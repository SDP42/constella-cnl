# Progress & handoff — Constella (CNL × E-Cell IIT Bombay, PS1)

_Last updated: 26 Nov 2026 (end of day 1)_

## How to run
```bash
# backend (first start builds the synthetic world + trains the model, ~10s)
cd backend && uv run uvicorn app.main:app --port 8000 --reload
# frontend
cd frontend && pnpm dev            # http://localhost:5173 (proxies /api to :8000)
```
API docs: http://localhost:8000/docs · Personas log in via `POST /api/auth/login {"persona": "priya|arjun|rakesh|meera|neha|vikram"}`.
Copilot uses Claude (`claude-opus-5-5`) when `ANTHROPIC_API_KEY` is set, otherwise the offline planner.

## Done (backend — complete and tested end to end)
- **Data model** (`app/models.py`): account twin, raw division records, transactions, installed base, interactions, signals, opportunities + event trail, audit log, automation rules, outbox, job runs.
- **Synthetic world** (`app/data/synth.py`): 600 partners, 24 months, latent needs, silos, seasonality, causal intent notes. EB ≈ 68% revenue share, matching CNL's investor deck.
- **Entity resolution** (`app/data/unify.py`): GSTIN → PAN → fuzzy name within city; precision 99.4%, recall 99.7%.
- **Model** (`app/ml/`): HistGradientBoosting propensity with a time-split back-test vs popularity / item-CF / association rules. AUC ≈ 0.82–0.84, avg precision +28% over popularity; calibration, gain curve, feature importance and reason codes.
- **Opportunity ladder**: cross-sell, upsell, solution (8 templates), annuity (attach + renewals), ranked by value-at-stake (margin × cash velocity × credit fit + 3-yr annuity).
- **Routing** (`app/routing/engine.py`): lead/assist 70/30 split credit, overlap merge, capacity overflow, escalation ladder L1–L4, cost-of-delay decay.
- **Services**: DaaS-ify deal shaping, whisper capture (note → signal → merged/new opportunity), 6-month pilot Monte Carlo with randomised holdout and scale/stop gates, SLA sweep.
- **Automation**: 8 rule playbooks (solution pod, SLA nudge, head digest, win→annuity, zero-touch renewal, competitor price-match, credit→DaaS, morning brief), outbox, asyncio scheduler, jobs API.
- **Agent**: LangGraph copilot (retrieve → plan → Claude tool loop / offline planner → PII guard) with TF-IDF RAG over `app/agent/kb/*.md`.
- **Security**: HMAC-signed expiring tokens, RBAC per role, territory scoping, GSTIN/PAN masking, rate limiting, security headers, audit log.

## Done (frontend — in progress)
- Vite + React 19 + TS, Tailwind v4, shadcn/ui (22 components), React Bits (8 components), R3F/drei, GSAP + Lenis, TanStack Query, zustand.
- **Design direction reset** after feedback (no grid lines, no generic dark dashboard): "Celestial Atlas", an editorial paper aesthetic derived with the UI UX Pro Max skill and CNL's own brand. See `design-system/constella/MASTER.md`.
- Written: theme tokens (`src/index.css`), `lib/api.ts`, `lib/auth.ts`, `lib/format.ts`, `lib/motion.ts` (Lenis + ScrollTrigger), `components/three/Orrery.tsx` (3D brass orrery: silos → twin → solution thread), `components/landing/WireTicker.tsx` (live WebSocket wire).
- `App.tsx` is still a placeholder; the landing page is not assembled yet. **The orrery has not been rendered or checked in the browser yet.**

## Next (day 2)
1. Assemble the landing page: pinned scroll chapters driving the orrery stage, journey (5 PS steps), live proof numbers, inventions list, persona seats, closing CTA. Check it in the browser.
2. Router + app shell (paper sidebar, command palette) and the persona screens: Rep Mission Inbox, Head Command Center, Account Twin (orrery with real data), Opportunity dossier (events, DaaS shaping), Solution Composer, Co-purchase graph, Model Lab, Data Unifier, Pilot Lab, Automation, Copilot, Partner view, Audit/Security.
3. Docs: README, DATA_MODEL, MODEL, ROUTING, PILOT, FEATURES, SECURITY, ARCHITECTURE; backend tests.
4. Optional: a licensed hero video. Needs per-file approval before download.
