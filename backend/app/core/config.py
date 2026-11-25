"""Runtime configuration (12-factor, overridable via env / .env)."""

from datetime import datetime
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CONSTELLA_", env_file=".env", extra="ignore")

    app_name: str = "Constella API"
    # Override in production: CONSTELLA_SECRET_KEY. The default is for the local demo only.
    secret_key: str = "constella-local-demo-secret-change-me"
    rate_limit_per_min: int = 240
    login_rate_limit_per_min: int = 12
    rebuild_on_start: bool = False
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'constella.db'}"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Synthetic world
    seed: int = 42
    n_accounts: int = 600
    history_months: int = 24
    # The demo clock. Everything (SLA, recency, seasonality) is computed against this.
    demo_now: datetime = datetime(2026, 11, 25, 10, 0, 0)

    # Model / scoring
    eval_window_days: int = 120  # label window for the time-split back-test
    top_k: int = 5
    min_probability: float = 0.18

    # Routing contract
    lead_credit_share: float = 0.7
    sla_accept_hours: int = 48
    sla_contact_hours: int = 120
    holdout_fraction: float = 0.2


@lru_cache
def get_settings() -> Settings:
    return Settings()
