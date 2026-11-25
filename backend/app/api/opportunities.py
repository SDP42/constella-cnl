"""Opportunity endpoints: list, detail, act, shape (DaaS-ify), rep inbox."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.api.schemas import ActionIn
from app.core.db import get_session
from app.data import catalog as C
from app.models import OPEN_STATUSES, Account, Opportunity, OpportunityEvent, OppKind, OppStatus, SalesRep, Signal
from app.services import ops
from app.services.shaping import shape

router = APIRouter(prefix="/api", tags=["opportunities"])


@router.get("/opportunities")
def list_opportunities(
    s: Session = Depends(get_session),
    status: str | None = None, kind: str | None = None, division: str | None = None,
    rep_id: int | None = None, account_id: int | None = None, open_only: bool = False,
    include_holdout: bool = False, sort: str = "score", limit: int = Query(100, le=1000), offset: int = 0,
) -> dict[str, Any]:
    q = select(Opportunity)
    if not include_holdout:
        q = q.where(Opportunity.in_holdout == False)  # noqa: E712
    if status:
        q = q.where(Opportunity.status == OppStatus(status))
    if open_only:
        q = q.where(col(Opportunity.status).in_(list(OPEN_STATUSES)))
    if kind:
        q = q.where(Opportunity.kind == OppKind(kind))
    if division:
        q = q.where(Opportunity.lead_division == division)
    if rep_id:
        q = q.where(Opportunity.lead_rep_id == rep_id)
    if account_id:
        q = q.where(Opportunity.account_id == account_id)
    rows = s.exec(q).all()
    key = {"score": lambda o: -o.score, "value": lambda o: -o.est_value, "probability": lambda o: -o.probability,
           "newest": lambda o: -o.created_at.timestamp()}.get(sort, lambda o: -o.score)
    rows = sorted(rows, key=key)
    reps = ops.rep_map(s)
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    return {"total": len(rows), "items": [ops.serialize(o, accs.get(o.account_id), reps) for o in rows[offset:offset + limit]]}


@router.get("/opportunities/{oid}")
def get_opportunity(oid: int, s: Session = Depends(get_session)) -> dict[str, Any]:
    o = s.get(Opportunity, oid)
    if not o:
        raise HTTPException(404, "opportunity not found")
    reps = ops.rep_map(s)
    acc = s.get(Account, o.account_id)
    d = ops.serialize(o, acc, reps, full=True)
    d["events"] = [e.model_dump() for e in s.exec(select(OpportunityEvent).where(
        OpportunityEvent.opportunity_id == oid).order_by(OpportunityEvent.ts)).all()]
    d["signals"] = [x.model_dump() for x in s.exec(select(Signal).where(col(Signal.id).in_(o.signal_ids or []))).all()]
    if acc:
        d["account"]["credit_headroom"] = max(0.0, acc.credit_limit - acc.credit_used)
        d["account"]["credit_limit"] = acc.credit_limit
    if o.solution_id:
        d["solution"] = next((x for x in C.SOLUTIONS if x["id"] == o.solution_id), None)
    return d


@router.post("/opportunities/{oid}/action")
def act(oid: int, body: ActionIn, s: Session = Depends(get_session)) -> dict[str, Any]:
    o = s.get(Opportunity, oid)
    if not o:
        raise HTTPException(404, "opportunity not found")
    actor = "Rep"
    if body.actor_rep_id:
        r = s.get(SalesRep, body.actor_rep_id)
        actor = r.name if r else actor
    try:
        o = ops.apply_action(s, o, body.action, actor, body.value, body.note)
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    return get_opportunity(o.id, s)


@router.get("/opportunities/{oid}/shape")
def shape_deal(oid: int, s: Session = Depends(get_session)) -> dict[str, Any]:
    o = s.get(Opportunity, oid)
    if not o:
        raise HTTPException(404, "opportunity not found")
    acc = s.get(Account, o.account_id)
    headroom = max(0.0, acc.credit_limit - acc.credit_used) if acc else 0.0
    wc = sum(C.CATEGORIES[c]["wc"] for c in o.categories) / max(1, len(o.categories))
    margin = o.est_margin / max(1.0, o.est_value)
    return shape(o.est_value, margin, o.est_annuity, headroom, wc)


@router.get("/reps")
def list_reps(s: Session = Depends(get_session)) -> list[dict[str, Any]]:
    reps = s.exec(select(SalesRep)).all()
    opps = s.exec(select(Opportunity).where(col(Opportunity.status).in_(list(OPEN_STATUSES)))).all()
    load: dict[int, int] = {}
    for o in opps:
        if o.lead_rep_id:
            load[o.lead_rep_id] = load.get(o.lead_rep_id, 0) + 1
    return [{**r.model_dump(), "open": load.get(r.id, 0), "utilisation": round(load.get(r.id, 0) / max(1, r.capacity), 2)}
            for r in reps]


@router.get("/reps/{rep_id}/inbox")
def inbox(rep_id: int, s: Session = Depends(get_session)) -> dict[str, Any]:
    rep = s.get(SalesRep, rep_id)
    if not rep:
        raise HTTPException(404, "rep not found")
    reps = ops.rep_map(s)
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    opps = s.exec(select(Opportunity).where(Opportunity.in_holdout == False)).all()  # noqa: E712
    lead = [o for o in opps if o.lead_rep_id == rep_id]
    assist = [o for o in opps if any(a.get("rep_id") == rep_id for a in (o.assists or [])) and o.lead_rep_id != rep_id]
    open_lead = sorted([o for o in lead if o.status in OPEN_STATUSES], key=lambda o: -o.score)
    won = [o for o in lead if o.status == OppStatus.WON]
    won_assist = [o for o in assist if o.status == OppStatus.WON]
    credit = sum((o.closed_value or 0) * (1 - sum(a.get("credit", 0) for a in o.assists)) for o in won) + \
        sum((o.closed_value or 0) * next((a.get("credit", 0) for a in o.assists if a.get("rep_id") == rep_id), 0)
            for o in won_assist)
    ser_open = [ops.serialize(o, accs.get(o.account_id), reps) for o in open_lead]
    breached = [x for x in ser_open if x["sla_breached"]]
    cod_total = sum(x["cost_of_delay"]["per_day"] for x in ser_open)
    top = ser_open[0] if ser_open else None
    brief = []
    if top:
        brief.append(f"Start with {top['account']['name']}: {top['title'].lower()} — ₹{top['est_value']:,.0f} at "
                     f"{top['probability'] * 100:.0f}% likelihood.")
    if breached:
        brief.append(f"{len(breached)} opportunit{'y is' if len(breached) == 1 else 'ies are'} past SLA — "
                     "act today or they escalate to your division head.")
    sol = [x for x in ser_open if x["kind"] == "solution"]
    if sol:
        brief.append(f"{len(sol)} solution deal(s) need a pod: assists from "
                     f"{', '.join(sorted({a['division'] for x in sol for a in x['assists']})) or 'other divisions'} are already tagged.")
    brief.append(f"Idle pipeline costs ≈ ₹{cod_total:,.0f}/day in decaying value-at-stake.")
    return {
        "rep": {**rep.model_dump()},
        "brief": brief,
        "stats": {"open": len(open_lead), "breached": len(breached), "won": len(won),
                  "won_value": sum(o.closed_value or 0 for o in won), "credit_earned": round(credit),
                  "assists_open": sum(1 for o in assist if o.status in OPEN_STATUSES),
                  "pipeline_value": sum(o.est_value for o in open_lead), "cost_of_delay_per_day": round(cod_total)},
        "lead": ser_open,
        "assist": [ops.serialize(o, accs.get(o.account_id), reps) for o in
                   sorted(assist, key=lambda o: -o.score) if o.status in OPEN_STATUSES][:30],
        "recent_closed": [ops.serialize(o, accs.get(o.account_id), reps) for o in
                          sorted([o for o in lead if o.closed_at], key=lambda o: o.closed_at, reverse=True)[:8]],
    }
