"""Process-wide state: the demo clock and the trained model (kept in memory for live scoring)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.core.config import get_settings

_settings = get_settings()


class AppState:
    def __init__(self) -> None:
        self.offset = timedelta(0)
        self.model: Any = None
        self.metrics: dict[str, Any] = {}
        self.resolution: dict[str, Any] = {}
        self.live: Any = None  # live whitespace snapshot (pandas) scored by the model
        self.cooc: Any = None  # co-purchase matrices (cos, lift, conf)

    @property
    def now(self) -> datetime:
        return _settings.demo_now + self.offset

    def advance(self, hours: float) -> datetime:
        self.offset += timedelta(hours=hours)
        return self.now

    def reset_clock(self) -> None:
        self.offset = timedelta(0)


state = AppState()
