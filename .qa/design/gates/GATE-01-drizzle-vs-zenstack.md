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
2. Schema: `worlds(id, owner_user_id)`, `maps(id, world_id, title, gm_only)`, `map_reveals(map_id, player_user_id)`.  
3. Seed: distinct identities Owner O, GM G, Player P, Cross-owner X. O owns a world, G has a GM membership for that world but is not its owner; P is a player member; X owns a separate world. Include a second O-owned world where O is not GM. One `gm_only` map.  
4. Commands: `listMaps(viewer)`, `getMap(id, viewer)`, `updateMapTitle(id, viewer, title, expectedRevision)`.

## Metrics / PASS criteria

| # | Test | PASS |
| --- | --- | --- |
| 1 | P lists maps | Only non-`gm_only` or revealed maps; never title leak of hidden |
| 2 | X getMap | Deny (empty/403); no row body |
| 3 | O (world owner, not GM) attempts GM-only `updateMapTitle` on the world where O has no GM assignment | Deny, even though owner identity matches |
| 4 | O update with stale `expectedRevision` | Conflict; no write |
| 5 | Domain package imports | Zero imports of drizzle/zenstack from `src/domains/**` |
| 6 | Cold start + 100 sequential writes | No lost updates; measurable p95 latency recorded |
| 7 | Policy bypass attempt via raw SQL in app layer | Impossible or fails closed (document how) |

## Negative tests (required)

- Forged `owner_user_id` in client payload ignored  
- Owner O without GM entitlement cannot exercise GM-only operations; GM G without ownership receives only explicitly delegated GM capabilities; reveal row for wrong player does not authorize  
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
