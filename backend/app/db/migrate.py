"""Run Alembic migrations from application code."""

from alembic import command
from alembic.config import Config

from app.core.config import BACKEND_DIR


def run_migrations() -> None:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
