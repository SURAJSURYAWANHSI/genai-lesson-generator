# 0006: Provider abstraction through LangChain, with Gemini as default

**Status:** Accepted
**Date:** 2026-11-07

## Context

The brief requires Gemini, OpenAI and Claude behind one abstraction, configured from the environment. The project's owner has a Gemini key today and expects the key or provider may change later. Vendors also differ in how they accept structured output.

## Decision

Agents depend on one small interface, `LLMProvider.generate_structured(schema, system_prompt, user_prompt)`. `LangChainProvider` implements it for all three vendors through their LangChain chat models.

- **Default:** `LLM_PROVIDER=gemini` with model `gemini-3.8-flash`, confirmed against Google's official model page on 2026-11-07. Changing key, model or vendor is a `.env` edit and a restart.
- **Structured output:** every vendor uses `method="json_schema"`. This is required for Claude: the adapter's default forces a tool call, which current Claude models reject with a 400. `temperature` is never sent to Claude for the same reason.
- **Schemas:** every model-facing field is required, using nullable types instead of defaults, to stay within strict schema rules on every vendor.
- **OpenAI has no default model** because current IDs could not be confirmed from an authoritative source, so `GENERATOR_MODEL` is required. A wrong guess would fail at the first request, and a clear startup error is better.

## Alternatives rejected

- **Each vendor's SDK directly:** more code for three adapters, with no benefit at this scale.
- **Prompting for JSON and parsing the text:** less reliable than native structured output, and the brief rules out parsing arbitrary text.

## Consequences

Vendor quirks stay in one file. Request shapes are tested offline. Only the Gemini path is intended for live use now; the OpenAI and Claude adapters are tested offline only and need a live run before being relied on.
