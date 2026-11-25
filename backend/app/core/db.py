"""Database engine + session helpers. SQLite for the prototype, Postgres-ready via URL."""

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import BASE_DIR, get_settings

settings = get_settings()
(BASE_DIR / "data").mkdir(exist_ok=True)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)


def init_db(drop: bool = False) -> None:
    from app import models  # noqa: F401  (register tables)

    if drop:
        SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
