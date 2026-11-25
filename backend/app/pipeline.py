"""End-to-end build: collect -> unify -> learn -> detect -> route -> simulate lifecycle.

Run: `uv run python -m app.pipeline` (also runs automatically on first API start).
"""

from __future__ import annotations

import random
import time
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.db import engine, init_db
from app.data import catalog as C
from app.data.synth import build_world
from app.data.unify import resolve
from app.ml.features import snapshot
from app.ml.model import train_and_evaluate
from app.ml.opportunities import OpportunityBuilder
from app.models import (
    Account, AccountType, Division, InstalledAsset, Interaction, ModelRun, Opportunity, OpportunityEvent, OppKind, OppStatus, Product,
    SalesRep, Signal, SolutionTemplate, SourceRecord, Transaction,
)
from app.routing.engine import Router, sla_due
from app.state import state

settings = get_settings()


def _clean(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if not k.startswith("_")}


def frames(session: Session) -> dict[str, pd.DataFrame]:
    def df(model: Any) -> pd.DataFrame:
        rows = session.exec(select(model)).all()
        return pd.DataFrame([r.model_dump() for r in rows])

    out = {"tx": df(Transaction), "accounts": df(Account), "interactions": df(Interaction),
           "products": df(Product), "assets": df(InstalledAsset)}
    out["interactions"]["ts"] = pd.to_datetime(out["interactions"]["ts"])
    return out


def build(verbose: bool = True) -> dict[str, Any]:
    t0 = time.time()
    log = (lambda *a: print("[constella]", *a)) if verbose else (lambda *a: None)
    init_db(drop=True)
    w = build_world()
    log(f"world: {len(w.accounts)} accounts, {len(w.transactions)} transactions, {len(w.source_records)} raw records")

    matches, report = resolve(w.source_records, w.accounts)
    log(f"entity resolution: precision={report['precision']} recall={report['recall']}")

    with Session(engine) as s:
        s.add_all(Division(**d) for d in w.divisions)
        s.add_all(SalesRep(**r) for r in w.reps)
        s.add_all(Product(**p) for p in w.products)
        s.add_all(SolutionTemplate(id=x["id"], name=x["name"], tagline=x["tagline"], verticals=x["verticals"],
                                   components=x["components"], annuity=x["annuity"], icon=x["icon"]) for x in w.solutions)
        s.add_all(Account(**{**_clean(a), "account_type": AccountType(a["account_type"])}) for a in w.accounts)
        s.commit()
        s.add_all(SourceRecord(**rec, account_id=m.account_id, match_confidence=m.confidence, match_rule=m.rule)
                  for rec, m in zip(w.source_records, matches, strict=True))
        s.add_all(Transaction(**t) for t in w.transactions)
        s.add_all(InstalledAsset(**a) for a in w.assets)
        s.add_all(Interaction(**i) for i in w.interactions)
        s.commit()

        f = frames(s)
        model, _ = train_and_evaluate(f["tx"], f["accounts"], f["interactions"], settings.demo_now.date(),
                                      settings.eval_window_days, settings.top_k)
        state.model, state.metrics, state.resolution = model, model.metrics, report
        s.add(ModelRun(created_at=settings.demo_now, metrics={**model.metrics, "resolution": report}))
        log(f"model AUC={model.metrics['models']['constella_gbm']['auc']} "
            f"P@5={model.metrics['models']['constella_gbm']['precision@5']}")

        live, _ = snapshot(f["tx"], f["accounts"], f["interactions"], settings.demo_now.date(),
                           settings.eval_window_days, with_labels=False)
        b = OpportunityBuilder(model, f["accounts"], f["products"], f["tx"], f["assets"], f["interactions"],
                               settings.demo_now)
        b.build(live)
        for sig in b.signals:
            s.add(Signal(**sig))
        s.commit()
        log(f"signals: {len(b.signals)}  opportunities: {len(b.opps)}")

        accounts = {a["id"]: a for a in w.accounts}
        router = Router(w.reps, accounts)
        simulate_lifecycle(s, b.opps, router, accounts)
        s.commit()
    log(f"done in {time.time() - t0:.1f}s")
    return {"accounts": len(w.accounts), "opportunities": len(b.opps), "signals": len(b.signals)}


def _event(s: Session, oid: int, ts: datetime, actor: str, kind: str, detail: str, **meta: Any) -> None:
    s.add(OpportunityEvent(opportunity_id=oid, ts=ts, actor=actor, kind=kind, detail=detail, meta=meta))


def simulate_lifecycle(s: Session, opps: list[dict[str, Any]], router: Router, accounts: dict[int, dict]) -> None:
    """Give the pipeline a realistic past: opportunities detected over the last 75 days progress,
    stall, escalate, merge, win or lose. The newest ones stay fresh for the live demo."""
    r = random.Random(settings.seed + 7)
    now = settings.demo_now
    reps = router.reps
    opps.sort(key=lambda o: -o["score"])
    for i, o in enumerate(opps):
        acc = accounts[o["account_id"]]
        fresh = o["account_id"] == 1 or r.random() < 0.28
        age_days = r.uniform(0.2, 2.5) if fresh else r.uniform(3, 75)
        created = now - timedelta(days=age_days)
        holdout = bool(acc["in_holdout"])
        fields = {k: v for k, v in o.items() if k in Opportunity.model_fields and k != "kind"}
        opp = Opportunity(**fields, kind=OppKind(o["kind"]), created_at=created, in_holdout=holdout)
        s.add(opp)
        s.flush()
        _event(s, opp.id, created, "Constella", "detected",
               f"Signal detected — {o['kind'].replace('_', ' ')} (p={o['probability']:.2f})", score=o["score"])
        if holdout:
            opp.status = OppStatus.NURTURE
            opp.explanation = {**opp.explanation, "holdout": True}
            _event(s, opp.id, created, "Pilot", "holdout",
                   "Account is in the randomised control group — opportunity logged but not routed")
            continue
        route = router.route(o)
        opp.lead_rep_id, opp.lead_division, opp.assists = route["lead_rep_id"], route["lead_division"], route["assists"]
        opp.explanation = {**opp.explanation, "routing": route["routing"]}
        opp.assigned_at = created + timedelta(minutes=r.randint(1, 4))
        opp.status = OppStatus.ASSIGNED
        opp.due_by = sla_due(opp.assigned_at, accepted=False)
        lead = reps.get(opp.lead_rep_id) if opp.lead_rep_id else None
        _event(s, opp.id, opp.assigned_at, "Router", "assigned",
               f"Assigned to {lead['name'] if lead else '—'} ({opp.lead_division}) · {route['routing']['rep_rule']}",
               assists=[reps[a["rep_id"]]["name"] for a in opp.assists])
        if fresh:
            continue

        t = opp.assigned_at
        # do they act within SLA?
        acts = r.random() < 0.55 + 0.4 * o["probability"]
        if not acts:
            t = opp.due_by
            opp.escalation_level = 1
            _event(s, opp.id, t, "SLA bot", "escalated", "L1 · No acceptance in 48h — nudge sent on WhatsApp + email")
            if age_days > 6 and r.random() < 0.6:
                t = t + timedelta(hours=24)
                nxt = router.next_best(opp.model_dump(), opp.lead_rep_id)
                if nxt:
                    old = lead["name"] if lead else "—"
                    opp.lead_rep_id = nxt["id"]
                    opp.escalation_level = 2
                    _event(s, opp.id, t, "SLA bot", "reassigned", f"L2 · Reassigned from {old} to {nxt['name']}; division head notified")
                    acts = r.random() < 0.6
                if not acts and age_days > 12:
                    t = t + timedelta(days=3)
                    opp.escalation_level = 3
                    _event(s, opp.id, t, "SLA bot", "escalated", "L3 · Raised to National Sales Head for review")
                    if age_days > 20 and r.random() < 0.7:
                        t = t + timedelta(days=4)
                        opp.escalation_level = 4
                        opp.status = OppStatus.NURTURE
                        _event(s, opp.id, t, "Nurture bot", "nurture",
                               "L4 · Moved to digital nurture: 3-step WhatsApp sequence to partner started")
                        continue
            if not acts:
                opp.due_by = t + timedelta(hours=24)
                continue
        actor = reps[opp.lead_rep_id]["name"] if opp.lead_rep_id else "Rep"
        t = t + timedelta(hours=r.uniform(2, 40))
        opp.status, opp.accepted_at = OppStatus.ACCEPTED, t
        opp.due_by = sla_due(t, accepted=True)
        _event(s, opp.id, t, actor, "accepted", "Accepted the opportunity")
        stages = [(OppStatus.CONTACTED, "Contacted partner — pitch sent on WhatsApp", 0.8),
                  (OppStatus.PROPOSAL, "Proposal shared (single combined BOM)", 0.7),
                  (OppStatus.NEGOTIATION, "Negotiating price & credit terms", 0.65)]
        alive = True
        for st, msg, pr in stages:
            if (now - t).days < 4 or r.random() > pr + 0.2 * o["probability"]:
                alive = (now - t).days < 4 or r.random() < 0.6
                break
            t = t + timedelta(days=r.uniform(1.5, 7))
            if t > now:
                break
            opp.status = st
            _event(s, opp.id, t, actor, st.value, msg)
        if not alive:
            opp.status = OppStatus.LOST
            opp.closed_at = min(now, t + timedelta(days=2))
            _event(s, opp.id, opp.closed_at, actor, "lost", r.choice(
                ["Lost — partner bought from another distributor on price", "Lost — project postponed",
                 "Lost — credit terms not acceptable"]))
        elif opp.status == OppStatus.NEGOTIATION and (now - t).days > 3 and r.random() < 0.75:
            t = t + timedelta(days=r.uniform(1, 5))
            if t < now:
                opp.status = OppStatus.WON
                opp.closed_at = t
                opp.closed_value = round(o["est_value"] * r.uniform(0.75, 1.15), -2)
                _event(s, opp.id, t, actor, "won", f"Won — PO received for ₹{opp.closed_value:,.0f}",
                       credit=[{"rep": actor, "share": 1 - sum(a.get("credit", 0) for a in opp.assists)}] +
                       [{"rep": reps[a["rep_id"]]["name"], "share": a.get("credit", 0)} for a in opp.assists])
        if opp.status not in (OppStatus.WON, OppStatus.LOST) and opp.due_by and opp.due_by < now and opp.status == OppStatus.ACCEPTED:
            opp.escalation_level = 1
            _event(s, opp.id, opp.due_by, "SLA bot", "escalated", "L1 · Accepted but no contact logged in 5 days — nudge")


if __name__ == "__main__":
    print(build())
    _ = C  # catalogue import kept for side-effect-free reference
