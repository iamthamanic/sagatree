# Atlas follow-up real product E2E (#755)

- Epic #746 closer: product default-3D path is gated in CI.
- Follow-ups #747–#754 must have CLEAR/SKIPPED composition proofs.
- Playwright contract asserts DB nav + registry tools; optional live via `E2E_ATLAS_PRODUCT=1`.
- Staging Donalu backfill evidenced; **prod migrations not applied**.
- Fixture setup uses mocks only — **no legacy deletion**.

## Artifacts

- `browser-matrix.json` — named assertions
- `SECURITY.md` — all severities
- `gate-proof.json` — written by check
- Playwright: `e2e/atlas-followup-product-e2e-gate.spec.ts`
