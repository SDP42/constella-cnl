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
