"""Operational helpers: serialisation, opportunity actions, SLA sweep, re-routing."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlmodel import Session, select

from app.data import catalog as C
from app.models import OPEN_STATUSES, Account, Opportunity, OpportunityEvent, OppStatus, SalesRep
from app.routing.engine import ESCALATION_LABELS, Router, cost_of_delay, sla_due
from app.state import state

TRANSITIONS: dict[str, tuple[set[OppStatus], OppStatus, str]] = {
    "accept": ({OppStatus.NEW, OppStatus.ASSIGNED}, OppStatus.ACCEPTED, "Accepted the opportunity"),
    "contact": ({OppStatus.ACCEPTED}, OppStatus.CONTACTED, "Contacted partner — pitch sent"),
    "proposal": ({OppStatus.CONTACTED, OppStatus.ACCEPTED}, OppStatus.PROPOSAL, "Proposal shared"),
    "negotiate": ({OppStatus.PROPOSAL}, OppStatus.NEGOTIATION, "Negotiating terms"),
    "win": (OPEN_STATUSES, OppStatus.WON, "Won"),
    "lose": (OPEN_STATUSES, OppStatus.LOST, "Lost"),
    "decline": ({OppStatus.NEW, OppStatus.ASSIGNED}, OppStatus.ASSIGNED, "Declined — sent back to router"),
    "nurture": (OPEN_STATUSES, OppStatus.NURTURE, "Moved to digital nurture"),
}


def rep_map(s: Session) -> dict[int, SalesRep]:
    return {r.id: r for r in s.exec(select(SalesRep)).all()}


def serialize(o: Opportunity, acc: Account | None, reps: dict[int, SalesRep], full: bool = False) -> dict[str, Any]:
    now = state.now
    age = max(0.0, (now - o.created_at).total_seconds() / 86400)
    cod = cost_of_delay(o.score, o.kind.value if hasattr(o.kind, "value") else o.kind, age)
    lead = reps.get(o.lead_rep_id) if o.lead_rep_id else None
    d: dict[str, Any] = {
        "id": o.id, "account_id": o.account_id, "title": o.title,
        "kind": o.kind.value if hasattr(o.kind, "value") else o.kind,
        "status": o.status.value if hasattr(o.status, "value") else o.status,
        "categories": o.categories, "category_labels": [C.CATEGORIES[c]["label"] for c in o.categories],
        "solution_id": o.solution_id, "est_value": o.est_value, "est_margin": o.est_margin,
        "est_annuity": o.est_annuity, "probability": o.probability, "score": o.score,
        "lead_rep": {"id": lead.id, "name": lead.name, "division": lead.division_code, "hue": lead.avatar_hue} if lead else None,
        "lead_division": o.lead_division,
        "assists": [{**a, "name": reps[a["rep_id"]].name, "hue": reps[a["rep_id"]].avatar_hue}
                    for a in o.assists if a.get("rep_id") in reps],
        "created_at": o.created_at, "assigned_at": o.assigned_at, "due_by": o.due_by,
        "sla_breached": bool(o.due_by and o.due_by < now and o.status in OPEN_STATUSES),
        "hours_to_due": round((o.due_by - now).total_seconds() / 3600, 1) if o.due_by else None,
        "escalation_level": o.escalation_level, "escalation_label": ESCALATION_LABELS.get(o.escalation_level, ""),
        "closed_value": o.closed_value, "closed_at": o.closed_at, "in_holdout": o.in_holdout,
        "cost_of_delay": cod, "why": (o.explanation or {}).get("why", []),
        "fits_credit": (o.explanation or {}).get("fits_credit", True),
        "divisions": (o.explanation or {}).get("divisions", []),
    }
    if acc:
        d["account"] = {"id": acc.id, "name": acc.name, "city": acc.city, "region": acc.region,
                        "type": acc.account_type.value if hasattr(acc.account_type, "value") else acc.account_type,
                        "vertical": acc.vertical, "tier": acc.tier}
    if full:
        d["explanation"] = o.explanation
        d["signal_ids"] = o.signal_ids
    return d


def add_event(s: Session, opp: Opportunity, actor: str, kind: str, detail: str, **meta: Any) -> None:
    s.add(OpportunityEvent(opportunity_id=opp.id, ts=state.now, actor=actor, kind=kind, detail=detail, meta=meta))


def make_router(s: Session, ignore_opp: int | None = None) -> Router:
    reps = [r.model_dump() for r in s.exec(select(SalesRep)).all()]
    accounts = {a.id: {**a.model_dump(), "account_type": str(a.account_type)} for a in s.exec(select(Account)).all()}
    router = Router(reps, accounts)
    for o in s.exec(select(Opportunity).where(Opportunity.status.in_(list(OPEN_STATUSES)))).all():
        if o.lead_rep_id and o.id != ignore_opp:
            router.load[o.lead_rep_id] = router.load.get(o.lead_rep_id, 0) + 1
    return router


def apply_action(s: Session, opp: Opportunity, action: str, actor: str, value: float | None, note: str | None) -> Opportunity:
    if action not in TRANSITIONS:
        raise ValueError(f"unknown action {action}")
    allowed, target, msg = TRANSITIONS[action]
    if opp.status not in allowed:
        raise ValueError(f"cannot {action} an opportunity in status {opp.status.value}")
    now = state.now
    if action == "decline":
        router = make_router(s, ignore_opp=opp.id)
        nxt = router.next_best(opp.model_dump(), opp.lead_rep_id)
        if nxt:
            opp.lead_rep_id = nxt["id"]
            msg = f"Declined by {actor} ({note or 'no reason given'}) — re-routed to {nxt['name']}"
        opp.assigned_at, opp.due_by = now, sla_due(now, accepted=False)
    opp.status = target
    if action == "accept":
        opp.accepted_at, opp.due_by, opp.escalation_level = now, sla_due(now, accepted=True), 0
    elif action in ("contact", "proposal", "negotiate"):
        opp.due_by = now + timedelta(days=7)
    elif action == "win":
        opp.closed_value = value or opp.est_value
        opp.closed_at = now
        msg = f"Won — PO received for ₹{opp.closed_value:,.0f}"
    elif action == "lose":
        opp.closed_at = now
        msg = f"Lost — {note or 'no reason'}"
    add_event(s, opp, actor, action, msg + (f" · {note}" if note and action not in ("lose", "decline") else ""))
    s.add(opp)
    if action == "win":
        from app.services import automation

        ann = next((C.ANNUITY_FOR[c] for c in opp.categories if c in C.ANNUITY_FOR), None)
        automation.fire(s, "opp_won", opp, annuity_category=ann)
    s.commit()
    s.refresh(opp)
    return opp


def sla_sweep(s: Session) -> list[dict[str, Any]]:
    """Walk the escalation ladder for every open opportunity whose SLA has passed."""
    now = state.now
    reps = rep_map(s)
    head = next((r for r in reps.values() if r.role == "head"), None)
    router = make_router(s)
    events = []
    stuck = s.exec(select(Opportunity).where(Opportunity.status.in_(list(OPEN_STATUSES)),
                                             Opportunity.due_by < now)).all()
    for o in stuck:
        lvl = o.escalation_level + 1
        if lvl == 1:
            detail = "L1 · SLA missed — nudge sent to lead on WhatsApp + email"
            o.due_by = now + timedelta(hours=24)
        elif lvl == 2:
            nxt = router.next_best(o.model_dump(), o.lead_rep_id)
            old = reps[o.lead_rep_id].name if o.lead_rep_id in reps else "—"
            if nxt and nxt["id"] != o.lead_rep_id:
                o.lead_rep_id = nxt["id"]
                router.load[nxt["id"]] = router.load.get(nxt["id"], 0) + 1
                detail = f"L2 · Reassigned from {old} to {nxt['name']}; division head notified"
                o.status, o.due_by = OppStatus.ASSIGNED, now + timedelta(hours=48)
            else:
                # nobody else in the division can take it — skip straight to the head instead of "reassigning" to self
                lvl = 3
                detail = f"L3 · No alternative rep for {old} — escalated to {head.name if head else 'National Sales Head'}"
                o.due_by = now + timedelta(hours=72)
        elif lvl == 3:
            detail = f"L3 · Escalated to {head.name if head else 'National Sales Head'} for review"
            o.due_by = now + timedelta(hours=72)
        else:
            lvl = 4
            detail = "L4 · Auto digital nurture — 3-step WhatsApp sequence sent to partner (zero headcount)"
            o.status = OppStatus.NURTURE
        o.escalation_level = lvl
        add_event(s, o, "SLA bot", "escalated" if lvl < 4 else "nurture", detail, level=lvl)
        s.add(o)
        from app.services import automation

        automation.fire(s, "sla_breach", o, level=lvl)
        events.append({"opportunity_id": o.id, "title": o.title, "level": lvl, "detail": detail})
    s.commit()
    return events


def now_iso() -> datetime:
    return state.now
