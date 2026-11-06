# Architecture Decision Records

Each record explains one significant decision: its context, the choice made, the alternatives rejected and the consequences. A decision that changes later gets a new record that supersedes the old one, so the history stays intact. Use [the template](template.md) for new records.

| # | Decision | Status |
|---|---|---|
| [0001](0001-langgraph-orchestration.md) | LangGraph for orchestration | Accepted |
| [0002](0002-separate-generator-and-evaluator.md) | Separate generator and evaluator, with no self-assessment | Accepted |
| [0003](0003-all-must-pass-gate.md) | All-must-pass gate, with no weighted score | Accepted |
| [0004](0004-deterministic-validators-override-llm.md) | Deterministic validators run first and override the model | Accepted |
| [0005](0005-fail-closed.md) | Fail closed on invalid output and provider failures | Accepted |
| [0006](0006-provider-abstraction.md) | Provider abstraction through LangChain, with Gemini as default | Accepted |
| [0007](0007-database-persistence-over-checkpointer.md) | Per-node database persistence instead of a checkpointer | Accepted |
| [0008](0008-memory-is-additive.md) | Memory is additive and can never relax the rubric | Accepted |
| [0009](0009-human-gated-evolution.md) | Human-gated evolution with versioning and rollback | Accepted |
| [0010](0010-mock-provider.md) | Mock provider is explicit, labelled and sees only prompts | Accepted |
| [0011](0011-error-injection.md) | Error injection after generation, blocked in production | Accepted |
| [0012](0012-revision-merge-in-code.md) | Revision merge enforced in code | Accepted |
| [0013](0013-sqlite-default-postgres-portable.md) | SQLite by default with a Postgres-portable schema | Accepted |
| [0014](0014-cost-from-configuration.md) | Cost rates come from configuration | Accepted |
