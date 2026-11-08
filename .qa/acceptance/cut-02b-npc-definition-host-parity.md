# Feature: CUT-02b: Port NPC definition duplicate restore world-catalog and promote via host

<!-- seeded for issue #1159 -->

## Intent
Host-only parity for NPC definition duplicate, restore, world-profile catalog load (incl. archived), compact→full promote, and residual load-world-availability composition — no Soft-DENY under host-first.

## Happy Path
- [x] Library duplicate uses `POST /api/v1/library/npc-creatures/:id/duplicate` → `NpcCreaturePorts.duplicateDefinition` (packs still host-create).
- [x] World catalog restore uses `POST .../restore` → `restoreDefinition`; list with `includeArchived=1` + scope/worldProfileId filters.
- [x] Compact→full promote uses host get + `updateDefinition` (PATCH); foreign owner denied.
- [x] `loadWorldNpcCreatureAvailability` composes via filtered host list HTTP + domain defaults (no Supabase).
- [x] Negative authz: unauth 401; foreign owner / non-world-editor 403 (`scripts/cut-02b-npc-definition.self-test.mjs`).
- [x] Touched files: zero type escape hatches.

## Edge Cases
- [x] Archived rows hidden unless `includeArchived=1`
- [x] Duplicate creates personal scope with “(Kopie)” name
- [x] Soft-DENY strings removed from restore path

## Regression
- [x] Existing NPC CRUD + CUT-02/03 controller/instance routes unchanged
- [x] Matrix rows for #1159 flipped to HOST_VERIFIED

## Assumptions
- World `modules` JSON for NPC catalog config remains domain defaults until a dedicated world-modules product surface exists; availability still host-lists definitions.

## Screenshots
| Step | Filename |
|------|----------|
| 1 | `01-happy-path.png` |

## Implementation Notes
- Routes: GET list query filters; POST restore; POST duplicate
- FE: `host-library-http` + `npc-creature-service` host-first
- Evidence: `scripts/cut-02b-npc-definition.self-test.mjs`
