"""Copilot endpoint (LangGraph + Claude, with an offline planner fallback)."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.agent.graph import GRAPH, MODEL, SUGGESTIONS, llm_available
from app.core.db import get_session
from app.core.security import Principal, current_principal

router = APIRouter(prefix="/api/agent", tags=["agent"])


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    account_id: int | None = None


@router.get("/info")
def info(_: Principal = Depends(current_principal)) -> dict[str, Any]:
    return {"mode": "llm" if llm_available() else "offline", "model": MODEL, "suggestions": SUGGESTIONS,
            "graph": ["retrieve", "plan", "act_llm | act_offline", "guard"]}


@router.post("/ask")
def ask(body: AskIn, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    t0 = time.perf_counter()
    out = GRAPH.invoke({"question": body.question, "account_id": body.account_id, "principal": p, "session": s,
                        "steps": []})
    return {"answer": out.get("answer", ""), "mode": out.get("mode"), "steps": out.get("steps", []),
            "citations": out.get("citations", []), "error": out.get("error"),
            "latency_ms": round((time.perf_counter() - t0) * 1000)}
