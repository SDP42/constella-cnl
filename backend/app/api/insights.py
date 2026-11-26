"""BI, prediction, AI nudges, campaign studio and brand portal endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.db import get_session
from app.core.security import Principal, current_principal, require
from app.data import catalog as C
from app.models import Account, Opportunity, OppKind, OppStatus, Outbox
from app.routing.engine import sla_due
from app.services import insights as I
from app.services import ops
from app.state import state

router = APIRouter(prefix="/api", tags=["insights"])


def _frames(s: Session) -> dict[str, Any]:
    if "frames" not in state.cache:
        from app.pipeline import frames

        state.cache["frames"] = frames(s)
    return state.cache["frames"]


def _cached(key: str, fn):
    if key not in state.cache:
        state.cache[key] = fn()
    return state.cache[key]


def _churn(s: Session) -> dict[str, Any]:
    f = _frames(s)
    return _cached("churn", lambda: I.churn_model(f["tx"], f["accounts"], f["interactions"], state.now.date()))


@router.get("/bi/overview")
def bi_overview(s: Session = Depends(get_session), _: Principal = Depends(require("read:all"))) -> dict[str, Any]:
    f = _frames(s)
    now = state.now.date()
    fc = _cached("forecast", lambda: I.forecast(f["tx"], now))
    mix = _cached("brand_mix", lambda: I.brand_mix(f["tx"], f["products"], now))
    pen = _cached("penetration", lambda: I.penetration(f["tx"], f["accounts"]))
    an = _cached("anomalies", lambda: I.anomalies(f["tx"], now))
    ch = _churn(s)
    hist = fc["history"]
    last12 = sum(h["total"] for h in hist[-12:])
    prev12 = sum(h["total"] for h in hist[-24:-12]) or 1
    acc = f["accounts"]
    cats_per = f["tx"].groupby("account_id")["category"].nunique()
    return {
        "kpis": {
            "revenue_12m": last12, "growth_yoy": round(last12 / prev12 - 1, 4),
            "next_6m_forecast": sum(x["total"] for x in fc["forecast"]),
            "brand_share_latest": mix[-1]["brand_share"] if mix else None,
            "avg_categories_per_partner": round(float(cats_per.mean()), 2),
            "avg_wallet_share": round(float((f["tx"][f["tx"]["tx_date"] > now.replace(year=now.year - 1)]
                                              .groupby("account_id")["amount"].sum()
                                              / acc.set_index("id")["est_annual_tech_spend"]).clip(upper=1).mean()), 4),
            "high_churn_risk": int((ch["live"]["risk"] > 0.7).sum()),
            "churn_model_auc": ch["auc"],
        },
        "forecast": fc, "brand_mix": mix, "penetration": pen, "anomalies": an,
    }


@router.get("/bi/fy29")
def fy29(s: Session = Depends(get_session), _: Principal = Depends(require("read:all")),
         base_growth: float = Query(0.18, ge=-0.2, le=0.6), uplift: float = Query(0.06, ge=0, le=0.3),
         brand_gain: float = Query(0.06, ge=0, le=0.2)) -> dict[str, Any]:
    f = _frames(s)
    return I.fy29_path(f["tx"], f["products"], state.now.date(), base_growth, uplift, brand_gain)


@router.get("/predict/churn")
def predict_churn(s: Session = Depends(get_session), p: Principal = Depends(current_principal), limit: int = 25) -> dict[str, Any]:
    ch = _churn(s)
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    live = ch["live"].sort_values("risk", ascending=False)
    rows = []
    for r in live.itertuples():
        a = accs.get(int(r.account_id))
        if not a or (p.role == "rep" and a.region != p.region) or (p.role == "partner"):
            continue
        drivers = []
        if r.recency > 90:
            drivers.append(f"No order for {r.recency} days")
        if r.trend < -0.5:
            drivers.append("Spend falling vs previous 6 months")
        if r.neg_notes:
            drivers.append(f"{r.neg_notes} negative interaction(s)")
        if r.credit_util > 0.9:
            drivers.append("Credit nearly exhausted")
        rows.append({"account_id": a.id, "name": a.name, "city": a.city, "type": a.account_type.value, "risk": round(float(r.risk), 3),
                     "recency_days": int(r.recency), "drivers": drivers or ["Pattern similar to past churners"]})
        if len(rows) >= limit:
            break
    return {"model": {"auc": ch["auc"], "base_rate": ch["base_rate"], "coefficients": ch["coefficients"],
                      "method": "logistic regression, time-split (train T-240d, test T-120d)"}, "items": rows}


@router.get("/predict/next-orders")
def predict_next(s: Session = Depends(get_session), p: Principal = Depends(current_principal), limit: int = 25) -> list[dict[str, Any]]:
    f = _frames(s)
    nx = _cached("next_orders", lambda: I.next_orders(f["tx"], state.now.date()))
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    nx = nx.assign(_k=nx["days_to_next"].abs()).sort_values("_k")
    out = []
    for r in nx.itertuples():
        a = accs.get(int(r.account_id))
        if not a or (p.role == "rep" and a.region != p.region) or p.role == "partner":
            continue
        if r.days_to_next < -60 or r.days_to_next > 45:
            continue
        out.append({"account_id": a.id, "name": a.name, "city": a.city, "next_order": r.next_order, "days_to_next": int(r.days_to_next),
                    "overdue": bool(r.days_to_next < 0), "typical_order": r.typical_order, "median_gap_days": int(r.median_gap_days)})
        if len(out) >= limit:
            break
    return out


@router.get("/ai/nudges")
def ai_nudges(s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> list[dict[str, Any]]:
    if p.role == "partner":
        return []
    f = _frames(s)
    region = p.region if p.role == "rep" else None
    key = f"nudges:{region}"
    data = _cached(key, lambda: I.nudges(f["tx"], f["accounts"], f["assets"], _churn(s)["live"], state.now.date(), region))
    return [{**n, "accounts": n["accounts"][:12], "account_count": n["size"]} for n in data]


class LaunchIn(BaseModel):
    segment_id: str
    max_accounts: int = 40


@router.post("/campaigns/launch")
def launch(body: LaunchIn, s: Session = Depends(get_session), p: Principal = Depends(require("capture"))) -> dict[str, Any]:
    f = _frames(s)
    region = p.region if p.role == "rep" else None
    data = _cached(f"nudges:{region}", lambda: I.nudges(f["tx"], f["accounts"], f["assets"], _churn(s)["live"], state.now.date(), region))
    seg = next((n for n in data if n["id"] == body.segment_id), None)
    if not seg:
        raise HTTPException(404, "segment not found")
    router_ = ops.make_router(s)
    reps = ops.rep_map(s)
    created, messages = 0, 0
    for aid in seg["accounts"][: body.max_accounts]:
        acc = s.get(Account, aid)
        if not acc or acc.in_holdout:
            continue
        cats = [seg["category"]] if seg.get("category") else []
        kind = OppKind.SOLUTION if seg["kind"] == "solution" else OppKind.RECURRING if seg["kind"] == "daas" else OppKind.CROSS_SELL
        if seg.get("solution_id"):
            sol = next(x for x in C.SOLUTIONS if x["id"] == seg["solution_id"])
            cats = [x["category"] for x in sol["components"] if x["required"]][:3]
        if not cats:
            cats = ["display_amc"]
        value = round(seg["est_value"] / max(1, seg["size"]), -2)
        margin = C.CATEGORIES[cats[0]]["margin"]
        o = Opportunity(account_id=aid, title=f"{seg['title']} — {acc.name}", kind=kind, categories=cats,
                        solution_id=seg.get("solution_id"), est_value=value, est_margin=round(value * margin),
                        probability=float(seg["confidence"]) * 0.6, score=round(float(seg["confidence"]) * value * margin, 2),
                        explanation={"why": [seg["why"], f"Launched as campaign '{seg['id']}' by {p.name}"],
                                     "divisions": sorted({C.CATEGORIES[c]["div"] for c in cats}), "fits_credit": True,
                                     "campaign": seg["id"]},
                        created_at=state.now)
        s.add(o)
        s.flush()
        route = router_.route({"account_id": aid, "categories": cats, "kind": kind.value, "est_value": value})
        o.lead_rep_id, o.lead_division, o.assists = route["lead_rep_id"], route["lead_division"], route["assists"]
        o.status, o.assigned_at, o.due_by = OppStatus.ASSIGNED, state.now, sla_due(state.now, accepted=False)
        ops.add_event(s, o, p.name, "campaign", f"Created by campaign '{seg['title']}'")
        s.add(Outbox(ts=state.now, channel=seg["channel"] if seg["channel"] in ("whatsapp", "email") else "in_app",
                     to=acc.name, subject=seg["title"], body=f"Hi {acc.name} team — {seg['why']} Reply YES for a quote.",
                     rule_id="campaign", opportunity_id=o.id, account_id=aid))
        created += 1
        messages += 1
        lead = reps.get(o.lead_rep_id) if o.lead_rep_id else None
        if lead:
            messages += 1
            s.add(Outbox(ts=state.now, channel="in_app", to=lead.name, subject="New campaign opportunity",
                         body=o.title, rule_id="campaign", opportunity_id=o.id, account_id=aid))
    s.commit()
    state.cache.pop(f"nudges:{region}", None)
    return {"segment": seg["id"], "opportunities_created": created, "messages_queued": messages}


@router.get("/brands")
def brand_list(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> list[dict[str, Any]]:
    f = _frames(s)
    return _cached("brands", lambda: I.brands(f["tx"], f["products"], f["accounts"], state.now.date()))
