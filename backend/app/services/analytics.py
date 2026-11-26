"""Growth, operations, team and data-trust analytics (feature batch 3).

Every function is a pure transform of the account-twin frames, so it scales with the same pipeline.
Synthetic operational feeds (stock, tenders, SI projects, RMA, contacts) are generated deterministically
from a seed and clearly labelled as illustrative in the API responses.
"""

from __future__ import annotations

import hashlib
import random
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

from app.data import catalog as C

DIVS = ["EB", "HON", "FMSG", "FMCT", "SVC"]


def _r(seed: str) -> random.Random:
    return random.Random(int(hashlib.md5(seed.encode()).hexdigest()[:8], 16))


# ------------------------------------------------------------------ growth lab
def wallet_treemap(tx: pd.DataFrame, accounts: pd.DataFrame, now: date, n: int = 80) -> list[dict[str, Any]]:
    s12 = tx[tx["tx_date"] > now - timedelta(days=365)].groupby("account_id")["amount"].sum()
    a = accounts.assign(cnl=accounts["id"].map(s12).fillna(0))
    a["share"] = (a["cnl"] / a["est_annual_tech_spend"].clip(lower=1)).clip(upper=1)
    top = a.sort_values("est_annual_tech_spend", ascending=False).head(n)
    return [{"id": int(r.id), "name": r.name, "size": float(r.est_annual_tech_spend), "cnl": float(r.cnl), "share": round(float(r.share), 3),
             "type": str(r.account_type), "region": r.region} for r in top.itertuples()]


def type_division_flows(tx: pd.DataFrame, accounts: pd.DataFrame, now: date) -> dict[str, Any]:
    t = tx[tx["tx_date"] > now - timedelta(days=365)].merge(accounts[["id", "account_type"]], left_on="account_id", right_on="id")
    g = t.groupby(["account_type", "division_code"])["amount"].sum().reset_index()
    types = sorted(g["account_type"].astype(str).unique())
    nodes = [{"name": x.replace("_", " ").title()} for x in types] + [{"name": d} for d in DIVS]
    links = [{"source": types.index(str(r.account_type)), "target": len(types) + DIVS.index(r.division_code), "value": float(r.amount)}
             for r in g.itertuples() if r.amount > 0]
    return {"nodes": nodes, "links": links}


def city_map(tx: pd.DataFrame, accounts: pd.DataFrame, opps: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    s12 = tx[tx["tx_date"] > now - timedelta(days=365)].groupby("account_id")["amount"].sum()
    a = accounts.assign(cnl=accounts["id"].map(s12).fillna(0))
    open_v = opps.groupby("account_id")["est_value"].sum() if len(opps) else pd.Series(dtype=float)
    a["open"] = a["id"].map(open_v).fillna(0)
    out = []
    for city, g in a.groupby("city"):
        _, lat, lng, _ = C.CITIES[city]
        out.append({"city": city, "lat": lat, "lng": lng, "partners": int(len(g)), "spend": float(g["cnl"].sum()),
                    "wallet": float(g["est_annual_tech_spend"].sum()), "open": float(g["open"].sum()),
                    "share": round(float(g["cnl"].sum() / max(1.0, g["est_annual_tech_spend"].sum())), 3),
                    "leakage": float((g["est_annual_tech_spend"] - g["cnl"]).clip(lower=0).sum())})
    return sorted(out, key=lambda x: -x["open"])


def cohorts(tx: pd.DataFrame, now: date) -> dict[str, Any]:
    t = tx[tx["tx_date"] <= now].copy()
    t["q"] = pd.to_datetime(t["tx_date"]).dt.to_period("Q")
    first = t.groupby("account_id")["q"].min()
    t["cohort"] = t["account_id"].map(first)
    t["age"] = (t["q"] - t["cohort"]).apply(lambda x: x.n)
    rows = []
    for c, g in t.groupby("cohort"):
        size = g["account_id"].nunique()
        act = g.groupby("age")["account_id"].nunique()
        rows.append({"cohort": str(c), "size": int(size), "retention": [round(float(act.get(i, 0)) / size, 3) for i in range(int(act.index.max()) + 1)]})
    return {"rows": rows[-8:]}


def rfm(tx: pd.DataFrame, accounts: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    t = tx[tx["tx_date"] > now - timedelta(days=365)]
    last = tx.groupby("account_id")["tx_date"].max()
    f = t.groupby("account_id")["tx_date"].nunique()
    m = t.groupby("account_id")["amount"].sum()
    out = []
    names = accounts.set_index("id")["name"]
    for aid in accounts["id"]:
        rec = (now - last[aid]).days if aid in last.index else 999
        fr, mo = int(f.get(aid, 0)), float(m.get(aid, 0))
        seg = ("Champion" if rec <= 30 and fr >= 8 else "Loyal" if fr >= 6 else "At risk" if rec > 120 and mo > 2e5
               else "Hibernating" if rec > 180 else "New" if fr <= 2 and rec <= 60 else "Needs attention")
        out.append({"id": int(aid), "name": names[aid], "recency": int(rec), "frequency": fr, "monetary": round(mo), "segment": seg})
    return out


def pareto(tx: pd.DataFrame, now: date) -> dict[str, Any]:
    s = tx[tx["tx_date"] > now - timedelta(days=365)].groupby("account_id")["amount"].sum().sort_values(ascending=False)
    cum = (s.cumsum() / s.sum()).values
    n = len(s)
    pts = [{"partners_pct": round((i + 1) / n, 3), "revenue_pct": round(float(cum[i]), 3)} for i in range(0, n, max(1, n // 50))]
    a = int((cum <= 0.8).sum()) + 1
    b = int((cum <= 0.95).sum()) + 1 - a
    return {"curve": pts, "abc": {"A": a, "B": b, "C": n - a - b}, "top20_share": round(float(cum[int(n * 0.2)]), 3)}


def category_matrix(tx: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    l12 = tx[tx["tx_date"] > now - timedelta(days=365)].groupby("category")["amount"].sum()
    p12 = tx[(tx["tx_date"] <= now - timedelta(days=365)) & (tx["tx_date"] > now - timedelta(days=730))].groupby("category")["amount"].sum()
    tot = float(l12.sum()) or 1.0
    out = []
    for c, v in l12.items():
        g = (v - p12.get(c, 0)) / p12.get(c, 1) if p12.get(c, 0) > 0 else 1.0
        share = v / tot
        quad = ("Star" if g > 0.3 and share > 0.03 else "Cash cow" if share > 0.03 else "Question mark" if g > 0.3 else "Dog")
        out.append({"category": c, "label": C.CATEGORIES[c]["label"], "division": C.CATEGORIES[c]["div"], "growth": round(float(min(g, 3)), 3),
                    "share": round(float(share), 4), "margin": C.CATEGORIES[c]["margin"], "revenue": float(v), "quadrant": quad})
    return out


def seasonality(tx: pd.DataFrame, top: int = 10) -> dict[str, Any]:
    t = tx.copy()
    t["m"] = pd.to_datetime(t["tx_date"]).dt.month
    cats = t.groupby("category")["amount"].sum().nlargest(top).index
    rows = []
    for c in cats:
        g = t[t["category"] == c].groupby("m")["amount"].sum().reindex(range(1, 13), fill_value=0)
        idx = (g / max(1.0, g.mean())).round(2)
        rows.append({"category": c, "label": C.CATEGORIES[c]["label"], "index": idx.tolist()})
    return {"months": ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], "rows": rows}


def affinity(cooc: dict[str, Any], top: int = 12) -> dict[str, Any]:
    owned = cooc["owned"]
    lift = cooc["lift"]
    cats = owned.mean().nlargest(top).index.tolist()
    return {"categories": [{"id": c, "label": C.CATEGORIES[c]["label"], "division": C.CATEGORIES[c]["div"]} for c in cats],
            "matrix": [[round(float(lift.loc[a, b]), 2) for b in cats] for a in cats]}


def lookalikes(tx: pd.DataFrame, accounts: pd.DataFrame, aid: int, k: int = 8) -> dict[str, Any]:
    v = tx.pivot_table(index="account_id", columns="category", values="amount", aggfunc="sum").fillna(0)
    v = np.log1p(v)
    if aid not in v.index:
        return {"similar": [], "whitespace": []}
    x = v.loc[aid].values
    norms = np.linalg.norm(v.values, axis=1) * (np.linalg.norm(x) or 1)
    sim = pd.Series(v.values @ x / np.where(norms == 0, 1, norms), index=v.index).drop(aid).nlargest(k)
    names = accounts.set_index("id")["name"]
    own = set(v.columns[v.loc[aid] > 0])
    counts: Counter = Counter()
    for other in sim.index:
        counts.update(set(v.columns[v.loc[other] > 0]) - own)
    return {"similar": [{"id": int(i), "name": names[i], "similarity": round(float(s), 3)} for i, s in sim.items()],
            "whitespace": [{"category": c, "label": C.CATEGORIES[c]["label"], "lookalikes_buying": n} for c, n in counts.most_common(6)]}


def next_category_paths(tx: pd.DataFrame, top: int = 14) -> list[dict[str, Any]]:
    first = tx.sort_values("tx_date").groupby(["account_id", "category"])["tx_date"].min().reset_index()
    trans: Counter = Counter()
    for _, g in first.sort_values("tx_date").groupby("account_id"):
        seq = g["category"].tolist()
        for a, b in zip(seq, seq[1:], strict=False):
            trans[(a, b)] += 1
    from_tot = Counter()
    for (a, _), n in trans.items():
        from_tot[a] += n
    return [{"from": C.CATEGORIES[a]["label"], "to": C.CATEGORIES[b]["label"], "count": n, "prob": round(n / from_tot[a], 3),
             "cross_division": C.CATEGORIES[a]["div"] != C.CATEGORIES[b]["div"]} for (a, b), n in trans.most_common(top)]


def revenue_at_risk(tx: pd.DataFrame, accounts: pd.DataFrame, churn: pd.DataFrame, now: date) -> dict[str, Any]:
    s12 = tx[tx["tx_date"] > now - timedelta(days=365)].groupby("account_id")["amount"].sum()
    c = churn.assign(spend=churn["account_id"].map(s12).fillna(0))
    c["at_risk"] = c["risk"] * c["spend"]
    names = accounts.set_index("id")["name"]
    top = c.sort_values("at_risk", ascending=False).head(10)
    return {"total": float(c["at_risk"].sum()), "items": [{"id": int(r.account_id), "name": names[r.account_id], "risk": round(float(r.risk), 3),
                                                            "spend": float(r.spend), "at_risk": float(r.at_risk)} for r in top.itertuples()]}


# ------------------------------------------------------------------ operations hub (illustrative feeds)
def inventory(tx: pd.DataFrame, live: pd.DataFrame | None, accounts: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    d90 = tx[tx["tx_date"] > now - timedelta(days=90)].groupby("category")["qty"].sum() / 90
    names = accounts.set_index("id")["name"]
    out = []
    for c, spec in C.CATEGORIES.items():
        if spec.get("recurring"):
            continue
        r = _r(f"stock:{c}")
        daily = float(d90.get(c, 0.2)) or 0.2
        cover = r.choice([8, 12, 18, 35, 45, 60, 95, 120, 150])
        stock = int(daily * cover)
        state = "low" if cover < 15 else "overstock" if cover > 90 else "healthy"
        targets = []
        if state == "overstock" and live is not None:
            sub = live[live["category"] == c].nlargest(4, "p")
            targets = [{"id": int(t.account_id), "name": names[t.account_id], "p": round(float(t.p), 3)} for t in sub.itertuples()]
        out.append({"category": c, "label": spec["label"], "division": spec["div"], "stock_units": stock, "days_cover": cover,
                    "state": state, "push_targets": targets,
                    "action": "Raise PO with brand" if state == "low" else "Run clearance to likely buyers" if state == "overstock" else "—"})
    return sorted(out, key=lambda x: (x["state"] != "low", x["state"] != "overstock", x["days_cover"]))


DEPTS = ["Maharashtra School Education Dept", "Pune Smart City SPV", "AIIMS Bhubaneswar", "Gujarat Education Board", "Karnataka e-Gov",
         "Delhi Jal Board", "UP Basic Shiksha Parishad", "Kerala IT Mission", "Chennai Metro Rail", "Indore Smart City"]


def tenders(accounts: pd.DataFrame, tx: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    owned = tx.groupby("account_id")["category"].agg(set).to_dict()
    sis = accounts[accounts["account_type"].astype(str) == "system_integrator"]
    out = []
    for i, dept in enumerate(DEPTS):
        r = _r(f"tender:{i}")
        sol = r.choice(C.SOLUTIONS)
        city = r.choice(list(C.CITIES))
        region = C.CITIES[city][0]
        value = r.choice([45, 80, 120, 250, 400, 900]) * 1e5
        cats = [x["category"] for x in sol["components"] if x["required"]]
        cand = sis[sis["region"] == region].copy()
        cand["fit"] = cand["id"].map(lambda a: len(set(cats) & owned.get(a, set())) / len(cats))
        best = cand.sort_values(["fit", "est_annual_tech_spend"], ascending=False).head(3)
        out.append({"id": f"GEM/2026/B/{4812000 + i * 137}", "department": dept, "city": city, "solution": sol["name"],
                    "value": value, "closes": str(now + timedelta(days=r.randint(6, 40))), "emd": round(value * 0.02, -3),
                    "partners": [{"id": int(b.id), "name": b.name, "fit": round(float(b.fit), 2)} for b in best.itertuples()]})
    return sorted(out, key=lambda x: x["closes"])


def si_projects(now: date) -> list[dict[str, Any]]:
    base = [("BharatNet Middle Mile — Odisha (illustrative tracker)", 3194.83e7, ["Mobilisation", "Survey & design", "OFC laying 30%", "OFC laying 70%", "SNOC data centre", "Acceptance testing", "O&M year 1"]),
            ("Pune Smart Classroom rollout — 400 schools", 18.4e7, ["PO & BOM freeze", "Pilot 20 schools", "Wave 1 (150)", "Wave 2 (230)", "AMC start"]),
            ("Hospital patient-experience — 12 sites", 6.2e7, ["Site survey", "Cabling", "Signage + purifiers", "Handover", "CMS + filter annuity"])]
    out = []
    for name, value, ms in base:
        r = _r(name)
        done = r.randint(1, len(ms) - 1)
        rows = []
        for i, m in enumerate(ms):
            bill = round(1 / len(ms), 3)
            st = "billed" if i < done - 1 else "in progress" if i == done - 1 else "planned"
            rows.append({"milestone": m, "billing_pct": bill, "status": st, "due": str(now + timedelta(days=(i - done + 1) * 45))})
        billed = sum(x["billing_pct"] for x in rows if x["status"] == "billed")
        out.append({"project": name, "value": value, "billed_pct": round(billed, 3), "collected_pct": round(billed * r.uniform(0.6, 0.95), 3),
                    "milestones": rows, "risk": r.choice(["On track", "Right-of-way delays", "Payment cycle stretch"])})
    return out


def rma(assets: pd.DataFrame, products: pd.DataFrame) -> list[dict[str, Any]]:
    a = assets.merge(products[["sku", "brand"]], on="sku", how="left")
    out = []
    for (cat, brand), g in a.groupby(["category", "brand"]):
        r = _r(f"rma:{cat}:{brand}")
        units = int(g["qty"].sum())
        rate = r.choice([0.004, 0.008, 0.012, 0.018, 0.031, 0.046])
        out.append({"category": C.CATEGORIES[cat]["label"], "brand": brand, "installed": units, "rma_rate": rate, "returns": int(units * rate),
                    "alert": rate > 0.025, "play": "Raise quality case with brand; offer extended warranty to affected partners" if rate > 0.025 else "—"})
    return sorted(out, key=lambda x: -x["rma_rate"])[:14]


def mdf_plan(brands: list[dict[str, Any]], budget: float = 2.5e7) -> list[dict[str, Any]]:
    weight = {b["brand"]: b["whitespace_partners"] * (1 + max(0.0, b["growth"] or 0)) for b in brands if b["whitespace_partners"]}
    tot = sum(weight.values()) or 1
    out = []
    for b in brands:
        if b["brand"] not in weight:
            continue
        alloc = budget * weight[b["brand"]] / tot
        roi = 2.2 + (b["growth"] or 0) * 2
        out.append({"brand": b["brand"], "allocation": round(alloc, -3), "whitespace_partners": b["whitespace_partners"],
                    "expected_revenue": round(alloc * roi, -3), "roi": round(roi, 2)})
    return sorted(out, key=lambda x: -x["allocation"])[:10]


# ------------------------------------------------------------------ team hub
def team(opps: pd.DataFrame, reps: pd.DataFrame, events: pd.DataFrame) -> dict[str, Any]:
    rows = []
    for r in reps[reps["role"] == "rep"].itertuples():
        mine = opps[opps["lead_rep_id"] == r.id]
        won = mine[mine["status"] == "WON"]
        assist_credit = 0.0
        for o in opps[opps["status"] == "WON"].itertuples():
            for a in o.assists or []:
                if a.get("rep_id") == r.id:
                    assist_credit += (o.closed_value or 0) * a.get("credit", 0)
        lead_credit = float((won["closed_value"].fillna(0) * 0.7).sum())
        credit = lead_credit + assist_credit
        quota = 9e6 + _r(f"quota:{r.id}").random() * 9e6
        sol = int((won["kind"] == "SOLUTION").sum())
        ann = int((won["kind"] == "RECURRING").sum())
        breached = int((mine["escalation_level"] > 0).sum())
        badges = [b for b, ok in [("Solution seller", sol >= 2), ("Annuity champion", ann >= 2), ("SLA hero", breached == 0 and len(mine) > 0),
                                  ("Team player", assist_credit > 2e5), ("Closer", len(won) >= 4)] if ok]
        rows.append({"id": int(r.id), "name": r.name, "division": r.division_code, "region": r.region, "won": int(len(won)),
                     "credit": round(credit), "assist_credit": round(assist_credit), "quota": round(quota, -4),
                     "attainment": round(credit / quota, 3), "solutions": sol, "annuity": ann, "badges": badges})
    rows.sort(key=lambda x: -x["credit"])
    # stage velocity from the audit trail
    ev = events.sort_values("ts")
    vel: dict[str, list[float]] = defaultdict(list)
    for _, g in ev.groupby("opportunity_id"):
        ts = dict(zip(g["kind"], pd.to_datetime(g["ts"]), strict=False))
        for a, b in [("assigned", "accepted"), ("accepted", "contacted"), ("contacted", "proposal"), ("proposal", "negotiation"), ("negotiation", "won")]:
            if a in ts and b in ts and ts[b] > ts[a]:
                vel[f"{a}→{b}"].append((ts[b] - ts[a]).total_seconds() / 86400)
    velocity = [{"stage": k, "days": round(float(np.median(v)), 1), "n": len(v)} for k, v in vel.items()]
    lost = events[events["kind"] == "lost"]["detail"].str.replace("Lost — ", "", regex=False).value_counts().head(6)
    return {"leaderboard": rows, "velocity": velocity, "loss_reasons": [{"reason": k, "count": int(v)} for k, v in lost.items()]}


# ------------------------------------------------------------------ data trust & compliance
GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin_check_digit(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        v = GST_CHARS.index(ch) * (2 if i % 2 else 1)
        total += v // 36 + v % 36
    return GST_CHARS[(36 - total % 36) % 36]


def gstin_valid(g: str | None) -> bool:
    if not g or len(g) != 15 or any(ch not in GST_CHARS for ch in g):
        return False
    return gstin_check_digit(g[:14]) == g[14]


def psi(a: np.ndarray, b: np.ndarray, bins: int = 10) -> float:
    q = np.unique(np.quantile(a, np.linspace(0, 1, bins + 1)))
    if len(q) < 3:
        return 0.0
    pa = np.histogram(a, q)[0] / max(1, len(a)) + 1e-4
    pb = np.histogram(b, q)[0] / max(1, len(b)) + 1e-4
    return round(float(np.sum((pa - pb) * np.log(pa / pb))), 4)


def contacts(accounts: pd.DataFrame, n: int = 40) -> list[dict[str, Any]]:
    out = []
    for a in accounts.head(n).itertuples():
        r = _r(f"contact:{a.id}")
        consent = r.choice(["granted", "granted", "granted", "withdrawn", "pending"])
        captured = date(2025, r.randint(1, 12), r.randint(1, 28))
        out.append({"account_id": int(a.id), "account": a.name, "contact": f"{r.choice(C.FIRST_NAMES)} {r.choice(C.LAST_NAMES)}",
                    "role": r.choice(["Owner", "Purchase head", "IT manager", "Accounts"]), "purpose": "B2B sales & service communication",
                    "consent": consent, "captured": str(captured), "retain_until": str(captured + timedelta(days=3 * 365)),
                    "channel": r.choice(["WhatsApp", "Email", "Phone"])})
    return out
