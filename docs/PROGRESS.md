# Progress & handoff — Constella

_Last updated: 26 Nov 2026 (day 2)_

## Run
`cd backend && uv run uvicorn app.main:app --port 8000 --reload` · `cd frontend && pnpm dev` → http://localhost:5173

## Day 2 delivered
- **Research**: Q2 FY27 call (BharatNet ₹3,195 Cr, Infinova, Super Micro, CyberPowerPC AI, WOZOYO, AT&T, FY29 ₹6,000 Cr goal) → `docs/RESEARCH.md §7`; one research agent produced **155 problems / 13 categories** → `docs/PROBLEMS.md`.
- **Design**: four directions explored; user chose and then replaced the prism. Current (v4): realistic night globe hero (India, gold city lights, routing arcs, scroll zoom to Pune) + premium stone & gold app (UI UX Pro Max "Luxury/Premium" palette). `design-system/constella/MASTER.md`.
- **Backend**: catalogue extended with surveillance, fire safety, AI servers/workstations, drones, WOZOYO + 3 solution templates + brand bundles; BI (forecast, brand mix, penetration, anomalies, FY29 path), churn model, next-order ETA, AI campaign segments + launch, brand portal; credit grades, collections, NWC simulator, deal desk (approval matrix + margin waterfall), scheme slabs, annuity ledger, today's 10 actions; role-based copilot tools and prompts.
- **Frontend**: app shell (⌘K search, ⌘J copilot), 17 screens incl. 3D account twin and 3D product universe; role-based **voice copilot** (speech in/out, hands-free); "How this is calculated & why it matters" panels on key metrics.

## Next
1. Landing page refinement (user will review).
2. Remaining P1 ideas from PROBLEMS.md: stock-aware recommendations, GeM/tender tracker, partner self-serve proposal links, RMA/warranty signals.
3. Backend tests (pytest) and a short demo script.

## Day 3 — twins, maps, dynamic backend, PS scorecard (2026-11-26)

**New screens:** PS1 scorecard (live evidence + honest gaps per objective), Territory twin (Sentinel-2 / NASA night-lights globe map, 3D leakage columns, OSM demand scan), Site twin (3D room, owned vs gold-ghost missing devices), Learning loop (versions, feedback priors, ERP order ingest), Beat plan (NN + 2-opt route on satellite), Collections & cash (GBM pay-date model, DSO, 13-week cash).

**Backend:** order ingest (JSON/CSV) → attribution → online re-score; feedback Beta priors; champion/challenger retrain (nightly, after 25 orders, or manual); pretrained `bge-small-en-v1.5` embeddings (fastembed/ONNX) for hybrid RAG, semantic note intents and dedupe; model registry; synthetic AMC contracts sized to installed units (annuity ≈1.1% of revenue).

**Landing:** PS-led and lighter — NASA Blue Marble day/night globe hero → the brief (3 problems + goal) → five-point answer track → preview → live proof → seats.

**Final test (this build):** 46 GET endpoints × 5 roles all 200 (role 403s by design); 18 write flows pass (RBAC refusals correct); `pnpm build` clean; 26 app screens render with no console errors or horizontal overflow.

**Open before submission:** pytest suite, written deliverables (deck, MODEL/COMPLIANCE/PILOT_PLAN/DEMO_SCRIPT docs), OSM public Overpass is often overloaded (synthetic fallback is labelled).
