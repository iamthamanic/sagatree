# Acceptance — Desktop Release pipeline (CI skeleton)

## Intent

Wire a **Desktop Release** GitHub Actions workflow into SagaTree CI/CD so Mac /
Windows / Linux installers can be published from version tags (or manual
dispatch) **without** folding installer builds into PR Quality Gates. Until
MIG-703 adds product Tauri, the workflow must probe readiness, succeed on dry
dispatch, and **fail-closed** on `v*` tags (no empty/fake releases).

## Preconditions

- Quality Gates remain `verify.yml` (PR + `main` push).
- GATE-05 PoC does **not** add product `src-tauri/` or `@tauri-apps/*` deps.
- MIG-703 is the unlock for real matrix builds / GitHub Release assets.

## Happy path

- [x] `.github/workflows/desktop-release.yml` exists; triggers: `v*` tags + `workflow_dispatch`.
- [x] `scripts/desktop-release-readiness.mjs` reports `ready=false` today with explicit blockers.
- [x] `docs/ops/desktop-release.md` describes feature/fix → tag → users / auto-update later.
- [x] PR path unchanged: no installer matrix on `pull_request`.
- [ ] After MIG-703: readiness `ready=true`; tag `v*` produces three-OS assets on a GitHub Release.
- [ ] Signing secrets + in-app updater documented and configured before public auto-update claims.

## Edge cases

- [x] Tag push while not ready → job fails with clear MIG-703 message.
- [x] `workflow_dispatch` dry_run while not ready → deferred job succeeds (pipeline proof).
- [x] Release preflight runs `npm run test-gate` only when packaging is ready (before build).

## Regression

- [ ] `npm run test-gate` unaffected.
- [ ] No product Tauri activation in this change (no `src-tauri/`, no new `@tauri-apps` deps).
- [ ] ECC / merge-gate `requiredChecks` list unchanged (Desktop Release is not a PR required check).

## Assumptions

- Real artifact publishing waits for MIG-703 product packaging.
- Auto-update UX is a follow-up once updater keys + signed releases exist.
