"""Credit, cash and margin intelligence — the constraints CNL's growth actually runs into.

* credit_scores   — dynamic partner credit grade (A–E) from payment behaviour, utilisation, order trend and
                    churn risk; recommends a limit change and flags early-warning partners.
* collections     — estimated overdue exposure ranked by risk-weighted amount (worklist for credit control).
* nwc_simulator   — what DSO / DIO / DPO changes do to net working-capital days and cash released.
* waterfall       — pocket-margin waterfall for a deal: list → discount → scheme rebate → freight → credit cost.
* approval_matrix — who may approve which discount (rep ≤3%, head ≤6%, CFO above; margin floor enforced).
* scheme_progress — "₹X to the next rebate slab" per partner per brand scheme.
* annuity_ledger  — ARR by partner, renewals due, attach rate, NRR proxy.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

from app.data import catalog as C

FINANCE_COST = 0.12  # annual cost of capital tied up in receivables
FREIGHT_PCT = 0.012
MARGIN_FLOOR = 0.025  # pocket margin below which only the CFO can approve


def credit_scores(accounts: pd.DataFrame, tx: pd.DataFrame, churn: pd.DataFrame | None, now: date) -> pd.DataFrame:
    a = accounts.copy()
    a["util"] = a["credit_used"] / a["credit_limit"].clip(lower=1)
    last6 = tx[tx["tx_date"] > now - timedelta(days=182)].groupby("account_id")["amount"].sum()
    prev6 = tx[(tx["tx_date"] <= now - timedelta(days=182)) & (tx["tx_date"] > now - timedelta(days=365))].groupby("account_id")["amount"].sum()
    a["trend"] = np.log1p(a["id"].map(last6).fillna(0)) - np.log1p(a["id"].map(prev6).fillna(0))
    risk = churn.set_index("account_id")["risk"] if churn is not None and len(churn) else pd.Series(dtype=float)
    a["churn_risk"] = a["id"].map(risk).fillna(0.3)
    # score 0–100: payment discipline 40%, utilisation 25%, momentum 20%, retention 15%
    pay = np.clip((95 - a["avg_payment_days"]) / 75, 0, 1)
    util = np.clip(1 - (a["util"] - 0.4) / 0.6, 0, 1)
    mom = np.clip(0.5 + a["trend"] / 2, 0, 1)
    ret = 1 - a["churn_risk"]
    a["score"] = (100 * (0.40 * pay + 0.25 * util + 0.20 * mom + 0.15 * ret)).round(1)
    a["grade"] = pd.cut(a["score"], [-1, 35, 50, 65, 80, 101], labels=["E", "D", "C", "B", "A"]).astype(str)
    change = {"A": 0.25, "B": 0.10, "C": 0.0, "D": -0.10, "E": -0.25}
    a["limit_change_pct"] = a["grade"].map(change)
    a["recommended_limit"] = (a["credit_limit"] * (1 + a["limit_change_pct"])).round(-4)
    a["early_warning"] = (a["grade"].isin(["D", "E"])) & (a["util"] > 0.8)
    # estimated overdue: receivable beyond 45 standard terms, proportional to payment days
    monthly = a["id"].map(last6).fillna(0) / 6
    a["receivable"] = (monthly * a["avg_payment_days"] / 30).round(-2)
    a["overdue"] = (a["receivable"] * np.clip((a["avg_payment_days"] - 45) / a["avg_payment_days"].clip(lower=1), 0, 1)).round(-2)
    return a


def nwc_simulator(dso: float, dio: float, dpo: float, annual_revenue: float, base: dict[str, float]) -> dict[str, Any]:
    nwc = dso + dio - dpo
    base_nwc = base["dso"] + base["dio"] - base["dpo"]
    per_day = annual_revenue / 365
    released = (base_nwc - nwc) * per_day
    return {"nwc_days": round(nwc, 1), "base_nwc_days": round(base_nwc, 1), "cash_released": round(released),
            "interest_saved": round(released * FINANCE_COST), "per_day_value": round(per_day),
            "components": {"dso": dso, "dio": dio, "dpo": dpo}}


def waterfall(list_value: float, margin_pct: float, discount_pct: float, scheme_rebate_pct: float, credit_days: float) -> dict[str, Any]:
    gross = list_value * margin_pct
    discount = list_value * discount_pct
    rebate = list_value * scheme_rebate_pct  # back-end rebate from the brand improves pocket margin
    freight = list_value * FREIGHT_PCT
    credit = list_value * (1 - discount_pct) * FINANCE_COST * credit_days / 365
    pocket = gross - discount + rebate - freight - credit
    steps = [
        {"step": "List gross margin", "value": round(gross)},
        {"step": "Discount", "value": round(-discount)},
        {"step": "Brand scheme rebate", "value": round(rebate)},
        {"step": "Freight & handling", "value": round(-freight)},
        {"step": "Cost of credit", "value": round(-credit)},
    ]
    return {"steps": steps, "pocket_margin": round(pocket), "pocket_pct": round(pocket / max(1.0, list_value), 4),
            "list_value": round(list_value)}


def approval_for(discount_pct: float, pocket_pct: float) -> tuple[str, bool]:
    """Returns (approver_role, auto_approve)."""
    if pocket_pct < MARGIN_FLOOR:
        return "cfo", False
    if discount_pct <= 0.03:
        return "rep", True
    if discount_pct <= 0.06:
        return "head", False
    return "cfo", False


def scheme_progress(tx: pd.DataFrame, products: pd.DataFrame, account_ids: set[int] | None, now: date) -> list[dict[str, Any]]:
    t = tx.merge(products[["sku", "brand"]], on="sku", how="left")
    out = []
    for sc in C.BRAND_SCHEMES:
        w = t[(t["brand"] == sc["brand"]) & (t["tx_date"] > now - timedelta(days=sc["period_days"]))]
        if account_ids is not None:
            w = w[w["account_id"].isin(account_ids)]
        for aid, amt in w.groupby("account_id")["amount"].sum().items():
            slabs = sc["slabs"]
            cur = max([s for s in slabs if amt >= s[0]], default=None, key=lambda s: s[0])
            nxt = next((s for s in slabs if amt < s[0]), None)
            if not nxt:
                continue
            gap = nxt[0] - amt
            if gap > nxt[0] * 0.6:
                continue  # too far to be actionable
            out.append({"scheme_id": sc["id"], "scheme": sc["name"], "brand": sc["brand"], "account_id": int(aid),
                        "turnover": round(float(amt)), "current_rebate": cur[1] if cur else 0.0,
                        "next_slab": nxt[0], "next_rebate": nxt[1], "gap": round(float(gap)),
                        "rebate_gain": round(float(nxt[0] * nxt[1] - amt * (cur[1] if cur else 0)))})
    return sorted(out, key=lambda x: x["gap"] / x["next_slab"])


def annuity_ledger(tx: pd.DataFrame, assets: pd.DataFrame, accounts: pd.DataFrame, now: date) -> dict[str, Any]:
    svc = tx[tx["division_code"] == "SVC"]
    last12 = svc[svc["tx_date"] > now - timedelta(days=365)]
    prev12 = svc[(svc["tx_date"] <= now - timedelta(days=365)) & (svc["tx_date"] > now - timedelta(days=730))]
    arr_now = last12.groupby("account_id")["amount"].sum()
    arr_prev = prev12.groupby("account_id")["amount"].sum()
    retained = arr_now.reindex(arr_prev.index).fillna(0).clip(upper=None).sum()
    nrr = float(retained / max(1.0, arr_prev.sum()))
    base_cats = set(C.ANNUITY_FOR)
    installed = assets[assets["category"].isin(base_cats)]
    with_base = set(installed["account_id"])
    attached = set(arr_now.index)
    due = assets.dropna(subset=["next_service_due"])
    due = due[(pd.to_datetime(due["next_service_due"]).dt.date >= now) & (pd.to_datetime(due["next_service_due"]).dt.date <= now + timedelta(days=90))]
    names = accounts.set_index("id")["name"]
    by_cat = last12.groupby("category")["amount"].sum().sort_values(ascending=False)
    top = arr_now.sort_values(ascending=False).head(12)
    return {
        "arr": round(float(arr_now.sum())), "arr_prev": round(float(arr_prev.sum())), "nrr": round(nrr, 3),
        "partners_with_annuity": len(attached), "partners_with_installed_base": len(with_base),
        "attach_rate": round(len(attached & with_base) / max(1, len(with_base)), 3),
        "renewals_due_90d": int(len(due)),
        "by_category": [{"category": c, "label": C.CATEGORIES[c]["label"], "arr": round(float(v))} for c, v in by_cat.items()],
        "top_partners": [{"account_id": int(a), "name": names.get(a, str(a)), "arr": round(float(v))} for a, v in top.items()],
        "renewals": [{"account_id": int(r.account_id), "name": names.get(r.account_id, ""), "category": C.CATEGORIES[r.category]["label"],
                      "annuity": C.CATEGORIES[C.ANNUITY_FOR[r.category]]["label"] if r.category in C.ANNUITY_FOR else "",
                      "qty": int(r.qty), "due": str(r.next_service_due)}
                     for r in due.sort_values("next_service_due").head(15).itertuples()],
    }
