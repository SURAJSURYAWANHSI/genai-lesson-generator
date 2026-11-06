# 0012: Revision merge enforced in code

**Status:** Accepted
**Date:** 2026-11-07

## Context

The brief requires revisions to preserve correct content and avoid unrelated rewriting. Asking a model to leave sections alone is only a request: it may rephrase them anyway and introduce new errors into content that already passed.

## Decision

`retry_agent` builds structured feedback containing only failed criteria, their evidence, specific instructions, and lists of sections to revise and preserve. Sections come from the evaluator's `affected_sections`, falling back to a default mapping per criterion. No model call is needed for this.

The generator returns a full lesson, and then `merge_revision` takes only the listed sections from it and keeps everything else from the previous version. Each version records its `changed_sections` and a content hash, which shows whether a revision actually changed anything.

## Alternatives rejected

- **Trusting the prompt alone:** cannot be guaranteed.
- **An extra model call to write the feedback:** the evaluator already found the problems, so this would pay twice and risk distorting them.
- **Having the model return only changed sections:** saves tokens but makes the schema and prompts conditional, and full output is simpler.

## Consequences

Unrelated drift is impossible. The trade-off is that a fix needing a change outside the listed sections is discarded. The next evaluation then fails and names the right section, which uses up a retry. Whole-lesson criteria such as Q02 map to many sections for this reason.
