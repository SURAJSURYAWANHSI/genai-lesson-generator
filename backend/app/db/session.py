"""Engine and session management, with one short transaction per unit of work."""

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import BACKEND_DIR, get_settings

_engine: Engine | None = None
_factory: sessionmaker[Session] | None = None


def resolve_database_url(url: str) -> str:
    """Anchor relative SQLite paths to backend/ so the working directory doesn't matter."""
    parsed = make_url(url)
    if parsed.get_backend_name() != "sqlite" or not parsed.database or parsed.database == ":memory:":
        return url
    path = Path(parsed.database)
    if not path.is_absolute():
        path = BACKEND_DIR / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return parsed.set(database=str(path)).render_as_string(hide_password=False)


def build_engine(url: str) -> Engine:
    resolved = resolve_database_url(url)
    if make_url(resolved).get_backend_name() != "sqlite":
        return create_engine(resolved, pool_pre_ping=True)
    engine = create_engine(resolved, connect_args={"check_same_thread": False, "timeout": 30})

    @event.listens_for(engine, "connect")
    def _configure_sqlite(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    return engine


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = build_engine(get_settings().database_url)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    global _factory
    if _factory is None:
        _factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    return _factory


def reset_engine() -> None:
    """Drop the current engine. This is how tests simulate an application restart."""
    global _engine, _factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _factory = None


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
