"""Copilot endpoint (LangGraph + Claude, with an offline planner fallback)."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.agent.graph import MODEL, ROLE_SUGGESTIONS, SUGGESTIONS, get_graph, llm_available
from app.core.db import get_session
from app.core.security import Principal, current_principal

router = APIRouter(prefix="/api/agent", tags=["agent"])


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    account_id: int | None = None


@router.get("/info")
def info(p: Principal = Depends(current_principal)) -> dict[str, Any]:
    greet = {"rep": "your territory and pipeline", "head": "the national business", "architect": "solution design",
             "steward": "data quality and model trust", "partner": "your proposals from CNL"}
    return {"mode": "llm" if llm_available() else "offline", "model": MODEL,
            "suggestions": ROLE_SUGGESTIONS.get(p.role, SUGGESTIONS), "role": p.role,
            "greeting": f"Hi {p.name.split()[0]} — I can help with {greet.get(p.role, 'your work')}. Ask by typing or tap the mic.",
            "graph": ["retrieve", "plan", "act_llm | act_offline", "guard"]}


@router.post("/ask")
def ask(body: AskIn, s: Session = Depends(get_session), p: Principal = Depends(current_principal)) -> dict[str, Any]:
    t0 = time.perf_counter()
    out = get_graph().invoke({"question": body.question, "account_id": body.account_id, "principal": p, "session": s,
                        "steps": []})
    return {"answer": out.get("answer", ""), "mode": out.get("mode"), "steps": out.get("steps", []),
            "citations": out.get("citations", []), "error": out.get("error"),
            "latency_ms": round((time.perf_counter() - t0) * 1000)}
