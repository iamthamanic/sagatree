# Feature: GATE-01-GUARD: Drizzle-/DB-Client-Architekturgrenzen im Host-CI erzwingen

## Intent
Fail-closed CI guard for ADR-ST-05 Drizzle host persistence wiring (#1044).

## Happy Path
- [x] Architecture guard inspects real host import graph for drizzle-orm / node:sqlite allowlists + forbidden zones; not package-name-only.
- [x] Self-test: valid fixture PASS; negatives for application/api/domain bypass, public-module drizzle import, missing drizzle-orm dep — all FAIL red.
- [x] Exceptions machine-readable in `.qa/architecture/host-drizzle-exceptions.json` (open-database, host-drizzle, auth cookie profile; drizzle allow persistence/repositories/module internal+persistence).
- [x] Guard runs via `architecture-boundary-check` → `npm run test-gate` / required CI. Evidence notes for #847/#849 SoT fold-in (no hand-edit of generated contracts).
- [x] Zero type escape hatches.

## Edge Cases
- [x] Missing exceptions policy → FAIL
- [x] Missing host-drizzle proof tokens → FAIL
- [x] Documented allowlist paths do not false-positive

## Regression
- [x] Existing host module-boundary self-test still PASS

## Assumptions
- #1043 merged (Drizzle HostDatabase on main)

## Screenshots
N/A

## Implementation Notes
- `checkHostDrizzlePersistenceBoundaries` in `scripts/architecture-boundary-check.mjs`
- Policy: `.qa/architecture/host-drizzle-exceptions.json`
