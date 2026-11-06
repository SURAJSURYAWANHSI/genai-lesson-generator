# 0010: Mock provider is explicit, labelled and sees only prompts

**Status:** Accepted
**Date:** 2026-11-07

## Context

The brief allows a clearly labelled mock mode when credentials are unavailable, and requires tests to run without API keys. A mock can mislead in two ways: by being mistaken for real output, or by cheating, such as being told which error was injected.

## Decision

- **Explicit only.** The mock runs only with `LLM_PROVIDER=mock`. There is no fallback, so a missing Gemini key stops the app with a clear error. Production refuses the mock outright.
- **No cheating.** The mock receives only the prompt text a real model would receive, and never sees injection metadata. Its generator repairs only the sections named in the feedback, so ignored feedback produces no improvement.
- **Labelled.** Every evidence string starts with `[Mock rule-based check]`, the API reports `mock_mode`, and the UI shows a permanent banner. Non-RAG mock lessons are titled `[MOCK LESSON]`.

The mock's evaluator is a set of simple rules, including a short list of known false claims. It proves that the pipeline works. It says nothing about how well a real model judges content, and the documentation says so.

## Alternatives rejected

- **Silent fallback to mock when a key is missing:** a reader could mistake canned content for a real result.
- **Giving the mock the injection type:** simpler, but detection would prove nothing.

## Consequences

The full pipeline can be run and tested free and deterministically. Test results from the mock must not be read as evidence of real semantic quality.
