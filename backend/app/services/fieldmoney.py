"""Work: beat planner (field-visit route optimisation). Money: receivables, collections and 13-week cash.

Beat planner
  Picks the rep's highest value-at-stake open opportunities, clusters them in the rep's busiest city,
  and orders visits with nearest-neighbour + 2-opt (TSP heuristic) from the CNL branch.
  Travel time = haversine × 1.35 road factor ÷ 22 km/h city speed; 40-minute meetings from 10:00.

Collections
  CNL's binding constraint is working capital (NWC ~45 days). The ERP AR ledger is simulated from
  invoices: credit terms come from tier, and actual payment days come from each partner's
  behaviour (avg payment days, credit utilisation, ticket size, quarter-end push, noise).
  A gradient-boosted regressor is trained on *settled* invoices and predicts days-to-pay for *open* ones.
  That gives expected slippage, a risk-ranked collection worklist and a 13-week cash-in forecast.
"""

from __future__ import annotations

import math
import random
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

from app.data import catalog as C

TERMS = {"platinum": 60, "gold": 45, "silver": 30, "bronze": 21}


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def _tour(pts: list[tuple[float, float]]) -> list[int]:
    """Open tour starting at index 0: nearest neighbour then 2-opt improvement."""
    n = len(pts)
    left, order = set(range(1, n)), [0]
    while left:
        last = pts[order[-1]]
        nxt = min(left, key=lambda j: _km(last, pts[j]))
        order.append(nxt)
        left.remove(nxt)
    improved = True
    while improved:
        improved = False
        for i in range(1, n - 2):
            for k in range(i + 1, n - 1):
                a, b, c, d = pts[order[i - 1]], pts[order[i]], pts[order[k]], pts[order[k + 1]]
                if _km(a, c) + _km(b, d) < _km(a, b) + _km(c, d) - 1e-6:
                    order[i:k + 1] = reversed(order[i:k + 1])
                    improved = True
    return order


def beat_plan(rep: dict[str, Any], opps: list[dict[str, Any]], accounts: dict[int, dict[str, Any]], start: datetime, max_stops: int = 6) -> dict[str, Any]:
    if not opps:
        return {"stops": [], "summary": {}, "note": "No open opportunities to visit."}
    by_city: dict[str, float] = {}
    for o in opps:
        by_city[accounts[o["account_id"]]["city"]] = by_city.get(accounts[o["account_id"]]["city"], 0) + o["score"]
    city = max(by_city, key=by_city.get)
    best: dict[int, dict[str, Any]] = {}
    for o in sorted(opps, key=lambda o: -o["score"]):
        a = accounts[o["account_id"]]
        if a["city"] == city and o["account_id"] not in best:
            best[o["account_id"]] = o
        if len(best) >= max_stops:
            break
    _, blat, blng, _ = C.CITIES[city]
    pts = [(blat, blng)] + [(accounts[aid]["lat"], accounts[aid]["lng"]) for aid in best]
    order = _tour(pts)
    naive = sum(_km(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    t, stops, total_km = start, [], 0.0
    for prev, cur in zip(order, order[1:], strict=False):
        km = _km(pts[prev], pts[cur]) * 1.35
        total_km += km
        t = t + timedelta(minutes=km / 22 * 60)
        aid = list(best)[cur - 1]
        o, a = best[aid], accounts[aid]
        stops.append({"seq": len(stops) + 1, "account_id": aid, "name": a["name"], "lat": a["lat"], "lng": a["lng"],
                      "arrive": t.strftime("%H:%M"), "drive_km": round(km, 1), "opportunity": o["title"], "opp_id": o["id"],
                      "value": round(o["est_value"]), "probability": round(o["probability"], 2),
                      "talk_track": f"Open with what they already buy, then show the gap: {o['title'].split(' for ')[0]}."})
        t = t + timedelta(minutes=40)
    opt_km = sum(_km(pts[order[i]], pts[order[i + 1]]) for i in range(len(order) - 1))
    return {"city": city, "branch": {"lat": blat, "lng": blng}, "stops": stops,
            "summary": {"visits": len(stops), "km": round(total_km, 1), "finish": t.strftime("%H:%M"),
                        "pipeline": round(sum(s["value"] for s in stops)), "km_saved_vs_list_order": round((naive - opt_km) * 1.35, 1)},
            "how": "Top value-at-stake opportunities in your busiest city → nearest-neighbour + 2-opt route from the branch → 40-min meetings from 10:00."}


# ------------------------------------------------------------------ receivables
def _ledger(tx: pd.DataFrame, accounts: pd.DataFrame, now: date) -> pd.DataFrame:
    t = tx[(tx["tx_date"] > now - timedelta(days=400)) & (tx["tx_date"] <= now)].copy()
    inv = t.groupby(["account_id", "tx_date"]).agg(amount=("amount", "sum"), lines=("amount", "size")).reset_index()
    acc = accounts.set_index("id")
    inv["tier"] = inv["account_id"].map(acc["tier"])
    inv["terms"] = inv["tier"].map(TERMS).fillna(30).astype(int)
    inv["avg_pay"] = inv["account_id"].map(acc["avg_payment_days"])
    inv["util"] = inv["account_id"].map(acc["credit_used"] / acc["credit_limit"].clip(lower=1)).clip(0, 1.5)
    inv["log_amt"] = np.log1p(inv["amount"])
    d = pd.to_datetime(inv["tx_date"])
    inv["month"] = d.dt.month
    inv["qtr_end"] = d.dt.month.isin([3, 6, 9, 12]).astype(int)
    inv["dow"] = d.dt.dayofweek
    # simulated behaviour (the ERP would give us actual settlement dates)
    rng = np.random.default_rng(42)
    base = inv["avg_pay"] * (0.75 + 0.5 * inv["util"]) + 4 * (inv["log_amt"] - 11) - 6 * (inv["month"] == 3)
    inv["pay_days"] = np.maximum(3, base + rng.normal(0, 9, len(inv))).round()
    inv["due"] = d + pd.to_timedelta(inv["terms"], unit="D")
    inv["paid_on"] = d + pd.to_timedelta(inv["pay_days"], unit="D")
    inv["open"] = inv["paid_on"] > pd.Timestamp(now)
    return inv


FEATS = ["terms", "avg_pay", "util", "log_amt", "month", "qtr_end", "dow", "lines"]


def collections(tx: pd.DataFrame, accounts: pd.DataFrame, now: date) -> dict[str, Any]:
    inv = _ledger(tx, accounts, now)
    settled, open_ = inv[~inv["open"]], inv[inv["open"]].copy()
    cut = pd.Timestamp(now - timedelta(days=90))
    tr, te = settled[pd.to_datetime(settled["tx_date"]) < cut], settled[pd.to_datetime(settled["tx_date"]) >= cut]
    reg = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.08, random_state=3).fit(tr[FEATS], tr["pay_days"])
    mae = mean_absolute_error(te["pay_days"], reg.predict(te[FEATS])) if len(te) else None
    naive_mae = mean_absolute_error(te["pay_days"], te["avg_pay"]) if len(te) else None
    reg = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.08, random_state=3).fit(settled[FEATS], settled["pay_days"])
    open_["pred_days"] = reg.predict(open_[FEATS]).round()
    open_["pred_pay"] = pd.to_datetime(open_["tx_date"]) + pd.to_timedelta(open_["pred_days"], unit="D")
    open_["late_days"] = (open_["pred_days"] - open_["terms"]).clip(lower=0)
    open_["overdue_now"] = (pd.Timestamp(now) - open_["due"]).dt.days.clip(lower=0)
    open_["risk"] = np.select([open_["late_days"] > 30, open_["late_days"] > 10], ["high", "medium"], "low")
    open_["priority"] = open_["amount"] * (open_["late_days"] / 30).clip(0, 3) + open_["overdue_now"] * 500
    names = accounts.set_index("id")["name"]
    work = (open_.groupby("account_id").agg(outstanding=("amount", "sum"), invoices=("amount", "size"), worst_late=("late_days", "max"),
                                            overdue=("overdue_now", "max"), priority=("priority", "sum"), terms=("terms", "first"),
                                            next_pay=("pred_pay", "min"))
            .sort_values("priority", ascending=False).head(20).reset_index())
    worklist = [{"account_id": int(r.account_id), "name": names[r.account_id], "outstanding": round(r.outstanding), "invoices": int(r.invoices),
                 "terms": int(r.terms), "predicted_late_days": int(r.worst_late), "overdue_days": int(r.overdue),
                 "expected_by": str(r.next_pay.date()),
                 "action": "Call owner today; hold new credit" if r.worst_late > 30 else "WhatsApp reminder with UPI link" if r.worst_late > 10 else "Auto-reminder 3 days before due"}
                for r in work.itertuples()]
    weeks = []
    for w in range(13):
        a, b = pd.Timestamp(now) + pd.Timedelta(days=7 * w), pd.Timestamp(now) + pd.Timedelta(days=7 * (w + 1))
        due_amt = float(open_.loc[(open_["due"] >= a) & (open_["due"] < b), "amount"].sum())
        exp_amt = float(open_.loc[(open_["pred_pay"] >= a) & (open_["pred_pay"] < b), "amount"].sum())
        weeks.append({"week": w + 1, "start": str(a.date()), "contractual": round(due_amt), "expected": round(exp_amt)})
    sales_90 = float(inv.loc[pd.to_datetime(inv["tx_date"]) > pd.Timestamp(now - timedelta(days=90)), "amount"].sum())
    ar = float(open_["amount"].sum())
    dso = ar / max(1.0, sales_90 / 90)
    buckets = open_.assign(b=pd.cut(open_["overdue_now"], [-1, 0, 30, 60, 90, 10_000], labels=["Not due", "1–30", "31–60", "61–90", "90+"])) \
        .groupby("b", observed=False)["amount"].sum()
    imp = sorted(zip(FEATS, np.abs(np.corrcoef(settled[FEATS].T.values.astype(float), settled["pay_days"].values)[-1, :-1])), key=lambda x: -x[1])
    return {"ar_outstanding": round(ar), "dso": round(dso, 1), "open_invoices": int(len(open_)),
            "expected_late_value": round(float(open_.loc[open_["late_days"] > 10, "amount"].sum())),
            "aging": [{"bucket": str(k), "amount": round(float(v))} for k, v in buckets.items()],
            "weeks": weeks, "worklist": worklist,
            "model": {"algo": "HistGradientBoostingRegressor", "mae_days": round(mae, 1) if mae is not None else None,
                      "naive_mae_days": round(naive_mae, 1) if naive_mae is not None else None,
                      "trained_on": int(len(settled)), "drivers": [{"feature": f, "corr": round(float(c), 2)} for f, c in imp[:5]]},
            "note": "AR ledger simulated from invoices; in production it is the ERP's receivables table."}
