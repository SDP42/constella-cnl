# Features — what each one does, which problem it answers, and how it is calculated

Problem IDs refer to [PROBLEMS.md](PROBLEMS.md). Screens are under `/app/*` after choosing a seat.

| Feature | Screen | Problem(s) answered | How it works |
|---|---|---|---|
| Account twin (3D disc stack) | Account twins → partner | Data & visibility (DV), wallet share (OD) | One golden record per partner; discs = divisions, thickness = spend share, glass = whitespace pulsing with model probability |
| Entity resolution | Data unifier | DV — duplicate partners across ERPs | GSTIN exact → PAN → fuzzy name within city (rapidfuzz token-set + initials); review queue for 72–86 scores |
| Next-best opportunity | Inbox, Account twin, Model lab | OD — no systematic way to spot needs | HistGradientBoosting on 24 point-in-time features; time-split back-test vs popularity, item-CF and association rules |
| Value-at-stake ranking | Everywhere opportunities are listed | PM, CW — revenue-only targets burn margin and cash | P(win) × gross margin × 1/(1+WC days/60) × credit fit + P × 3-yr annuity margin |
| Solution detection & composer | Inbox, Solution composer | SS — bundles invisible across divisions | 11 templates; coverage of required components; BOM skips owned items; GP, ARR and credit fit |
| Annuity ladder & ledger | Annuity ledger | AN — recurring revenue invisible | Installed base without service plan → attach opportunity; ARR, NRR, attach rate, 90-day renewals |
| Routing contract | Opportunity dossier | RO — ownership, hoarding | Lead division rules, owner-first, capacity overflow, 70/30 split credit, overlap merge |
| SLA ladder & cost of delay | Command center, dossier | RO — opportunities rot | L1–L4 escalation; value-at-stake decays with a kind-specific half-life, shown as ₹/day |
| Whisper capture | Inbox | OD — intent dies in WhatsApp | Keyword lexicon → categories, quantity, timing, competitor; merges into existing opp or creates & routes |
| Today's 10 actions | Inbox, copilot | People & productivity | Quota-balanced mix of deals (cost of delay), SLA breaches, predicted reorders, churn calls, scheme slabs |
| AI campaigns | Inbox | OD, AN | Segments: bundle gaps (Honeywell→WOZOYO, display→AMC…), season, win-back, one-component-from-solution, DaaS |
| Churn radar | Inbox, BI | OD — leakage to other distributors | Logistic regression on recency, trend, frequency, negative notes, payment days, credit use; time-split AUC |
| Next-order ETA | Inbox | SC — reorders missed | Median inter-order gap per partner; overdue flags |
| Revenue forecast | BI & forecast | Planning | Log-linear trend + 2-harmonic seasonality (ridge OLS), 80% interval, back-tested MAPE shown |
| FY29 path | BI & forecast | Leadership goal | Sample scaled to CNL FY26 revenue; sliders for growth, Constella uplift, brand-mix gain vs ₹6,000 Cr / 40% |
| Brand portal | Brand portal | Brand principals (BP) | Per-brand 12m revenue, growth, penetration, whitespace partners — basis for MDF talks |
| Credit grades & limits | Credit & cash | CW — static limits | Score = 40% payment days + 25% utilisation + 20% momentum + 15% retention; A–E; limit ±10–25% |
| Collections worklist | Credit & cash | CW — rising debtor days | Overdue estimate × (1 + churn risk); action ladder |
| NWC simulator | Credit & cash | CW | NWC = DSO + DIO − DPO; cash released = Δdays × revenue/365 |
| Deal desk | Deal desk | PM — discounts erode margin | Pocket-margin waterfall (discount, scheme rebate, freight, cost of credit); ≤3% rep, ≤6% head, else CFO |
| Scheme-slab tracker | Inbox | PM — unclaimed brand schemes | QTD turnover vs brand slabs; ₹ gap and rebate gained |
| DaaS-ify | Dossier | CW, AN | 36-month NBFC-funded plan: hardware margin now + service annuity |
| Automation playbooks | Automation | Scale without headcount | 8 rules, outbox, scheduler; hours saved and FTE-equivalent |
| Role-based voice copilot | Everywhere (⌘J) | People & productivity | LangGraph (retrieve → plan → act → guard); role briefs & suggestions; speech in/out |
| Pilot lab | Pilot lab | PS point 5 | 20% stratified holdout; Monte Carlo; uplift CIs; scale/stop gates |
| Security & audit | Security & audit | Compliance & risk (CR) | HMAC tokens, RBAC, territory scope, PII masking, rate limits, audit log |
