# Acceptance — MIG-401 ai-gm Edge quarantine (#817)

## Intent
Capture legacy-unmounted Edge `ai-gm` worker; keep external 404. No automatic host route or public activation until a reviewed successor is authorized.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host AI-GM routes + MIG-600/#845 + MIG-602/#847; `AI_GM_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Dispatcher / host probes for `ai-gm` stay 404 (valid/invalid/no JWT); worker not created.
- [x] `AI_GM_PUBLIC_ACTIVATION_AUTHORIZED === false`; enablement requires separate GM/player projection + lorekeeper/sessions successor.
- [x] Isolated fixtures: action max 5000; membership gate before LLM/quota fan-out; default quota 12/60s → 13th returns 429.
- [x] NDJSON-under-`text/event-stream` framing helpers pinned for narrative/complete/error chunks (not SSE `data:` framing).
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-401-ai-gm-quarantine.self-test.mjs` → PASS

## Evidence
`scripts/mig-401-ai-gm-quarantine.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-401.md`.
