"""Synthetic-but-structured world for Creative Newtech's partner network.

Assumptions (also documented in docs/DATA_MODEL.md):
  * 420 B2B accounts (sample of the 10,000+ network) over 24 months of history.
  * Each account has a *latent need* per category = f(account type x division affinity,
    vertical needs, solution intent, noise). Adoption is a monthly hazard on that need,
    boosted when the account already owns sibling components of a solution (sequential
    adoption) and modulated by seasonality (purifiers in North-India winter, education
    buying before the academic year).
  * Divisions run separate systems -> every account appears as 1..N raw SourceRecords with
    noisy names, missing GSTINs, different phone formats. The resolver must stitch them.
  * Annuity attach is deliberately low today (the gap the solution should close).
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import numpy as np

from app.core.config import get_settings
from app.data import catalog as C

settings = get_settings()


@dataclass
class World:
    divisions: list[dict] = field(default_factory=list)
    reps: list[dict] = field(default_factory=list)
    products: list[dict] = field(default_factory=list)
    solutions: list[dict] = field(default_factory=list)
    accounts: list[dict] = field(default_factory=list)
    source_records: list[dict] = field(default_factory=list)
    transactions: list[dict] = field(default_factory=list)
    assets: list[dict] = field(default_factory=list)
    interactions: list[dict] = field(default_factory=list)


PERSONA_REPS = [
    # name, division, region, role, persona_key
    ("Priya Nair", "EB", "West", "rep", "priya"),
    ("Arjun Mehta", "FMSG", "West", "rep", "arjun"),
    ("Rakesh Iyer", "EB", "National", "head", "rakesh"),
    ("Meera Shah", "SVC", "National", "architect", "meera"),
    ("Neha Kulkarni", "SVC", "National", "steward", "neha"),
]

INTENT_CATS: dict[str, list[str]] = {
    "tender": ["interactive_display", "mini_pc", "structured_cabling", "projector"],
    "expansion": ["structured_cabling", "digital_signage", "retail_security", "commercial_monitor"],
    "new_office": ["air_purifier", "interactive_display", "home_audio", "mini_pc"],
    "signage": ["digital_signage", "retail_security"],
    "gaming": ["gaming_pc", "gaming_peripherals", "commercial_monitor"],
    "creator": ["action_camera", "memory_cards", "video_accessories"],
}
INTENT_BY_VERTICAL: dict[str, list[str]] = {
    "education": ["tender", "tender", "gaming", "new_office"],
    "government": ["tender", "expansion"],
    "healthcare": ["expansion", "new_office", "signage"],
    "retail": ["expansion", "signage", "creator"],
    "bfsi": ["new_office", "expansion"],
    "it_ites": ["new_office", "new_office", "expansion"],
    "manufacturing": ["expansion", "new_office"],
    "hospitality": ["signage", "gaming", "expansion"],
    "media_creators": ["creator", "creator", "expansion"],
}

INTENT_NOTES = [
    ("tender", "Mentioned a state school tender for {n} smart classrooms closing next quarter"),
    ("expansion", "Opening {n} new branches / stores in the next two quarters"),
    ("new_office", "Moving into a new {n}-seat office; asked about air quality and meeting rooms"),
    ("signage", "Asked whether we can do signage for their {n} outlets"),
    ("gaming", "Client wants to set up a {n}-seat gaming lounge on campus"),
    ("creator", "Seeing strong demand from YouTubers; wants creator bundles for {n} stores"),
]
NEUTRAL_NOTES = [
    "Routine payment follow-up, cleared two invoices",
    "Delivery delayed by 4 days, partner unhappy with logistics",
    "Asked for updated price list for Q3",
    "Discussed scheme targets for the quarter",
    "Partner comparing our pricing with Redington",
    "Requested demo units for an upcoming expo",
    "Asked for credit limit enhancement",
]


def _rng() -> tuple[random.Random, np.random.Generator]:
    return random.Random(settings.seed), np.random.default_rng(settings.seed)


def _gstin(r: random.Random, region: str) -> tuple[str, str]:
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    pan = "".join(r.choice(letters) for _ in range(3)) + "P" + r.choice(letters) + \
        f"{r.randint(1000, 9999)}" + r.choice(letters)
    state = r.choice(C.STATE_CODES[region])
    from app.services.analytics import gstin_check_digit

    body = f"{state}{pan}1Z"
    return body + gstin_check_digit(body), pan


def _name_variant(r: random.Random, name: str, city: str) -> str:
    v = name
    ops = r.sample(["case", "pvt", "abbr", "typo", "branch", "amp", "none"], k=2)
    for op in ops:
        if op == "case":
            v = v.upper() if r.random() < 0.5 else v.lower()
        elif op == "pvt":
            v = v + r.choice([" Pvt Ltd", " Private Limited", " Pvt. Ltd.", " (P) Ltd", " LLP"])
        elif op == "abbr":
            parts = v.split()
            if len(parts) > 2:
                v = parts[0] + " " + "".join(p[0] for p in parts[1:]).upper()
        elif op == "typo" and len(v) > 6:
            i = r.randint(1, len(v) - 2)
            v = v[:i] + v[i + 1] + v[i] + v[i + 2:]
        elif op == "branch":
            v = f"{v} - {city}"
        elif op == "amp":
            v = v.replace(" and ", " & ")
    return v


def build_world() -> World:
    r, g = _rng()
    w = World()
    w.divisions = C.DIVISIONS
    w.solutions = C.SOLUTIONS

    # ---------------------------------------------------------------- reps
    rid = 1
    for name, div, region, role, key in PERSONA_REPS:
        w.reps.append({"id": rid, "name": name, "email": f"{name.split()[0].lower()}@creativenewtech.demo",
                       "division_code": div, "region": region, "role": role, "persona_key": key,
                       "capacity": 30, "avatar_hue": r.randint(0, 360)})
        rid += 1
    per_region = {"EB": 2, "HON": 1, "FMSG": 1, "FMCT": 1, "SVC": 1}
    for div, n in per_region.items():
        for region in ["West", "North", "South", "East"]:
            for _ in range(n):
                if div == "EB" and region == "West" and _ == 0:
                    continue  # Priya covers it
                if div == "FMSG" and region == "West":
                    continue  # Arjun covers it
                nm = f"{r.choice(C.FIRST_NAMES)} {r.choice(C.LAST_NAMES)}"
                w.reps.append({"id": rid, "name": nm, "email": f"rep{rid}@creativenewtech.demo",
                               "division_code": div, "region": region, "role": "rep", "persona_key": None,
                               "capacity": 160 if div == "SVC" else r.randint(22, 34), "avatar_hue": r.randint(0, 360)})
                rid += 1

    def reps_for(div: str, region: str) -> list[dict]:
        return [x for x in w.reps if x["division_code"] == div and x["region"] == region and x["role"] == "rep"]

    # ---------------------------------------------------------------- products
    for cat, spec in C.CATEGORIES.items():
        for bi, brand in enumerate(spec["brands"]):
            for tier, (mult, label) in enumerate([(0.75, "Essential"), (1.0, "Pro"), (1.5, "Max")]):
                if spec.get("recurring") and tier > 0:
                    continue
                margin = spec["margin"] * (0.9 + 0.12 * tier)
                q = 1 if margin >= 0.15 and spec["wc"] <= 40 else 2 if margin >= 0.1 else 3 if spec["wc"] <= 50 else 4
                w.products.append({
                    "sku": f"{cat[:4].upper()}-{brand[:3].upper()}-{bi}{tier}",
                    "name": f"{brand} {spec['label'].rstrip('s')} {label}",
                    "brand": brand, "category": cat, "division_code": spec["div"],
                    "unit_price": round(spec["price"] * mult, -1), "margin_pct": round(margin, 4),
                    "wc_days": spec["wc"], "quadrant": q,
                    "is_recurring": bool(spec.get("recurring")),
                    "recurring_period_months": spec.get("recurring"),
                })
    skus_by_cat: dict[str, list[dict]] = {}
    for p in w.products:
        skus_by_cat.setdefault(p["category"], []).append(p)

    # ---------------------------------------------------------------- accounts
    types = (["reseller"] * 30 + ["retailer"] * 25 + ["system_integrator"] * 18 +
             ["enterprise"] * 15 + ["sub_distributor"] * 12)
    vert_by_type = {
        "retailer": ["retail"] * 6 + ["media_creators"] * 4 + ["hospitality"],
        "enterprise": ["bfsi", "it_ites", "healthcare", "education", "manufacturing", "hospitality", "government"],
        "system_integrator": ["education", "government", "healthcare", "bfsi", "it_ites", "manufacturing", "retail"],
        "reseller": C.VERTICALS,
        "sub_distributor": ["retail", "media_creators", "it_ites", "education"],
    }
    cities = list(C.CITIES.keys())
    city_w = np.array([3 if c in ("Mumbai", "Delhi", "Bengaluru", "Pune") else 1 for c in cities], dtype=float)
    city_w /= city_w.sum()
    used_names: set[str] = set()
    cats = list(C.CATEGORIES.keys())
    cat_idx = {c: i for i, c in enumerate(cats)}

    now = settings.demo_now.date()
    start = (now.replace(day=1) - timedelta(days=30 * settings.history_months)).replace(day=1)
    months = settings.history_months

    for aid in range(1, settings.n_accounts + 1):
        atype = r.choice(types)
        vertical = r.choice(vert_by_type[atype])
        city = str(g.choice(cities, p=city_w))
        region, lat, lng, pin = C.CITIES[city]
        if aid == 1:  # Vikram's account — the demo partner
            atype, vertical, city = "system_integrator", "education", "Pune"
            region, lat, lng, pin = C.CITIES[city]
            name = "TechNova Systems"
        else:
            while True:
                name = f"{r.choice(C.COMPANY_STEMS)} {r.choice(C.COMPANY_SUFFIX[atype])}"
                if name not in used_names:
                    break
                name = f"{r.choice(C.COMPANY_STEMS)} {r.choice(C.COMPANY_STEMS)} {r.choice(C.COMPANY_SUFFIX[atype])}"
                if name not in used_names:
                    break
        used_names.add(name)
        emp_mu = {"enterprise": 6.2, "system_integrator": 4.2, "reseller": 3.2, "retailer": 2.6, "sub_distributor": 3.6}[atype]
        employees = int(max(5, g.lognormal(emp_mu, 0.8))) if aid != 1 else 140
        per_emp = {"enterprise": 62000, "system_integrator": 340000, "reseller": 260000,
                   "retailer": 220000, "sub_distributor": 420000}[atype]
        spend = float(employees * per_emp * g.lognormal(0, 0.35))
        gstin, pan = _gstin(r, region)
        tier = "platinum" if spend > 6e7 else "gold" if spend > 2e7 else "silver" if spend > 6e6 else "bronze"
        credit_limit = round(spend * r.uniform(0.06, 0.14), -4)
        w.accounts.append({
            "id": aid, "name": name, "gstin": gstin, "pan": pan, "account_type": atype, "vertical": vertical,
            "city": city, "region": region, "employees": employees, "est_annual_tech_spend": round(spend, -3),
            "credit_limit": credit_limit, "credit_used": round(credit_limit * r.uniform(0.15, 0.97), -3),
            "avg_payment_days": int(r.triangular(18, 95, 42)), "tier": tier,
            "lat": lat + r.uniform(-0.15, 0.15), "lng": lng + r.uniform(-0.15, 0.15),
            "in_holdout": False, "data_quality": 1.0, "_pin": pin,
        })

    # Persona ownership: Priya owns West EB-heavy accounts; Arjun West FMSG-heavy accounts.
    # ---------------------------------------------------------------- latent needs + adoption
    aff = C.TYPE_DIVISION_AFFINITY
    sol_by_vertical = {v: [s for s in C.SOLUTIONS if v in s["verticals"]] for v in C.VERTICALS}
    sibling: dict[str, set[str]] = {c: set() for c in cats}
    for s in C.SOLUTIONS:
        comp = [x["category"] for x in s["components"]]
        for c in comp:
            sibling[c].update(x for x in comp if x != c)

    tx_id = 1
    for a in w.accounts:
        need = np.zeros(len(cats))
        intents = r.sample(sol_by_vertical[a["vertical"]], k=min(2, len(sol_by_vertical[a["vertical"]]))) \
            if sol_by_vertical[a["vertical"]] else []
        intent_cats = {x["category"] for s in intents for x in s["components"]}
        for c in cats:
            spec = C.CATEGORIES[c]
            base = aff[a["account_type"]][spec["div"]]
            v = base * (1.7 if c in C.VERTICAL_NEEDS[a["vertical"]] else 0.3)
            if c in intent_cats:
                v *= 1.8
            if spec["div"] == "SVC":
                v *= 0.12  # annuity attach is weak today
            if c in ("ai_server", "ai_workstation", "surveillance", "fire_safety", "drone_kits"):
                v *= 0.45  # newer lines (Q2 FY27): early adoption
            need[cat_idx[c]] = v * g.lognormal(0, 0.45)
        a["_need"] = need
        a["_intents"] = [s["id"] for s in intents]

        intent_events = []
        for _ in range(int(g.poisson(0.9))):
            key = r.choice(INTENT_BY_VERTICAL[a["vertical"]])
            intent_events.append((r.randint(0, months - 1), key))
        if a["id"] == 1:
            intent_events.append((months - 1, "tender"))
        a["_intent_events"] = intent_events

        owned: dict[str, date] = {}
        scale = max(1.0, a["employees"] / 100)
        # account-level engagement: some accounts are simply more active
        activity = g.lognormal(0, 0.4)
        # pick 1-2 "home" divisions (where the relationship started)
        home_divs = sorted(aff[a["account_type"]], key=lambda d: -aff[a["account_type"]][d] * r.random())[:2]

        for m in range(months):
            month_start = start + timedelta(days=30 * m)
            mo = month_start.month
            for c in cats:
                spec = C.CATEGORIES[c]
                i = cat_idx[c]
                if spec.get("recurring"):
                    continue  # annuity handled below
                if a["id"] == 1 and spec["div"] in ("HON", "FMSG"):
                    continue  # demo partner: classic silo — big EB buyer, never touched Honeywell
                season = 1.0
                if c == "air_purifier" and mo in (10, 11, 12, 1) and a["region"] in ("North", "East"):
                    season = 2.6
                if c in ("interactive_display", "projector", "mini_pc") and mo in (3, 4, 5, 6) and a["vertical"] in ("education", "government"):
                    season = 1.9
                if c in ("instant_camera", "action_camera", "gaming_peripherals") and mo in (10, 11):
                    season = 1.6  # festive season
                for im, key in intent_events:
                    if im < m <= im + 5 and c in INTENT_CATS[key]:
                        season *= 3.2
                if c not in owned:
                    sib = len(sibling[c] & set(owned)) if owned else 0
                    home = 1.0 if spec["div"] in home_divs else 0.35  # silo effect
                    hazard = 0.026 * need[i] * home * activity * season * (1 + 0.85 * sib)
                    if r.random() < min(hazard, 0.6):
                        owned[c] = month_start
                    else:
                        continue
                # repeat purchase propensity once owned
                freq = {"memory_cards": 0.55, "connectivity": 0.45, "mobile_accessories": 0.6,
                        "commercial_monitor": 0.35, "gaming_peripherals": 0.35}.get(c, 0.18)
                if owned[c] == month_start or r.random() < freq * min(2.0, activity) * season * 0.6:
                    p = r.choice(skus_by_cat[c])
                    qty = max(1, int(g.poisson(max(1.0, scale * {"memory_cards": 12, "connectivity": 10,
                                                                   "mobile_accessories": 25}.get(c, 2)))))
                    if C.CATEGORIES[c]["price"] > 300000:
                        qty = 1 if r.random() < 0.8 else 2  # big-ticket servers/workstations ship in ones and twos
                    day = month_start + timedelta(days=r.randint(0, 27))
                    if day > now:
                        continue
                    amount = qty * p["unit_price"] * r.uniform(0.92, 1.0)
                    region_reps = reps_for(spec["div"], a["region"])
                    w.transactions.append({
                        "id": tx_id, "account_id": a["id"], "sku": p["sku"], "division_code": spec["div"],
                        "category": c, "tx_date": day, "qty": qty, "amount": round(amount, 2),
                        "gross_margin": round(amount * p["margin_pct"], 2),
                        "rep_id": region_reps[0]["id"] if region_reps else None,
                    })
                    tx_id += 1
                    if c in C.ANNUITY_FOR or c in ("interactive_display", "digital_signage", "air_purifier"):
                        due = None
                        ann = C.ANNUITY_FOR.get(c)
                        if ann:
                            per = C.CATEGORIES[ann]["recurring"]
                            due = day + timedelta(days=30 * per)
                        w.assets.append({"account_id": a["id"], "sku": p["sku"], "category": c,
                                         "installed_on": day, "qty": qty, "next_service_due": due})
        # Low natural annuity attach
        for c_base, ann in C.ANNUITY_FOR.items():
            if c_base in owned and r.random() < 0.12 * min(2.0, need[cat_idx[ann]] * 6 + 0.5):
                p = skus_by_cat[ann][0]
                first = owned[c_base] + timedelta(days=r.randint(5, 40))
                per = C.CATEGORIES[ann]["recurring"]
                d = first
                while d <= now:
                    qty = max(1, int(scale * 2))
                    amount = qty * p["unit_price"]
                    w.transactions.append({
                        "id": tx_id, "account_id": a["id"], "sku": p["sku"], "division_code": "SVC",
                        "category": ann, "tx_date": d, "qty": qty, "amount": round(amount, 2),
                        "gross_margin": round(amount * p["margin_pct"], 2), "rep_id": None})
                    tx_id += 1
                    d = d + timedelta(days=30 * per)

    # ---------------------------------------------------------------- owners, holdout
    tx_by_acc: dict[int, list[dict]] = {}
    for t in w.transactions:
        tx_by_acc.setdefault(t["account_id"], []).append(t)
    for a in w.accounts:
        txs = tx_by_acc.get(a["id"], [])
        spend_by_div: dict[str, float] = {}
        for t in txs:
            spend_by_div[t["division_code"]] = spend_by_div.get(t["division_code"], 0) + t["amount"]
        top_div = max(spend_by_div, key=spend_by_div.get) if spend_by_div else "EB"
        if top_div == "SVC":
            top_div = "EB"
        candidates = reps_for(top_div, a["region"])
        if a["region"] == "West" and top_div == "EB":
            candidates = [x for x in w.reps if x["persona_key"] == "priya"] + candidates
        if a["region"] == "West" and top_div == "FMSG":
            candidates = [x for x in w.reps if x["persona_key"] == "arjun"]
        a["owner_rep_id"] = candidates[0]["id"] if candidates else None
    if w.accounts:
        w.accounts[0]["owner_rep_id"] = 1  # TechNova -> Priya
    strata: dict[str, list[dict]] = {}
    for a in w.accounts[1:]:
        strata.setdefault(a["account_type"], []).append(a)
    for group in strata.values():
        r.shuffle(group)
        for a in group[: int(len(group) * settings.holdout_fraction)]:
            a["in_holdout"] = True

    # ---------------------------------------------------------------- raw division records (silos)
    systems = {"EB": "sap_b1", "HON": "tally", "FMSG": "zoho", "FMCT": "tally", "SVC": "excel"}
    for a in w.accounts:
        divs = sorted({t["division_code"] for t in tx_by_acc.get(a["id"], [])}) or ["EB"]
        for d in divs:
            missing_gst = r.random() < 0.28
            phone = f"+91 9{r.randint(100000000, 999999999)}" if d == divs[0] else None
            w.source_records.append({
                "division_code": d, "system": systems[d],
                "raw_name": a["name"] if d == divs[0] else _name_variant(r, a["name"], a["city"]),
                "raw_gstin": None if missing_gst else (a["gstin"][:14] + ("X" if a["gstin"][14] != "X" else "Y")
                                                      if r.random() < 0.05 else a["gstin"]),  # ~5% keying errors
                "phone": phone, "pincode": f"{a['_pin']}{r.randint(0, 99):03d}"[:6], "city": a["city"],
                "truth_account_id": a["id"],
            })
        a["data_quality"] = round(1.0 - 0.18 * sum(1 for s in w.source_records[-len(divs):] if not s["raw_gstin"]) / len(divs), 3)

    # ---------------------------------------------------------------- interactions
    t0 = datetime.combine(start, datetime.min.time())
    notes_by_key = dict(INTENT_NOTES)
    for a in w.accounts:
        for im, key in a["_intent_events"]:
            ts = t0 + timedelta(days=30 * im + r.randint(0, 6), hours=r.randint(9, 19))
            if a["id"] == 1 and key == "tender" and im == months - 1:
                ts = settings.demo_now - timedelta(days=6)
            if ts > settings.demo_now:
                ts = settings.demo_now - timedelta(days=r.randint(1, 20))
            w.interactions.append({"account_id": a["id"], "rep_id": a["owner_rep_id"],
                                   "channel": r.choice(["whatsapp", "call", "visit", "whatsapp"]), "ts": ts,
                                   "note": notes_by_key[key].format(n=r.choice([4, 6, 8, 12, 20, 40])),
                                   "sentiment": 0.6})
        for _ in range(r.randint(2, 7)):
            ts = t0 + timedelta(days=r.randint(0, months * 30 - 1), hours=r.randint(9, 19))
            if ts > settings.demo_now:
                ts = settings.demo_now - timedelta(days=r.randint(1, 60))
            note = r.choice(NEUTRAL_NOTES)
            sentiment = -0.4 if "unhappy" in note or "comparing" in note else 0.1
            w.interactions.append({"account_id": a["id"], "rep_id": a["owner_rep_id"],
                                   "channel": r.choice(["whatsapp", "call", "visit", "email", "whatsapp"]),
                                   "ts": ts, "note": note, "sentiment": sentiment})
    return w


def monthly_hazard_doc() -> str:  # pragma: no cover - documentation helper
    return f"hazard = 0.018 * need * home * activity * season * (1 + 0.85 * siblings); exp(-1)={math.exp(-1):.3f}"
