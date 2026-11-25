"""Request bodies (responses are typed dicts produced by the service layer)."""

from typing import Literal

from pydantic import BaseModel, Field


class ActionIn(BaseModel):
    action: Literal["accept", "contact", "proposal", "negotiate", "win", "lose", "decline", "nurture"]
    actor_rep_id: int | None = None
    value: float | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)


class ClockIn(BaseModel):
    hours: float = Field(gt=0, le=24 * 30)


class CaptureIn(BaseModel):
    account_id: int
    text: str = Field(min_length=3, max_length=2000)
    rep_id: int | None = None
    create: bool = True


class ComposeIn(BaseModel):
    account_id: int
    solution_id: str


class PilotIn(BaseModel):
    action_rate: float = Field(default=0.65, ge=0, le=1)
    uplift_scale: float = Field(default=1.0, ge=0, le=3)
    runs: int = Field(default=300, ge=50, le=2000)
