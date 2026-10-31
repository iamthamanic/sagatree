# Acceptance — stack-migration-mig-600 (#845)

## Intent

Negative authz / permission parity on the host: role matrix (owner/GM/players/outsider/otherGm),
secret-marker projections, and a membership/filter canary that fails closed when filters are
disabled. Coverage inventory lists every Depends-on row as executed or open-blocker — never silent
parity.

## Acceptance tier

`feature-security` — SLICE DONE for host policy+projection security parity (+ hermetic Browser E2E
and `/api/world-touch` smoke). Per-successor HTTP/RPC/realtime FEATURE VERIFIED → MIG-602/#847.
RELEASE APPROVED → human (MIG-700).

## Preconditions

- All listed Depends-on GitHub issues CLOSED (63/63), including #804 MIG-305.

## Happy path

- Host SQLite fixture seeds parity-harness actors; PolicyService authorize matrix matches allow/deny.
- Player projections omit secret markers; GM-only objects/events stay filtered.
- Canary: `filterEnabled: false` leaks marker → detected; healthy outsider world.edit remains deny.
- Coverage inventory: ≥60 Depends-on rows + Compose #607 Edge suite row; no `parity` without execution.

## Edge / security

- Outsider / otherGm denied on primary world/project/asset/ruleset/saga.
- Owner ≠ GM for session.gm; world.edit stays owner-scoped.
- Compose-era Edge JWT suite (#607) remains wired via `negative-authz-suite-check.mjs` (not claimed as host HTTP).

## Required Tests

- [x] Host SQLite PolicyService role matrix matches allow/deny for owner/GM/players/outsider/otherGm.
- [x] Player projections omit secret markers; GM-only objects/events stay filtered.
- [x] Canary fails closed when filters are disabled; healthy outsider world.edit remains deny.
- [x] Coverage inventory lists Depends-on rows as executed or open-blocker (no silent parity).
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-600-host-authz-parity.self-test.mjs` → PASS (stdout only; does not rewrite this file).
- [x] `e2e/host-negative-authz-parity.spec.ts` → PASS (hermetic Browser E2E, temp `MIG600_OUT_DIR`).

## Security Coverage

| ID | How |
| --- | --- |
| Deny-by-default | PolicyService authorize matrix |
| Secret redaction | projectSessionSnapshot + projectionContainsSecretMarker |
| Canary fail-closed | disabled filter + always-allow stub vs healthy deny |
| Coverage honesty | open-blocker for per-successor HTTP → MIG-602; no untested parity claim |

### Launch Checklist (SC)

N/A — not a launch ticket (SC-01/02/03/06 covered inline via policy + projection).

## Implementation Notes

- `server/tests/authz/host-negative-authz-suite.ts` + barrel
- Self-test evidence: `.qa/runs/mig-600-host-authz/`
- Docs: `docs/ops/negative-authz-suite.md` § Host parity

## Composition Gate

Proof: `.qa/runs/composition-gate-stack-migration-mig-600.md`
