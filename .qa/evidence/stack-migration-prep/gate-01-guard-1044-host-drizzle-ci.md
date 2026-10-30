# Evidence — #1044 GATE-01 CI guard (Drizzle/DB import boundaries)

- Date: 2026-10-30
- Depends on: #1043 merged (`881d61ca…`)
- Policy: `.qa/architecture/host-drizzle-exceptions.json`
- Enforcement: `checkHostDrizzlePersistenceBoundaries` in `scripts/architecture-boundary-check.mjs` (wired into `npm run test-gate`)

## Proof

- Live repo boundary check PASS with #1043 HostDatabase wiring
- Self-test (inline fixture policy mirroring live allowlist shapes): application drizzle, api node:sqlite, modules/*/persistence PASS, exact node:sqlite sibling FAIL, commented-out import ignored, missing server/src → violation (not throw), missing policy / comment-only proof tokens
- Composition: tooling/docs-only range is auto-SKIPPED by `scripts/composition-gate.mjs` (no hand-maintained `.qa/runs` record)

## Fold into later gates (SoT only)

| Gate | Issue | Absorb |
| --- | --- | --- |
| MIG-602 | #847 | Host CI matrix must keep architecture-boundary (incl. this guard) + host E2E/policy parity green |
| MIG-700 | #849 | Cutover checklist: Drizzle host + this guard + policy parity required before freeze/delta; no RELEASE without them |

Do not hand-edit generated `.qa/design/migration-issues/**` or intake JSON as source — update generator/SoT inputs when those tickets execute.
