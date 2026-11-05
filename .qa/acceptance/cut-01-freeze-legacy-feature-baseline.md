# Feature: CUT-01 — Freeze legacy feature baseline and produce exhaustive parity matrix

Issue: #1136 · Epic: #1135 · Slug: `cut-01-freeze-legacy-feature-baseline`

## Intent

Vollständige baselinegebundene Auflistung aller produktiv erreichbaren Supabase/GoTrue/Storage/RPC/Edge/Realtime-Operationen inklusive der nicht in FE-HOST-09 dokumentierten DENYs. Read-only außer nachvollziehbarer QA-Dokumentation und deterministischem Inventory-Gate.

## Happy Path

- [ ] Machine-readable matrix at `.qa/evidence/cutover-parity/feature-matrix.json` with required schema fields and baseline SHA `54b6ee7c6…`
- [ ] Baseline freeze documented in `.qa/evidence/cutover-parity/baseline.md`
- [ ] `scripts/cutover-parity-inventory-check.mjs` validates schema, ownership vs CUT-02..23 + follow-ups, inject-fake → FAIL, LEGACY_UNUSED evidence
- [ ] Check wired into `npm run test-gate`
- [ ] Every `PARITY_MISSING` row has numeric `issueRef` in planned set; no silent drops
- [ ] Reachable gaps outside CUT-02..19 documented as follow-ups #1159–#1162; CUT-20 blockers updated
- [ ] No UI change; no product feature invention; zero type escape hatches on touched files

## Edge Cases

- [ ] Injected fake reachable missing operation fails ownership gate
- [ ] Optional never-activated workers classified LEGACY_UNUSED only with caller evidence
- [ ] Soft-DENY residual strings still present for honesty fingerprint (not counted as HOST_VERIFIED)

## Regression

- [ ] Existing FE-HOST-09 residual allowlist remains accurate for known DENYs
- [ ] `npm run test-gate` remains green

## Security Coverage

- N/A for new runtime auth surfaces — documentation/inventory only.
- SC-01…SC-07: N/A — not a launch ticket; no new API routes in this issue.

## Assumptions

- Baseline is FE-HOST-14 merge `54b6ee7c6f3a07abd49b5450e507df78591f9b05`
- Soft-DENY ≠ parity
- Follow-up issues are required before CUT-20; not optional

## Screenshots

| Step | Filename |
|------|----------|
| — | N/A (no UI) |

## Implementation Notes

- Artifacts: `feature-matrix.json` (126 rows), `baseline.md`, `cutover-parity-inventory-check.mjs`
- Follow-ups created: #1159 CUT-02b, #1160 CUT-06b, #1161 CUT-10b, #1162 CUT-04b
- Scoped runner queue updated to include follow-ups before CUT-20
