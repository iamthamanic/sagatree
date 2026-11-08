# Acceptance — cut-23-prove-complete-host-only-parity-wi (#1158)

## Intent
Machine-inspectable full host-only parity closer: zero `PARITY_MISSING`, Soft-DENY UX gone
from product infrastructure (except shared deny helper), host Compose default from CUT-22,
and desktop claims stay honest under GATE-05 / DESKTOP-PRODUCT-STORE separation.

## Happy Path
- [x] `feature-matrix.json` counts: `PARITY_MISSING === 0`
- [x] `cutover-parity-inventory-check` PASS
- [x] Root Compose includes host-only default (CUT-22)
- [x] Soft-DENY `im Host-Modus noch nicht verfügbar` cleared from product adapters
- [x] Project membership leave via `POST /api/v1/projects/:id/leave`
- [x] Desktop README documents GATE-05 PoC evidence + non-claims for NOT-RUN platforms
- [x] `scripts/cut-23-final-parity.self-test.mjs` wired into test-gate

## Composition Gate
See `.qa/runs/composition-gate-cut-23-prove-complete-host-only-parity-wi.md`

## Evidence
- `scripts/cut-23-final-parity.self-test.mjs`
- `.qa/evidence/cutover-parity/feature-matrix.json`
