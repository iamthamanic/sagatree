# ATL2-E01 — Primary maps & WorldNode links

**Issue:** #1219 · **Slug:** `atl2-e01`

## Decision

One SoT for six-level hierarchy links:

`world (root map) > continent > country > place > building > room`

Each WorldNode owns exactly one `usage='primary'` map. Child primary
`parent_map_id` MUST equal the parent's primary map id (continent → world root
map). No seventh region level. No dual geometry SoT.

## Enforcement

| Layer | Rule |
|---|---|
| Domain | `assertPrimaryMapLinkGraph`, `expectedPrimaryMapParentId`, subtype gate |
| Host create | Atomic ancestors + primary maps; subtype whitelist; skip/cycle/cross-world fail-closed |
| Host upsert map | Primary-linked maps cannot reparent away from expected parent |
| Host delete map | Refuses world root, primary-linked maps, and maps with children |

## Out of scope

Locate/anchor (E02), zoom/breadcrumb (E03), LOD (E04).
