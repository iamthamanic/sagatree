# GATE-01 — Drizzle + Policy Service vs ZenStack 3

> **Status:** SPEC only — not APPROVED  
> **GitHub:** #784 (PoC execution) · Prep criteria: #776  
> **Blocks:** MIG-011..013, wave-1 host persistence/authz

## Variants

| ID | Stack |
| --- | --- |
| A | `better-sqlite3` or `libsql` + **Drizzle ORM** + hand-written **SagaTree Policy Service** |
| B | **ZenStack 3** (SQLite) with generated policy layer |

## Reproducible setup

1. Fresh `server/poc/gate-01/` package (isolated; not wired into product).  
2. Schema: `worlds(id, owner_user_id)`, `maps(id, world_id, title, revision, gm_only)`, `projects(id, world_id, gm_user_id)`, `project_members(project_id, user_id, role)`, `sessions(id, project_id, status)`, and `map_reveals(project_id, map_id, player_user_id)`. Keep world ownership separate from project membership and session authority.  
3. Seed: distinct identities Owner O, GM G, Players P1/P2, and Cross-owner X. O owns W1 but has no GM assignment. G is GM of a project using W1 and does not own W1. P1/P2 are player members. X owns W2 and belongs to neither project. One map is unrevealed, one revealed only to P1; use another session in X's project for cross-project negatives.  
4. Operations: owner-scoped `updateMapTitle(id, viewer, title, expectedRevision)`; saga-scoped `listMaps/getMap` player projections; GM-scoped `setSessionStatus(sessionId, viewer, status)`. These are separate permissions, not aliases.

## Source authority (before contract)

- `supabase/migrations/015_inventory_item_definitions.sql`: `current_user_can_edit_world_profile` authorizes `world_profiles.owner_user_id = auth.uid()`; being a GM does not grant world ownership.
- `supabase/migrations/094_world_atlas.sql` and `104_atlas_worldbuilder_mutations.sql`: Atlas writes call that owner guard.
- `supabase/migrations/040_session_join_code_security.sql`: session lifecycle writes require `is_project_gm(project_id)`.
- `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`: player projection requires the appropriate saga/reveal context. A world owner without a GM assignment still keeps owner editing rights.

## Metrics / PASS criteria

| # | Test | PASS |
| --- | --- | --- |
| 1 | P1/P2 list maps in their saga | Each projection contains only maps allowed by that saga's reveal contract; no hidden title, layer, or body leaks and no reveal from another saga/player |
| 2 | X getMap | Deny (empty/403); no row body |
| 3 | O without GM edits own world; G without ownership tries the same Atlas write | O succeeds; G is denied. P1/P2 and X are denied as well |
| 4 | O update with stale `expectedRevision` | Conflict; no write |
| 5 | Domain package imports | Zero imports of drizzle/zenstack from `src/domains/**` |
| 6 | Cold start + 100 sequential writes | No lost updates; measurable p95 latency recorded |
| 7 | Policy bypass attempt via raw SQL in app layer | Impossible or fails closed (document how) |
| 8 | G changes status of their project session; O without GM tries that session operation | G succeeds; O/P1/P2/X are denied. World ownership does not grant GM session powers |
| 9 | Missing authentication, unknown saga, or a membership in another project | Deny before any write; no response data from another owner/project |

## Negative tests (required)

- Forged `owner_user_id` in client payload ignored  
- Owner O keeps own-world editing but cannot exercise GM-only session operations; GM G keeps delegated project/session capabilities but cannot edit another user's world; a reveal for the wrong saga/player does not authorize  
- Missing auth context → deny by default  

## Decision criteria (human APPROVED after PoC)

1. All PASS rows green for chosen variant.  
2. Policy authoring complexity score (time to add new resource) recorded.  
3. Migration path for 50+ tables plausible (notes).  
4. License/ops constraints acceptable.

## On APPROVED

- Record ADR-ST-05 = chosen variant.  
- Unblock MIG-011, MIG-012, MIG-013 labels only after ADR file lands.

## Explicit non-decision

Agents must not mark GATE-01 APPROVED. PoC may recommend A or B with evidence only.
