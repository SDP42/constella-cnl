# Research — Creative Newtech × E-Cell IIT Bombay, Problem Statement 1

> **Beyond Distribution: growing wallet share and solution selling across the customer network.**
> Design a mechanism that increases revenue per B2B customer and moves Creative Newtech (CNL)
> from selling individual products to selling integrated solutions.

---

## 1. The company (from CNL's own investor material)

| Fact | Value | Source |
|---|---|---|
| Founded / HQ | 1992, Mumbai (formerly *Creative Peripherals & Distribution Ltd*, renamed Aug 2021) | Investor deck Q1 FY26 |
| CMD | Mr. Ketan Patel | Investor deck Q1 FY26 |
| Footprint | 31+ branches in India, Hong Kong subsidiary, Middle East tie-ups, SAARC expansion | Investor deck Q1 FY26 |
| Network | **10,000+ channel partners**, 350+ employees | Investor deck Q1 FY26 |
| Portfolio | **25+ brands, 5,000+ products** | Investor deck Q1 FY26 |
| Segments | **FMSG** (social-media gadgets), **FMCT** (consumer tech), **FMEG** (electronics goods), **EB** (Enterprise Business) | Investor deck Q1 FY26 |
| Brands | Samsung, Cooler Master, Fujifilm (Instax), Lexar, Cricut, Olympus, iBall, ViewSonic, pTron, Holoware, Aabo Ring, Ruark Audio, Polycab, AOC, Insta360, Hama, ZEISS, MSI, Hyperice, ZION, LENCO… | Investor deck Q1 FY26 |
| Licensing | Exclusive **Honeywell** brand licensee across **38 countries** (structured cabling, connectivity, air purifiers, home audio); CyberPowerPC licensing / JV | Investor deck Q1 FY26 |
| FY25 revenue | ₹1,774.48 Cr consolidated (₹1,638.55 Cr standalone) | Investor deck Q1 FY26 |
| FY25 EBITDA / PAT | ₹72.86 Cr (**4.04%**) / ₹53.11 Cr (**2.95%**) | Investor deck Q1 FY26 |
| Q1 FY26 | Revenue ₹392.96 Cr (+30% YoY), EBITDA margin 3.80% | Investor deck Q1 FY26 |
| Segment mix FY25 | EB ≈ 68%, FMSG ≈ 22%, FMCT ≈ 10%, FMEG < 0.1% | Investor deck Q1 FY26 |
| Strategy lens | "Quadrant" ranking of products by **margin × working-capital cycle**; resources shift to Quadrant 1 (high margin, quick cycle) | Investor deck Q1 FY26 |
| Past digital B2B | Launched **Ckart** (digital B2B platform), sold it in Feb 2024 for ₹10 Cr | Investor deck Q1 FY26 |

**What this tells us**

1. **Margins are razor thin (≈3–4% EBITDA).** Any cross-sell engine that optimises *revenue* alone could
   push low-margin, slow-cycle SKUs. Our scoring must be **margin- and working-capital-aware**, the same way
   CNL's management already thinks about the business (their Quadrant model).
2. **Enterprise Business is two-thirds of revenue**, but FMSG/FMCT are where the high-margin experiential
   brands are. The cross-division whitespace (an EB system integrator who never buys Honeywell cabling, a
   FMSG retailer who never buys Lexar memory) is exactly what the silos hide.
3. **Honeywell licensing** (cabling + air purifiers + audio) is a natural *solution backbone* and a
   natural *annuity* hook (filter replacement, cabling certification/AMC).
4. **They already tried a digital B2B channel (Ckart) and divested it.** The new mechanism must plug into
   how sales teams already work (WhatsApp, email, the ERP, the weekly review) rather than ask
   partners to adopt yet another portal.
5. **10,000 partners ÷ 350 staff ≈ 28 partners per employee, and many more per salesperson.** Headcount
   cannot scale with the portfolio, so prioritisation and automation decide whether this works.

## 2. What the industry already does

| Player / approach | What it does | Gap for CNL |
|---|---|---|
| Ingram Micro **Xvantage** | AI demand generation, transaction intelligence pushed into partners' own systems | Built for a global catalogue; no solution assembly across licensed + distributed brands |
| TD SYNNEX **Digital Bridge** | Partner-facing engine surfacing adjacent categories (security, networking, cloud) | Partner-facing only; does not solve *internal* division ownership/overlap |
| McKinsey "next-best-opportunity" engines in distribution | Lead generation, product recommendation, contact timing; B2B software case reported ~30% bookings lift | Generic; usually revenue-ranked, not margin/working-capital ranked |
| Classic CRM (Salesforce/Zoho) | Records opportunities | Records only what a rep types in; never *detects* anything |
| Market-basket analysis | "People who bought X bought Y" | Product-level only; blind to **solutions**, **timing**, **ownership** |

Sources: McKinsey distribution blog on AI in sales; Avaus, *From data to revenue: AI in B2B wholesale*;
Distribution Strategy Group, *Why is cross-selling so difficult for distributors*; Channel Insider on
Xvantage and TD SYNNEX Digital Bridge (URLs in the main README).

## 3. Problems the brief states

1. Purchases are spread across divisions; **each team sees only its slice.**
2. There is **no systematic way to spot** product combinations that form a solution or upsell.
3. **Headcount cannot grow** in proportion to portfolio growth.
4. The company wants **recurring / annuity** revenue and to move toward **system integration**.

## 4. Problems the brief does not state (found from the personas' side)

| # | Hidden problem | Who feels it | Our answer |
|---|---|---|---|
| H1 | **The same partner exists 3–5 times** across divisions (different names, branches, billing GSTINs) | Data steward, sales head | GSTIN/PAN-anchored **entity resolution** with fuzzy name + phone + pincode matching and a golden record |
| H2 | **Reps hoard accounts**: if division B closes a sale on "my" account, I lose credit | Every rep | **Lead + assist split credit** (70/30 by default) written into the routing contract, so sharing pays |
| H3 | **Cross-sell that burns working capital**: a ₹50L deal at 1.5% margin with 90-day credit is worth less than a ₹8L deal at 18% margin, paid in 15 days | CFO, sales head | **Value-at-stake score** = P(win) × gross margin × working-capital velocity × credit headroom |
| H4 | **Credit-limit blind spots**: the recommended deal would breach the partner's credit limit | Credit control | Credit headroom is part of the score and is shown on the card |
| H5 | **Explainability**: reps do not trust black-box suggestions | Rep | Every opportunity carries "why now": peer evidence, rule lift, the trigger signal and feature contributions |
| H6 | **Signals die in WhatsApp**: a partner mentions "school tender next month" to a rep and nobody records it | Rep, partner | **Signal capture**: free-text notes and tender alerts parsed into structured intent signals |
| H7 | **No one owns the solution**: a smart classroom needs EB (display), Honeywell (cabling) and FMCT (UPS/memory) | Solutions architect | A **solution pod**: one lead owner and assists auto-assigned per component division |
| H8 | **Opportunities rot silently** | Sales head | SLA ladder: nudge, then reassign, then escalate, then move to digital nurture. Nothing stays un-actioned |
| H9 | **Annuity is invisible**: filters, AMC and consumables are not tracked by installed base | Service, finance | **Installed-base twin** that predicts replenishment dates and converts them to subscriptions |
| H10 | **Pilot results get argued about** ("would have bought anyway") | Management | **Randomised control holdout** of accounts with uplift attribution |
| H11 | **Leakage to competing distributors** (Redington, Ingram, Savex) is unknown | Sales head | Wallet estimate per account from firmographics + peer benchmark, which gives *share of wallet* |
| H12 | **Seasonality**: air purifiers peak in Oct–Jan (north India smog), school tenders in Mar–Jun | Reps | Seasonal and event triggers in the signal layer |

## 5. Personas

| Persona | Role | Goal | Pain | What they see in the product |
|---|---|---|---|---|
| **Priya Nair** | Key Account Manager, Enterprise Business (Mumbai) | Hit quarterly GP target on 40 SI/enterprise accounts | Doesn't know what her accounts buy from FMSG/Honeywell; reluctant to "give away" accounts | *Mission Inbox*: ranked opportunities with "why now", one-tap accept, auto-drafted WhatsApp pitch |
| **Arjun Mehta** | Channel Sales Executive, FMSG (Pune) | Push new brands to 180 retailers | Too many accounts, no idea which retailer is ready for which brand | Same inbox, territory-filtered, plus a replenishment radar |
| **Rakesh Iyer** | National Sales Head | Grow GP per account and the solution mix without hiring | No single view; finds out about stalled deals late | *Command Center*: funnel, SLA breaches, overlap conflicts, escalations, division heat-map |
| **Meera Shah** | Solutions Architect, SI desk | Turn product baskets into solution proposals | Manual BOM building; pricing across divisions | *Solution Composer*: template gap analysis and BOM with margin and annuity lines |
| **Neha Kulkarni** | Data & RevOps Steward | One clean account record | Duplicates, missing GSTIN, inconsistent SKUs | *Data Unifier*: entity-resolution clusters, quality score, lineage |
| **Vikram Rao** | Owner, *TechNova Systems* (reseller/SI partner, Pune) | Win more end-customer deals, better margins | Has to call 4 different CNL people for 4 categories | Partner-facing proposal link (single CNL face, one proposal) |

## 6. Design principles we derived

1. **Detect, don't wait.** Signals come from data (transactions, installed base, seasonality, tenders, notes).
2. **Margin over revenue.** Rank by expected *gross profit velocity*, matching CNL's Quadrant thinking.
3. **Solutions are first-class objects**, not a tag on a deal.
4. **Ownership is a contract**: one lead, assists with split credit, SLAs, and an escalation ladder.
5. **Fit existing workflows**: CSV/ERP ingest, WhatsApp/email drafts, weekly review export. No new partner portal required.
6. **Prove it**: time-split back-tests for the model, a randomised holdout for the business.

---

## 7. Update — latest disclosures (Q2 FY27 earnings call, 29 Oct 2026)

Source: [Q2 FY27 earnings call transcript (NSE)](https://nsearchives.nseindia.com/corporate/CREATIVE_03112026073058_Transcript_CreativeNewtech-Oct29-2026.pdf);
clients list from the [18th Annual Report](https://creativenewtech.com/wp-content/uploads/2025/01/1-18th-Annual-Report.pdf);
AT&T licensing via [SAHI news](https://www.sahi.com/news/creative-newtech-signs-strategic-licensing-deal-with-at-t-for-tech-infrastructure).

| Theme | What CNL disclosed | What it means for Constella |
|---|---|---|
| Financials | Q2 FY27 revenue ₹752.14 Cr, EBITDA ₹40.11 Cr (**5.31%**, up from 4.04%), PAT margin 3.44%; net working-capital days **45** (from 75 in FY26) | Margin and cash-cycle aware ranking (value-at-stake) is the right objective; track WC days per opportunity |
| Target | **₹6,000 Cr revenue by FY29**, brand business to rise from 19% to **40%**, brand PAT 10–11% | "Brand mix" is a first-class KPI in the BI layer; cross-sell should push licensed/own brands |
| System integration | Advance work order from **BSNL for BharatNet Middle Mile (Odisha), ≈ ₹3,195 Cr** (≈ ₹1,700 Cr capex over 3.5 yrs + opex); a ₹50 Cr government data centre (SNOC); **Super Micro** tie-up for private data-centre deals | Solution templates must include data-centre / network infrastructure and project-style (milestone) deals |
| Surveillance & safety | Proposed acquisition of **Infinova India** (smart-city / airport / border cameras; Mumbai Smart City uses it; STQC certification); **Ravel Electronics** for fire & life safety | New solution: *Smart City & Campus Security* (surveillance + fire safety + cabling + AMC) |
| AI | **CyberPowerPC repositioned as AI workstation / "AI in a box"** for BFSI customers that won't send data to the cloud | New solution: *On-prem AI Pod* (AI workstation + Super Micro server + storage + AMC) |
| Drones | **Drona Aviation** (drone-based STEM education), **Jupiter Electric Mobility** | New solution: *Drone STEM Lab* for schools |
| Own brand | **WOZOYO** global consumer brand (US first, India launch with air purifiers & docking stations); Amazon "Rising Global Stars"; ₹45–50 Cr first-year target; sold via **Blinkit, Swiggy, Amazon** | Quick-commerce & marketplace partners as account types; bundling rule "Honeywell + WOZOYO" |
| Bundling tactic (CMD) | "If you want Honeywell air purifiers, you will also have to stock WOZOYO accessories" | Exactly the cross-sell leverage Constella automates — a *Brand Bundle Lever* feature |
| Licensing | New **AT&T** brand licensing for technology infrastructure categories; Honeywell licence across 38 countries | Licensed brands carry higher margin — prioritise in scoring |
| Customers named | Reliance, Amazon, Flipkart, Croma, Teleperformance, Jio Studios, Nykaa | Seed demo accounts with these archetypes (retail chains, marketplaces, BPO enterprise, media) |
| Risks mentioned | Middle-East demand pressure from the war, rising freight, government-project perception | Leakage/risk signals and scenario planning in the BI layer |

### New features this research drives
1. **Brand Bundle Lever** — when a partner wants a scarce/high-demand brand (Honeywell), recommend the attach bundle (WOZOYO, AMC) and quantify it.
2. **Project-style solution deals** with milestone billing (BharatNet-like), DC/SNOC, surveillance, drone labs, on-prem AI pods.
3. **Brand Principal Portal** — show each brand (Honeywell, Samsung, Infinova…) its sell-through, whitespace and co-marketing ROI across CNL's network.
4. **FY29 Path** BI view — revenue run-rate vs the ₹6,000 Cr goal and brand-mix vs 40% target, with scenario sliders.
