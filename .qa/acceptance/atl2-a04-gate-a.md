# Feature: ATL2-A04 Gate A — Phase A acceptance protocol (#1200)

<!-- atlas-v2-epic: #1196; slice: A04; slug: atl2-a04 -->

## Intent

Independent browser + code evidence that Phase A Golden foundation
(A01–A03 + PR stack) is trustworthy before Phase B opens.

## Preconditions

- #1197 / #1198 / #1199 merged to `main`.
- Host Better Auth available for Browser E2E (`browser-e2e-with-host`).

## Happy Path

- [ ] Fresh host + Browser/Host probe show Golden six-level child maps after ensure-starter
- [ ] PR stack #1239 / #1194 / #1195 / #1240 present on `main` (documented SHAs)
- [ ] Known High foundation defects closed or residual gaps explicitly filed (not silently ignored)
- [ ] Gate report `.qa/runs/atl2-a04-gate-a.md` published with CLEAR or OPEN+blocker

## Edge Cases

- [ ] Non-owner cannot read owner atlas maps (negative)
- [ ] Player view does not expose crypt secret stamps (existing redaction path)

## Security Coverage

- Owner-scoped atlas list/get; outsider deny
- Player projection redaction (existing `redactUnifiedCanvasForParty`)
- Out of scope: new auth routes

## Composition Gate

SKIPPED — acceptance protocol / evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-a04-gate-a.md`)

## Implementation Notes

- Protocol: `scripts/atl2-a04-gate-a.self-test.mjs` → `.qa/runs/atl2-a04-gate-a.md`
- Browser wrapper: `e2e/atl2-a04-gate-a.spec.ts`
- Residual: editor Golden-reset dialog hang tracked as non-blocking Medium
