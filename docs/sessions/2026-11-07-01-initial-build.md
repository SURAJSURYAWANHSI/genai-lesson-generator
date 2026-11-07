# Session 2026-11-07-01: Initial build

## Goal

Build the self-evaluating lesson generator specified in `Prompt.md`, with ADRs, session logs and a well-organised repository, using no technology beyond what the assignment needs.

## Starting state

- The repository contained only `Prompt.md`, which holds the same brief twice.
- Python 3.13 and Node 22 were available. The Docker CLI was installed, with the daemon not running.

## Requirements that changed during the session

| Request | Effect |
|---|---|
| Proper documentation, ADRs, session logs | Added `docs/adr`, `docs/sessions`, `docs/architecture.md` and `docs/implementation-plan.md` |
| Only a Gemini key; must run on it and not offline; provider may change later | Gemini became the default. Mock runs only when explicitly chosen, with no fallback. Changing provider is a `.env` edit ([ADR 0006](../adr/0006-provider-abstraction.md), [ADR 0010](../adr/0010-mock-provider.md)) |
| Everything runs and is stored locally | Data in `backend/data/`, Docker ports bound to `127.0.0.1`, no CDNs or remote fonts ([ADR 0013](../adr/0013-sqlite-default-postgres-portable.md)) |
| Nothing extra in the UI; it's for an interview | UI limited to section 15 of the brief, plus what other sections require |
| Make the UI simple and friendly | Plain language, one main action per page, a simple list for live progress |

## Decisions

The brief describes a lesson generator whose topic is RAG, not a RAG pipeline, so no vector store or embeddings were added. All decisions are in [the ADR index](../adr/README.md).

## Problems found and fixed

- **Client disconnect left runs stuck in RUNNING.** A first fix only worked when the stream was closed directly, and a test over a real socket showed the bug remained. Runs now execute on their own thread, so they finish and are recorded whether or not the browser stays open.
- **Unhelpful provider errors.** "GoogleAPIError" gave no way to act on the failure. Status codes now become plain advice, while provider messages are still never passed on.
- **`gemini-3.8-flash` overloaded.** It returned repeated 503 and 504 errors, so the default moved to `gemini-3.6-flash`, the first model to pass live calls with the project's schemas.
- **Daily quota used up by testing.** The free tier's limit is 20 requests a day per model, and this session's live checks reached it on `gemini-3.6-flash`. `gemini-3.5-flash` also returned the limit error after very few direct calls, so the assumption that another model would give a fresh allowance proved unreliable. The local `.env` was set to `gemini-3.5-flash-lite` for the rest of the day.
- **Wrong package from the shadcn CLI.** It installed an unrelated npm package named `cn`. The package was removed and imports now use `@/lib/utils`.
- **Mock rule mismatch.** A pattern matched "look" but not "looks". The guard against publishing an undetected injected error caught this, ending the run in `ERROR` with nothing published.

## Verification

Results at the end of the session:

| Check | Result |
|---|---|
| `pytest` with no key or network | 162 tests passed |
| Migration on an empty database, then `alembic check` | Applied; no drift |
| Lifecycle checks against real server processes (`mock` and invalid-key runs): restart persistence, rejection, approve and rollback, production lockdown, no fallback without a key | 27 of 27 passed |
| Client disconnect over a real socket | Run finished as PASS at all 3 disconnect points |
| `npm run build` | Passed, no type errors. JS bundle 606 kB (188 kB gzip), with Vite's size warning accepted to keep the build simple |
| Dashboard in headless Chrome against a mock backend | 61 walkthrough and 12 simulated-response checks passed, as reported by the frontend build agent. Screenshots reviewed |
| Remote origins in the built frontend | None loaded: only library text and namespace identifiers contain "http" |
| 12-step demo on live Gemini (`gemini-3.6-flash`) | All 12 confirmed: failed Q07, revised 2 sections, then 10 of 10 passed |
| Errors only a model can detect, on live Gemini | 3 of 3 detected. See [the results](../../outputs/demo/live_evaluator_checks.md) |

**Not verified:**

- The dashboard in a browser against live Gemini.
- Rejection after all retries on live Gemini (covered with mock and scripted responses).
- Correction of the jargon error on live Gemini, because the quota ran out during the revision.
- Docker Compose, the nginx configuration and PostgreSQL, because the Docker daemon wasn't running.
- OpenAI and Claude against live APIs, because no keys were available.

## Next steps

- Check the dashboard against live Gemini once quota is available.
- Run Docker Compose and the Postgres profile when Docker Desktop is running.
