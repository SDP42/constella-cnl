"""Feature engineering for (account, category) whitespace pairs at a point-in-time cutoff.

Everything is computed strictly from data *before* the cutoff, so back-tests are leak-free.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from app.data import catalog as C

CATS = list(C.CATEGORIES.keys())
CAT_DIV = {c: s["div"] for c, s in C.CATEGORIES.items()}
INTENT_KEYWORDS: dict[str, list[str]] = {
    "tender": ["interactive_display", "mini_pc", "structured_cabling", "projector", "connectivity"],
    "classroom": ["interactive_display", "mini_pc", "projector"],
    "branches": ["structured_cabling", "digital_signage", "commercial_monitor", "retail_security"],
    "stores": ["digital_signage", "retail_security", "home_audio", "instant_camera", "action_camera"],
    "office": ["air_purifier", "interactive_display", "mini_pc", "home_audio", "commercial_monitor"],
    "air quality": ["air_purifier"],
    "signage": ["digital_signage", "signage_cms"],
    "outlets": ["digital_signage", "retail_security"],
    "gaming": ["gaming_pc", "gaming_peripherals", "commercial_monitor"],
    "youtubers": ["action_camera", "memory_cards", "video_accessories"],
    "creator": ["action_camera", "memory_cards", "video_accessories", "instant_camera"],
}

FEATURES = [
    "cf_score", "rule_lift", "rule_conf", "peer_adoption", "solution_coverage", "vertical_fit",
    "div_affinity", "owns_division", "n_categories", "n_divisions", "recency_days", "frequency_12m",
    "log_monetary_12m", "growth_ratio", "log_employees", "credit_headroom", "avg_payment_days",
    "season", "intent", "annuity_base", "cat_margin", "cat_wc_days", "type_code", "vertical_code",
]
CATEGORICAL = ["type_code", "vertical_code"]
TYPE_CODES = {t: i for i, t in enumerate(C.TYPE_DIVISION_AFFINITY)}
VERT_CODES = {v: i for i, v in enumerate(C.VERTICALS)}
ANNUITY_BASE = {v: k for k, v in C.ANNUITY_FOR.items()}


def seasonal_flag(cat: str, region: str, vertical: str, cutoff: date, horizon_days: int) -> float:
    months = {(cutoff + timedelta(days=d)).month for d in range(0, horizon_days, 15)}
    if cat in ("air_purifier", "filter_subscription") and months & {10, 11, 12, 1} and region in ("North", "East"):
        return 1.0
    if cat in ("interactive_display", "projector", "mini_pc") and months & {3, 4, 5, 6} and vertical in ("education", "government"):
        return 1.0
    if cat in ("instant_camera", "action_camera", "gaming_peripherals") and months & {10, 11}:
        return 1.0
    return 0.0


def cooccurrence(owned: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """owned: binary account x category. Returns cosine sim, lift, confidence matrices."""
    m = owned.values.astype(float)
    n = max(1, m.shape[0])
    co = m.T @ m
    support = np.diag(co) / n
    norms = np.sqrt(np.diag(co))
    with np.errstate(divide="ignore", invalid="ignore"):
        cos = co / np.outer(norms, norms)
        conf = co / np.diag(co)[:, None]  # P(col | row)
        lift = conf / support[None, :]
    for arr in (cos, conf, lift):
        np.fill_diagonal(arr, 0)
        arr[~np.isfinite(arr)] = 0
    # require minimum co-support of 4 accounts to trust a rule
    weak = co < 4
    lift[weak] = 0
    conf[weak] = 0
    cols = owned.columns
    return (pd.DataFrame(cos, cols, cols), pd.DataFrame(lift, cols, cols), pd.DataFrame(conf, cols, cols))


def snapshot(tx: pd.DataFrame, accounts: pd.DataFrame, interactions: pd.DataFrame,
             cutoff: date, horizon_days: int, with_labels: bool = True) -> tuple[pd.DataFrame, dict]:
    hist = tx[tx["tx_date"] <= cutoff]
    owned = (hist.assign(v=1).pivot_table(index="account_id", columns="category", values="v", aggfunc="max")
             .reindex(index=accounts["id"], columns=CATS).fillna(0))
    cos, lift, conf = cooccurrence(owned)

    acc = accounts.set_index("id")
    peer_key = acc["account_type"] + "|" + acc["vertical"]
    peer_rate = owned.groupby(peer_key.reindex(owned.index).values).mean()

    last12 = hist[hist["tx_date"] > cutoff - timedelta(days=365)]
    last6 = hist[hist["tx_date"] > cutoff - timedelta(days=182)]
    prev6 = hist[(hist["tx_date"] <= cutoff - timedelta(days=182)) & (hist["tx_date"] > cutoff - timedelta(days=365))]
    mon12 = last12.groupby("account_id")["amount"].sum()
    freq12 = last12.groupby("account_id").size()
    s6, p6 = last6.groupby("account_id")["amount"].sum(), prev6.groupby("account_id")["amount"].sum()
    recency = hist.groupby("account_id")["tx_date"].max()
    divs_owned = hist.groupby("account_id")["division_code"].agg(lambda s: set(s))

    recent_notes = interactions[(interactions["ts"].dt.date <= cutoff) &
                                (interactions["ts"].dt.date > cutoff - timedelta(days=150))]
    intent_cats: dict[int, dict[str, str]] = {}
    for row in recent_notes.itertuples():
        low = row.note.lower()
        for kw, cs in INTENT_KEYWORDS.items():
            if kw in low:
                for c in cs:
                    intent_cats.setdefault(row.account_id, {})[c] = row.note

    sol_req = [(s, [x["category"] for x in s["components"] if x["required"]]) for s in C.SOLUTIONS]

    if with_labels:
        fut = tx[(tx["tx_date"] > cutoff) & (tx["tx_date"] <= cutoff + timedelta(days=horizon_days))]
        future_pairs = set(zip(fut["account_id"], fut["category"], strict=False))
    else:
        future_pairs = set()

    rows = []
    cos_v, lift_v, conf_v = cos.values, lift.values, conf.values
    cidx = {c: i for i, c in enumerate(CATS)}
    for aid, own_row in owned.iterrows():
        a = acc.loc[aid]
        own = [c for c in CATS if own_row[c] > 0]
        own_i = [cidx[c] for c in own]
        dset = divs_owned.get(aid, set())
        pr = peer_rate.loc[peer_key[aid]] if peer_key[aid] in peer_rate.index else None
        rec_days = (cutoff - recency[aid]).days if aid in recency.index else 999
        m12 = float(mon12.get(aid, 0.0))
        growth = float((s6.get(aid, 0) + 1) / (p6.get(aid, 0) + 1))
        headroom = max(0.0, (a["credit_limit"] - a["credit_used"]) / max(1.0, a["credit_limit"]))
        for c in CATS:
            if own_row[c] > 0:
                continue
            spec = C.CATEGORIES[c]
            base = ANNUITY_BASE.get(c)
            if spec.get("recurring") and base and own_row.get(base, 0) == 0:
                continue  # annuity only makes sense on an installed base
            j = cidx[c]
            if own_i:
                cf = float(cos_v[own_i, j].sum() / np.sqrt(len(own_i)))
                li = lift_v[own_i, j]
                best = int(np.argmax(li))
                rl, rc = float(li[best]), float(conf_v[own_i[best], j])
                antecedent = own[best] if rl > 0 else None
            else:
                cf = rl = rc = 0.0
                antecedent = None
            cov = 0.0
            for s, req in sol_req:
                if c in [x["category"] for x in s["components"]] and a["vertical"] in s["verticals"]:
                    cov = max(cov, sum(1 for q in req if own_row.get(q, 0) > 0) / len(req))
            rows.append({
                "account_id": aid, "category": c,
                "cf_score": cf, "rule_lift": rl, "rule_conf": rc,
                "peer_adoption": float(pr[c]) if pr is not None else 0.0,
                "solution_coverage": cov,
                "vertical_fit": 1.0 if c in C.VERTICAL_NEEDS[a["vertical"]] else 0.0,
                "div_affinity": C.TYPE_DIVISION_AFFINITY[a["account_type"]][spec["div"]],
                "owns_division": 1.0 if spec["div"] in dset else 0.0,
                "n_categories": len(own), "n_divisions": len(dset),
                "recency_days": rec_days, "frequency_12m": float(freq12.get(aid, 0)),
                "log_monetary_12m": float(np.log1p(m12)), "growth_ratio": min(growth, 10.0),
                "log_employees": float(np.log1p(a["employees"])), "credit_headroom": headroom,
                "avg_payment_days": float(a["avg_payment_days"]),
                "season": seasonal_flag(c, a["region"], a["vertical"], cutoff, horizon_days),
                "intent": 1.0 if c in intent_cats.get(aid, {}) else 0.0,
                "annuity_base": 1.0 if base and own_row.get(base, 0) > 0 else 0.0,
                "cat_margin": spec["margin"], "cat_wc_days": float(spec["wc"]),
                "type_code": TYPE_CODES[a["account_type"]], "vertical_code": VERT_CODES[a["vertical"]],
                "label": 1 if (aid, c) in future_pairs else 0,
                "_antecedent": antecedent, "_note": intent_cats.get(aid, {}).get(c),
            })
    ctx = {"cos": cos, "lift": lift, "conf": conf, "owned": owned, "peer_rate": peer_rate}
    return pd.DataFrame(rows), ctx
