# Constella — account-twin revenue intelligence for Creative Newtech

> **Creative Newtech × E-Cell IIT Bombay hackathon · Problem statement 1 — Beyond distribution.**
> Increase revenue per B2B partner and move CNL from selling individual products to selling integrated
> solutions and annuity, without growing sales headcount at the same pace as the portfolio.

Constella stitches every division's view of a partner into one **account twin**, predicts the next product,
solution or service plan that partner will buy, **routes** it to one accountable owner across divisions, makes it
easy to say yes (pitch, bill of materials, deal shape, credit), automates the follow-up, and **proves** the uplift
with a randomised control group.

## Run it

```bash
# backend — first start generates the synthetic network and trains the models (~12 s)
cd backend && uv run uvicorn app.main:app --port 8000 --reload
```

```bash
# frontend — http://localhost:5173 (proxies /api to :8000)
cd frontend && pnpm install && pnpm dev
```

Open http://localhost:5173, scroll the landing page, then **Take a seat** as one of six personas.
API docs: http://localhost:8000/docs. The copilot uses Claude (`claude-opus-5-5`) when `ANTHROPIC_API_KEY` is
set; otherwise a deterministic offline planner answers from the same tools.

## How it covers the five "what you need to do" points

| PS point | Where in Constella | Key files |
|---|---|---|
| **1 · Model the data** | Account twin: purchases, installed base, product relationships, credit, interactions, signals. Raw records from SAP B1 / Tally / Zoho / Excel unified by GSTIN → PAN → fuzzy name (99% precision). | `backend/app/models.py`, `data/unify.py`, `data/synth.py`, screen **Data unifier** |
| **2 · Detect the opportunity** | Gradient-boosted propensity + co-purchase lift + peer adoption + solution coverage + intent notes; time-split back-test vs 3 baselines; calibration; reason codes. Ladder: cross-sell → upsell → solution → annuity, ranked by value-at-stake. | `ml/features.py`, `ml/model.py`, `ml/opportunities.py`, screen **Model lab** |
| **3 · Capture & route** | One lead + assists with 70/30 split credit, overlap merge, capacity-aware routing, SLA ladder L1 nudge → L2 reassign → L3 head → L4 zero-touch nurture, full audit trail, cost-of-delay. | `routing/engine.py`, `services/ops.py`, opportunity dossier |
| **4 · Working prototype** | Six role-based workspaces (rep, head, architect, steward, partner) with inbox, today's 10 actions, whisper capture, solution composer, deal desk, credit & cash, automation playbooks, voice copilot. | `frontend/src/app/**` |
| **5 · Prove it works** | 20% stratified holdout, Monte-Carlo projection with 90% intervals, attribution rules, month-2/3/4/6 scale-or-stop gates, FY29 path simulator. | `services/pilot.py`, `services/insights.py`, screens **Pilot lab**, **BI & forecast** |

## Features at a glance

**Intelligence** — account twin (3D) · next-best product/solution/annuity · value-at-stake ranking · churn model
(time-split AUC ≈ 0.83–0.89) · next-order ETA · 6-month revenue forecast with interval · anomaly feed ·
division × industry penetration · brand portal · 3D product-universe graph · FY29 path (₹6,000 Cr / 40% brand mix).

**Action** — mission inbox with AI brief · today's 10 actions · AI-suggested campaigns with one-click launch ·
whisper capture (WhatsApp line → routed opportunity) · solution composer (BOM, GP, annuity, credit fit) ·
DaaS-ify deal shaping · deal desk (approval matrix + pocket-margin waterfall) · scheme-slab tracker ·
collections worklist · dynamic credit grades · NWC simulator · annuity ledger and renewal calendar.

**Automation & AI** — 8 playbooks (solution pod, SLA nudge, head digest, win→annuity, zero-touch renewal,
competitor price-match, credit→DaaS, morning brief) · scheduler · outbox · LangGraph copilot with RAG over
playbooks, role-specific behaviour and **voice** (speech in, speech out, hands-free).

**Security** — signed expiring tokens, RBAC per endpoint (agent included), territory scoping, GSTIN/PAN
masking, rate limiting, security headers, append-only audit log.

## Stack

FastAPI · SQLModel (SQLite, Postgres-ready) · pandas · scikit-learn · LangGraph · Anthropic SDK ·
React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · React Bits · React Three Fiber / drei / postprocessing ·
GSAP · Lenis · TanStack Query · Recharts.

## Documentation

- [docs/RESEARCH.md](docs/RESEARCH.md) — company research, personas, hidden problems, latest Q2 FY27 disclosures
- [docs/PROBLEMS.md](docs/PROBLEMS.md) — 155 stakeholder problems across 13 categories with platform answers
- [docs/FEATURES.md](docs/FEATURES.md) — every feature, the problem it answers and how it is calculated
- [design-system/constella/MASTER.md](design-system/constella/MASTER.md) — visual system (UI UX Pro Max)
- [docs/PROGRESS.md](docs/PROGRESS.md) — build log and next steps

## Data and sources

All partner data is **synthetic** (600 partners, 24 months, seeded). Company facts are cited from Creative
Newtech's public investor presentations and the Q2 FY27 earnings call; see `docs/RESEARCH.md`.
