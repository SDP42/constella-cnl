"""Territory twin, open-data demand, site twins and the continuous-learning loop."""

from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.insights import _frames
from app.api.labs import _c, _opps_df
from app.core.db import get_session
from app.core.security import Principal, current_principal, require
from app.models import Account, InstalledAsset, Transaction
from app.services import geo, learning
from app.state import state

router = APIRouter(prefix="/api", tags=["geo", "learning"])


@router.get("/geo/territory")
def territory(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    def build() -> dict[str, Any]:
        f = _frames(s)
        return geo.territory(f["tx"], f["accounts"], _opps_df(s), state.now.date())
    return _c("geo_territory", build)


class PoiIn(BaseModel):
    kind: str
    name: str | None = None
    lat: float
    lng: float
    id: str | None = None


class DemandIn(BaseModel):
    lat: float = Field(..., ge=5, le=38)
    lng: float = Field(..., ge=67, le=98)
    radius: int = 3000
    source: str = "openstreetmap"
    pois: list[PoiIn] = Field(default_factory=list, max_length=3000)


@router.post("/geo/demand")
def demand(body: DemandIn, _: Principal = Depends(current_principal)) -> dict[str, Any]:
    items = [{**p.model_dump(), "kind": k} for p in body.pois if (k := geo.classify_kind(p.kind))]
    return geo.score_pois(body.lat, body.lng, body.radius, items, body.source)


@router.get("/geo/site/{account_id}")
def site(account_id: int, solution: str | None = None, s: Session = Depends(get_session),
         _: Principal = Depends(current_principal)) -> dict[str, Any]:
    a = s.get(Account, account_id)
    if not a:
        raise HTTPException(404, "account not found")
    owned = {t.category for t in s.exec(select(Transaction).where(Transaction.account_id == account_id)).all()}
    now = state.now.date()
    inst = [{"category": i.category, "age_months": (now.year - i.installed_on.year) * 12 + now.month - i.installed_on.month}
            for i in s.exec(select(InstalledAsset).where(InstalledAsset.account_id == account_id)).all()]
    return geo.site_twin(a.model_dump(), owned, inst, solution)


# ------------------------------------------------------------------ continuous learning
class OrderIn(BaseModel):
    account_id: int
    sku: str | None = None
    category: str | None = None
    qty: int = Field(1, ge=1, le=10_000)
    amount: float | None = Field(None, ge=0)
    tx_date: str | None = None


@router.get("/learn/status")
def learn_status(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    return learning.status(s)


@router.post("/learn/orders")
def ingest(rows: list[OrderIn], s: Session = Depends(get_session), _: Principal = Depends(require("data:write"))) -> dict[str, Any]:
    if len(rows) > 5000:
        raise HTTPException(413, "max 5000 rows per call")
    return learning.ingest_orders(s, [r.model_dump() for r in rows])


@router.post("/learn/orders/csv")
async def ingest_csv(file: UploadFile, s: Session = Depends(get_session), _: Principal = Depends(require("data:write"))) -> dict[str, Any]:
    raw = (await file.read())[:2_000_000].decode("utf-8", errors="replace")
    rows = list(csv.DictReader(io.StringIO(raw)))[:5000]
    return learning.ingest_orders(s, rows)


@router.post("/learn/demo-orders")
def demo_orders(n: int = 30, s: Session = Depends(get_session), _: Principal = Depends(require("model"))) -> dict[str, Any]:
    """Simulate a day of ERP orders: partners buying what the model predicted (and some noise)."""
    import random

    live = state.live.sort_values("p", ascending=False)
    r = random.Random(int(state.now.timestamp()))
    picks = live.head(400).sample(min(n, 400), random_state=r.randint(0, 9999))
    rows = [{"account_id": int(x.account_id), "category": x.category, "qty": r.randint(1, 3)} for x in picks.itertuples()]
    return learning.ingest_orders(s, rows)


@router.post("/learn/retrain")
def retrain(_: Principal = Depends(require("model"))) -> dict[str, Any]:
    return learning.retrain("manual retrain from Model Lab")


@router.post("/learn/rescore")
def rescore(s: Session = Depends(get_session), _: Principal = Depends(require("model"))) -> dict[str, Any]:
    return learning.rescore(s)


# ------------------------------------------------------------------ PS1 scorecard (live evidence)
@router.get("/proof/scorecard")
def scorecard(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    from app.services import scorecard as sc

    return _c("scorecard", lambda: sc.build(s, _frames(s)))


# ------------------------------------------------------------------ model registry (trained + pretrained)
@router.get("/ai/models")
def models(_: Principal = Depends(current_principal)) -> dict[str, Any]:
    from app.ml import embed

    m = state.metrics or {}
    gbm = (m.get("models") or {}).get("constella_gbm", {})
    return {"models": [
        {"name": "Next-best-category propensity", "kind": "trained here", "algo": "HistGradientBoosting + isotonic calibration (scikit-learn)",
         "use": "Opportunity detection & ranking", "status": "live", "metric": f"AUC {gbm.get('auc')} · ECE {m.get('ece')}"},
        {"name": "Churn risk", "kind": "trained here", "algo": "Logistic regression on recency/frequency/momentum", "use": "Revenue-at-risk radar", "status": "live", "metric": "see BI & forecast"},
        {"name": "Demand forecast", "kind": "trained here", "algo": "Log-linear trend + Fourier seasonality (ridge)", "use": "FY29 path, seasonality", "status": "live", "metric": "back-test MAPE ≈ 0.23"},
        {"name": "bge-small-en-v1.5", "kind": "pretrained", "algo": "BAAI sentence embeddings, 384-d, ONNX via fastembed (MIT)",
         "use": "Copilot RAG (hybrid), note intent detection, partner dedupe", "status": "live" if embed.available() else "offline → TF-IDF fallback", "metric": "zero-shot; threshold 0.58, margin 0.05"},
        {"name": "Claude (Anthropic API)", "kind": "pretrained (API)", "algo": "LLM with tool use via LangGraph", "use": "Copilot reasoning, pitch drafting",
         "status": "live" if __import__("os").environ.get("ANTHROPIC_API_KEY") else "offline graph (no key)", "metric": "guard-railed tools"},
    ]}


class IntentIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)


@router.post("/ai/intent")
def intent(body: IntentIn, _: Principal = Depends(current_principal)) -> dict[str, Any]:
    from app.ml.semantic import intents

    return {"text": body.text, "intents": intents(body.text)}


# ------------------------------------------------------------------ Work: beat planner · Money: collections
@router.get("/work/beat")
def beat(rep_id: int | None = None, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    from datetime import datetime as _dt

    from app.models import OPEN_STATUSES, Opportunity, SalesRep
    from app.services.fieldmoney import beat_plan

    rid = rep_id or p.rep_id
    if rid is None:  # heads/architects: show the busiest rep's day
        rid = max(((r.id, len(s.exec(select(Opportunity.id).where(Opportunity.lead_rep_id == r.id)).all())) for r in s.exec(select(SalesRep)).all()), key=lambda x: x[1])[0]
    if not p.can("read:all") and p.rep_id != rid:
        raise HTTPException(403, "you can only plan your own day")
    rep = s.get(SalesRep, rid)
    opps = [o.model_dump() for o in s.exec(select(Opportunity).where(Opportunity.lead_rep_id == rid)).all() if o.status in OPEN_STATUSES]
    accs = {a.id: a.model_dump() for a in s.exec(select(Account)).all()}
    start = _dt.combine(state.now.date(), _dt.min.time()).replace(hour=10)
    return {"rep": {"id": rep.id, "name": rep.name, "division": rep.division_code, "region": rep.region}, **beat_plan(rep.model_dump(), opps, accs, start)}


@router.get("/money/collections")
def collections(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    from app.services.fieldmoney import collections as coll

    def build() -> dict[str, Any]:
        f = _frames(s)
        return coll(f["tx"], f["accounts"], state.now.date())
    return _c("collections", build)
