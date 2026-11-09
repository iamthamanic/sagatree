# Composition Gate — desktop-release-pipeline

- HEAD_SHA: eae7e0da8b8b3b7bd55653dda4ea443aa8e58cec
- BASE_SHA: 89101a9109205583fbdceb2ccd5dafcd66f4584e
- Date: 2026-11-09
- Verdict: CLEAR
- Acceptance tier: tool-only

## Event

Desktop Release workflow is fail-closed until MIG-703, then builds into a
draft GitHub Release and undrafts only after every OS matrix leg succeeds.

## Hop chain

1. **Producer:** `scripts/desktop-release-readiness.mjs` → ready/version/blocker
2. **Gate:** tag↔version match + deferred fail-closed on `v*` without packaging
3. **Consumer:** tauri-action draft release → `publish` undrafts on tag success

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | dispatch dry_run / tag not ready | deferred succeeds / tag fails | pass |
| Invalid/missing | mistyped tag vs package version | readiness fails closed | pass |
| Two consumers / crash | matrix fail-fast=false | draft stays unpublished | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
