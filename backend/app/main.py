"""Constella API — FastAPI entrypoint."""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session

from app.api import accounts, agent, automation, finance, geo, insights, labs, opportunities, platform
from app.core.config import get_settings
from app.core.db import engine, init_db
from app.core.security import SECURITY_HEADERS, limiter
from app.models import AuditLog
from app.state import state

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    db_path = settings.database_url.replace("sqlite:///", "")
    from app import pipeline

    if settings.rebuild_on_start or (settings.database_url.startswith("sqlite") and not Path(db_path).exists()):
        await asyncio.to_thread(pipeline.build)
    else:
        init_db()
        await asyncio.to_thread(pipeline.warm)
    from app.services import scheduler

    if settings.lite:
        # small hosts (0.1 CPU): compute the heavy pages once, one at a time, before users ask for them
        asyncio.create_task(asyncio.to_thread(_prewarm))
    stop = asyncio.Event()
    task = asyncio.create_task(scheduler.loop(stop))
    yield
    stop.set()
    await task


PREWARM = ["/api/public/stats", "/api/public/network", "/api/dashboard/head", "/api/proof/scorecard", "/api/money/collections",
           "/api/growth/overview", "/api/bi/overview", "/api/team/overview", "/api/ops/overview", "/api/trust/overview",
           "/api/geo/territory", "/api/brands", "/api/model/metrics"]


def _trim() -> None:
    """Return freed memory to the OS (glibc keeps it otherwise) — matters on 512 MB instances."""
    import ctypes
    import gc

    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except OSError:  # not glibc (e.g. macOS)
        pass


def _prewarm() -> None:
    import json
    import os
    import time as _t
    import urllib.request

    base = f"http://127.0.0.1:{os.environ.get('PORT', '8000')}"
    for _ in range(60):  # wait until uvicorn accepts connections
        try:
            urllib.request.urlopen(base + "/api/health", timeout=5)
            break
        except Exception:  # noqa: BLE001
            _t.sleep(2)
    try:
        req = urllib.request.Request(base + "/api/auth/login", data=json.dumps({"persona": "rakesh"}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        token = json.loads(urllib.request.urlopen(req, timeout=60).read())["token"]
    except Exception:  # noqa: BLE001
        return
    for path in PREWARM:
        _t.sleep(1.5)  # leave gaps so health checks and real users are never starved on 0.1 CPU
        try:
            urllib.request.urlopen(urllib.request.Request(base + path, headers={"Authorization": f"Bearer {token}"}), timeout=120).read()
        except Exception:  # noqa: BLE001 — best effort
            pass
        _trim()
    print("[constella] prewarm complete", flush=True)


app = FastAPI(
    title="Constella API",
    version="1.0.0",
    description="Account-twin revenue intelligence for Creative Newtech — detect, route and prove "
                "cross-sell, solution and annuity opportunities across divisions.",
    lifespan=lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])


@app.middleware("http")
async def guard(request: Request, call_next):
    ip = request.client.host if request.client else "?"
    path = request.url.path
    if path == "/api/health":  # keep the health check out of rate limits and DB writes
        return await call_next(request)
    if path.startswith("/api") and not limiter.allow(ip, "api", settings.rate_limit_per_min):
        return JSONResponse({"detail": "rate limit exceeded"}, status_code=429, headers={"Retry-After": "10"})
    response = await call_next(request)
    if settings.lite and request.method == "POST":
        _trim()
    if path.startswith("/api"):
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
    sensitive_read = path.startswith(("/api/data", "/api/audit")) or (path.startswith("/api/accounts/") and request.method == "GET")
    if path.startswith("/api") and (request.method != "GET" or sensitive_read) and path != "/api/auth/login":
        p = getattr(request.state, "principal", None)
        with Session(engine) as s:
            s.add(AuditLog(ts=state.now, actor=p.name if p else "anonymous", role=p.role if p else "-",
                           method=request.method, path=path, status=response.status_code, ip=ip))
            s.commit()
    return response


app.include_router(platform.router)
app.include_router(opportunities.router)
app.include_router(accounts.router)
app.include_router(automation.router)
app.include_router(agent.router)
app.include_router(insights.router)
app.include_router(finance.router)
app.include_router(labs.router)
app.include_router(geo.router)


@app.get("/api/health", tags=["platform"])
async def health() -> dict:
    # async on purpose: answered on the event loop, never queued behind heavy work in the thread pool
    return {"status": "ok", "model_ready": state.model is not None, "now": state.now.isoformat()}


@app.websocket("/api/ws/live")
async def live(ws: WebSocket) -> None:
    """Streams detected signals (simulated ingest) to the landing page and command center."""
    await ws.accept()
    try:
        while True:
            with Session(engine) as s:
                evt = platform.random_live_event(s)
            await ws.send_text(json.dumps(evt, default=str))
            await asyncio.sleep(2.2)
    except (WebSocketDisconnect, RuntimeError):
        return
