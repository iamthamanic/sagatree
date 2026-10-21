# Issue contract quality audit (independent remediation review)

**Status: BLOCKED for implementation.** The earlier report saying "Weak/incomplete: 0" only measured superficial field presence. It is not a semantic sign-off.

## Verified deficiencies

- 55/55 RPC inventory rows still have `parametersGuess`, `returnsGuess` and `tablesGuess`. Many SQL relation matches are local variables, keywords or aliases; the live SQL signatures and the final deployed overload must be resolved from migration order and caller types.
- 22/24 Edge function inventory rows contain placeholder request/response shapes, generic authz, and unspecified side effects or rates. Existing dispatcher allowlist permits only eight hardened workers; legacy CRUD workers must remain unreachable until separately proven secure.
- The parity "harness" delivered in PREP-08 is a Markdown scenario/fixture **specification**, not an executable seeded backend/DB test suite. Required CI regression proof is missing.
- GitHub issues previously lacked canonical `## Runner`/design links and did not include per-source verified contracts.
- The earlier validator did not validate all seven contract sections, had a non-global boilerplate matcher, allowed 12 unmapped IDs, and rejected the already-published GitHub metadata.
- Architecture PoCs GATE-01..05 are NOT human-approved; #770 is open, live CI not mandatory.
- Legacy to successor design must not invent a new exposure for unmounted CRUD workers or change owner-scoped AI credential authorization into project membership.

## Work remaining for an implementation-ready verdict

1. Verify all 55 SQL RPC **latest effective overloads**, inputs, outputs, table effects, ownership and SQLSTATE against the actual migration chain and callers; remove guesses after verification.
2. Verify all 24 Edge functions' exact routes/authorization/allowlist behavior, request and response variants, persistent effects, rate limits, retries and failure cases; prohibit activation of the 16 legacy-unmounted workers without new audited policy.
3. Bind all 13 infra facades to **every** invoked RPC/Edge successor, not a truncated list; each must have a precise dependency to its implementation ticket.
4. Build and run required DB-backed parity/Atlas tests; prove a deliberately introduced regression fails CI.
5. Publish canonical issue bodies with `## Runner`, verified design paths and *implementation-specific* acceptance criteria, maintain `agent-blocked` until audits pass.
6. Run architectural PoCs and obtain explicit HUMAN APPROVED decisions before unlocking downstream tasks.

## Audit semantics

- `schema-valid` / `structure-valid` means only the required metadata is present.
- `verified` means signatures, permission boundaries, behavior and negative tests are confirmed from source and runnable fixtures.
- `implementation-ready` requires verified contract + closed predecessor issues + approved ADRs + applicable live evidence.
- An issue must not be tagged `agent-ready` based on metadata/keyword checks alone.
