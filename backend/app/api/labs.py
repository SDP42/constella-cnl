"""Feature batch 3: Growth Lab, Operations Hub, Team Hub, Data Trust, feedback, attribution, proposals, pitches."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, col, select

from app.api.insights import _churn, _frames
from app.core.db import get_session
from app.core.security import Principal, current_principal, issue_token, require, verify_token
from app.data import catalog as C
from app.data.unify import score_pair
from app.ml.features import FEATURES
from app.models import (
    OPEN_STATUSES, Account, ErasureRequest, Feedback, Opportunity, OpportunityEvent, OppStatus, SalesRep, SourceRecord,
    Transaction,
)
from app.services import analytics as A
from app.services import ops
from app.state import state

router = APIRouter(prefix="/api", tags=["labs"])


def _opps_df(s: Session) -> pd.DataFrame:
    rows = s.exec(select(Opportunity)).all()
    return pd.DataFrame([{**o.model_dump(), "status": o.status.name, "kind": o.kind.name} for o in rows])


def _c(key: str, fn):
    if key not in state.cache:
        state.cache[key] = fn()
    return state.cache[key]


# ------------------------------------------------------------------ growth lab
@router.get("/growth/overview")
def growth(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    f = _frames(s)
    now = state.now.date()
    opps = _opps_df(s)
    open_ = opps[opps["status"].isin([x.name for x in OPEN_STATUSES])] if len(opps) else opps
    return _c("growth", lambda: {
        "treemap": A.wallet_treemap(f["tx"], f["accounts"], now),
        "flows": A.type_division_flows(f["tx"], f["accounts"], now),
        "cities": A.city_map(f["tx"], f["accounts"], open_, now),
        "cohorts": A.cohorts(f["tx"], now),
        "pareto": A.pareto(f["tx"], now),
        "matrix": A.category_matrix(f["tx"], now),
        "seasonality": A.seasonality(f["tx"]),
        "affinity": A.affinity(state.cooc) if state.cooc else None,
        "paths": A.next_category_paths(f["tx"]),
        "at_risk": A.revenue_at_risk(f["tx"], f["accounts"], _churn(s)["live"], now),
    })


@router.get("/growth/rfm")
def rfm(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> list[dict[str, Any]]:
    f = _frames(s)
    return _c("rfm", lambda: A.rfm(f["tx"], f["accounts"], state.now.date()))


@router.get("/accounts/{aid}/lookalikes")
def lookalikes(aid: int, s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    f = _frames(s)
    return A.lookalikes(f["tx"], f["accounts"], aid)


# ------------------------------------------------------------------ operations hub
@router.get("/ops/overview")
def ops_overview(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    f = _frames(s)
    now = state.now.date()
    from app.services.insights import brands as brand_stats

    return _c("ops", lambda: {
        "inventory": A.inventory(f["tx"], state.live, f["accounts"], now),
        "tenders": A.tenders(f["accounts"], f["tx"], now),
        "projects": A.si_projects(now),
        "rma": A.rma(f["assets"], f["products"]),
        "mdf": A.mdf_plan(brand_stats(f["tx"], f["products"], f["accounts"], now)),
        "note": "Stock, tender, project and RMA feeds are illustrative (seeded) until connected to the ERP/GeM/service systems.",
    })


# ------------------------------------------------------------------ team hub
@router.get("/team/overview")
def team_overview(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    reps = pd.DataFrame([r.model_dump() for r in s.exec(select(SalesRep)).all()])
    events = pd.DataFrame([e.model_dump() for e in s.exec(select(OpportunityEvent)).all()])
    return A.team(_opps_df(s), reps, events)


class CommissionIn(BaseModel):
    lead_share: float = Field(0.7, ge=0.5, le=1.0)
    rate_hardware: float = Field(0.01, ge=0, le=0.05)
    rate_annuity: float = Field(0.04, ge=0, le=0.15)


@router.post("/team/commission")
def commission(body: CommissionIn, s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> list[dict[str, Any]]:
    reps = {r.id: r for r in s.exec(select(SalesRep)).all()}
    pay: dict[int, float] = {}
    for o in s.exec(select(Opportunity).where(Opportunity.status == OppStatus.WON)).all():
        rate = body.rate_annuity if o.kind.value == "recurring" else body.rate_hardware
        pool = (o.closed_value or 0) * rate
        assists = o.assists or []
        if o.lead_rep_id:
            pay[o.lead_rep_id] = pay.get(o.lead_rep_id, 0) + pool * (body.lead_share if assists else 1)
        for a in assists:
            pay[a["rep_id"]] = pay.get(a["rep_id"], 0) + pool * (1 - body.lead_share) / len(assists)
    return sorted([{"rep": reps[k].name, "division": reps[k].division_code, "payout": round(v)} for k, v in pay.items() if k in reps],
                  key=lambda x: -x["payout"])[:15]


# ------------------------------------------------------------------ data trust & compliance
@router.get("/trust/overview")
def trust(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    accs = s.exec(select(Account)).all()
    recs = s.exec(select(SourceRecord)).all()
    bad = [r for r in recs if r.raw_gstin and not A.gstin_valid(r.raw_gstin)]
    drift = []
    if state.live is not None and "eval_snapshot" not in state.cache:
        f = _frames(s)
        from app.ml.features import snapshot

        state.cache["eval_snapshot"], _ = snapshot(f["tx"], f["accounts"], f["interactions"], state.now.date() - timedelta(days=240), 120, with_labels=False)
    if state.live is not None:
        base = state.cache["eval_snapshot"]
        for feat in ["peer_adoption", "cf_score", "rule_lift", "log_monetary_12m", "recency_days", "credit_headroom", "intent", "solution_coverage"]:
            v = A.psi(base[feat].values, state.live[feat].values)
            drift.append({"feature": feat, "psi": v, "status": "stable" if v < 0.1 else "watch" if v < 0.25 else "drift"})
    erasures = s.exec(select(ErasureRequest).order_by(col(ErasureRequest.id).desc())).all()
    accounts_df = pd.DataFrame([a.model_dump() for a in accs])
    return {
        "gstin": {"records": len(recs), "with_gstin": sum(1 for r in recs if r.raw_gstin), "invalid_checksum": len(bad),
                  "invalid": [{"raw_name": r.raw_name, "division": r.division_code, "gstin": r.raw_gstin[:2] + "•" * 10 + r.raw_gstin[-3:],
                               "matched_by": r.match_rule} for r in bad[:12]],
                  "golden_valid": sum(1 for a in accs if A.gstin_valid(a.gstin))},
        "drift": drift,
        "contacts": A.contacts(accounts_df),
        "erasures": [e.model_dump() for e in erasures[:20]],
        "retention_policy": {"contacts": "3 years after last transaction", "interactions": "2 years", "audit_log": "8 years (Companies Act)",
                             "model_features": "derived, no direct identifiers"},
    }


class DedupeIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=60)
    gstin: str | None = Field(default=None, max_length=15)


@router.post("/trust/dedupe")
def dedupe(body: DedupeIn, s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    """Onboarding guard: is this 'new' partner already in the network?"""
    accs = s.exec(select(Account)).all()
    cands = []
    for a in accs:
        if body.gstin and a.gstin == body.gstin.upper():
            cands.append({"id": a.id, "name": a.name, "city": a.city, "score": 1.0, "rule": "GSTIN exact"})
        elif a.city.lower() == body.city.lower():
            sc = score_pair(body.name, a.name, a.city) / 100
            rule = "fuzzy name in city"
            if 0.55 <= sc < 0.86:  # ambiguous band: ask the pretrained embedding model for a second opinion
                from app.ml import embed

                cs = embed.cosine(body.name.lower(), a.name.lower())
                if cs is not None and cs >= 0.85:
                    sc, rule = max(sc, round((sc + cs) / 2, 3)), "fuzzy + semantic name (bge-small)"
            if sc >= 0.72:
                cands.append({"id": a.id, "name": a.name, "city": a.city, "score": round(sc, 3), "rule": rule})
    cands.sort(key=lambda x: -x["score"])
    return {"gstin_valid": A.gstin_valid(body.gstin.upper()) if body.gstin else None, "candidates": cands[:5],
            "verdict": "duplicate" if cands and cands[0]["score"] >= 0.86 else "review" if cands else "new partner"}


class ErasureIn(BaseModel):
    account_id: int
    contact: str = Field(min_length=2, max_length=100)
    request: str = Field("erasure", pattern="^(erasure|correction|access)$")


@router.post("/trust/erasure")
def erasure(body: ErasureIn, s: Session = Depends(get_session), p: Principal = Depends(require("pii:view"))) -> dict[str, Any]:
    e = ErasureRequest(account_id=body.account_id, contact=body.contact, request=body.request, handled_by=p.name, ts=state.now,
                       note="Personal fields redacted from CRM notes; transaction records retained under GST law (books of account)."
                       if body.request == "erasure" else None)
    s.add(e)
    s.commit()
    s.refresh(e)
    return e.model_dump()


# ------------------------------------------------------------------ feedback loop & attribution
class FeedbackIn(BaseModel):
    useful: bool
    reason: str | None = Field(default=None, max_length=200)


@router.post("/opportunities/{oid}/feedback")
def feedback(oid: int, body: FeedbackIn, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    o = s.get(Opportunity, oid)
    if not o:
        raise HTTPException(404, "opportunity not found")
    fb = Feedback(opportunity_id=oid, actor=p.name, useful=body.useful, reason=body.reason, kind=o.kind.value, ts=state.now)
    s.add(fb)
    ops.add_event(s, o, p.name, "feedback", f"Marked {'useful' if body.useful else 'not relevant'}{': ' + body.reason if body.reason else ''}")
    s.commit()
    return {"ok": True}


@router.get("/feedback/summary")
def feedback_summary(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    rows = s.exec(select(Feedback)).all()
    by: dict[str, dict[str, int]] = {}
    for r in rows:
        d = by.setdefault(r.kind, {"useful": 0, "not_relevant": 0})
        d["useful" if r.useful else "not_relevant"] += 1
    tot = len(rows)
    return {"total": tot, "not_relevant_rate": round(sum(1 for r in rows if not r.useful) / tot, 3) if tot else None, "by_kind": by,
            "gate": "Pilot gate 3 requires < 15% 'not relevant'"}


def attribute_orders(s: Session) -> dict[str, Any]:
    """Credit an opportunity when the partner orders one of its categories within 120 days of assignment."""
    won, value = 0, 0.0
    opps = [o for o in s.exec(select(Opportunity).where(Opportunity.assigned_at != None)).all()  # noqa: E711
            if o.status in OPEN_STATUSES or o.status == OppStatus.NURTURE]
    for o in opps:
        start = o.assigned_at.date()
        tx = s.exec(select(Transaction).where(Transaction.account_id == o.account_id, Transaction.tx_date > start,
                                              Transaction.tx_date <= start + timedelta(days=120),
                                              col(Transaction.category).in_(o.categories))).all()
        if not tx:
            continue
        amt = sum(t.amount for t in tx)
        o.status, o.closed_value, o.closed_at = OppStatus.WON, round(amt, 2), state.now
        ops.add_event(s, o, "Attribution", "won", f"Won by attribution — {len(tx)} order(s) for ₹{amt:,.0f} matched within 120 days of assignment")
        s.add(o)
        won += 1
        value += amt
    s.commit()
    return {"matched": won, "value": round(value)}


@router.post("/attribution/run")
def run_attribution(s: Session = Depends(get_session), _: Principal = Depends(require("reassign"))) -> dict[str, Any]:
    state.cache.clear()
    return attribute_orders(s)


# ------------------------------------------------------------------ shareable proposals (partner self-serve)
@router.post("/proposals/{oid}/share")
def share(oid: int, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    o = s.get(Opportunity, oid)
    if not o:
        raise HTTPException(404, "opportunity not found")
    token = issue_token({"sub": f"proposal:{oid}", "name": "partner-link", "role": "proposal", "opp": oid}, ttl_s=14 * 86400)
    ops.add_event(s, o, p.name, "shared", "Proposal link shared with partner (valid 14 days)")
    s.commit()
    return {"token": token, "path": f"/p/{token}"}


def _proposal(token: str, s: Session) -> tuple[Opportunity, Account]:
    c = verify_token(token)
    if c.get("role") != "proposal":
        raise HTTPException(403, "invalid proposal link")
    o = s.get(Opportunity, int(c["opp"]))
    if not o:
        raise HTTPException(404, "proposal not found")
    return o, s.get(Account, o.account_id)


@router.get("/public/proposals/{token}")
def view_proposal(token: str, s: Session = Depends(get_session)) -> dict[str, Any]:
    o, a = _proposal(token, s)
    sol = next((x for x in C.SOLUTIONS if x["id"] == o.solution_id), None)
    lines = [{"label": C.CATEGORIES[c]["label"], "brand": C.CATEGORIES[c]["brands"][0], "division": C.CATEGORIES[c]["div"]} for c in o.categories]
    return {"partner": a.name, "city": a.city, "title": o.title.replace(f" for {a.name}", ""), "solution": sol["name"] if sol else None,
            "tagline": sol["tagline"] if sol else None, "lines": lines, "value": o.est_value, "annuity": o.est_annuity,
            "why": (o.explanation or {}).get("why", [])[:3], "status": o.status.value,
            "monthly_option": round(o.est_value * 0.0345 + o.est_value * 0.012), "valid_days": 14}


@router.post("/public/proposals/{token}/accept")
def accept_proposal(token: str, s: Session = Depends(get_session)) -> dict[str, Any]:
    o, a = _proposal(token, s)
    if o.status in (OppStatus.WON, OppStatus.LOST):
        raise HTTPException(409, "proposal already closed")
    o.status = OppStatus.NEGOTIATION
    ops.add_event(s, o, a.name, "partner_accepted", "Partner accepted the proposal online — PO paperwork triggered")
    s.add(o)
    s.commit()
    return {"ok": True, "status": o.status.value}


# ------------------------------------------------------------------ multilingual pitch
PITCH = {
    "en": "Hi {p} team — {t}. One PO, one point of contact across Creative Newtech, within your credit line. Shall I share the proposal?",
    "hi": "नमस्ते {p} टीम — {t}. Creative Newtech से एक ही PO, एक ही संपर्क व्यक्ति, आपकी क्रेडिट लिमिट के अंदर। क्या मैं प्रस्ताव भेजूँ?",
    "mr": "नमस्कार {p} टीम — {t}. Creative Newtech कडून एकच PO, एकच संपर्क व्यक्ती, तुमच्या क्रेडिट मर्यादेत. मी प्रस्ताव पाठवू का?",
    "gu": "નમસ્તે {p} ટીમ — {t}. Creative Newtech તરફથી એક જ PO, એક જ સંપર્ક, તમારી ક્રેડિટ મર્યાદામાં. શું હું પ્રસ્તાવ મોકલું?",
    "ta": "வணக்கம் {p} குழு — {t}. Creative Newtech-இலிருந்து ஒரே PO, ஒரே தொடர்பு நபர், உங்கள் கடன் வரம்பிற்குள். முன்மொழிவை அனுப்பட்டுமா?",
}


@router.get("/opportunities/{oid}/pitch")
def pitch(oid: int, lang: str = "en", s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    o = s.get(Opportunity, oid)
    if not o:
        raise HTTPException(404, "opportunity not found")
    a = s.get(Account, o.account_id)
    t = o.title.replace(f" for {a.name}", "").replace(f" — {a.name}", "")
    return {"lang": lang, "text": PITCH.get(lang, PITCH["en"]).format(p=a.name, t=t), "languages": list(PITCH)}


_ = FEATURES
