# Feature: ST-MIG PREP-08 — Real parity harness contract (#781)

## Intent

Publish a reproducible GM+2 / Dornhain-Donalu parity harness contract with real DB/API assertions and a mandatory regression canary.

## Happy Path

- [x] Harness design lists PAR-01..10 with backend state assertions
- [x] Fixture manifest for Dornhain/Donalu GM+2 + secrets + combat + concurrency
- [x] PAR-10 canary documents intentional permission flip must fail CI
- [x] Forbidden: marker-only / mock-only / skippable required rows
- [x] No host implementation in this ticket; blocked on GATE-01 for execution

## Composition Gate

- Proof: `.qa/runs/composition-gate-stack-prep-08.md`
