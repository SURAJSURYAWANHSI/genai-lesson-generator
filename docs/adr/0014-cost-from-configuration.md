# 0014: Cost rates come from configuration

**Status:** Accepted
**Date:** 2026-11-07

## Context

The brief requires estimated cost per run. Vendor prices change, and a price table in code would go out of date without anyone noticing, producing confident but wrong numbers.

## Decision

Rates are set through `GENERATOR_*_COST_PER_MTOK` and `EVALUATOR_*_COST_PER_MTOK`. When a rate isn't configured, cost is stored and shown as null ("not configured"), never as zero. If any call in a run has unknown cost, the run total is also null, so it can't be quietly understated. Token usage is always recorded when the provider reports it. The mock reports estimated tokens at zero cost.

## Alternatives rejected

- **A built-in price table:** convenient, but silently wrong once prices change.
- **Fetching prices at runtime:** no standard API exists across vendors.

## Consequences

Cost figures are absent until someone sets the rates, though the token counts needed to work them out are always stored. The estimate ignores discounts such as caching and free tiers.
