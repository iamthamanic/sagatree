# Acceptance — MIG-408 export quarantine (#824)

## Intent
Capture legacy-unmounted `export`; keep host/dispatcher at 404. Isolated format conversion fixtures; import parse is not persistence.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; `EXPORT_PUBLIC_ACTIVATION_AUTHORIZED === false`. FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] export/import routes remain 404 (createRouteHandler + allowlist).
- [x] JSON indent, Markdown, PDF header/content/filename; invalid format/content → 400.
- [x] Import parse sets persisted=false; conversion ≠ persistence.
- [x] Legacy: no auth; arbitrary content; PDF not validated pipeline.
- [x] Touched files: zero type escape hatches.
- [x] scripts/mig-408-export-quarantine.self-test.mjs → PASS


## Evidence
`scripts/mig-408-export-quarantine.self-test.mjs` → PASS (in test-gate).

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-408.md`.
