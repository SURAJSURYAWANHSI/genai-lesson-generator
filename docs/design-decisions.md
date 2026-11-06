# Design decisions

This answers the questions set in the brief and explains the trade-offs. Each answer links to the [Architecture Decision Record](adr/README.md) with the full reasoning.

## Why was LangGraph selected?

The workflow is a known state machine with a loop: generate, evaluate, then publish, retry or reject. LangGraph makes that loop explicit, keeps state typed, and provides per-node streaming for the live view.

**Trade-off:** a framework dependency for a small graph that could be written by hand. A free-running agent was rejected because the steps are fixed, and giving a model control of them would make the quality gate easier to skip. See [ADR 0001](adr/0001-langgraph-orchestration.md).

## Why are generation and evaluation separate?

Writing and judging need opposite incentives. The generator has a teaching prompt. The evaluator has a sceptical one, sees the lesson only as data, and defaults to FAIL when in doubt. They can even use different vendors.

**Trade-off:** at least two model calls per attempt. See [ADR 0002](adr/0002-separate-generator-and-evaluator.md).

## Why can't the evaluator trust generator self-assessment?

The reasoning that produced an error also tends to justify it, so a self-grade is weak evidence. The evaluator receives neither a self-assessment nor the revision feedback, so a revised lesson is judged on what it says and not on what it claims to have fixed. The lesson schema has no status field, and unknown fields are dropped.

**Trade-off:** the evaluator has less context on each revision and may re-raise something it accepted before. See [ADR 0002](adr/0002-separate-generator-and-evaluator.md).

## Why is PASS/FAIL mandatory?

A lesson that is good overall but wrong about one concept still teaches something false, and a beginner can't tell which part to distrust. An average would let strength elsewhere hide that.

**Trade-off:** one borderline judgement costs a whole retry, and strict evaluators can reject acceptable lessons. See [ADR 0003](adr/0003-all-must-pass-gate.md).

## Why are retry limits necessary?

Without them, an unfixable lesson or an evaluator that disagrees with itself would spend money indefinitely. Three generations give two real chances to correct a defect. A failure persisting after that usually needs a person.

**Trade-off:** some fixable lessons get rejected. They stay available for inspection, and the pattern feeds evolution proposals. See [ADR 0001](adr/0001-langgraph-orchestration.md).

## Why is deterministic validation used?

Whether a section is empty or a question has an answer can be checked exactly, instantly and at no cost, so a model shouldn't be trusted with it. A deterministic issue can only make a result stricter. Semantic quality is left to the model, because keyword checks would prove nothing.

**Trade-off:** rules must be maintained, and they catch only structural defects. See [ADR 0004](adr/0004-deterministic-validators-override-llm.md).

## How does memory work?

After each evaluation, failures are counted per criterion, for the topic and globally. When a criterion that failed goes on to pass after revision, the correction is stored as a strategy. Before generating, the system turns these records, plus human feedback and approved topic guidance, into written advice for the generator and notes for the evaluator. Everything lives in the database, so it survives restarts.

Memory never takes part in the PASS decision, so it can't weaken the rubric.

**Trade-off:** it is simple counting by criterion, so it recognises *what* keeps failing but not subtler reasons. See [ADR 0008](adr/0008-memory-is-additive.md).

## How is self-evolution controlled?

Analysis produces proposals backed by counted evidence, and creating one changes nothing. A named person must approve it, which creates a new version. Each run records its versions, so outcomes can be compared. Rollback restores the previous version. Rubric proposals can only add guidance, and code refuses anything else.

**Trade-off:** improvements wait for a person, and the system has no authentication, so reviewer names are self-declared. See [ADR 0009](adr/0009-human-gated-evolution.md).

## How does deliberate error injection work?

After the generator returns a lesson, code applies one of six defects on the first attempt only. The lesson then goes through the normal evaluator, which isn't told. The run records what changed, whether the expected criterion failed (`detected`), and whether a later clean version passed it (`corrected`). It requires demo mode and is refused in production. If the evaluator misses the defect, the run ends in `ERROR` and isn't published.

**Trade-off:** structural defects are caught by the validators with certainty, so only semantic ones truly test the model. See [ADR 0011](adr/0011-error-injection.md).

## How are hallucination risks reduced?

- A curated reference is supplied for RAG topics, or the user can supply their own.
- The evaluator treats anything that conflicts with the reference as a failure (Q01).
- Evidence is required on every check, which makes unfounded verdicts easier to spot.
- The prompts tell models to treat reference text and lesson content as data, not instructions.
- Revisions can't change sections that already passed.

**Trade-off:** these reduce the risk but don't remove it. Without a reference, Q01 rests on the evaluator's own knowledge, and the same model could share a misconception with the generator. Using a different vendor as evaluator would help, at higher cost and with more setup.

## How are cost and latency managed?

- Generation stops at 3 attempts, and evaluator correction at 1 retry.
- Feedback comes from code, with no extra model call.
- Deterministic checks are free.
- Evolution analysis uses counting, not a model.
- Timeouts and provider retries are configurable, and generate endpoints are rate limited.
- Tokens are recorded per call, and costs per run when rates are configured.

The worst case is 12 model calls in one run, if every generation and evaluation needs its one retry. Typically a run takes 2 to 4. Calls run one after another, so latency is the sum of those calls, and the live stream makes the wait visible.

**Trade-off:** running both checks on every attempt costs more than stopping early, in exchange for complete feedback. See [ADR 0004](adr/0004-deterministic-validators-override-llm.md) and [ADR 0014](adr/0014-cost-from-configuration.md).

## What can the current system not guarantee?

- **That a passed lesson is correct.** A PASS means an evaluator found no failure. It can be wrong, and generator and evaluator may share blind spots.
- **That a lesson works for real beginners.** Q02 is a model's opinion, not a test with learners.
- **Consistent verdicts.** The same lesson could be judged differently on another run.
- **That approved changes helped.** Prompt metrics show correlation on small samples.
- **Safety against all prompt injection.** Text is treated as data by instruction, which reduces the risk but doesn't remove it.
- **Multi-instance operation.** The rate limiter and interrupted-run recovery work per process.
