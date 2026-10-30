# Evidence — #1043 GATE-01 follow-up (Drizzle host persistence)

- Date: 2026-10-30
- Issue: https://github.com/iamthamanic/sagatree/issues/1043
- ADR: `docs/architecture/ADR-ST-05-gate-01-drizzle-policy.md`
- Exceptions inventory: `docs/architecture/gate-01-drizzle-host-exceptions.md`
- Self-test: `scripts/gate-01-drizzle-host-persistence.self-test.mjs` (wired in `npm run test-gate`)

## Runtime proof

- Dependency: `drizzle-orm@1.0.0-rc.5` (root + `server/`) with `drizzle-orm/node-sqlite` over existing `node:sqlite` `DatabaseSync`
- Product handle: `server/src/persistence/host-drizzle.ts` (`HostDatabase.orm` + prepare bridge)
- Typed adapters: world read (`repositories/world/sqlite-world-read-store.ts`) + world write (`modules/world/internal/world-write-store.ts`)
- Other product stores: `HostDatabase.prepare` → Drizzle SQL bind (no direct `DatabaseSync.prepare`)

## Tests observed green (this change)

- gate-01-drizzle-host-persistence.self-test
- mig-010, mig-011, mig-012, mig-013, mig-014, mig-020, mig-022
- rpc-world-places, rpc-world-create, rpc-world-destructive, rpc-session-access, rpc-project-membership
- architecture-boundary-check

## Fold into later gates (SoT only — do not hand-edit generated outputs)

| Gate | Issue | What to absorb later |
| --- | --- | --- |
| MIG-602 CI quality | #847 | Require `checkGate01DrizzleHostPersistence` + upcoming #1044 import-boundary guard in host CI matrix |
| MIG-700 cutover | #849 | Cutover checklist: host persistence must be Drizzle+Policy (this evidence + #1044) before freeze/delta |

Registry/generator path: update Source-of-Truth inputs that feed `.qa/intake/local-first-stack-migration-issues.json` / design generators when those tickets open — not by editing generated contract files in this PR.
