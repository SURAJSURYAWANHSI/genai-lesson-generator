# 0013: SQLite by default with a Postgres-portable schema

**Status:** Accepted
**Date:** 2026-11-07

## Context

The project must run locally with no setup and also suit deployment. The brief asks for SQLite locally and a PostgreSQL-compatible architecture.

## Decision

SQLAlchemy models use only portable types (`Uuid`, `JSON`, a UTC datetime decorator), and the database is chosen by `DATABASE_URL`. Alembic owns the schema and runs at startup. Both databases get partial unique indexes guaranteeing one active prompt per name and one active rubric. Handlers are synchronous and run in FastAPI's threadpool, with SQLite in WAL mode.

## Alternatives rejected

- **Postgres only:** a heavier first run for an assessment.
- **`create_all` instead of migrations:** no upgrade path, and the brief requires Alembic.
- **Async SQLAlchemy:** adds complexity with no benefit at this load, since LLM calls dominate run time.

## Consequences

All data stays on the local machine, as the project's owner requires: local runs and Docker both use `backend/data/`, and Docker ports bind to `127.0.0.1` only. Only the text a model needs is sent to the configured provider. `git clone` to a running app needs no database setup. The Postgres path was designed for, and a driver and Compose profile are included, but it has **not been run** in this environment because the Docker daemon was unavailable. Treat it as untested. SQLite's single writer limits write concurrency, which is acceptable for local use.
