# Composition Gate — desktop-product-tauri

- HEAD_SHA: 6ffebe281763c70a77796ce168a521dd80df9fba
- BASE_SHA: e7f7981067c5c1b3a6fd2dd2b96aa15039ef7f48
- Date: 2026-11-10
- Verdict: CLEAR
- Acceptance tier: tool-only
- Acceptance: `.qa/acceptance/desktop-product-tauri.md`

## Event

Product Tauri packaging under `DESKTOP-PRODUCT-STORE` APPROVED: `src-tauri/` +
`@tauri-apps/*` flip Desktop Release readiness to `ready=true`. GATE-05 PoC
check now requires product activation when the store RELEASE is APPROVED.
Unsigned draft installers may build; signing/externalBin remain follow-up.

## Hop chain

1. **Producer:** `scripts/desktop-release-readiness.mjs` → `ready=true` / version
2. **Gate:** `scripts/desktop-product-tauri.self-test.mjs` (+ GATE-05 product-activation case)
3. **Consumer:** `.github/workflows/desktop-release.yml` matrix / tauri-action draft release

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | readiness + self-test + GATE-05 check | all PASS on this HEAD | pass |
| Invalid/missing | no src-tauri / no deps | readiness ready=false; GATE-05 fails if RELEASE APPROVED | pass |
| Two consumers / crash | sidecar spawn fail | SPA continues; stand-in secrets probe 404 | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
