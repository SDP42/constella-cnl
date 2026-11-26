"""Credit & cash, deal desk, schemes, annuity ledger and the daily action list."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, col, select

from app.api.insights import _churn, _frames
from app.core.db import get_session
from app.core.security import Principal, current_principal, require
from app.data import catalog as C
from app.models import OPEN_STATUSES, Account, DealRequest, Opportunity, SalesRep
from app.services import finance as F
from app.services import ops
from app.state import state

router = APIRouter(prefix="/api", tags=["finance"])


def _scores(s: Session):
    if "credit" not in state.cache:
        f = _frames(s)
        state.cache["credit"] = F.credit_scores(f["accounts"], f["tx"], _churn(s)["live"], state.now.date())
    return state.cache["credit"]


def _scope(p: Principal, df):
    if p.role == "rep":
        return df[df["region"] == p.region]
    if p.role == "partner":
        return df[df["id"] == p.account_id]
    return df


# ------------------------------------------------------------------ credit & cash
@router.get("/credit/scores")
def credit(s: Session = Depends(get_session), p: Principal = Depends(current_principal), limit: int = 40) -> dict[str, Any]:
    df = _scope(p, _scores(s))
    dist = df["grade"].value_counts().reindex(["A", "B", "C", "D", "E"]).fillna(0).astype(int).to_dict()
    warn = df[df["early_warning"]].sort_values("score")
    cols = ["id", "name", "city", "grade", "score", "credit_limit", "recommended_limit", "limit_change_pct", "util",
            "avg_payment_days", "churn_risk", "overdue"]
    rows = df.sort_values("score", ascending=False)[cols].head(limit)
    return {"distribution": dist, "early_warning": warn[cols].head(15).to_dict("records"),
            "top": rows.to_dict("records"), "headroom_unlock": round(float((df["recommended_limit"] - df["credit_limit"]).clip(lower=0).sum())),
            "method": "payment discipline 40% · utilisation 25% · order momentum 20% · retention (churn model) 15%"}


@router.get("/credit/worklist")
def worklist(s: Session = Depends(get_session), p: Principal = Depends(current_principal), limit: int = 25) -> list[dict[str, Any]]:
    df = _scope(p, _scores(s))
    df = df.assign(priority=df["overdue"] * (1 + df["churn_risk"])).sort_values("priority", ascending=False)
    out = []
    for r in df.head(limit).itertuples():
        action = "Hold new orders, call finance head" if r.grade in ("D", "E") and r.util > 0.9 else \
            "Send payment reminder on WhatsApp" if r.overdue > 0 else "Offer early-payment discount (1%)"
        out.append({"account_id": int(r.id), "name": r.name, "city": r.city, "grade": r.grade, "overdue": float(r.overdue),
                    "receivable": float(r.receivable), "payment_days": int(r.avg_payment_days), "action": action})
    return out


@router.get("/bi/nwc")
def nwc(s: Session = Depends(get_session), _: Principal = Depends(require("read:all")),
        dso: float = Query(62, ge=0, le=180), dio: float = Query(38, ge=0, le=180), dpo: float = Query(55, ge=0, le=180)) -> dict[str, Any]:
    from app.services.insights import CNL_FY26_REVENUE

    # base calibrated to CNL's disclosed 45 NWC days (H1 FY27)
    return F.nwc_simulator(dso, dio, dpo, CNL_FY26_REVENUE, {"dso": 62, "dio": 38, "dpo": 55})


# ------------------------------------------------------------------ deal desk
class DealIn(BaseModel):
    opportunity_id: int
    discount_pct: float = Field(ge=0, le=0.3)
    reason: str = Field(min_length=3, max_length=300)


def _waterfall_for(o: Opportunity, acc: Account | None, discount: float, s: Session) -> dict[str, Any]:
    margin = o.est_margin / max(1.0, o.est_value)
    rebate = 0.0
    brands = {b for c in o.categories for b in C.CATEGORIES[c]["brands"]}
    for sc in C.BRAND_SCHEMES:
        if sc["brand"] in brands:
            rebate = max(rebate, sc["slabs"][0][1])
    return F.waterfall(o.est_value, margin, discount, rebate, acc.avg_payment_days if acc else 45)


@router.get("/dealdesk/preview")
def deal_preview(opportunity_id: int, discount_pct: float = 0.04, s: Session = Depends(get_session),
                 _: Principal = Depends(current_principal)) -> dict[str, Any]:
    o = s.get(Opportunity, opportunity_id)
    if not o:
        raise HTTPException(404, "opportunity not found")
    w = _waterfall_for(o, s.get(Account, o.account_id), discount_pct, s)
    role, auto = F.approval_for(discount_pct, w["pocket_pct"])
    return {"waterfall": w, "approver_role": role, "auto_approve": auto}


@router.post("/dealdesk/requests")
def deal_request(body: DealIn, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    if p.role == "partner":
        raise HTTPException(403, "partners cannot raise discount requests")
    o = s.get(Opportunity, body.opportunity_id)
    if not o:
        raise HTTPException(404, "opportunity not found")
    w = _waterfall_for(o, s.get(Account, o.account_id), body.discount_pct, s)
    role, auto = F.approval_for(body.discount_pct, w["pocket_pct"])
    dr = DealRequest(opportunity_id=o.id, requested_by=p.name, requested_role=p.role, discount_pct=body.discount_pct,
                     reason=body.reason, status="auto_approved" if auto else "pending", approver_role=role,
                     created_at=state.now, waterfall=w, decided_by="policy" if auto else None,
                     decided_at=state.now if auto else None)
    s.add(dr)
    ops.add_event(s, o, p.name, "deal_desk", f"Discount {body.discount_pct * 100:.1f}% requested — "
                  f"{'auto-approved by policy' if auto else f'awaiting {role.upper()} approval'} · pocket margin {w['pocket_pct'] * 100:.1f}%")
    s.commit()
    s.refresh(dr)
    return dr.model_dump()


@router.get("/dealdesk/requests")
def deal_list(s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> list[dict[str, Any]]:
    rows = s.exec(select(DealRequest).order_by(col(DealRequest.id).desc()).limit(80)).all()
    opps = {o.id: o for o in s.exec(select(Opportunity).where(col(Opportunity.id).in_([r.opportunity_id for r in rows]))).all()}
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    out = []
    for r in rows:
        if p.role == "rep" and r.requested_by != p.name:
            continue
        o = opps.get(r.opportunity_id)
        out.append({**r.model_dump(), "title": o.title if o else "", "account": accs[o.account_id].name if o else "",
                    "value": o.est_value if o else 0})
    return out


@router.post("/dealdesk/requests/{rid}/{decision}")
def deal_decide(rid: int, decision: str, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    if decision not in ("approve", "reject"):
        raise HTTPException(400, "decision must be approve or reject")
    r = s.get(DealRequest, rid)
    if not r or r.status != "pending":
        raise HTTPException(404, "no pending request")
    allowed = {"head": {"head"}, "cfo": {"head"}}  # in the demo the national head stands in for the CFO
    if p.role not in allowed.get(r.approver_role, set()):
        raise HTTPException(403, f"needs {r.approver_role} approval")
    r.status = "approved" if decision == "approve" else "rejected"
    r.decided_by, r.decided_at = p.name, state.now
    o = s.get(Opportunity, r.opportunity_id)
    if o:
        ops.add_event(s, o, p.name, "deal_desk", f"Discount {r.discount_pct * 100:.1f}% {r.status} by {p.name}")
    s.add(r)
    s.commit()
    s.refresh(r)
    return r.model_dump()


# ------------------------------------------------------------------ schemes, annuity, today
@router.get("/schemes/progress")
def schemes(s: Session = Depends(get_session), p: Principal = Depends(current_principal), limit: int = 20) -> list[dict[str, Any]]:
    f = _frames(s)
    accs = f["accounts"]
    ids = set(_scope(p, accs)["id"]) if p.role in ("rep", "partner") else None
    names = accs.set_index("id")["name"]
    rows = F.scheme_progress(f["tx"], f["products"], ids, state.now.date())[:limit]
    return [{**r, "name": names.get(r["account_id"], "")} for r in rows]


@router.get("/annuity/ledger")
def annuity(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    f = _frames(s)
    if "annuity" not in state.cache:
        state.cache["annuity"] = F.annuity_ledger(f["tx"], f["assets"], f["accounts"], state.now.date())
    return state.cache["annuity"]


@router.get("/reps/{rep_id}/today")
def today(rep_id: int, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    """Today's 10 actions: one ranked list mixing deals, SLAs, reorders, renewals, credit and churn."""
    if not p.can("read:all") and p.rep_id != rep_id:
        raise HTTPException(403, "you can only open your own list")
    rep = s.get(SalesRep, rep_id)
    if not rep:
        raise HTTPException(404, "rep not found")
    reps = ops.rep_map(s)
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    actions: list[dict[str, Any]] = []
    opps = [o for o in s.exec(select(Opportunity).where(Opportunity.lead_rep_id == rep_id)).all() if o.status in OPEN_STATUSES]
    for o in opps:
        ser = ops.serialize(o, accs.get(o.account_id), reps)
        urgency = 2.0 if ser["sla_breached"] else 1.0
        actions.append({"type": "sla" if ser["sla_breached"] else "deal", "title": o.title, "account": ser["account"]["name"],
                        "why": ser["why"][0] if ser["why"] else "", "value": o.est_value, "opportunity_id": o.id,
                        "score": ser["cost_of_delay"]["per_day"] * 30 * urgency})
    f = _frames(s)
    from app.services.insights import next_orders

    nx = state.cache.get("next_orders")
    if nx is None:
        nx = state.cache["next_orders"] = next_orders(f["tx"], state.now.date())
    region = rep.region
    for r in nx.itertuples():
        a = accs.get(int(r.account_id))
        if not a or a.region != region or not (-14 <= r.days_to_next <= 7):
            continue
        actions.append({"type": "reorder", "title": f"Reorder due from {a.name}", "account": a.name,
                        "why": f"Orders every ~{r.median_gap_days} days; {'overdue' if r.days_to_next < 0 else 'due'} {abs(int(r.days_to_next))}d",
                        "value": float(r.typical_order), "score": float(r.typical_order) * 0.05})
    ch = _churn(s)["live"]
    for r in ch[ch["risk"] > 0.85].itertuples():
        a = accs.get(int(r.account_id))
        if a and a.region == region:
            actions.append({"type": "churn", "title": f"Call {a.name} — churn risk {r.risk:.0%}", "account": a.name,
                            "why": f"No order for {int(r.recency)} days", "value": 0.0, "score": 20000 * r.risk})
    for sc in F.scheme_progress(f["tx"], f["products"], {a.id for a in accs.values() if a.region == region}, state.now.date())[:5]:
        a = accs.get(sc["account_id"])
        actions.append({"type": "scheme", "title": f"{a.name if a else ''}: ₹{sc['gap']:,.0f} to next {sc['brand']} slab",
                        "account": a.name if a else "", "why": f"Unlocks {sc['next_rebate'] * 100:.1f}% rebate (+₹{sc['rebate_gain']:,.0f})",
                        "value": float(sc["gap"]), "score": float(sc["rebate_gain"]) * 0.8})
    # a balanced day: best deals, then breached SLAs, reorders, churn calls and scheme slabs; fill by score
    quota = {"deal": 4, "sla": 2, "reorder": 2, "churn": 1, "scheme": 1}
    picked: list[dict[str, Any]] = []
    for kind, n in quota.items():
        picked += sorted([a for a in actions if a["type"] == kind], key=lambda x: -x["score"])[:n]
    rest = sorted([a for a in actions if a not in picked], key=lambda x: -x["score"])
    picked = (picked + rest)[:10]
    picked.sort(key=lambda x: -x["score"])
    return {"rep": rep.name, "date": str(state.now.date()), "actions": picked,
            "generated": "deals by cost-of-delay · SLA breaches · predicted reorders · churn risk · scheme slabs"}


_ = timedelta
