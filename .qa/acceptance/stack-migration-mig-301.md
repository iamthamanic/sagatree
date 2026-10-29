# Acceptance — MIG-301 infrastructure/ai host adapters (#800)

## Intent
Port `src/infrastructure/ai` callers onto approved host HTTP adapters for BYOK credentials + Ollama Organize prefs while Edge remains allowlisted (no production cutover).

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
MIG-600/#845 feature E2E cutover; FEATURE VERIFIED → MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] List/add/refresh/delete preserve typed public credential view and expose provider errors without key leakage.
- [x] Ollama Organize get/upsert/test/listModels preserve typed settings view without apiKey leakage; foreign account cannot mutate owner prefs.
- [x] Foreign account cannot list or mutate owner credentials; missing session fails before invoke.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-301-ai-adapter.self-test.mjs` → PASS

## Evidence
`node --experimental-strip-types scripts/mig-301-ai-adapter.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-301.md`.
