# Real parity harness (PREP-08 #781)

> **Status:** SPEC / fixture contract only — not a mock marker suite.  
> **Does not** replace ATLAS-LIVE-E2E (#770). Complements cutover gates MIG-700/702.

## Goal

Reproducible backend/API/DB assertions for local-first migration parity. An intentional permission or persistence regression **must** turn a required test red.

## Fixture: Dornhain / Donalu (GM + 2 players)

| Actor | Role | Notes |
| --- | --- | --- |
| `gm@fixture.local` | gamemaster / owner | Sees `gm_only` NPCs, maps, assets |
| `p1@fixture.local` | player | Character + inventory; no GM secrets |
| `p2@fixture.local` | player | Second seat; concurrent commands |

World structure (must stay consistent with product Dornhain/Donalu inventory):

- Saga/project with atlas root → region → place nodes  
- At least one **secret NPC** (`gm_only`) and one revealed NPC  
- At least one **secret map/asset** not visible to players  
- Characters with inventory rows for p1/p2  
- Active session with runtime revision, dice, combat encounter seed  
- Persisted play-state snapshot after combat tick  

Fixture pack path (to be seeded by implementer after GATE-01):  
`.qa/evidence/stack-migration-prep/parity-fixtures/dornhain-donalu/`

## Required scenarios (real state, not markers)

| ID | Scenario | Assert |
| --- | --- | --- |
| PAR-01 | GM lists maps/NPCs | Includes `gm_only` rows |
| PAR-02 | Player lists maps/NPCs | Excludes unrevealed `gm_only`; no title/body leak |
| PAR-03 | Cross-owner read | 403/empty; no row body |
| PAR-04 | Concurrent commands | Two players + GM command within same revision window; no lost update |
| PAR-05 | Stale `expectedRevision` | Conflict; DB unchanged |
| PAR-06 | Idempotent retry | Same `idempotencyKey` → single apply |
| PAR-07 | Restart/reconnect | Snapshot resync matches DB revision |
| PAR-08 | Dice + combat persist | Runtime tables/API snapshot durable after process restart |
| PAR-09 | Inventory mutation | Player can mutate own; not other player's |
| PAR-10 | Intentional regression probe | Flipping a deny rule to allow **must** fail PAR-02 or PAR-03 in CI |

## Forbidden evidence

- Marker files / `expect(true)` placeholders as parity proof  
- Fully mocked membership/auth that never hits Policy Service / DB  
- `test.skip` / optional live skip for required PAR-* rows  

## CI wiring (later implementation)

- Isolated test DB (same class of constraint as ATLAS-CI-* — no prod)  
- Job must fail closed if fixture seed missing  
- PAR-10 kept as canary in the required suite  

## Blockers

- GATE-01 (policy/ORM shape) before host-side harness execution  
- ATLAS-LIVE-E2E (#770) remains separate product live proof  
