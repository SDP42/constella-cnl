# Constella — Problem Inventory for Creative Newtech (PS1)

Problem statement 1 asks how Creative Newtech Limited (CNL) can **raise revenue per B2B customer (wallet share)**, **move from single products to integrated solutions and recurring/annuity revenue**, and do it **without adding sales headcount at the same rate as the portfolio grows**.

This document lists **155 concrete problems** felt by CNL leadership and staff, its divisions (Enterprise, FMSG, FMCT, FMEG, Honeywell licensing, WOZOYO, SI/projects), its 10,000+ channel partners, its 25+ brand principals, and end customers. Each problem has an owner persona, why it matters, a concrete software answer, and a priority:

- **P1**: high impact and feasible in a hackathon prototype using synthetic or exported data
- **P2**: high impact, needs integrations or more data than a prototype has
- **P3**: useful, but niche, slow to show value, or mostly a process or policy fix

**Anchor facts.** Q2 FY27 consolidated revenue was ₹752.14 Cr (+14.4% YoY) and PAT about ₹25.9 Cr ([Univest](https://univest.in/blogs/creative-newtech-q2-results-fy27-pat-26-crore); [Q2 FY27 call transcript](https://nsearchives.nseindia.com/corporate/CREATIVE_03112026073058_Transcript_CreativeNewtech-Oct29-2026.pdf)). Net working capital days were 45 in H1 FY27, down from 75 in FY26, with steady-state guidance of about 50–55 ([Sovrenn concall summary](https://www.sovrenn.com/concall-summary/creative-newtech)). Brand business was about 17% of H1 revenue against a 40% FY29 target, at roughly 40–42% gross margin ([Sovrenn](https://www.sovrenn.com/concall-summary/creative-newtech)). Screener shows debtor days rising from 50.3 to 78.7 ([Screener](https://www.screener.in/company/CREATIVE/consolidated)). Peers run on thin margins too: Redington's FY24 operating margin was 2.6% and its net margin 1.4% ([ICRA](https://www.icra.in/Rating/GetRationalReportFilePdf?id=138133)). Rashi Peripherals is buying 67% of VDA Infosolutions to move into managed services ([CRN Asia](https://www.crnasia.com/india/news/2026/rashi-peripherals-moves-beyond-distribution-with-vda-infosolutions-acquisition)).

> Numbers without a link are working estimates for the prototype. They are labelled "est." and should be checked against CNL data.

---

## Summary by category

| # | Category | Code | Count | P1 | P2 | P3 |
|---|---|---|---|---|---|---|
| 1 | Data & visibility | DV | 13 | 7 | 5 | 1 |
| 2 | Opportunity detection & wallet share | OD | 13 | 8 | 4 | 1 |
| 3 | Solution selling & BOM | SS | 12 | 6 | 4 | 2 |
| 4 | Pricing, margin & schemes | PM | 12 | 4 | 6 | 2 |
| 5 | Credit & working capital | CW | 13 | 6 | 5 | 2 |
| 6 | Routing, ownership & incentives | RO | 11 | 5 | 4 | 2 |
| 7 | Partner experience & self-serve | PX | 13 | 5 | 6 | 2 |
| 8 | Annuity, service & renewals | AN | 12 | 5 | 5 | 2 |
| 9 | Supply chain, stock & logistics | SC | 12 | 3 | 6 | 3 |
| 10 | Government / SI projects & tenders | GP | 11 | 3 | 5 | 3 |
| 11 | Brand principals, licensing & D2C | BP | 12 | 5 | 4 | 3 |
| 12 | Compliance, security & risk | CR | 11 | 3 | 5 | 3 |
| 13 | People & productivity | PP | 10 | 4 | 4 | 2 |
| | **Total** | | **155** | **64** | **63** | **28** |

---

## 1. Data & visibility (DV)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| DV-01 | No single view of a partner across divisions | CMD, division heads, KAMs | One partner may buy Enterprise cabling, FMSG cameras and FMCT peripherals through different teams, so its total wallet and cross-sell gaps stay hidden. | A 360° partner profile that joins ERP invoices from every division into one account card showing a "category coverage" heatmap. | P1 |
| DV-02 | Duplicate and fragmented partner masters (same GSTIN, many codes) | MIS, finance, sales ops | With 10,000+ partners across 31+ branches, duplicates inflate the partner count and split credit limits and history (est. 5–10% duplicates). | GSTIN/PAN-based entity resolution with fuzzy name and address matching, plus a merge-review queue. | P1 |
| DV-03 | SKU taxonomy differs across 25+ brands and 5,000+ SKUs | Category managers, analysts | Without a common category tree (e.g. "Cat6 cabling", "action camera") you cannot compute share of category or recommend substitutes. | An auto-classifier that maps vendor SKUs to a unified taxonomy, with human confirmation of low-confidence matches. | P1 |
| DV-04 | Sell-in is visible, sell-through and sell-out are not | Brand managers, principals | CNL sees what partners buy, not what they resell, so it cannot tell real demand from channel stuffing. | Lightweight sell-out capture (partner upload, POS/marketplace API, Tally connector) with stock-in-channel estimation. | P2 |
| DV-05 | Leadership dashboards are spreadsheet-driven and lag by weeks | CMD, CFO | Decisions toward the ₹6,000 Cr FY29 target need daily, not month-end, signals on mix, margin and NWC. | A live BI cockpit (revenue, GM by segment, brand share, NWC days, top movers) refreshed from ERP extracts. | P1 |
| DV-06 | No measure of wallet share per partner | Sales leadership | Revenue per customer cannot be managed without knowing the estimated total spend (wallet) and CNL's share of it. | A wallet-size model (partner type, size, GST turnover band, peer benchmarks) that outputs "share of wallet %" and headroom in ₹. | P1 |
| DV-07 | Partner firmographics are missing or stale | KAMs, credit | Segment, employee count, verticals served and end-customer types are rarely recorded, which weakens targeting. | Enrichment from GSTIN, MCA and website signals, plus a 3-question nudge to the KAM after each visit. | P2 |
| DV-08 | Lost-sale and enquiry data never gets recorded | Inside sales, branches | Quotes that did not convert ("no stock", "price high") are the best signal for assortment and pricing, but they live in WhatsApp. | Quote and enquiry logging from WhatsApp/email with lost-reason tags and a weekly "demand we missed" report. | P1 |
| DV-09 | Margin is known only at invoice level, not net of schemes, freight and returns | CFO, division heads | Distributor net margins of about 1–3% ([ICRA](https://www.icra.in/Rating/GetRationalReportFilePdf?id=138133)) mean an unseen freight or RMA cost can turn a deal loss-making. | Pocket-margin waterfall per invoice, partner and SKU (list → invoice → scheme → freight → returns → credit cost). | P1 |
| DV-10 | Acquired companies (Infinova, Ravel, Drona) run on separate systems | CFO, integration PMO | Acquisitions bring new customers and cross-sell potential, which is lost if data stays siloed; integration risk is already flagged ([Multibagg](https://www.multibagg.ai/market-pulse/articles/q1-fy27-update-97162)). | An integration data hub that maps acquired customer lists to the CNL master and flags overlaps and whitespace. | P2 |
| DV-11 | Branch-level performance is hard to compare fairly | Regional heads | Branches differ in mix and market, so raw revenue rankings mislead and demotivate. | Peer-normalised branch scorecards (per-partner revenue, category breadth, DSO, margin) with like-for-like cohorts. | P2 |
| DV-12 | No event stream of partner behaviour (logins, quotes, payments) | Product, analytics | Without behavioural events, churn and propensity models depend only on lagging invoices. | A unified event log (orders, payments, portal activity, service tickets) feeding the models. | P2 |
| DV-13 | Data quality issues get noticed only at audit or quarter close | Finance, MIS | Wrong HSN codes, missing PIN codes and bad credit terms cause rework and compliance exposure. | Data-quality rules with a daily DQ score and an owner-assigned fix list. | P3 |

## 2. Opportunity detection & wallet share (OD)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| OD-01 | Cross-sell opportunities are found by memory, not data | KAMs, inside sales | With 25+ brands, no rep can remember which partner should also buy Lexar with Insta360, or Honeywell racks with cabling. | A next-best-product recommender (basket affinity plus peer-cohort gaps) with a reason string per suggestion. | P1 |
| OD-02 | Partners about to churn go unnoticed until orders stop | KAMs, branch heads | Win-back costs more than retention. A 90-day order gap often shows up only in the quarterly review. | A churn-risk score (recency, frequency, monetary trend, payment delay, category shrink) with early-warning alerts. | P1 |
| OD-03 | No prediction of when a partner will reorder | Inside sales | Calling at the right moment beats calling often. Reps waste calls on partners who are not ready to buy. | Next-order ETA per partner and category, used to build a daily call list. | P1 |
| OD-04 | Peer benchmarks are not used to set expectations | Sales managers | "Partners like you buy 4 categories; you buy 1" is persuasive, but nobody computes it. | Look-alike cohorts with "partners like you also buy" gap cards that KAMs can share with partners. | P1 |
| OD-05 | Anomalies (sudden drop, spike or mix shift) are missed | Division heads | A big partner dropping 40% month on month can mean a competitor win, a credit block or a stock issue, and each needs a different response. | Anomaly detection on partner × category revenue, with root-cause hints (credit hold, stock-out, price change). | P1 |
| OD-06 | Upsell from consumer to enterprise grade is not prompted | KAMs | Partners selling Cooler Master cases could sell CyberPowerPC "AI in a box" workstations into BFSI at a much higher ticket. | Upgrade-path rules (good → better → best, SMB → enterprise) that fire when a partner's end-customer mix changes. | P2 |
| OD-07 | New brand launches lack a ready target list | Brand managers | Launches like Honeywell fibre cables or Infinova cameras ([Sovrenn](https://www.sovrenn.com/concall-summary/creative-newtech)) need the 500 partners most likely to adopt on day one. | A launch-targeting engine that ranks partners by propensity (adjacent-category buying, vertical, geography). | P1 |
| OD-08 | Dormant partners in the long tail get no attention | Inside sales, marketing | Most of the 10,000+ partners are low-touch (est. 70%+ of the count, under 20% of revenue), and many could be reactivated cheaply. | An automated reactivation campaign (WhatsApp offer plus scheme) for dormant cohorts, with conversion tracking. | P1 |
| OD-09 | Seasonal and festival demand is not used for proactive pitching | FMSG/FMCT sales | Instax, gadgets and audio peak around Diwali, weddings and the gifting season, and partners stock too late. | Seasonal pre-book campaigns triggered by last year's curve per partner. | P2 |
| OD-10 | End-customer projects behind partner orders are invisible | Enterprise KAMs | An SI ordering cabling may be building a full site (racks, UPS, surveillance), which is a solution opportunity. | A "project signal" detector (unusual quantities, mixed categories, delivery to a site) prompting a solution call. | P2 |
| OD-11 | Wallet headroom is not turned into ₹ targets per partner | Sales leadership | Targets set as "last year + 15%" ignore headroom, so they over-push saturated partners and under-push high-headroom ones. | Headroom-based target suggestions per partner and category, which the KAM can accept or edit. | P1 |
| OD-12 | Competitor wins are not captured | KAMs, strategy | Losing to Redington, Ingram, Savex or Rashi on price, credit or availability needs different fixes. | Lost-to-competitor tagging plus a competitive heatmap by category and region. | P2 |
| OD-13 | Retail chains' (Croma, Reliance) planogram and assortment gaps are not analysed | Modern trade KAM | Each missing SKU in a store cluster is lost sell-out for both CNL and the brand. | Store-cluster assortment gap analysis from sell-out feeds. | P3 |

## 3. Solution selling & BOM (SS)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| SS-01 | Building a multi-brand solution quote takes days | Presales, SIs | A surveillance + cabling + UPS + storage site BOM spans 4–6 brands. Slow quotes lose deals to faster SIs. | A solution configurator with templates (smart classroom, CCTV site, AI workstation, branch network) that outputs a priced BOM in minutes. | P1 |
| SS-02 | BOM compatibility errors (wrong connectors, under-sized UPS) cause returns | Presales, partners | One missing patch panel or under-rated PSU delays installation and erodes trust. | Rule-based compatibility checks (port counts, power budget, cable length) with auto-added accessories. | P1 |
| SS-03 | Partners do not know CNL sells complete solutions | SIs, resellers | Partners see CNL as a box-mover for one brand and source the rest elsewhere, which caps wallet share. | A partner-facing solution catalogue with bundles, reference designs and "add to quote". | P1 |
| SS-04 | No bundle pricing logic | Pricing, presales | Bundles need a combined margin target, not the sum of single-SKU prices, otherwise they are uncompetitive or margin-negative. | Bundle pricing engine with a target blended margin and per-component floor checks. | P1 |
| SS-05 | CyberPowerPC "AI in a box" positioning lacks sizing tools | BFSI-facing partners | BFSI buyers ask "which GPU/RAM for our on-prem LLM?" and partners cannot answer. | A workload sizing wizard (model size, users, latency) that recommends a workstation configuration plus storage, UPS and support. | P1 |
| SS-06 | Super Micro data-centre deals need specialist presales | Enterprise presales | DC deals are high ticket but rare, and CNL's presales bench is thin. | A guided DC BOM builder plus an expert-on-call request queue that tracks presales capacity. | P2 |
| SS-07 | Solution wins are not reused as playbooks | Presales, marketing | Each win (e.g. a Jio Studios content-creation setup) is a template for similar customers, but it stays in a deck on someone's laptop. | A win-library that turns closed solution deals into searchable templates with vertical tags. | P1 |
| SS-08 | Attach of accessories and services to hardware is low | KAMs | Accessories and extended warranty carry the highest margins, but reps forget to attach them. | An attach-rate prompt in the quote flow plus attach-rate leaderboards. | P2 |
| SS-09 | Honeywell portfolio (cabling, connectivity, air purifiers, audio) is sold as separate lines | Honeywell brand team | Selling "Honeywell for the whole office" raises ticket size and brand share toward the 40% goal. | Cross-line Honeywell bundles (structured cabling + air purifiers + conferencing audio) for office fit-outs. | P2 |
| SS-10 | Site survey and design data is not captured digitally | SIs, field engineers | Paper surveys cause BOM rework and disputes. | A mobile site survey form (photos, measurements, port counts) feeding the configurator. | P2 |
| SS-11 | Solution proposals look different every time and are weak on value | Presales | Partners need a customer-ready proposal (scope, TCO, ROI) to win against single-box quotes. | A one-click branded proposal and TCO document generated from the BOM. | P3 |
| SS-12 | Integration and installation services are not priced in | Presales, SIs | Labour and commissioning are often given away free, which destroys solution margin. | Service SKUs (install, configure, AMC) added to every solution template with standard rate cards. | P3 |

## 4. Pricing, margin & schemes (PM)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| PM-01 | Discount approvals go over phone and WhatsApp with no guardrails | KAMs, managers | Ad-hoc discounting on 1–3% net margin businesses ([ICRA](https://www.icra.in/Rating/GetRationalReportFilePdf?id=138133)) can wipe out a quarter's profit. | A deal desk with floor prices, approval matrix by margin band, and an audit trail. | P1 |
| PM-02 | Vendor schemes (slab, target, sell-out) are tracked in Excel | Scheme team, finance | Missed slab targets or unclaimed back-end money can cost several basis points of margin (est.). | A scheme engine that tracks progress to slab per partner and SKU, with projected payout and claim status. | P1 |
| PM-03 | Partners do not know how close they are to a scheme slab | Partners | A partner 8% short of the next slab would buy more if told, which is an easy upsell. | A "you are ₹X from the next slab" nudge in the portal and on WhatsApp. | P1 |
| PM-04 | MDF and co-op funds go unclaimed | Brand managers, partners | Industry commentary suggests a large share of MDF goes unused, often cited as about 60%, because claims are cumbersome ([360insights](https://www.360insights.com/blog/your-channel-partners-arent-using-their-mdf-or-co-op.-heres-why)). | An MDF workflow: pre-approval, proof upload, claim tracking, and a fund balance per partner. | P2 |
| PM-05 | Price protection on vendor price drops is not passed on or claimed correctly | Finance, partners | A missed price-protection claim on in-channel stock is a direct loss. | Price-drop detector that computes eligible stock and auto-drafts claims to vendor and credit notes to partners. | P2 |
| PM-06 | Same SKU priced differently across branches without reason | Pricing, branch heads | Inconsistent pricing invites arbitrage between partners and hurts trust. | Price-dispersion report with outlier alerts per SKU and region. | P2 |
| PM-07 | No price elasticity understanding | Category managers | Without elasticity, discounts are guesses, which over-discounts inelastic SKUs. | An elasticity estimate per category from historical price and volume, shown in the deal desk. | P3 |
| PM-08 | Marketplace and quick-commerce prices undercut B2B channel prices | FMCT/FMSG partners | Channel partners stop stocking a brand when Amazon or Blinkit sells it below their landing cost. | MAP (minimum advertised price) monitoring across marketplaces with violation alerts. | P2 |
| PM-09 | Partner-specific price lists are hard to maintain | Pricing ops | Thousands of partner-tier-SKU combinations get out of date after every vendor price change. | Tiered price-list generator with rules (tier, volume, region) and automatic publishing. | P2 |
| PM-10 | Hidden cost-to-serve makes small partners unprofitable | CFO | Small, frequent orders with long credit and high freight can be loss-making (est. 15–25% of tail partners). | Cost-to-serve model per partner that recommends minimum order value or consolidated delivery. | P1 |
| PM-11 | Currency moves on imported brands are not reflected in prices quickly | Pricing, CFO | Most FMSG/FMCT brands are imported, so INR/USD moves and freight spikes (Middle East routes) compress margin. | FX and freight-indexed landed-cost calculator with reprice alerts. | P2 |
| PM-12 | Scheme effectiveness is never measured | Brand principals, CNL | Schemes that only subsidise volume partners would have bought anyway waste money. | Scheme ROI analysis (incremental lift vs control cohort). | P3 |

## 5. Credit & working capital (CW)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| CW-01 | Credit limits are static and not risk-based | Credit team | Debtor days rose from 50.3 to 78.7 ([Screener](https://www.screener.in/company/CREATIVE/consolidated)) and higher partner credit is driving working-capital needs ([Multibagg](https://www.multibagg.ai/market-pulse/articles/q1-fy27-update-97162)). | A dynamic credit score (payment behaviour, GST filing regularity, order trend) recommending limit changes. | P1 |
| CW-02 | Orders get stuck on credit hold and sales lose the deal | KAMs, partners | Every hour on hold risks the partner buying from a competitor that has stock and limit. | Real-time credit-hold alerts with one-tap "pay ₹X to release" links and auto-release on payment. | P1 |
| CW-03 | Collections are done by calling everyone, not by priority | Collections team | Collection effort should go to large, overdue, at-risk balances first. | A collections worklist ranked by amount × days overdue × risk, with WhatsApp reminders and promise-to-pay tracking. | P1 |
| CW-04 | NWC gains (75 → 45 days) may slip back as project business grows | CFO | Management guides to 50–55 days steady state ([Sovrenn](https://www.sovrenn.com/concall-summary/creative-newtech)), and the BharatNet SI order is milestone-paid. | An NWC simulator showing the impact of mix (projects vs distribution) and terms on cash days. | P1 |
| CW-05 | Partners lack access to cheap working capital | Small resellers | Partners who cannot fund stock buy less and rotate through multiple distributors. Peers such as Ingram offer financing to partners ([VARINDIA](https://www.varindia.com/news/top-10-technology-distributors-in-india-2026)). | Embedded channel finance (NBFC/bank invoice discounting, BNPL) with eligibility shown at checkout. | P2 |
| CW-06 | No early-payment incentive | Finance | A small cash discount for early payment can be cheaper than CNL's cost of debt. | Dynamic early-payment discount offers computed from the cost of capital. | P2 |
| CW-07 | Unapplied cash and unreconciled payments distort ledgers | Finance ops | Partners dispute statements and credit holds trigger wrongly. | Auto-reconciliation of bank receipts (UPI/NEFT references) to invoices with exceptions queue. | P2 |
| CW-08 | Credit risk from partner concentration is not monitored | CFO, board | A few large partners or projects can dominate receivables. | Concentration dashboard (top-10 exposure, sector, geography) with limits. | P2 |
| CW-09 | Inventory ageing ties up cash | Category managers | Slow stock in 5,000+ SKUs locks cash and risks write-downs. | Ageing buckets with liquidation suggestions (bundle, scheme, target partner list). | P1 |
| CW-10 | Partner insolvency signals arrive late | Credit team | Cheque bounces, GST non-filing or a sudden cut in order size precede defaults. | External signals (GST return status, bounce history) feeding an early-default alert. | P1 |
| CW-11 | MSME supplier payment rules squeeze distributor cash | CFO | Section 43B(h) pushes buyers to pay MSME suppliers within 15/45 days, squeezing intermediaries that wait longer on their customers ([Business Standard](https://www.business-standard.com/finance/personal-finance/45-day-msme-payment-rule-impact-and-details-of-section-43b-h-explained-124032600333_1.html)). | Payables calendar that flags MSME vendors and matches outflows to expected collections. | P2 |
| CW-12 | Security deposits, PDCs and guarantees are tracked on paper | Credit admin | Expired guarantees mean unsecured exposure. | Collateral register with expiry alerts. | P3 |
| CW-13 | Credit notes for returns and schemes are issued late | Partners, finance | Delayed credit notes block a partner's limit and sour the relationship. | SLA-tracked credit-note pipeline with partner-visible status. | P3 |

## 6. Routing, ownership & incentives (RO)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| RO-01 | Unclear account ownership across divisions | Division heads, KAMs | When three divisions all "own" a partner, nobody drives cross-sell, or all three call with conflicting offers. | An account-team model (primary owner + specialist overlays) with visible ownership per partner and category. | P1 |
| RO-02 | Leads from brands, web and events are not routed fast | Inside sales | Lead response time strongly affects conversion. Leads in shared inboxes go cold. | Rules- and score-based lead routing (geo, category, capacity) with SLA timers. | P1 |
| RO-03 | Reps are paid on revenue, not margin, mix or new categories | Sales leadership, HR | Revenue-only incentives push low-margin volume and ignore brand business (40–42% GM) and annuity. | An incentive designer that weights margin, brand share, new-category attach and recurring revenue, with what-if payouts. | P1 |
| RO-04 | Specialists (presales, brand) do not get credit for assisted deals | Presales, brand managers | Without credit, specialists stop helping generalist reps, which kills solution selling. | Split-credit tracking on opportunities. | P2 |
| RO-05 | Coverage is uneven: some partners get weekly visits, others none | Regional heads | Visit time goes to friendly accounts, not to accounts with the most headroom. | Coverage plan that allocates touch type (visit, call, digital) by headroom and risk. | P1 |
| RO-06 | Headcount cannot scale with portfolio | CMD, HR | 350+ staff serve 10,000+ partners and 25+ brands, and adding brands should not mean adding reps one for one. | Digital "pod" coverage: AI nudges and automated campaigns for the long tail, humans for the top tier. | P1 |
| RO-07 | Channel conflict between partners on the same end-customer deal | SIs, KAMs | Two partners quoting the same tender drives price down and annoys both. | Deal registration with protection windows and conflict alerts. | P2 |
| RO-08 | Branch boundaries block national accounts | National KAMs | Customers like Teleperformance buy in many cities, and branch silos fragment service and pricing. | National account hierarchy with cross-branch fulfilment and unified pricing. | P2 |
| RO-09 | Partner tiering is based only on revenue | Channel managers | Tiers should reflect breadth, growth, payment discipline and capability (certified engineers). | Multi-factor partner tiering with benefits mapped per tier. | P2 |
| RO-10 | Territory changes lose relationship history | Sales ops | When reps move, notes and context vanish. | Account timeline and handover packs. | P3 |
| RO-11 | Targets are set top-down without capacity checks | Sales ops | Unrealistic targets demotivate, and easy ones leave money on the table. | Capacity-aware target allocation from headroom (see OD-11). | P3 |

## 7. Partner experience & self-serve (PX)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| PX-01 | No B2B ordering portal since Ckart was sold in 2024 | Partners, inside sales | Partners must call or WhatsApp for price, stock and order, which needs a human for every transaction. | A lightweight partner portal and WhatsApp commerce bot: live price, stock, order, track, pay. | P1 |
| PX-02 | Partners cannot see real-time stock and ETA | Partners | "Is it available?" calls are a large share of inside-sales volume (est. 30%+). | Stock-by-branch and ETA visibility with back-in-stock alerts. | P1 |
| PX-03 | Account statements, invoices and credit notes are hard to get | Partner accountants | Statement requests and disputes delay payments. | Self-serve ledger, invoice/e-invoice PDF download and dispute raising. | P1 |
| PX-04 | Order status and dispatch tracking are opaque | Partners | Partners chase CNL for dispatch details, LR numbers and e-way bills. | Order timeline with courier/LR tracking and proactive delay notices. | P2 |
| PX-05 | Partners lack product training and certifications on new brands | Resellers, SIs | Partners will not sell Infinova, Super Micro or Honeywell connectivity confidently without training. | Micro-learning modules with certification badges that unlock tier benefits. | P2 |
| PX-06 | Marketing collateral is scattered across brands | Partners | Partners need ready-to-post creatives, especially for FMSG and D2C brands. | Co-branded asset library with WhatsApp/Instagram-ready creatives. | P2 |
| PX-07 | Partner onboarding (KYC, GST, bank, credit form) takes weeks | New partners, credit team | Slow onboarding means new partners start with competitors. | Digital onboarding with GSTIN/PAN auto-verification and e-sign of terms. | P1 |
| PX-08 | Partners get generic broadcast offers that are not relevant | Partners | Irrelevant spam trains partners to ignore CNL messages. | Personalised offers per partner from the recommender (OD-01), with frequency caps. | P1 |
| PX-09 | Language barriers in Tier-2/3 markets | Small resellers | English-only tools exclude many partners. | Hindi/Marathi/Gujarati/Tamil interface and WhatsApp bot. | P2 |
| PX-10 | No way for partners to request a solution quote digitally | SIs | SIs want to submit a requirement and get a BOM back. | "Request a solution" form linked to the configurator and presales queue. | P2 |
| PX-11 | Partner feedback (NPS, complaints) is not collected | Channel managers | Without feedback, attrition causes stay unknown. | Transactional NPS after orders and RMAs with a closed-loop follow-up. | P2 |
| PX-12 | Reward and loyalty programmes are manual | Partners, marketing | Retailer points and incentives are promised but paid late. | Points ledger and redemption tied to scheme engine. | P3 |
| PX-13 | Partner staff (counter sales) do not know CNL's full catalogue | Retail counter staff | Counter staff push what they know, so CNL's long tail stays unsold. | Searchable catalogue app with "what to sell with this" prompts. | P3 |

## 8. Annuity, service & renewals (AN)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| AN-01 | Recurring revenue is a tiny, untracked share | CMD, CFO | Distributors such as Rashi are buying managed-services firms to stabilise service revenue ([CRN Asia](https://www.crnasia.com/india/news/2026/rashi-peripherals-moves-beyond-distribution-with-vda-infosolutions-acquisition)), and CNL has no annuity metric (ARR, NRR). | An annuity ledger tracking ARR, NRR and churn across AMC, warranty, subscriptions and managed services. | P1 |
| AN-02 | Warranty expiries are not turned into renewal or upgrade sales | KAMs, service | Each expiring device is a natural moment to sell extended warranty, AMC or a replacement. | Install-base registry with expiry-driven renewal campaigns (90/60/30 days). | P1 |
| AN-03 | No install base: CNL does not know what is deployed where | Service, sales | Without an install base, nothing can be renewed, refreshed or serviced proactively. | Serial-number capture at sale and warranty registration with end-customer mapping. | P1 |
| AN-04 | Consumables and refills (Instax film, Cricut materials, filters for air purifiers) are not set up as subscriptions | FMSG/FMEG partners, consumers | Consumables are predictable repeat revenue tied to hardware already sold. | Replenishment subscriptions with predicted reorder dates per partner or end user. | P1 |
| AN-05 | AMC and managed-services contracts are not standardised | Service, presales | Each AMC is bespoke, so it is hard to price, renew and scale. | AMC catalogue (tiers, SLAs, prices) attachable to any solution quote. | P2 |
| AN-06 | Surveillance (Infinova) and fire-safety (Ravel) systems need recurring monitoring and compliance checks | Smart-city/enterprise clients | Fire & life-safety and surveillance have mandatory periodic maintenance, which is natural annuity. | Compliance-driven service schedules with automatic AMC quotes. | P2 |
| AN-07 | Device-as-a-service and leasing are not offered | Enterprise customers, BFSI | Customers with capex limits would take AI workstations or DC kit on a monthly fee. | DaaS pricing calculator (tenure, residual, finance partner) and contract tracking. | P2 |
| AN-08 | RMA turnaround is slow and opaque | Partners, end customers | Slow RMAs damage brand trust and partner loyalty. | RMA portal with status tracking, SLA timers and advance-replacement rules. | P1 |
| AN-09 | Renewal ownership is unclear (CNL vs partner vs brand) | Channel managers | Renewals slip through when nobody owns them. | Renewal opportunity auto-created and assigned with partner co-sell. | P2 |
| AN-10 | Software and cloud subscriptions are not part of the portfolio | Enterprise sales | Partners buy licences elsewhere, so CNL misses high-margin recurring attach. | Subscription catalogue (security, backup, AI tools) with billing and renewal tracking. | P2 |
| AN-11 | Repeat failure patterns are not analysed | Brand managers, QA | Failure clusters by batch or SKU raise RMA costs and should go back to principals. | Failure-rate analytics by SKU, batch and region. | P3 |
| AN-12 | Service revenue is not attributed back to the original seller | Sales, finance | Reps do not push AMC if they get no credit for future renewals. | Lifetime value attribution to the originating rep and partner. | P3 |

## 9. Supply chain, stock & logistics (SC)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| SC-01 | Stock-outs on fast movers lose orders to competitors | Category managers, partners | A partner who cannot get stock buys from another distributor and may not come back. | Demand forecast per SKU and branch with reorder-point alerts. | P1 |
| SC-02 | Overstock on slow movers ties up cash | CFO | See CW-09; excess stock in 5,000+ SKUs drives NWC days. | Forecast-driven purchase recommendations with ageing guardrails. | P1 |
| SC-03 | Inter-branch stock transfers are reactive | Logistics | 31+ branches hold uneven stock, and transfers happen only after a lost order. | Stock rebalancing suggestions across branches. | P2 |
| SC-04 | Import lead times and freight volatility (Middle East disruption) | Supply chain, CFO | Red Sea and Middle East disruptions raise freight and lead-time variance, hurting availability and margin. | Lead-time and freight-risk monitoring with buffer-stock adjustment. | P2 |
| SC-05 | Solution deals fail because one BOM line is out of stock | Presales | A full solution cannot ship if one component is missing, which delays revenue recognition. | BOM availability check with substitutes at quote time. | P1 |
| SC-06 | Quick-commerce dark-store replenishment needs different logistics | D2C/WOZOYO team | Q-commerce has small, frequent drops to many dark stores; Blinkit alone ran 2,243 stores by March 2026 ([Inc42](https://inc42.com/features/quick-commerce-2026-trends-outlook-most-competitive-phase)). | Dark-store-level demand and replenishment planner. | P2 |
| SC-07 | Freight cost per order is not optimised | Logistics | Small partial shipments raise cost-to-serve. | Order consolidation and carrier selection by lane cost. | P2 |
| SC-08 | E-way bill and dispatch paperwork slow dispatch | Warehouse | Manual paperwork adds hours per shipment. | Automated e-way bill generation from dispatch data. | P2 |
| SC-09 | Serial-number tracking is inconsistent | Warehouse, service | Without serials, warranty validation and RMA fraud control fail. | Barcode/serial scanning at dispatch linked to invoices. | P2 |
| SC-10 | Returns (non-defective) are not disposed of quickly | Warehouse, finance | Returned stock loses value every week it sits. | Returns grading and fast-liquidation routing. | P3 |
| SC-11 | Partner-level stock in channel is unknown | Brand managers | Over-pushed channel stock leads to later returns and price-protection claims. | Channel inventory estimate from sell-in minus sell-out. | P3 |
| SC-12 | Supplier performance (fill rate, lead time) is not scored | Procurement | Poor principal fulfilment hurts CNL's reputation with partners. | Supplier scorecards. | P3 |

## 10. Government / SI projects & tenders (GP)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| GP-01 | Large SI projects (BharatNet ~₹3,195 Cr) concentrate execution and cash risk | CFO, project PMO | BharatNet has missed several deadlines historically, and the CAG flagged execution deficiencies ([CAG 2026](https://cag.gov.in/webroot/uploads/download_audit_report/2026/19-of-2026-UG-Eng-06a7c90aa5f2901.29659974.pdf)). | Project control tower: milestones, billing, cash curve, delay risk and penalty exposure. | P1 |
| GP-02 | Milestone-based billing delays cash | CFO | BSNL releases payments against milestones, so slippage directly stretches working capital ([Communications Today](https://www.communicationstoday.co.in/rs-42000-crore-bharatnet-projects-face-delay-cost-overrun/)). | Milestone-to-invoice tracker with "evidence pack" checklist to speed certification. | P1 |
| GP-03 | Tender discovery is manual (GeM, CPPP, state portals) | Bid team, SIs | Missing relevant tenders means missing large orders for partners and CNL brands. | Tender-scraping feed matched to CNL categories and partner capabilities. | P2 |
| GP-04 | GeM listings need OEM authorisation for resellers | Partners, brand team | On GeM, reseller listings in some categories go live only after the OEM approves ([GeM quadrant policy](https://assets-bg.gem.gov.in/resources/pdf/quadrant-policy-of-gem.pdf)), and lapses can trigger delisting ([guide](https://righttoinformation.wiki/practical-guides/gem-seller-account-suspended-product-delisted-appeal)). | OEM-authorisation (MAF) request and expiry tracker for CNL-licensed brands. | P1 |
| GP-05 | Government payment delays | SIs, CNL | Delayed government payments remain a sector issue ([Swarajya](https://swarajyamag.com/amp/story/economy/beyond-gem-portal-why-msmes-are-still-waiting-for-their-money-from-government-buyers)), even with a 1% late-payment interest rule on GeM ([Inc42](https://inc42.com/buzz/buyers-to-attract-late-payment-charges-on-gem-portal)). | Government receivables tracker with escalation and interest-claim calculation. | P2 |
| GP-06 | Bid/no-bid decisions lack margin and risk analysis | Bid committee | Taking unprofitable or high-penalty tenders destroys value and adds to perception risk. | Bid scoring model (margin, penalties, payment history of the buyer, capability). | P2 |
| GP-07 | Compliance documents (STQC, BIS, MII, Make in India) are scattered | Bid team | Missing certificates disqualify bids. | Certificate vault with expiry alerts, mapped to tender requirements. | P2 |
| GP-08 | Subcontractor and field-team progress is not visible | Project managers | Middle-mile fibre rollouts involve many subcontractors across terrain. | Mobile progress capture (geo-tagged photos, km laid) rolling up to the control tower. | P2 |
| GP-09 | Market perception treats CNL as a "government projects" stock | CFO, IR | Investors discount government-heavy revenue for payment and execution risk. | Revenue-quality mix reporting (distribution vs projects vs brands vs annuity) for IR. | P3 |
| GP-10 | Smart-city surveillance (Infinova) projects need long O&M commitments | Infinova team | O&M is annuity, but it is often mispriced in bids. | O&M cost model and SLA penalty simulator. | P3 |
| GP-11 | Bank guarantees and EMDs lock capital | Treasury | BGs for large projects consume bank limits needed for distribution. | BG/EMD register with release tracking. | P3 |

## 11. Brand principals, licensing & D2C (BP)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| BP-01 | Brand principals lack visibility into their India performance | Global brands (Insta360, ZEISS, Cooler Master...) | Principals renew exclusivity based on data. Opaque reporting risks losing brands to Redington or Rashi. | A brand portal with sell-in, sell-out, partner reach, stock and scheme ROI per brand. | P1 |
| BP-02 | Brand business must grow from ~17–19% to 40% of revenue by FY29 | CMD, brand team | Brand gross margin is about 40–42% vs low single digits in distribution ([Sovrenn](https://www.sovrenn.com/concall-summary/creative-newtech)). | FY29 brand-mix path planner (required growth by brand, channel, quarter). | P1 |
| BP-03 | Honeywell licence covers 38 countries but export markets are under-served | Honeywell licensing team | Each country is a new market for licensed products, but there is no pipeline view by country. | Country-level licensing pipeline and distributor-partner tracker. | P2 |
| BP-04 | WOZOYO D2C needs marketplace and quick-commerce analytics | WOZOYO team | Q-commerce favours small-ticket electronics under ₹1,000 ([Outlook Business](https://www.outlookbusiness.com/in-depth/indias-983-billion-mobile-accessories-market-finds-a-sweet-spot-in-quick-commerce)), so listing, ranking and stock per platform matter. | Marketplace/Q-com dashboard (sales, rank, stock-outs, reviews) for Amazon, Blinkit and Swiggy Instamart. | P1 |
| BP-05 | New licensed brands (AT&T) need a go-to-market plan | Brand team | Licences have minimum guarantees, so slow ramp-up costs royalties. | Launch planner linking target partners (OD-07), channels and royalty break-even. | P2 |
| BP-06 | Royalty and minimum-guarantee tracking for licensed brands | Finance, licensing | Missed minimums cause penalties or loss of licence. | Royalty accrual and MG-shortfall forecast. | P1 |
| BP-07 | Brand compliance (packaging, claims, quality) across licensed products | Licensing, QA | Licensors audit brand use, and failures risk the licence. | Brand compliance checklist and audit log per SKU. | P3 |
| BP-08 | Consumer reviews and ratings are not monitored | D2C, brand managers | Ratings drive marketplace conversion. | Review sentiment monitoring with issue clustering. | P2 |
| BP-09 | Channel and D2C conflict over pricing | Partners, D2C | Partners resent brands undercutting them online (see PM-08). | Channel-specific SKUs and price corridors. | P2 |
| BP-10 | Principal targets and rebates are tracked manually | Brand managers | Missing a quarterly principal target can forfeit back-end rebates. | Principal target tracker with gap-to-target actions. | P1 |
| BP-11 | Exclusivity is at risk if CNL cannot show coverage depth | CMD | Principals compare distributors on reach and execution. | Coverage reports (active partners, towns, verticals) per brand. | P3 |
| BP-12 | Acquired brands (Drona, Jupiter Electric) target new segments (STEM, drones) | Brand team | Education and drone channels are new to CNL, with no partner base. | New-channel recruitment funnel (schools, ed-tech resellers) with lead scoring. | P3 |

## 12. Compliance, security & risk (CR)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| CR-01 | E-invoices must be reported to the IRP within 30 days | Finance | Taxpayers with AATO ≥ ₹10 Cr cannot report invoices older than 30 days, risking buyers' ITC ([ClearTax](https://cleartax.in/s/time-limit-for-reporting-e-invoices-on-the-irp-portal); [Tally](https://tallysolutions.com/accounting/30-day-e-invoice-reporting-limit-impact-on-itc-buyers-and-sellers/)). | E-invoice SLA monitor that flags unreported invoices and credit notes by days left. | P1 |
| CR-02 | Partner GST non-filing puts CNL's and partners' ITC at risk | Finance, credit | Non-compliant partners create tax and credit risk. | GSTIN filing-status checks feeding credit score and onboarding. | P1 |
| CR-03 | Grey-market and parallel imports undermine authorised channel | Brand managers | Grey stock undercuts pricing and voids warranty claims. | Serial-based authenticity and warranty validation. | P2 |
| CR-04 | Customer and partner data protection (DPDP Act 2023) | Legal, IT | Personal data of end customers in warranty and D2C systems needs consent and safeguards. | Consent management and role-based data access in the platform. | P2 |
| CR-05 | Sanctions, export controls and end-use checks for Super Micro/GPU sales | Compliance | High-end GPUs and servers carry export-control obligations. | End-use declaration capture and restricted-party screening at quote. | P2 |
| CR-06 | Fraud: fake orders, credit misuse, warranty fraud | Credit, service | Small frauds add up across 10,000+ partners. | Anomaly rules on orders, RMA claims and credit usage. | P2 |
| CR-07 | Geopolitical and freight risk (Middle East war) | CFO, CMD | Disruption raises costs and delays imported stock. | Risk register with exposure by supplier country and lane. | P3 |
| CR-08 | Audit trail for pricing and credit decisions is missing | Internal audit | Without trails, overrides cannot be reviewed. | Immutable decision log for discounts, credit overrides and scheme payouts. | P1 |
| CR-09 | Cybersecurity of the partner portal and APIs | IT | A new portal increases attack surface. | SSO, MFA, rate limits and audit logs by design. | P2 |
| CR-10 | AI recommendations may be opaque and mistrusted | Sales, compliance | Reps ignore recommendations they cannot explain. | Explainable reasons on every score and nudge, with feedback buttons. | P3 |
| CR-11 | Related-party and acquisition integration controls | Board, audit | New subsidiaries need consistent controls. | Control checklist and entity-level dashboards. | P3 |

## 13. People & productivity (PP)

| ID | Problem | Who | Why it matters | Platform answer | Priority |
|---|---|---|---|---|---|
| PP-01 | Reps spend most of their time on admin, not selling | KAMs | Status calls, price checks and follow-ups crowd out selling (est. 40–60% of time). | An AI copilot that drafts follow-ups, answers stock/price questions and logs activities automatically. | P1 |
| PP-02 | No daily prioritised action list | KAMs, inside sales | Without a ranked list, reps call the familiar accounts, not the highest-value ones. | "Today's 10 actions" feed combining churn risk, reorder ETA, cross-sell and collections. | P1 |
| PP-03 | Product knowledge across 25+ brands is impossible to hold | Reps, presales | Reps cannot answer spec questions on every brand. | Searchable AI assistant over datasheets and price lists. | P1 |
| PP-04 | Managers coach on anecdotes, not data | Sales managers | Coaching should target specific gaps (attach rate, call conversion). | Rep scorecards with coaching prompts. | P2 |
| PP-05 | New hires take months to ramp | HR, managers | Long ramp-up delays productivity per head. | Onboarding paths with account histories and playbooks. | P2 |
| PP-06 | Field visits are not planned around value | Field sales | Travel time across territories wastes selling hours. | Route-optimised visit plans weighted by headroom. | P2 |
| PP-07 | Campaign execution needs marketing staff for every brand | Marketing | Small teams cannot run campaigns for 25+ brands and 10,000 partners. | Campaign launcher: pick cohort + offer + channel (WhatsApp/email), with automatic tracking. | P1 |
| PP-08 | Knowledge lives in WhatsApp groups and leaves with people | Leadership | Attrition takes customer context away. | Shared account notes and conversation capture. | P2 |
| PP-09 | Monthly review meetings take days of report preparation | MIS, managers | Manual reporting is a hidden headcount cost. | Auto-generated review packs. | P3 |
| PP-10 | Cross-division collaboration has no shared goals | Division heads | Without shared wallet-share goals, divisions compete instead of cross-selling. | Shared account-level wallet-share OKRs visible to all divisions. | P3 |

---

## Top 25 P1 problems to build first

These are chosen for impact on wallet share, solution and annuity revenue, and NWC, and for being demonstrable with synthetic data in a prototype.

| Rank | IDs | Proposed feature |
|---|---|---|
| 1 | DV-01, DV-06 | **Partner 360 & Wallet-Share Meter**: unified account card, category heatmap, share-of-wallet % and ₹ headroom |
| 2 | OD-01, OD-04 | **Next-Best-Product Recommender**: "partners like you also buy" with reason strings |
| 3 | OD-02 | **Churn Radar**: risk score with early-warning alerts |
| 4 | OD-03, PP-02 | **Next-Order ETA & Today's 10 Actions**: daily prioritised call list |
| 5 | OD-05 | **Anomaly Feed**: drops and spikes with root-cause hints |
| 6 | SS-01, SS-02 | **Solution Configurator**: template BOMs with compatibility checks |
| 7 | SS-04 | **Bundle Pricing Engine**: blended-margin targets and floor checks |
| 8 | SS-05 | **AI-in-a-Box Sizing Wizard**: CyberPowerPC workstation sizing for BFSI |
| 9 | PM-01, CR-08 | **Deal Desk**: floor prices, approval matrix and audit trail |
| 10 | PM-02, PM-03, BP-10 | **Scheme & Slab Tracker**: "₹X to next slab" nudges, principal target gaps |
| 11 | DV-09, PM-10 | **Pocket-Margin Waterfall & Cost-to-Serve** |
| 12 | CW-01, CW-10 | **Dynamic Credit Score**: limit recommendations and default early-warning |
| 13 | CW-02, CW-03 | **Credit-Hold Release & Collections Worklist**: pay-to-release links, ranked collections |
| 14 | CW-04 | **NWC Simulator**: mix and terms impact on cash days |
| 15 | CW-09, SC-01, SC-02 | **Stock Health**: demand forecast, reorder and ageing liquidation |
| 16 | RO-03 | **Incentive Designer**: margin, brand-mix and annuity-weighted payouts |
| 17 | RO-01, RO-05, RO-06 | **Coverage Planner**: ownership, touch-model by tier, digital pod for long tail |
| 18 | PX-01, PX-02, PX-03 | **Partner Portal + WhatsApp Bot**: price, stock, order, ledger |
| 19 | PX-08, OD-08, PP-07 | **AI Nudges & Campaign Launcher**: personalised offers and dormant reactivation |
| 20 | AN-01 | **Annuity Ledger**: ARR, NRR and churn |
| 21 | AN-02, AN-03, AN-04 | **Install Base & Renewal Engine**: warranty/AMC renewals and consumable subscriptions |
| 22 | BP-01, BP-02 | **Brand Portal & FY29 Brand-Mix Path** |
| 23 | GP-01, GP-02 | **Project Control Tower**: milestones, billing and cash curve for BharatNet-type projects |
| 24 | CR-01, CR-02 | **Compliance Guard**: e-invoice 30-day SLA monitor and partner GST status |
| 25 | PP-01, PP-03 | **Sales Copilot**: AI assistant over catalogue, account data and follow-ups |

### Sources

- [CNL Q2 FY27 earnings call transcript (NSE)](https://nsearchives.nseindia.com/corporate/CREATIVE_03112026073058_Transcript_CreativeNewtech-Oct29-2026.pdf)
- [Univest: CNL Q2 FY27 results](https://univest.in/blogs/creative-newtech-q2-results-fy27-pat-26-crore)
- [Sovrenn: CNL concall summary](https://www.sovrenn.com/concall-summary/creative-newtech)
- [Screener: CNL consolidated](https://www.screener.in/company/CREATIVE/consolidated)
- [Multibagg: CNL Q1 FY27 update](https://www.multibagg.ai/market-pulse/articles/q1-fy27-update-97162)
- [ICRA: Redington rating rationale](https://www.icra.in/Rating/GetRationalReportFilePdf?id=138133)
- [VARINDIA: Top 10 technology distributors in India 2026](https://www.varindia.com/news/top-10-technology-distributors-in-india-2026)
- [CRN Asia: Rashi Peripherals acquires VDA Infosolutions](https://www.crnasia.com/india/news/2026/rashi-peripherals-moves-beyond-distribution-with-vda-infosolutions-acquisition)
- [ClearTax: 30-day e-invoice reporting limit](https://cleartax.in/s/time-limit-for-reporting-e-invoices-on-the-irp-portal) and [Tally: ITC impact](https://tallysolutions.com/accounting/30-day-e-invoice-reporting-limit-impact-on-itc-buyers-and-sellers/)
- [Business Standard: Section 43B(h) 45-day MSME rule](https://www.business-standard.com/finance/personal-finance/45-day-msme-payment-rule-impact-and-details-of-section-43b-h-explained-124032600333_1.html)
- [GeM quadrant policy](https://assets-bg.gem.gov.in/resources/pdf/quadrant-policy-of-gem.pdf), [GeM suspension guide](https://righttoinformation.wiki/practical-guides/gem-seller-account-suspended-product-delisted-appeal), [Inc42: GeM late-payment interest](https://inc42.com/buzz/buyers-to-attract-late-payment-charges-on-gem-portal), [Swarajya: MSME payment delays](https://swarajyamag.com/amp/story/economy/beyond-gem-portal-why-msmes-are-still-waiting-for-their-money-from-government-buyers)
- [CAG Report 19 of 2026 (BharatNet)](https://cag.gov.in/webroot/uploads/download_audit_report/2026/19-of-2026-UG-Eng-06a7c90aa5f2901.29659974.pdf), [Communications Today: BharatNet delays and overruns](https://www.communicationstoday.co.in/rs-42000-crore-bharatnet-projects-face-delay-cost-overrun/)
- [Outlook Business: accessories on quick commerce](https://www.outlookbusiness.com/in-depth/indias-983-billion-mobile-accessories-market-finds-a-sweet-spot-in-quick-commerce), [Inc42: quick commerce 2026](https://inc42.com/features/quick-commerce-2026-trends-outlook-most-competitive-phase)
- [360insights: why partners do not use MDF](https://www.360insights.com/blog/your-channel-partners-arent-using-their-mdf-or-co-op.-heres-why)
