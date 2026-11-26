"""BI, forecasting and prediction layer.

* revenue forecast    — log-linear trend + month-of-year seasonality (OLS), 80% interval, back-tested MAPE
* churn prediction    — logistic regression trained on a past window ("no order in next 120 days"), time-split AUC
* next-order ETA      — per-account median inter-order gap; overdue partners flagged
* anomaly detection   — weekly division revenue z-scores
* FY29 path           — sample network scaled to CNL's reported revenue; scenario sliders vs ₹6,000 Cr / 40% brand mix
* brand portal        — per-brand sell-through, growth, penetration and whitespace across the network
* nudges              — AI-suggested campaign segments (bundles, season, win-back, near-complete solutions, DaaS)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

from app.data import catalog as C

CNL_FY26_REVENUE = 2699.77e7  # ₹ consolidated FY26 (investor presentation)
FY29_TARGET = 6000e7
BRAND_TARGET = 0.40
BRAND_BUSINESS = {"Honeywell", "WOZOYO", "CyberPowerPC", "Infinova", "AT&T"}
DIVS = ["EB", "HON", "FMSG", "FMCT", "SVC"]


def _month(d: pd.Series) -> pd.Series:
    return pd.to_datetime(d).dt.to_period("M").dt.to_timestamp()


# ------------------------------------------------------------------ revenue + forecast
def monthly_by_division(tx: pd.DataFrame, now: date) -> pd.DataFrame:
    t = tx[tx["tx_date"] <= now].copy()
    t["month"] = _month(t["tx_date"])
    m = t.pivot_table(index="month", columns="division_code", values="amount", aggfunc="sum").fillna(0)
    m = m.reindex(columns=DIVS, fill_value=0)
    # drop the current (partial) month
    if len(m) and m.index[-1].month == now.month and m.index[-1].year == now.year:
        m = m.iloc[:-1]
    # trim thin edge months (history start, and a last month the ERP extract hasn't fully closed)
    tot = m.sum(axis=1)
    med = float(tot.median()) if len(tot) else 0
    while len(m) > 6 and tot.iloc[0] < 0.7 * med:
        m, tot = m.iloc[1:], tot.iloc[1:]
    while len(m) > 6 and tot.iloc[-1] < 0.7 * med:
        m, tot = m.iloc[:-1], tot.iloc[:-1]
    return m


def _design(t: np.ndarray, months: list[pd.Timestamp]) -> np.ndarray:
    m = np.array([d.month for d in months], dtype=float)
    w = 2 * np.pi * m / 12
    return np.column_stack([np.ones(len(t)), t, np.sin(w), np.cos(w), np.sin(2 * w), np.cos(2 * w)])


def _fit_forecast(y: np.ndarray, months: list[pd.Timestamp], horizon: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Log-linear trend + 2-harmonic Fourier seasonality (6 parameters — robust on 24 monthly points)."""
    n = len(y)
    t = np.arange(n, dtype=float)
    X = _design(t, months)
    ly = np.log(np.maximum(y, 1.0))
    # ridge-regularised least squares keeps the seasonal terms honest on short history
    lam = 0.5
    beta = np.linalg.solve(X.T @ X + lam * np.diag([0, 0, 1, 1, 1, 1]), X.T @ ly)
    resid = ly - X @ beta
    sigma = float(np.sqrt(np.sum(resid ** 2) / max(1, n - X.shape[1])))
    fut_months = [months[-1] + pd.DateOffset(months=i + 1) for i in range(horizon)]
    Xf = _design(np.arange(n, n + horizon, dtype=float), fut_months)
    mu = Xf @ beta
    return np.exp(mu), np.exp(mu - 1.28 * sigma), np.exp(mu + 1.28 * sigma)


def forecast(tx: pd.DataFrame, now: date, horizon: int = 6) -> dict[str, Any]:
    m = monthly_by_division(tx, now)
    total = m.sum(axis=1)
    months = list(total.index)
    y = total.values
    fc, lo, hi = _fit_forecast(y, months, horizon)
    # back-test: fit on all but last 4 months, score the last 4
    bt_fc, _, _ = _fit_forecast(y[:-4], months[:-4], 4)
    mape = float(np.mean(np.abs(bt_fc - y[-4:]) / np.maximum(y[-4:], 1)))
    fut = [months[-1] + pd.DateOffset(months=i + 1) for i in range(horizon)]
    history = [{"month": d.strftime("%Y-%m"), **{k: round(float(v)) for k, v in row.items()}, "total": round(float(row.sum()))}
               for d, row in m.iterrows()]
    return {
        "history": history,
        "forecast": [{"month": d.strftime("%Y-%m"), "total": round(float(f)), "lo": round(float(a)), "hi": round(float(b))}
                     for d, f, a, b in zip(fut, fc, lo, hi, strict=True)],
        "backtest_mape": round(mape, 4),
        "method": "log-linear trend + 2-harmonic seasonality (ridge OLS), 80% prediction interval",
    }


# ------------------------------------------------------------------ brand mix + FY29 path
def brand_mix(tx: pd.DataFrame, products: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    t = tx.merge(products[["sku", "brand"]], on="sku", how="left")
    t = t[t["tx_date"] <= now].copy()
    t["month"] = _month(t["tx_date"])
    t["brand_biz"] = t["brand"].isin(BRAND_BUSINESS)
    g = t.groupby("month").apply(lambda d: d.loc[d["brand_biz"], "amount"].sum() / max(1.0, d["amount"].sum()),
                                 include_groups=False)
    if len(g) and g.index[-1].month == now.month and g.index[-1].year == now.year:
        g = g.iloc[:-1]  # current month is partial
    return [{"month": d.strftime("%Y-%m"), "brand_share": round(float(v), 4)} for d, v in g.items()]


def fy29_path(tx: pd.DataFrame, products: pd.DataFrame, now: date, base_growth: float, uplift: float,
              brand_gain_pp: float) -> dict[str, Any]:
    last12 = tx[(tx["tx_date"] > now - timedelta(days=365)) & (tx["tx_date"] <= now)]
    sample_rev = float(last12["amount"].sum())
    scale = CNL_FY26_REVENUE / max(1.0, sample_rev)
    t = last12.merge(products[["sku", "brand"]], on="sku", how="left")
    brand_share0 = float(t.loc[t["brand"].isin(BRAND_BUSINESS), "amount"].sum() / max(1.0, sample_rev))
    years, rev, share = ["FY26", "FY27", "FY28", "FY29"], [CNL_FY26_REVENUE], [brand_share0]
    base = [CNL_FY26_REVENUE]
    for _ in range(3):
        base.append(base[-1] * (1 + base_growth))
        rev.append(rev[-1] * (1 + base_growth + uplift))
        share.append(min(0.9, share[-1] + brand_gain_pp))
    req = (FY29_TARGET / CNL_FY26_REVENUE) ** (1 / 3) - 1
    return {
        "scale_factor": round(scale, 2), "sample_annual_revenue": round(sample_rev),
        "years": [{"year": y, "revenue": round(r), "baseline": round(b), "brand_share": round(s, 4)}
                  for y, r, b, s in zip(years, rev, base, share, strict=True)],
        "target_revenue": FY29_TARGET, "target_brand_share": BRAND_TARGET,
        "required_cagr": round(req, 4), "gap_fy29": round(FY29_TARGET - rev[-1]),
        "on_track": rev[-1] >= FY29_TARGET and share[-1] >= BRAND_TARGET,
        "assumptions": {"base_growth": base_growth, "constella_uplift": uplift, "brand_gain_pp_per_year": brand_gain_pp,
                        "fy26_revenue_source": "CNL consolidated FY26, investor presentation"},
    }


# ------------------------------------------------------------------ penetration heatmap
def penetration(tx: pd.DataFrame, accounts: pd.DataFrame) -> dict[str, Any]:
    own = tx.groupby(["account_id", "division_code"]).size().reset_index()[["account_id", "division_code"]]
    own = own.merge(accounts[["id", "vertical"]], left_on="account_id", right_on="id")
    n_by_v = accounts.groupby("vertical").size()
    cells = []
    for (v, d), g in own.groupby(["vertical", "division_code"]):
        cells.append({"vertical": v, "division": d, "share": round(len(g) / max(1, n_by_v.get(v, 1)), 3)})
    return {"verticals": sorted(n_by_v.index.tolist()), "divisions": DIVS, "cells": cells}


# ------------------------------------------------------------------ churn + next order
def _churn_features(tx: pd.DataFrame, accounts: pd.DataFrame, interactions: pd.DataFrame, cutoff: date) -> pd.DataFrame:
    h = tx[tx["tx_date"] <= cutoff]
    rows = []
    neg = interactions[(interactions["sentiment"] < 0) & (interactions["ts"].dt.date <= cutoff) &
                       (interactions["ts"].dt.date > cutoff - timedelta(days=180))].groupby("account_id").size()
    by = {a: g for a, g in h.groupby("account_id")}
    for a in accounts.itertuples():
        g = by.get(a.id)
        if g is None or g.empty:
            continue
        last = g["tx_date"].max()
        s6 = g.loc[g["tx_date"] > cutoff - timedelta(days=182), "amount"].sum()
        p6 = g.loc[(g["tx_date"] <= cutoff - timedelta(days=182)) & (g["tx_date"] > cutoff - timedelta(days=365)), "amount"].sum()
        f6 = (g["tx_date"] > cutoff - timedelta(days=182)).sum()
        rows.append({"account_id": a.id, "recency": (cutoff - last).days, "trend": np.log1p(s6) - np.log1p(p6),
                     "freq6": f6, "n_cats": g["category"].nunique(), "neg_notes": int(neg.get(a.id, 0)),
                     "pay_days": a.avg_payment_days, "credit_util": a.credit_used / max(1.0, a.credit_limit)})
    return pd.DataFrame(rows)


CHURN_FEATURES = ["recency", "trend", "freq6", "n_cats", "neg_notes", "pay_days", "credit_util"]


def churn_model(tx: pd.DataFrame, accounts: pd.DataFrame, interactions: pd.DataFrame, now: date) -> dict[str, Any]:
    horizon = 120
    train_cut = now - timedelta(days=2 * horizon)
    eval_cut = now - timedelta(days=horizon)

    def labelled(cut: date) -> pd.DataFrame:
        f = _churn_features(tx, accounts, interactions, cut)
        fut = set(tx[(tx["tx_date"] > cut) & (tx["tx_date"] <= cut + timedelta(days=horizon))]["account_id"])
        f["label"] = (~f["account_id"].isin(fut)).astype(int)
        return f

    tr, ev = labelled(train_cut), labelled(eval_cut)
    clf = LogisticRegression(max_iter=500, class_weight="balanced").fit(tr[CHURN_FEATURES], tr["label"])
    auc = float(roc_auc_score(ev["label"], clf.predict_proba(ev[CHURN_FEATURES])[:, 1])) if ev["label"].nunique() > 1 else None
    live = _churn_features(tx, accounts, interactions, now)
    live["risk"] = clf.predict_proba(live[CHURN_FEATURES])[:, 1]
    coefs = dict(zip(CHURN_FEATURES, clf.coef_[0].round(3).tolist(), strict=True))
    return {"live": live, "auc": round(auc, 4) if auc else None, "coefficients": coefs,
            "base_rate": round(float(ev["label"].mean()), 4)}


def next_orders(tx: pd.DataFrame, now: date) -> pd.DataFrame:
    rows = []
    for aid, g in tx[tx["tx_date"] <= now].groupby("account_id"):
        d = sorted(set(g["tx_date"]))
        if len(d) < 3:
            continue
        gaps = np.diff(np.array([np.datetime64(x) for x in d])).astype("timedelta64[D]").astype(int)
        gap = float(np.median(gaps))
        nxt = d[-1] + timedelta(days=int(gap))
        last_amt = float(g[g["tx_date"] == d[-1]]["amount"].sum())
        rows.append({"account_id": aid, "last_order": d[-1], "median_gap_days": int(gap), "next_order": nxt,
                     "days_to_next": (nxt - now).days, "typical_order": round(float(g.groupby("tx_date")["amount"].sum().median())),
                     "last_amount": round(last_amt)})
    return pd.DataFrame(rows)


# ------------------------------------------------------------------ anomalies
def anomalies(tx: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    t = tx[(tx["tx_date"] <= now) & (tx["tx_date"] > now - timedelta(days=7 * 40))].copy()
    t["week"] = pd.to_datetime(t["tx_date"]).dt.to_period("W").dt.start_time
    w = t.pivot_table(index="week", columns="division_code", values="amount", aggfunc="sum").fillna(0)
    out = []
    for d in w.columns:
        s = w[d]
        base = s.iloc[:-8]
        mu, sd = float(base.mean()), float(base.std() or 1)
        for wk, v in s.iloc[-8:].items():
            z = (float(v) - mu) / sd
            if abs(z) >= 2.5 and mu > 0 and (z > 0 or float(v) > 0):
                out.append({"week": wk.strftime("%Y-%m-%d"), "division": d, "value": round(float(v)), "expected": round(mu),
                            "z": round(z, 2), "direction": "spike" if z > 0 else "drop"})
    return sorted(out, key=lambda x: -abs(x["z"]))[:12]


# ------------------------------------------------------------------ brand portal
def brands(tx: pd.DataFrame, products: pd.DataFrame, accounts: pd.DataFrame, now: date) -> list[dict[str, Any]]:
    t = tx.merge(products[["sku", "brand"]], on="sku", how="left")
    last = t[t["tx_date"] > now - timedelta(days=365)]
    prev = t[(t["tx_date"] <= now - timedelta(days=365)) & (t["tx_date"] > now - timedelta(days=730))]
    cats_by_brand = defaultdict(set)
    for c, spec in C.CATEGORIES.items():
        for b in spec["brands"]:
            cats_by_brand[b].add(c)
    fit_verticals = defaultdict(set)
    for v, cats in C.VERTICAL_NEEDS.items():
        for c in cats:
            for b in C.CATEGORIES[c]["brands"]:
                fit_verticals[b].add(v)
    n_acc = len(accounts)
    out = []
    for b, g in last.groupby("brand"):
        buyers = set(g["account_id"])
        fit = accounts[accounts["vertical"].isin(fit_verticals.get(b, set()))]
        whitespace = len(set(fit["id"]) - buyers)
        p = float(prev.loc[prev["brand"] == b, "amount"].sum())
        r = float(g["amount"].sum())
        out.append({"brand": b, "revenue_12m": round(r), "growth": round((r - p) / p, 3) if p else None,
                    "partners": len(buyers), "penetration": round(len(buyers) / n_acc, 3),
                    "whitespace_partners": whitespace, "categories": sorted(cats_by_brand.get(b, [])),
                    "brand_business": b in BRAND_BUSINESS,
                    "gross_margin": round(float(g["gross_margin"].sum()), 0)})
    return sorted(out, key=lambda x: -x["revenue_12m"])


# ------------------------------------------------------------------ AI nudges (campaign segments)
def nudges(tx: pd.DataFrame, accounts: pd.DataFrame, assets: pd.DataFrame, churn: pd.DataFrame, now: date,
           region: str | None = None) -> list[dict[str, Any]]:
    acc = accounts if not region else accounts[accounts["region"] == region]
    ids = set(acc["id"])
    owned = tx[tx["account_id"].isin(ids)].groupby("account_id")["category"].agg(set).to_dict()
    price = {c: s["price"] for c, s in C.CATEGORIES.items()}
    out: list[dict[str, Any]] = []
    for b in C.BRAND_BUNDLES:
        seg = [a for a, cs in owned.items() if b["anchor"] in cs and b["attach"] not in cs]
        have = [a for a, cs in owned.items() if b["anchor"] in cs]
        if not have:
            continue
        rate = 1 - len(seg) / len(have)
        if seg:
            out.append({"id": f"bundle:{b['id']}", "kind": "bundle", "title": f"Attach {C.CATEGORIES[b['attach']]['label']} to {C.CATEGORIES[b['anchor']]['label']} buyers",
                        "why": f"{b['rule']}. Attach rate today {rate * 100:.0f}% vs target {b['attach_rate_target'] * 100:.0f}%.",
                        "accounts": seg, "size": len(seg), "est_value": round(len(seg) * price[b["attach"]] * 6),
                        "category": b["attach"], "channel": "whatsapp", "confidence": round(0.5 + 0.4 * (b["attach_rate_target"] - rate), 2)})
    # season: purifier winter in North/East
    if now.month in (9, 10, 11, 12, 1):
        ne = acc[acc["region"].isin(["North", "East"])]["id"]
        seg = [a for a in ne if "air_purifier" not in owned.get(a, set())]
        out.append({"id": "season:purifier", "kind": "seasonal", "title": "Winter clean-air push — North & East partners",
                    "why": "Air-purifier demand peaks Oct–Jan with winter smog; these partners stock none yet. Pair with WOZOYO essentials.",
                    "accounts": seg[:200], "size": len(seg), "est_value": round(len(seg) * price["air_purifier"] * 8),
                    "category": "air_purifier", "channel": "whatsapp", "confidence": 0.72})
    # win-back
    if churn is not None and len(churn):
        risky = churn[(churn["risk"] > 0.7) & churn["account_id"].isin(ids)].sort_values("risk", ascending=False)
        if len(risky):
            out.append({"id": "winback:risk", "kind": "winback", "title": "Win back partners drifting to other distributors",
                        "why": f"{len(risky)} partners show falling orders and rising recency (churn model risk > 70%).",
                        "accounts": risky["account_id"].astype(int).tolist()[:150], "size": int(len(risky)),
                        "est_value": round(float(len(risky)) * 250000), "category": None, "channel": "call", "confidence": 0.64})
    # near-complete solutions
    for sol in C.SOLUTIONS:
        req = [x["category"] for x in sol["components"] if x["required"]]
        fit = set(acc[acc["vertical"].isin(sol["verticals"])]["id"])
        seg = [a for a in fit if len(set(req) - owned.get(a, set())) == 1]
        if len(seg) >= 3:
            out.append({"id": f"solution:{sol['id']}", "kind": "solution", "title": f"One component from a {sol['name']}",
                        "why": f"{len(seg)} partners already own all but one core {sol['name']} component — one call completes the solution.",
                        "accounts": seg, "size": len(seg),
                        "est_value": round(len(seg) * np.mean([price[c] for c in req]) * 4), "category": None,
                        "solution_id": sol["id"], "channel": "visit", "confidence": 0.58})
    # credit-blocked → DaaS
    tight = acc[(acc["credit_used"] / acc["credit_limit"].clip(lower=1)) > 0.85]["id"].tolist()
    if tight:
        out.append({"id": "daas:credit", "kind": "daas", "title": "Offer Device-as-a-Service to credit-tight partners",
                    "why": f"{len(tight)} partners use >85% of credit — growth stalls unless deals move off their balance sheet.",
                    "accounts": tight[:150], "size": len(tight), "est_value": round(len(tight) * 180000),
                    "category": "device_as_a_service", "channel": "email", "confidence": 0.55})
    out = [n for n in out if n["size"] > 0]
    for n in out:
        n["accounts"] = [int(x) for x in n["accounts"]]
    return sorted(out, key=lambda x: -x["est_value"])
