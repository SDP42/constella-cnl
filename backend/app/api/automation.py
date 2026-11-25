"""Automation & jobs API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.core.db import get_session
from app.core.security import Principal, current_principal, require
from app.models import AutomationRule, JobRun, Outbox
from app.services.scheduler import JOBS, run_job

router = APIRouter(prefix="/api/automation", tags=["automation"])


class RulePatch(BaseModel):
    enabled: bool | None = None
    conditions: dict[str, Any] | None = None


@router.get("/rules")
def rules(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> dict[str, Any]:
    rows = s.exec(select(AutomationRule)).all()
    hours = sum(r.runs * r.hours_saved_per_run for r in rows)
    return {"rules": [r.model_dump() for r in rows], "runs": sum(r.runs for r in rows),
            "hours_saved": round(hours, 1), "fte_equivalent": round(hours / 160, 2)}


@router.patch("/rules/{rid}")
def patch_rule(rid: str, body: RulePatch, s: Session = Depends(get_session),
               _: Principal = Depends(require("reassign"))) -> dict[str, Any]:
    r = s.get(AutomationRule, rid)
    if not r:
        raise HTTPException(404, "rule not found")
    if body.enabled is not None:
        r.enabled = body.enabled
    if body.conditions is not None:
        r.conditions = body.conditions
    s.add(r)
    s.commit()
    s.refresh(r)
    return r.model_dump()


@router.get("/outbox")
def outbox(s: Session = Depends(get_session), p: Principal = Depends(current_principal), limit: int = 60) -> list[dict[str, Any]]:
    rows = s.exec(select(Outbox).order_by(col(Outbox.id).desc()).limit(limit * 4)).all()
    if p.role == "rep":
        rows = [o for o in rows if o.to == p.name]
    return [o.model_dump() for o in rows[:limit]]


@router.get("/jobs")
def jobs(s: Session = Depends(get_session), _: Principal = Depends(current_principal)) -> list[dict[str, Any]]:
    out = []
    for name, j in JOBS.items():
        last = s.exec(select(JobRun).where(JobRun.job == name).order_by(col(JobRun.id).desc())).first()
        out.append({"job": name, "every": j["every"], "description": j["desc"],
                    "last": last.model_dump() if last else None})
    return out


@router.post("/jobs/{name}/run")
def trigger(name: str, _: Principal = Depends(require("reassign"))) -> dict[str, Any]:
    if name not in JOBS:
        raise HTTPException(404, "unknown job")
    return run_job(name).model_dump()
