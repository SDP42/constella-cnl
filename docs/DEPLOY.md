# Deploying Constella: API on Render (free), web on Vercel (free)

```
Browser ──► Vercel (React static build)
              ├─ /api/*  ──rewrite──►  Render web service (FastAPI, lite mode)
              └─ wss://constella-cnl.onrender.com/api/ws/live   (live feed, direct)
```

## Why it fits Render's free plan (512 MB RAM, 0.1 CPU)

| Measurement (peak RSS) | Full mode | Lite mode (`CONSTELLA_LITE=true`) |
|---|---|---|
| Start-up | ~364 MB, trains ~15 s | **~264 MB, loads saved model in ~3 s** |
| Peak: all heavy pages + copilot + pilot + retrain | ~527 MB | **~409 MB** |

What lite mode changes:

- **No pretrained embedding model.** Semantic intent, RAG and dedupe fall back to TF-IDF and the keyword lexicon. This saves ~130 MB.
- **Database, model and heavy pages built at build time.** `python -m app.pipeline` writes `data/constella.db` and `data/model.joblib`; `python -m app.bake` computes the live scores and the 13 heaviest pages and saves them to `data/warm.joblib`. The free instance only loads them (start ~2.6 s, ~258 MB, heavy pages answer in milliseconds).
- **Health check never waits.** `/api/health` is async and skips rate limits and the audit log, so Render's 5-second check is answered even while a heavy request runs.
- **Lazy imports.** The Anthropic SDK and LangGraph load only when the copilot is first used (~55 MB saved at start).
- **Single worker,** and `MALLOC_ARENA_MAX=2` to limit glibc memory fragmentation.

Free-plan caveats:

- The service sleeps after 15 minutes idle. The first request after that takes ~30–60 s.
- The filesystem is ephemeral, so demo writes (feedback, ingested orders) reset on restart. The demo data is rebuilt deterministically at every deploy.
- Avoid Render's free Postgres: it expires after 30 days. SQLite is enough for the demo.

## 1. Backend on Render

1. Push the repo to GitHub (already at `SDP42/constella-cnl`).
2. In Render, go to **New → Blueprint**, pick the repo, and Render reads [`render.yaml`](../render.yaml).
3. It creates `constella-cnl` (free, region Singapore) with:
   - build: `pip install uv && uv sync --frozen --no-dev && uv run python -m app.pipeline && uv run python -m app.bake`
   - start: `.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`
   - env: `CONSTELLA_LITE=true`, a generated `CONSTELLA_SECRET_KEY`, `PYTHON_VERSION=3.12.7`, and optionally `ANTHROPIC_API_KEY`
4. Check `https://constella-cnl.onrender.com/api/health`. If Render gives a different hostname, use it in step 2 below.

## 2. Frontend on Vercel

1. In Vercel, go to **Add New → Project**, import the repo, and set **Root Directory = `frontend`**. Vercel reads [`frontend/vercel.json`](../frontend/vercel.json).
2. In `vercel.json`, the rewrite sends `/api/*` to the Render URL (edit the hostname if yours differs). Calls stay same-origin, so no CORS setup is needed.
3. Environment variable (Production): `VITE_WS_URL = wss://constella-cnl.onrender.com/api/ws/live`. Vercel cannot proxy WebSockets; the live feed is optional and backs off when the API is asleep.
4. Deploy. Then add the Vercel URL to `CONSTELLA_CORS_ORIGINS` on Render if you ever call the API directly (via `VITE_API_URL`).

## 3. Keeping the demo awake (optional)

One free web service uses at most ~744 of the 750 free instance-hours a month, so a pinger is safe. Use an external monitor (for example UptimeRobot) on `/api/health` every 10 minutes during judging days.

## Local check of lite mode

```bash
cd backend && CONSTELLA_LITE=true uv run uvicorn app.main:app --port 8000
```
