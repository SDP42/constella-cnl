"""Build-time bake for small hosts: compute the heavy pages once on the build machine and save the results.

Render's free instance has 0.1 CPU. Computing the live scores and the BI caches there after every wake-up
takes minutes and starves the health check. The build machine is much faster, the database and model are
fixed at build time, and the demo clock is deterministic, so the results are identical. They are saved to
``data/warm.joblib`` and loaded at start-up by ``pipeline.warm``.

Run after ``python -m app.pipeline``:  ``python -m app.bake``
"""

from __future__ import annotations

import time
from pathlib import Path

import joblib

from app.core.config import get_settings
from app.state import state

settings = get_settings()
WARM_PATH = Path(settings.model_path).with_name("warm.joblib")


def bake() -> None:
    import json

    from fastapi.testclient import TestClient
    from sqlmodel import Session, func, select

    from app import pipeline
    from app.core import respcache
    from app.core.db import engine, init_db
    from app.main import PREWARM, app
    from app.models import AuditLog

    t0 = time.time()
    init_db()
    pipeline.warm(use_baked=False)
    settings.rate_limit_per_min = settings.login_rate_limit_per_min = 10**6  # this process only: replay every screen
    with Session(engine) as s:
        audit_before = s.exec(select(func.max(AuditLog.id))).one() or 0
    client = TestClient(app)  # not a context manager: the lifespan (and its prewarm thread) does not run
    token = client.post("/api/auth/login", json={"persona": "rakesh"}).json()["token"]
    for path in PREWARM:
        r = client.get(path, headers={"Authorization": f"Bearer {token}"})
        print(f"[bake] {r.status_code} {path}")
    # replay what each seat's screens request (recorded by scripts/record_bake_routes.py) into the response cache
    respcache.clear()
    routes = json.loads((Path(__file__).with_name("bake_routes.json")).read_text())
    for persona, paths in routes.items():
        auth = {} if persona == "public" else {"Authorization": "Bearer " + client.post("/api/auth/login", json={"persona": persona}).json()["token"]}
        ok = 0
        for p in paths:
            for enc in ("gzip, deflate", "identity"):
                ok += client.get(p, headers={**auth, "Accept-Encoding": enc}).status_code == 200
        print(f"[bake] {persona}: {ok}/{2 * len(paths)} responses cached", flush=True)
    with Session(engine) as s:  # the replay is not real user activity: keep the audit log clean
        for row in s.exec(select(AuditLog).where(AuditLog.id > audit_before)).all():
            s.delete(row)
        s.commit()
    joblib.dump({"live": state.live, "cooc": state.cooc, "cache": state.cache, "resp": respcache.export()}, WARM_PATH, compress=3)
    print(f"[bake] saved {len(state.cache)} results + {respcache.size()} responses to {WARM_PATH.name} in {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    bake()
