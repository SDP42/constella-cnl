"""Continuous learning: the model is never static.

Three loops keep scores current:
  1. **Online re-score** (seconds). When orders are ingested, the live whitespace snapshot is rebuilt
     with the current model. New purchases remove the whitespace they fill and shift co-purchase
     lift for peers.
  2. **Feedback prior** (instant). Each rep 👍/👎 updates a Beta(2,2)-smoothed relevance rate per
     category and per opportunity kind. Live probabilities are multiplied by that rate relative to
     the network average, clipped to [0.6, 1.25], so bad suggestions stop surfacing without waiting
     for a retrain.
  3. **Champion / challenger retrain** (about 20 s). The challenger is trained on all data up to the
     clock and back-tested on the same time split. It is promoted only if value-ranked GP capture@5
     is no worse than the champion's (−0.5 pt tolerance). Every run is versioned in ModelRun.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from datetime import date, datetime
from typing import Any

import pandas as pd
from sqlmodel import Session, col, select

from app.core.config import get_settings
from app.core.db import engine
from app.ml.features import FEATURES, snapshot
from app.ml.model import train_and_evaluate
from app.models import OPEN_STATUSES, Account, Feedback, ModelRun, Opportunity, Product, Transaction
from app.state import state

settings = get_settings()
_lock = threading.Lock()
RETRAIN_AFTER_ORDERS = 25
_status: dict[str, Any] = {"running": False, "last": None, "orders_since_train": 0}


# ------------------------------------------------------------------ feedback priors
def feedback_priors(s: Session) -> dict[str, Any]:
    rows = s.exec(select(Feedback)).all()
    opps = {o.id: o for o in s.exec(select(Opportunity).where(col(Opportunity.id).in_([r.opportunity_id for r in rows]))).all()} if rows else {}
    cat, kind = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    for r in rows:
        o = opps.get(r.opportunity_id)
        for c in (o.categories if o else []):
            cat[c][0 if r.useful else 1] += 1
        kind[r.kind][0 if r.useful else 1] += 1
    tot_u = sum(v[0] for v in kind.values())
    tot = sum(v[0] + v[1] for v in kind.values())
    base = (tot_u + 2) / (tot + 4)

    def mult(u: int, n: int) -> float:
        rate = (u + 2) / (u + n + 4)  # Beta(2,2) posterior mean
        return round(min(1.25, max(0.6, rate / base)), 3)

    return {"n": len(rows), "base_rate": round(base, 3),
            "category": {c: {"useful": u, "not": n, "mult": mult(u, n)} for c, (u, n) in cat.items()},
            "kind": {k: {"useful": u, "not": n, "mult": mult(u, n)} for k, (u, n) in kind.items()}}


# ------------------------------------------------------------------ re-scoring
def _frames(s: Session) -> dict[str, pd.DataFrame]:
    from app.pipeline import frames

    return frames(s)


def rescore(s: Session, f: dict[str, pd.DataFrame] | None = None) -> dict[str, Any]:
    """Rebuild the live snapshot with the current model and feedback priors, then refresh open opportunities."""
    f = f or _frames(s)
    live, ctx = snapshot(f["tx"], f["accounts"], f["interactions"], state.now.date(), settings.eval_window_days, with_labels=False)
    pri = feedback_priors(s)
    live["p_model"] = state.model.clf.predict_proba(live[FEATURES])[:, 1]
    live["fb_mult"] = live["category"].map(lambda c: pri["category"].get(c, {}).get("mult", 1.0))
    live["p"] = (live["p_model"] * live["fb_mult"]).clip(0, 0.99)
    prev = state.live.set_index(["account_id", "category"])["p"] if state.live is not None else None
    state.live, state.cooc = live, ctx
    key = live.set_index(["account_id", "category"])["p"]
    moved = []
    for o in s.exec(select(Opportunity).where(col(Opportunity.status).in_(list(OPEN_STATUSES)))).all():
        pairs = [(o.account_id, c) for c in o.categories]
        now_p = [float(key[k]) for k in pairs if k in key.index]
        was_p = [float(prev[k]) for k in pairs if prev is not None and k in prev.index]
        kmult = pri["kind"].get(o.kind.value, {}).get("mult", 1.0)
        if now_p and was_p:
            drift = (sum(now_p) / len(now_p)) / max(1e-4, sum(was_p) / len(was_p))
        elif was_p and not now_p:
            drift = 0.5  # the whitespace was filled by a new order (attribution handles wins)
        else:
            drift = 1.0
        base_p = float(o.explanation.get("p_detected", o.probability))
        fb = o.explanation.get("feedback_mult", 1.0) or 1.0
        new_p = round(min(0.99, max(0.01, o.probability / fb * min(1.6, max(0.4, drift)) * kmult)), 4)
        if abs(new_p - o.probability) < 0.005:
            continue
        ratio = new_p / max(1e-4, o.probability)
        moved.append({"id": o.id, "title": o.title, "from": round(o.probability, 3), "to": new_p})
        o.score = round(o.score * ratio, 2)
        o.probability = new_p
        o.explanation = {**o.explanation, "p_detected": base_p, "rescored_at": str(state.now), "feedback_mult": kmult}
        s.add(o)
    s.commit()
    state.cache.clear()
    moved.sort(key=lambda m: -abs(m["to"] - m["from"]))
    return {"pairs_scored": int(len(live)), "opportunities_moved": len(moved), "top_moves": moved[:8]}


# ------------------------------------------------------------------ champion / challenger
def _version(s: Session) -> int:
    return len(s.exec(select(ModelRun.id)).all())


def retrain(reason: str = "manual") -> dict[str, Any]:
    if not _lock.acquire(blocking=False):
        return {"status": "busy", "detail": "a retrain is already running"}
    _status["running"] = True
    t0 = time.time()
    try:
        with Session(engine) as s:
            f = _frames(s)
            ch, _ = train_and_evaluate(f["tx"], f["accounts"], f["interactions"], state.now.date(),
                                       settings.eval_window_days, settings.top_k)
            champ = state.metrics or {}
            c_gp = (champ.get("gp_capture@5") or {}).get("constella_value_ranked", 0.0)
            n_gp = ch.metrics["gp_capture@5"]["constella_value_ranked"]
            promoted = n_gp >= c_gp - 0.005
            info = {"version": _version(s) + 1, "reason": reason, "promoted": promoted,
                    "champion_gp5": c_gp, "challenger_gp5": n_gp,
                    "challenger_auc": ch.metrics["models"]["constella_gbm"]["auc"],
                    "transactions": int(len(f["tx"])), "feedback": feedback_priors(s)["n"],
                    "cutoff": str(state.now.date()), "seconds": round(time.time() - t0, 1)}
            s.add(ModelRun(created_at=state.now, metrics={**ch.metrics, "resolution": state.resolution, "run": info}))
            s.commit()
            if promoted:
                state.model, state.metrics = ch, ch.metrics
                from app.pipeline import save_model

                save_model(ch)
            info["rescore"] = rescore(s, f)
            info["seconds"] = round(time.time() - t0, 1)
            _status["orders_since_train"] = 0
            _status["last"] = info
            return info
    finally:
        _status["running"] = False
        _lock.release()


def retrain_async(reason: str) -> None:
    threading.Thread(target=retrain, args=(reason,), daemon=True).start()


# ------------------------------------------------------------------ order ingest
def ingest_orders(s: Session, rows: list[dict[str, Any]]) -> dict[str, Any]:
    prods = {p.sku: p for p in s.exec(select(Product)).all()}
    by_cat: dict[str, Product] = {}
    for p in prods.values():
        by_cat.setdefault(p.category, p)
    accounts = set(s.exec(select(Account.id)).all())
    ok, errors = [], []
    for i, r in enumerate(rows):
        aid = int(r.get("account_id") or 0)
        p = prods.get(str(r.get("sku") or "")) or by_cat.get(str(r.get("category") or ""))
        if aid not in accounts:
            errors.append({"row": i, "error": f"unknown account_id {aid}"})
            continue
        if not p:
            errors.append({"row": i, "error": "unknown sku/category"})
            continue
        qty = max(1, int(r.get("qty") or 1))
        amount = float(r.get("amount") or p.unit_price * qty)
        d = r.get("tx_date")
        tx_date = date.fromisoformat(str(d)) if d else state.now.date()
        t = Transaction(account_id=aid, sku=p.sku, division_code=p.division_code, category=p.category,
                        tx_date=tx_date, qty=qty, amount=round(amount, 2), gross_margin=round(amount * p.margin_pct, 2))
        s.add(t)
        ok.append({"account_id": aid, "category": p.category, "amount": t.amount})
    s.commit()
    from app.api.labs import attribute_orders

    attr = attribute_orders(s) if ok else {"matched": 0, "value": 0}
    res = rescore(s) if ok else {}
    _status["orders_since_train"] += len(ok)
    queued = _status["orders_since_train"] >= RETRAIN_AFTER_ORDERS and not _status["running"]
    if queued:
        retrain_async(f"{_status['orders_since_train']} new orders")
    return {"ingested": len(ok), "errors": errors[:20], "attribution": attr, "rescore": res, "retrain_queued": queued,
            "orders_since_train": _status["orders_since_train"], "retrain_threshold": RETRAIN_AFTER_ORDERS}


def status(s: Session) -> dict[str, Any]:
    runs = s.exec(select(ModelRun).order_by(ModelRun.id)).all()
    hist = []
    for i, r in enumerate(runs, 1):
        m = r.metrics or {}
        run = m.get("run", {})
        hist.append({"version": i, "at": str(r.created_at), "reason": run.get("reason", "initial build"),
                     "promoted": run.get("promoted", True),
                     "auc": (m.get("models") or {}).get("constella_gbm", {}).get("auc"),
                     "gp5": (m.get("gp_capture@5") or {}).get("constella_value_ranked"),
                     "ece": m.get("ece"), "transactions": run.get("transactions"), "feedback": run.get("feedback")})
    return {"running": _status["running"], "last": _status["last"], "orders_since_train": _status["orders_since_train"],
            "retrain_threshold": RETRAIN_AFTER_ORDERS, "history": hist[-12:], "feedback": feedback_priors(s),
            "champion": {"auc": (state.metrics.get("models") or {}).get("constella_gbm", {}).get("auc"),
                         "gp5": (state.metrics.get("gp_capture@5") or {}).get("constella_value_ranked")},
            "now": str(state.now), "checked_at": str(datetime.now())[:19]}
