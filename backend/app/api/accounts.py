"""Account Twin: one unified view of a partner across every division."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.core.db import get_session
from app.core.security import Principal, can_see_account, current_principal, mask
from app.data import catalog as C
from app.models import Account, InstalledAsset, Interaction, Opportunity, Signal, SourceRecord, Transaction
from app.services import ops
from app.state import state

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _acc_summary(a: Account, p: Principal, spend12: float = 0.0) -> dict[str, Any]:
    pii = p.can("pii:view")
    return {
        "id": a.id, "name": a.name, "type": str(a.account_type.value), "vertical": a.vertical,
        "city": a.city, "region": a.region, "tier": a.tier, "employees": a.employees,
        "gstin": a.gstin if pii else mask(a.gstin), "pan": a.pan if pii else mask(a.pan),
        "est_annual_tech_spend": a.est_annual_tech_spend, "spend_12m": round(spend12),
        "wallet_share": round(spend12 / max(1.0, a.est_annual_tech_spend), 4),
        "credit_limit": a.credit_limit, "credit_used": a.credit_used,
        "credit_headroom": max(0.0, a.credit_limit - a.credit_used), "avg_payment_days": a.avg_payment_days,
        "owner_rep_id": a.owner_rep_id, "in_holdout": a.in_holdout, "data_quality": a.data_quality,
        "lat": a.lat, "lng": a.lng,
    }


@router.get("")
def list_accounts(
    s: Session = Depends(get_session), p: Principal = Depends(current_principal),
    q: str | None = None, type: str | None = None, region: str | None = None, vertical: str | None = None,
    sort: str = "whitespace", limit: int = Query(60, le=600), offset: int = 0,
) -> dict[str, Any]:
    accs = s.exec(select(Account)).all()
    since = state.now.date() - timedelta(days=365)
    spend: dict[int, float] = defaultdict(float)
    for aid, amt in s.exec(select(Transaction.account_id, Transaction.amount).where(Transaction.tx_date > since)).all():
        spend[aid] += amt
    open_val: dict[int, float] = defaultdict(float)
    n_open: dict[int, int] = defaultdict(int)
    for o in s.exec(select(Opportunity).where(Opportunity.in_holdout == False)).all():  # noqa: E712
        if o.status.value in ("won", "lost", "nurture"):
            continue
        open_val[o.account_id] += o.est_value
        n_open[o.account_id] += 1
    out = []
    for a in accs:
        if not can_see_account(p, a):
            continue
        if q and q.lower() not in a.name.lower() and q.lower() not in a.city.lower():
            continue
        if type and a.account_type.value != type:
            continue
        if region and a.region != region:
            continue
        if vertical and a.vertical != vertical:
            continue
        d = _acc_summary(a, p, spend[a.id])
        d["open_value"], d["open_opps"] = open_val[a.id], n_open[a.id]
        d["leakage"] = max(0.0, a.est_annual_tech_spend - spend[a.id])
        out.append(d)
    key = {"whitespace": lambda d: -d["open_value"], "spend": lambda d: -d["spend_12m"],
           "share": lambda d: d["wallet_share"], "name": lambda d: d["name"]}.get(sort, lambda d: -d["open_value"])
    out.sort(key=key)
    return {"total": len(out), "items": out[offset:offset + limit]}


@router.get("/{aid}")
def account_twin(aid: int, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    a = s.get(Account, aid)
    if not a:
        raise HTTPException(404, "account not found")
    opps = s.exec(select(Opportunity).where(Opportunity.account_id == aid)).all()
    involved = {o.lead_rep_id for o in opps} | {x.get("rep_id") for o in opps for x in (o.assists or [])}
    if not can_see_account(p, a, {i for i in involved if i}):
        raise HTTPException(403, "outside your territory")

    tx = s.exec(select(Transaction).where(Transaction.account_id == aid)).all()
    since = state.now.date() - timedelta(days=365)
    spend12 = sum(t.amount for t in tx if t.tx_date > since)
    reps = ops.rep_map(s)

    # category constellation: owned (lit) vs whitespace (ghost, with live probability)
    by_cat: dict[str, dict[str, Any]] = {}
    for t in tx:
        d = by_cat.setdefault(t.category, {"spend": 0.0, "orders": 0, "last": t.tx_date, "first": t.tx_date})
        d["spend"] += t.amount
        d["orders"] += 1
        d["last"] = max(d["last"], t.tx_date)
        d["first"] = min(d["first"], t.tx_date)
    live = state.live
    pmap: dict[str, float] = {}
    if live is not None:
        sub = live[live["account_id"] == aid]
        pmap = dict(zip(sub["category"], sub["p"], strict=True))
    peer = state.cooc["peer_rate"] if state.cooc else None
    peer_key = f"{a.account_type.value}|{a.vertical}"
    categories = []
    for c, spec in C.CATEGORIES.items():
        own = by_cat.get(c)
        categories.append({
            "category": c, "label": spec["label"], "division": spec["div"], "owned": bool(own),
            "spend": round(own["spend"]) if own else 0, "orders": own["orders"] if own else 0,
            "first": own["first"] if own else None, "last": own["last"] if own else None,
            "probability": round(float(pmap.get(c, 0.0)), 3) if not own else None,
            "peer_adoption": round(float(peer.loc[peer_key, c]), 3) if peer is not None and peer_key in peer.index else None,
            "margin": spec["margin"], "recurring": bool(spec.get("recurring")),
        })

    # divisions view — who sees what today
    div_spend: dict[str, float] = defaultdict(float)
    for t in tx:
        div_spend[t.division_code] += t.amount
    divisions = [{"code": d["code"], "name": d["name"], "color": d["color"], "spend": round(div_spend.get(d["code"], 0)),
                  "categories_owned": sum(1 for x in categories if x["owned"] and x["division"] == d["code"])}
                 for d in C.DIVISIONS]

    # monthly timeline per division (last 24 months)
    tl: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for t in tx:
        tl[t.tx_date.strftime("%Y-%m")][t.division_code] += t.amount
    timeline = [{"month": m, **{k: round(v) for k, v in tl[m].items()}} for m in sorted(tl)]

    # solution coverage
    owned = {c for c in by_cat}
    solutions = []
    for sol in C.SOLUTIONS:
        comps = [{**x, "owned": x["category"] in owned, "label": C.CATEGORIES[x["category"]]["label"],
                  "division": C.CATEGORIES[x["category"]]["div"], "p": round(float(pmap.get(x["category"], 0)), 3)}
                 for x in sol["components"]]
        req = [x for x in comps if x["required"]]
        solutions.append({"id": sol["id"], "name": sol["name"], "icon": sol["icon"],
                          "fit": a.vertical in sol["verticals"],
                          "coverage": round(sum(1 for x in req if x["owned"]) / len(req), 2), "components": comps})
    solutions.sort(key=lambda x: (-x["fit"], -x["coverage"]))

    sources = s.exec(select(SourceRecord).where(SourceRecord.account_id == aid)).all()
    pii = p.can("pii:view")
    lineage = [{"division": r.division_code, "system": r.system, "raw_name": r.raw_name,
                "raw_gstin": r.raw_gstin if pii else mask(r.raw_gstin), "phone": r.phone if pii else mask(r.phone, 4, 2),
                "confidence": r.match_confidence, "rule": r.match_rule} for r in sources]

    signals = s.exec(select(Signal).where(Signal.account_id == aid).order_by(col(Signal.created_at).desc())).all()
    notes = s.exec(select(Interaction).where(Interaction.account_id == aid).order_by(col(Interaction.ts).desc())).all()
    assets = s.exec(select(InstalledAsset).where(InstalledAsset.account_id == aid)).all()
    owner = reps.get(a.owner_rep_id) if a.owner_rep_id else None
    visible_opps = opps if not a.in_holdout or p.can("read:all") else []
    return {
        "account": _acc_summary(a, p, spend12),
        "owner": {"id": owner.id, "name": owner.name, "division": owner.division_code} if owner else None,
        "categories": categories, "divisions": divisions, "timeline": timeline, "solutions": solutions,
        "lineage": lineage,
        "signals": [x.model_dump() for x in signals[:30]],
        "interactions": [{**n.model_dump(), "rep": reps[n.rep_id].name if n.rep_id in reps else None} for n in notes[:20]],
        "installed_base": [x.model_dump() for x in assets[:40]],
        "opportunities": [ops.serialize(o, a, reps) for o in sorted(visible_opps, key=lambda o: -o.score)],
        "leakage": max(0.0, a.est_annual_tech_spend - spend12),
    }
