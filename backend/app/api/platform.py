"""Auth, meta, command-center dashboard, model lab, data unifier, pilot lab, capture, solutions, clock."""

from __future__ import annotations

import html
import random
from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.api.schemas import CaptureIn, ClockIn, ComposeIn, PilotIn
from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import Principal, current_principal, issue_token, limiter, require
from app.data import catalog as C
from app.models import (
    OPEN_STATUSES, Account, AuditLog, Interaction, Opportunity, OppKind, OppStatus, SalesRep, Signal, SourceRecord,
    Transaction,
)
from app.routing.engine import sla_due
from app.services import capture as cap
from app.services import ops
from app.services.pilot import simulate
from app.state import state

settings = get_settings()
router = APIRouter(prefix="/api", tags=["platform"])

PERSONAS = [
    {"key": "priya", "role": "rep", "title": "Key Account Manager · Enterprise Business", "city": "Mumbai",
     "goal": "Grow GP on 40 SI & enterprise accounts", "pain": "Can't see what her accounts buy from other divisions"},
    {"key": "arjun", "role": "rep", "title": "Channel Sales Executive · FMSG", "city": "Pune",
     "goal": "Push experiential brands to 180 retailers", "pain": "Too many accounts, no idea who is ready for what"},
    {"key": "rakesh", "role": "head", "title": "National Sales Head", "city": "Mumbai",
     "goal": "More GP per account and more solution mix — without hiring", "pain": "Finds stalled deals too late"},
    {"key": "meera", "role": "architect", "title": "Solutions Architect · SI desk", "city": "Bengaluru",
     "goal": "Turn product baskets into solution proposals", "pain": "Manual BOMs across 4 divisions"},
    {"key": "neha", "role": "steward", "title": "Data & RevOps Steward", "city": "Mumbai",
     "goal": "One clean record per partner", "pain": "Same partner exists 3-5 times across ERPs"},
    {"key": "vikram", "role": "partner", "title": "Owner · TechNova Systems (SI partner)", "city": "Pune",
     "goal": "Win more school & campus projects", "pain": "Has to call 4 different CNL people for 4 categories"},
]


class LoginIn(BaseModel):
    persona: str


# ------------------------------------------------------------------ auth & meta
@router.post("/auth/login")
def login(body: LoginIn, request: Request, s: Session = Depends(get_session)) -> dict[str, Any]:
    ip = request.client.host if request.client else "?"
    if not limiter.allow(ip, "login", settings.login_rate_limit_per_min):
        raise HTTPException(429, "too many login attempts")
    persona = next((x for x in PERSONAS if x["key"] == body.persona), None)
    if not persona:
        raise HTTPException(404, "unknown persona")
    if persona["role"] == "partner":
        acc = s.get(Account, 1)
        claims = {"sub": "partner:technova", "name": "Vikram Rao", "role": "partner", "rep_id": None,
                  "region": acc.region if acc else None, "account_id": 1}
    else:
        rep = s.exec(select(SalesRep).where(SalesRep.persona_key == body.persona)).first()
        if not rep:
            raise HTTPException(404, "persona not seeded")
        claims = {"sub": f"rep:{rep.id}", "name": rep.name, "role": rep.role, "rep_id": rep.id, "region": rep.region}
    token = issue_token(claims)
    s.add(AuditLog(ts=state.now, actor=claims["name"], role=claims["role"], method="POST", path="/api/auth/login",
                   status=200, ip=ip, detail="persona login"))
    s.commit()
    return {"token": token, "user": {**claims, "persona": persona}}


@router.get("/auth/me")
def me(p: Principal = Depends(current_principal)) -> dict[str, Any]:
    from app.core.security import ROLE_PERMISSIONS
    return {**p.__dict__, "permissions": sorted(ROLE_PERMISSIONS[p.role])}


@router.get("/meta")
def meta() -> dict[str, Any]:
    return {"now": state.now, "divisions": C.DIVISIONS, "personas": PERSONAS,
            "categories": {k: {"label": v["label"], "division": v["div"], "margin": v["margin"], "wc": v["wc"],
                               "recurring": bool(v.get("recurring"))} for k, v in C.CATEGORIES.items()},
            "verticals": C.VERTICALS}


@router.get("/public/stats")
def public_stats(s: Session = Depends(get_session)) -> dict[str, Any]:
    """Unauthenticated, aggregate-only numbers for the landing page."""
    opps = s.exec(select(Opportunity)).all()
    m = state.metrics.get("models", {}).get("constella_gbm", {})
    return {
        "accounts": len(s.exec(select(Account.id)).all()),
        "raw_records": len(s.exec(select(SourceRecord.id)).all()),
        "signals": len(s.exec(select(Signal.id)).all()),
        "opportunities": len(opps),
        "pipeline_value": round(sum(o.est_value for o in opps if o.status in OPEN_STATUSES)),
        "annuity_value": round(sum(o.est_annuity for o in opps)),
        "solutions": sum(1 for o in opps if o.kind == OppKind.SOLUTION),
        "auc": m.get("auc"), "hit_rate": m.get("hit_rate@5"),
        "resolution_precision": state.resolution.get("precision"),
    }


# ------------------------------------------------------------------ command center
@router.get("/dashboard/head")
def head_dashboard(s: Session = Depends(get_session), p: Principal = Depends(require("read:all"))) -> dict[str, Any]:
    reps = ops.rep_map(s)
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    opps = s.exec(select(Opportunity)).all()
    treat = [o for o in opps if not o.in_holdout]
    open_ = [o for o in treat if o.status in OPEN_STATUSES]
    won = [o for o in treat if o.status == OppStatus.WON]
    lost = [o for o in treat if o.status == OppStatus.LOST]
    ser_open = [ops.serialize(o, accs.get(o.account_id), reps) for o in open_]
    breached = sorted([x for x in ser_open if x["sla_breached"]], key=lambda x: -x["score"])
    funnel_order = ["assigned", "accepted", "contacted", "proposal", "negotiation", "won"]
    reached = Counter()
    rank = {st: i for i, st in enumerate(funnel_order)}
    for o in treat:
        st = o.status.value
        if st in rank:
            for f in funnel_order[: rank[st] + 1]:
                reached[f] += 1
        elif st in ("lost", "nurture"):
            reached["assigned"] += 1
    by_div: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for o in treat:
        d = by_div[o.lead_division or "—"]
        d["count"] += 1
        d["value"] += o.est_value
        if o.status == OppStatus.WON:
            d["won"] += o.closed_value or 0
        if o.status in OPEN_STATUSES:
            d["open"] += 1
    by_kind = Counter(o.kind.value for o in treat)
    load: Counter = Counter(o.lead_rep_id for o in open_ if o.lead_rep_id)
    rep_rows = []
    for r in reps.values():
        if r.role != "rep":
            continue
        mine = [o for o in treat if o.lead_rep_id == r.id]
        w = [o for o in mine if o.status == OppStatus.WON]
        rep_rows.append({"id": r.id, "name": r.name, "division": r.division_code, "region": r.region, "hue": r.avatar_hue,
                         "open": load.get(r.id, 0), "capacity": r.capacity,
                         "utilisation": round(load.get(r.id, 0) / max(1, r.capacity), 2),
                         "won": len(w), "won_value": round(sum(o.closed_value or 0 for o in w)),
                         "breached": sum(1 for x in ser_open if x["lead_rep"] and x["lead_rep"]["id"] == r.id and x["sla_breached"])})
    rep_rows.sort(key=lambda x: -x["won_value"])
    overlaps = sum(1 for o in treat if len({a.get("division") for a in (o.assists or [])} | {o.lead_division}) > 1)
    esc = Counter(o.escalation_level for o in treat)
    map_points = []
    acc_open = defaultdict(float)
    for o in open_:
        acc_open[o.account_id] += o.est_value
    for a in accs.values():
        map_points.append({"id": a.id, "name": a.name, "lat": a.lat, "lng": a.lng, "region": a.region,
                           "open_value": round(acc_open.get(a.id, 0)), "spend": round(a.est_annual_tech_spend),
                           "holdout": a.in_holdout})
    cod = sum(x["cost_of_delay"]["per_day"] for x in ser_open)
    closed = len(won) + len(lost)
    return {
        "now": state.now,
        "kpis": {
            "open_opps": len(open_), "pipeline_value": round(sum(o.est_value for o in open_)),
            "pipeline_annuity": round(sum(o.est_annuity for o in open_)),
            "won": len(won), "won_value": round(sum(o.closed_value or 0 for o in won)),
            "win_rate": round(len(won) / max(1, closed), 3), "sla_breached": len(breached),
            "cost_of_delay_per_day": round(cod), "cross_division_deals": overlaps,
            "nurture_auto": sum(1 for o in treat if o.status == OppStatus.NURTURE),
            "holdout_logged": sum(1 for o in opps if o.in_holdout),
        },
        "funnel": [{"stage": f, "count": reached[f]} for f in funnel_order],
        "by_division": [{"division": k, **{kk: round(vv) for kk, vv in v.items()}} for k, v in by_div.items()],
        "by_kind": dict(by_kind),
        "escalations": {str(k): v for k, v in sorted(esc.items())},
        "breached": breached[:25],
        "top_open": sorted(ser_open, key=lambda x: -x["score"])[:12],
        "reps": rep_rows,
        "map": map_points,
    }


# ------------------------------------------------------------------ model lab & data unifier
@router.get("/model/metrics")
def model_metrics(_: Principal = Depends(require("model"))) -> dict[str, Any]:
    if not state.metrics:
        raise HTTPException(503, "model not trained yet")
    return state.metrics


@router.get("/graph/categories")
def category_graph(_: Principal = Depends(current_principal)) -> dict[str, Any]:
    if not state.cooc:
        raise HTTPException(503, "model not trained yet")
    owned = state.cooc["owned"]
    lift = state.cooc["lift"]
    nodes = [{"id": c, "label": C.CATEGORIES[c]["label"], "division": C.CATEGORIES[c]["div"],
              "adoption": round(float(owned[c].mean()), 3)} for c in owned.columns]
    edges = []
    cols = list(lift.columns)
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            v = float(max(lift.loc[a, b], lift.loc[b, a]))
            if v > 1.4:
                edges.append({"source": a, "target": b, "lift": round(v, 2),
                              "cross_division": C.CATEGORIES[a]["div"] != C.CATEGORIES[b]["div"]})
    edges.sort(key=lambda e: -e["lift"])
    return {"nodes": nodes, "edges": edges[:80]}


@router.get("/data/unification")
def unification(s: Session = Depends(get_session), p: Principal = Depends(require("data:read"))) -> dict[str, Any]:
    recs = s.exec(select(SourceRecord)).all()
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    clusters: dict[int, list[SourceRecord]] = defaultdict(list)
    for r in recs:
        if r.account_id:
            clusters[r.account_id].append(r)
    multi = sorted(clusters.items(), key=lambda kv: -len(kv[1]))
    sample = []
    for aid, rs in multi[:24]:
        a = accs[aid]
        sample.append({"golden": {"id": a.id, "name": a.name, "gstin": a.gstin if p.can("pii:view") else None,
                                  "city": a.city, "quality": a.data_quality},
                       "records": [{"division": r.division_code, "system": r.system, "raw_name": r.raw_name,
                                    "has_gstin": bool(r.raw_gstin), "confidence": r.match_confidence, "rule": r.match_rule}
                                   for r in rs]})
    review = [{"id": r.id, "raw_name": r.raw_name, "city": r.city, "division": r.division_code,
               "candidate": accs[r.account_id].name if r.account_id in accs else None,
               "confidence": r.match_confidence} for r in recs if r.match_rule in ("review_queue", "unmatched")]
    systems = Counter((r.division_code, r.system) for r in recs)
    missing_gst = sum(1 for r in recs if not r.raw_gstin)
    return {"report": state.resolution, "sample_clusters": sample, "review_queue": review,
            "systems": [{"division": d, "system": sy, "records": n} for (d, sy), n in systems.items()],
            "quality": {"records": len(recs), "missing_gstin_pct": round(missing_gst / max(1, len(recs)), 3),
                        "avg_account_quality": round(float(np.mean([a.data_quality for a in accs.values()])), 3)}}


# ------------------------------------------------------------------ pilot lab
@router.post("/pilot/simulate")
def pilot(body: PilotIn, s: Session = Depends(get_session), _: Principal = Depends(require("pilot"))) -> dict[str, Any]:
    opps = [{"probability": o.probability, "kind": o.kind.value, "est_value": o.est_value, "est_margin": o.est_margin,
             "est_annuity": o.est_annuity, "account_id": o.account_id} for o in s.exec(select(Opportunity)).all()]
    accs = {a.id: {"in_holdout": a.in_holdout} for a in s.exec(select(Account)).all()}
    return simulate(opps, accs, body.action_rate, body.uplift_scale, body.runs)


# ------------------------------------------------------------------ whisper capture
@router.post("/capture")
def capture(body: CaptureIn, s: Session = Depends(get_session), p: Principal = Depends(require("capture"))) -> dict[str, Any]:
    acc = s.get(Account, body.account_id)
    if not acc:
        raise HTTPException(404, "account not found")
    text = html.escape(body.text.strip())
    parsed = cap.parse(text)
    result: dict[str, Any] = {"parsed": parsed, "signal": None, "opportunity": None, "merged_into": None}
    if not body.create or not parsed["categories"]:
        return result
    s.add(Interaction(account_id=acc.id, rep_id=p.rep_id, channel="whatsapp", ts=state.now, note=text, sentiment=0.6))
    sig = Signal(account_id=acc.id, kind="intent_note", title=f"Intent captured: “{text[:120]}”",
                 strength=parsed["strength"], source=f"whisper capture by {p.name}", created_at=state.now,
                 payload={"parsed": parsed})
    s.add(sig)
    s.flush()
    result["signal"] = sig.model_dump()
    cats = [c["category"] for c in parsed["categories"] if not C.CATEGORIES[c["category"]].get("recurring")][:5]
    # overlap rule: merge into an open opportunity that shares a category
    existing = [o for o in s.exec(select(Opportunity).where(Opportunity.account_id == acc.id)).all()
                if o.status in OPEN_STATUSES and set(o.categories) & set(cats)]
    reps = ops.rep_map(s)
    if existing:
        o = max(existing, key=lambda x: x.score)
        o.signal_ids = [*o.signal_ids, sig.id]
        o.probability = round(min(0.95, o.probability + 0.1 * parsed["urgency"]), 3)
        o.score = round(o.score * (1 + 0.25 * parsed["urgency"]), 2)
        ops.add_event(s, o, p.name, "signal_merged",
                      f"New intent merged (no duplicate created): “{text[:80]}” — probability ↑ to {o.probability:.2f}")
        s.add(o)
        s.commit()
        result["merged_into"] = ops.serialize(o, acc, reps)
        return result
    sol = parsed["solutions"][0] if parsed["solutions"] else None
    kind = OppKind.SOLUTION if sol else OppKind.CROSS_SELL
    qty = parsed["quantities"][0]["qty"] if parsed["quantities"] else 4
    value = sum(C.CATEGORIES[c]["price"] for c in cats) * max(1, qty) * 0.8
    margin = sum(C.CATEGORIES[c]["price"] * C.CATEGORIES[c]["margin"] for c in cats) / max(1, sum(C.CATEGORIES[c]["price"] for c in cats))
    prob = round(0.25 + 0.4 * parsed["urgency"] * parsed["strength"], 3)
    o = Opportunity(account_id=acc.id, title=(f"{sol['name']} solution for {acc.name}" if sol else
                                               f"{', '.join(C.CATEGORIES[c]['label'] for c in cats[:2])} for {acc.name}"),
                    kind=kind, categories=cats, solution_id=sol["id"] if sol else None, est_value=round(value, -2),
                    est_margin=round(value * margin, -1), probability=prob, score=round(prob * value * margin, 2),
                    explanation={"why": [f"Captured from conversation: “{text[:140]}”",
                                         f"Timing: {parsed['timing'].replace('_', ' ')}",
                                         *([f"Competitor mentioned: {parsed['competitor'].title()} — leakage risk"]
                                           if parsed["competitor"] else [])],
                                 "divisions": sorted({C.CATEGORIES[c]["div"] for c in cats}), "fits_credit": True},
                    signal_ids=[sig.id], created_at=state.now, in_holdout=acc.in_holdout)
    s.add(o)
    s.flush()
    router_ = ops.make_router(s)
    route = router_.route({"account_id": acc.id, "categories": cats, "kind": kind.value, "est_value": o.est_value})
    o.lead_rep_id, o.lead_division, o.assists = route["lead_rep_id"], route["lead_division"], route["assists"]
    o.explanation = {**o.explanation, "routing": route["routing"]}
    o.status, o.assigned_at, o.due_by = OppStatus.ASSIGNED, state.now, sla_due(state.now, accepted=False)
    ops.add_event(s, o, "Constella", "detected", f"Opportunity created from whisper capture by {p.name}")
    lead = reps.get(o.lead_rep_id)
    ops.add_event(s, o, "Router", "assigned", f"Assigned to {lead.name if lead else '—'} ({o.lead_division})")
    s.commit()
    s.refresh(o)
    result["opportunity"] = ops.serialize(o, acc, reps)
    return result


# ------------------------------------------------------------------ solutions
@router.get("/solutions")
def solutions(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> list[dict[str, Any]]:
    opps = s.exec(select(Opportunity).where(Opportunity.kind == OppKind.SOLUTION)).all()
    agg: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for o in opps:
        a = agg[o.solution_id or ""]
        a["count"] += 1
        a["value"] += o.est_value
        a["annuity"] += o.est_annuity
        if o.status == OppStatus.WON:
            a["won"] += 1
    out = []
    for sol in C.SOLUTIONS:
        comps = [{**c, "label": C.CATEGORIES[c["category"]]["label"], "division": C.CATEGORIES[c["category"]]["div"],
                  "price": C.CATEGORIES[c["category"]]["price"], "margin": C.CATEGORIES[c["category"]]["margin"]}
                 for c in sol["components"]]
        ann = [{**x, "label": C.CATEGORIES[x["category"]]["label"], "price": C.CATEGORIES[x["category"]]["price"],
                "period": C.CATEGORIES[x["category"]]["recurring"]} for x in sol["annuity"]]
        out.append({**sol, "components": comps, "annuity": ann,
                    "divisions": sorted({c["division"] for c in comps}),
                    "pipeline": {k: round(v) for k, v in agg[sol["id"]].items()}})
    return out


@router.post("/solutions/compose")
def compose(body: ComposeIn, s: Session = Depends(get_session), p: Principal = Depends(require("compose"))) -> dict[str, Any]:
    acc = s.get(Account, body.account_id)
    sol = next((x for x in C.SOLUTIONS if x["id"] == body.solution_id), None)
    if not acc or not sol:
        raise HTTPException(404, "account or solution not found")
    owned = {t for t in s.exec(select(Transaction.category).where(Transaction.account_id == acc.id)).all()}
    units = max(1.0, acc.employees / 100) if acc.account_type.value in ("enterprise", "retailer") else \
        float(np.clip(acc.est_annual_tech_spend / 6e6, 1, 8))
    lines, total, gp = [], 0.0, 0.0
    for c in sol["components"]:
        spec = C.CATEGORIES[c["category"]]
        qty = max(1, round(c["per100"] * units))
        amt = qty * spec["price"]
        include = c["category"] not in owned
        lines.append({"category": c["category"], "label": spec["label"], "brand": spec["brands"][0], "role": c["role"],
                      "division": spec["div"], "qty": qty, "unit_price": spec["price"], "amount": amt,
                      "margin_pct": spec["margin"], "already_owned": not include, "include": include})
        if include:
            total += amt
            gp += amt * spec["margin"]
    ann_lines, arr = [], 0.0
    for x in sol["annuity"]:
        spec = C.CATEGORIES[x["category"]]
        qty = max(1, round(x["per100"] * units))
        annual = qty * spec["price"] * 12 / spec["recurring"]
        arr += annual
        ann_lines.append({"category": x["category"], "label": spec["label"], "qty": qty, "annual": round(annual),
                          "margin_pct": spec["margin"], "period_months": spec["recurring"]})
    headroom = max(0.0, acc.credit_limit - acc.credit_used)
    return {"account": {"id": acc.id, "name": acc.name, "credit_headroom": headroom}, "solution": sol,
            "lines": lines, "annuity": ann_lines,
            "totals": {"hardware": round(total), "gross_profit": round(gp), "gp_pct": round(gp / max(1, total), 4),
                       "arr": round(arr), "three_year_value": round(total + 3 * arr),
                       "fits_credit": total <= headroom,
                       "divisions": sorted({l_["division"] for l_ in lines if l_["include"]})}}


# ------------------------------------------------------------------ clock, feed, audit
@router.post("/clock/advance")
def advance(body: ClockIn, s: Session = Depends(get_session), _: Principal = Depends(require("clock"))) -> dict[str, Any]:
    now = state.advance(body.hours)
    events = ops.sla_sweep(s)
    return {"now": now, "escalations": events}


@router.post("/clock/reset")
def reset_clock(_: Principal = Depends(require("clock"))) -> dict[str, Any]:
    state.reset_clock()
    return {"now": state.now}


@router.get("/signals/feed")
def feed(s: Session = Depends(get_session), p: Principal = Depends(current_principal), limit: int = 40) -> list[dict[str, Any]]:
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    q = select(Signal).order_by(col(Signal.created_at).desc()).limit(400)
    out = []
    for x in s.exec(q).all():
        a = accs.get(x.account_id)
        if not a or (p.role == "rep" and a.region != p.region):
            continue
        out.append({**x.model_dump(), "account": a.name, "city": a.city})
        if len(out) >= limit:
            break
    return out


@router.get("/audit")
def audit(s: Session = Depends(get_session), _: Principal = Depends(require("read:all")), limit: int = 100) -> list[dict[str, Any]]:
    return [x.model_dump() for x in s.exec(select(AuditLog).order_by(col(AuditLog.id).desc()).limit(limit)).all()]


def random_live_event(s: Session) -> dict[str, Any]:
    """Synthetic live event for the websocket ticker (simulates the streaming ingest)."""
    r = random.Random()
    sig = s.exec(select(Signal).offset(r.randint(0, 3000)).limit(1)).first()
    acc = s.get(Account, sig.account_id) if sig else None
    return {"ts": state.now + timedelta(seconds=r.randint(0, 59)), "kind": sig.kind if sig else "whitespace",
            "title": sig.title if sig else "", "account": acc.name if acc else "", "city": acc.city if acc else "",
            "lat": acc.lat if acc else 0, "lng": acc.lng if acc else 0, "strength": sig.strength if sig else 0}
