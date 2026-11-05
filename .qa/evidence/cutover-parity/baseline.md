# CUT-01 — Legacy feature baseline freeze

**Epic:** [#1135](https://github.com/iamthamanic/sagatree/issues/1135)  
**Issue:** [#1136](https://github.com/iamthamanic/sagatree/issues/1136)  
**Baseline SHA:** `54b6ee7c6f3a07abd49b5450e507df78591f9b05`  
**Baseline commit:** FE-HOST-14: Clear AI/Meshy residual DENYs via host successors (#1119) (#1134)  
**Captured:** 2026-11-05  

## What this baseline means

At this SHA the browser product is **host-first** when `VITE_SAGATREE_HOST_AUTH_URL` is set and `VITE_SAGATREE_HOST_LIBRARY` is not explicitly off. Covered library/session/world/project/catalog journeys use Hono + Better Auth cookies. The Supabase JS client stays inert under host-first unless the operator opts out (`VITE_SAGATREE_HOST_LIBRARY=0`).

This freeze does **not** claim host-only cutover complete. Soft-DENY German UX and residual dual-path branches remain for surfaces listed in the matrix as `PARITY_MISSING`. Soft-DENY is **not** parity.

## Source inputs

| Input | Role |
| --- | --- |
| `docs/architecture/host-modular-monolith.md` | Binding host module/ports contract |
| `docs/architecture/migration-owner-decisions-2026-10-23.md` | Owner decisions (auth/HTTP/desktop/cutover) |
| `docs/architecture/fe-host-09-residual-supabase.md` | Pre-CUT residual allowlist (incomplete) |
| `.qa/intake/edge-infra-contracts/inventory.json` | Edge/infra historical inventory |
| `src/infrastructure/**`, `src/lib/**`, `src/app/**` | Live FE callers |
| `server/src/api/*-routes.ts`, `server/src/modules/*/index.ts` | Host successors |

## Machine-readable matrix

`.qa/evidence/cutover-parity/feature-matrix.json`

Schema fields per row: `stableKey`, `historicalCaller`, `uiJourney`, `previousBehavior`, `hostSuccessor`, `dataOwner`, `risk`, `classification` (`HOST_VERIFIED` \| `PARITY_MISSING` \| `LEGACY_UNUSED`), `issueRef`, `evidenceTest`, `featureAvailableBeforeCutover`.

Deterministic gate: `scripts/cutover-parity-inventory-check.mjs` (wired into `npm run test-gate`).

## Classification counts (at freeze)

See `feature-matrix.json` → `counts`. Snapshot at generation:

| Classification | Count |
| --- | --- |
| HOST_VERIFIED | 48 |
| PARITY_MISSING | 73 |
| LEGACY_UNUSED | 5 |
| Total | 126 |

## Pre-planned CUT ownership (CUT-02..19)

| Issue | CUT | Domain |
| --- | --- | --- |
| #1137 | CUT-02 | NPC controller assignment |
| #1138 | CUT-03 | NPC session instances |
| #1139 | CUT-04 | Session delete |
| #1140 | CUT-05 | Session outcome promote |
| #1141 | CUT-06 | Item catalog mutations |
| #1142 | CUT-07 | Look version history |
| #1143 | CUT-08 | Character presets |
| #1144 | CUT-09 | Adventure arcs |
| #1145 | CUT-10 | World by public ID |
| #1146 | CUT-11 | Avatar artifacts |
| #1147 | CUT-12 | Avatar import/export |
| #1148 | CUT-13 | Character lore AI |
| #1149 | CUT-14 | Session recap AI |
| #1150 | CUT-15 | Look reference analysis |
| #1151 | CUT-16 | Item thumbnail |
| #1152 | CUT-17 | Item model3D |
| #1153 | CUT-18 | Meshy avatar |
| #1154 | CUT-19 | Session media token |
| #1155 | CUT-20 | Dual-path eradication |
| #1156 | CUT-21 | Supabase/Deno runtime eradication |
| #1157 | CUT-22 | Docker/CI/docs |
| #788 | GATE-05 | Desktop packaging proof |
| #1158 | CUT-23 | Final host-only acceptance |

## Follow-ups created by CUT-01 (no silent drop)

Reachable surfaces with no pre-planned CUT-02..19 owner → narrowly scoped issues (reuse existing ports; no new product architecture):

| Issue | Title | Depends on |
| --- | --- | --- |
| #1159 | CUT-02b NPC definition duplicate/restore/world-catalog/promote | #1138 |
| #1162 | CUT-04b session lobby ready host realtime | #1139 |
| #1160 | CUT-06b item catalog character/world reads | #1141 |
| #1161 | CUT-10b world map/atlas asset uploads | #1145 |

CUT-20 (#1155) blockers updated to `Depends on #1154` **and** `#1159` `#1160` `#1161` `#1162`.

## Explicit non-goals at baseline

- Aiberto / AI-GM ensemble / new product concepts (not in matrix as pre-cutover available)
- UI redesign or Adaptive shell changes
- Production Supabase shutdown or data wipe (separate human approvals)
- Treating soft-DENY or mock fingerprints as HOST_VERIFIED

## Gate rule

Any new `PARITY_MISSING` row without a numeric `issueRef` in the planned CUT set (including follow-ups) fails `cutover-parity-inventory-check`. Injecting a fake reachable missing operation must FAIL. Optional never-activated workers may be `LEGACY_UNUSED` only with inbound-import or route evidence (`featureAvailableBeforeCutover: false`).
