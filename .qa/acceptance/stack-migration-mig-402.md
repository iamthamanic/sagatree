# Acceptance — MIG-402 AI provider credentials + ollama-settings (#818)

## Intent
Host ports for allowlisted ai-provider-credentials and ollama-settings workers; secure failure semantics.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized HTTP adapters + MIG-600; FEATURE VERIFIED → MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] Credential list/create/update/delete/refresh paths match source contracts with authz.
- [x] List DB errors → 500 (not empty list); refresh persist failure → 500 persist_failed.
- [x] Ollama settings URL policy + resolve paths covered.
- [x] Legacy regression: refresh PATCH ignore / empty-list-on-DB-error characterized and successor semantics decided.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] scripts/mig-402-ai-provider-credentials.self-test.mjs → PASS

## Evidence
`node --experimental-strip-types scripts/mig-402-ai-provider-credentials.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-402.md`.
