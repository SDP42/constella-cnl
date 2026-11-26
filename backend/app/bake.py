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
    from fastapi.testclient import TestClient

    from app import pipeline
    from app.core.db import init_db
    from app.main import PREWARM, app

    t0 = time.time()
    init_db()
    pipeline.warm(use_baked=False)
    client = TestClient(app)  # not a context manager: the lifespan (and its prewarm thread) does not run
    token = client.post("/api/auth/login", json={"persona": "rakesh"}).json()["token"]
    for path in PREWARM:
        r = client.get(path, headers={"Authorization": f"Bearer {token}"})
        print(f"[bake] {r.status_code} {path}")
    joblib.dump({"live": state.live, "cooc": state.cooc, "cache": state.cache}, WARM_PATH, compress=3)
    print(f"[bake] saved {len(state.cache)} cached results to {WARM_PATH.name} in {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    bake()
