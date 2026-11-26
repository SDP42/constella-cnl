"""Lightweight job scheduler (asyncio). Production: Celery beat / Temporal / cloud scheduler."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import datetime

from sqlmodel import Session

from app.core.db import engine
from app.models import JobRun
from app.services import automation, ops
from app.state import state


def _sla(s: Session) -> str:
    events = ops.sla_sweep(s)
    return f"{len(events)} escalations"


def _rescore(_: Session) -> str:
    from app import pipeline

    pipeline.warm(verbose=False)
    return "model retrained and live whitespace re-scored"


JOBS: dict[str, dict[str, object]] = {
    "sla_sweep": {"fn": _sla, "every": "5 min", "desc": "Walk the escalation ladder for overdue opportunities"},
    "renewals": {"fn": lambda s: f"{automation.renewal_job(s)} renewal quotes sent", "every": "daily 08:00",
                 "desc": "Zero-touch renewal quotes 30 days ahead"},
    "daily_brief": {"fn": lambda s: f"{automation.daily_brief_job(s)} briefs sent", "every": "daily 09:00",
                    "desc": "WhatsApp morning brief per rep"},
    "outbox": {"fn": lambda s: f"{automation.drain_outbox(s)} messages delivered", "every": "30 s",
               "desc": "Deliver queued WhatsApp / email / webhook messages"},
    "attribution": {"fn": lambda s: "{matched} opportunities won by order matching (₹{value:,})".format(**__import__("app.api.labs", fromlist=["x"]).attribute_orders(s)),
                    "every": "hourly", "desc": "Match new orders to open opportunities (120-day window) and credit the owners"},
    "rescore": {"fn": _rescore, "every": "nightly 02:00", "desc": "Retrain model and re-score whitespace"},
}


def run_job(name: str) -> JobRun:
    fn: Callable[[Session], str] = JOBS[name]["fn"]  # type: ignore[assignment]
    with Session(engine) as s:
        jr = JobRun(job=name, started_at=state.now)
        try:
            jr.summary = fn(s)
        except Exception as e:  # noqa: BLE001 — job failures are recorded, never crash the loop
            jr.status, jr.summary = "failed", str(e)[:300]
        jr.finished_at = datetime.now()
        s.add(jr)
        s.commit()
        s.refresh(jr)
        return jr


async def loop(stop: asyncio.Event) -> None:
    tick = 0
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=30)
        except TimeoutError:
            pass
        if stop.is_set():
            break
        tick += 1
        await asyncio.to_thread(run_job, "outbox")
        if tick % 10 == 0:
            await asyncio.to_thread(run_job, "sla_sweep")
