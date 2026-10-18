# SagaTree Atlas — Worldbuilder Contract

**Status:** Normative (from Epic [#712](https://github.com/iamthamanic/SagaTree/issues/712) `## Design`)  
**Slug:** `atlas-worldbuilder-contract`  
**Baseline code (epic authoring):** `main@162b79778e3fcd90110f5a77c10b764385759e43`  
**Evidence lock:** Issue [#713](https://github.com/iamthamanic/SagaTree/issues/713) → `.qa/evidence/atlas-worldbuilder-evidence/`  
**Related prior design:** `.qa/design/donalu-world-workspace.md`, `.qa/design/unified-atlas-2d-3d-editor.md`, `.qa/design/world-atlas-editor.md`

This file is the in-repo architecture contract for Epic #712. Child issues #713–#724 must not contradict it. UI chrome from PR `#711` is the visual gold — no redesign.

---

## Outcome

Ship one stable worldbuilding workflow with strict `world > continent > country > place > building > room` semantics, automatic primary map and clearly marked auto-ancestor placeholders for each node, one shared editable document for 2D/3D, SagaTree-native existing tree/tools, secure persistence and migrated Donalu world data without breaking existing IDs or Sagas.

## Binding product rules

1. Exactly six hierarchy levels: `world > continent > country > place > building > room`. No required `region` level. No skipping a level.
2. Country (`country`) means political state/republic/kingdom. Islands and landmasses are physical terrain, not countries.
3. The root world and every child node, including every room, get one automatically persisted **primary map**, created together with the node. Optional secondary maps do not replace its primary.
4. Missing required ancestors are generated automatically with neutral, editable, explicitly marked placeholder names. Never create fictional geometry or lore when auto-creating an ancestor or map.
5. One `WorldProfile` is one world root. No dimension feature nested under worlds.
6. German UI; canonical English domain identifiers: `world`, `continent`, `country`, `place`, `building`, `room`.
7. Wilderness, forest and city are `place` subtypes. A cave, dungeon or fortress is a `building` subtype. Chambers and corridors are `room` subtypes.
8. Preserve current map-first WebGL UI: existing hierarchy rows, folding, inline renames, menus, panel chrome, tools, animations and focus view. Rename the left pane's conceptual title to `Weltstruktur` without replacing its tree layout.

## Domain glossary

| Concept | UI | Canonical code | Meaning |
|---|---|---|---|
| World root | Welt | `WorldProfile` / `world` | One authored world; `world_profiles` row |
| Tree | Weltstruktur | `WorldNodeTree` | One hierarchy with virtual category headers |
| Continent | Kontinent | `continent` | Geographic macro grouping |
| Country | Land | `country` | Political polity, not island/terrain |
| Place | Ort | `place` | City/village/wilderness/forest/mountain via subtype |
| Structure | Gebäude | `building` | House/castle/cave/dungeon via subtype |
| Room | Raum | `room` | Chamber/hall/corridor via subtype |
| Map | Karte | `AtlasMap` | Persisted editable view/document, distinct from node identity |

Canonical node API: `WorldNodeKind = 'continent'|'country'|'place'|'building'|'room'`, plus `WorldNode`, `WorldNodeSubtype`, `WorldHierarchy`. World root stays `WorldProfile`.

**Migration rule:** `world_places` physical table, existing row IDs, map IDs and Saga references remain intact. Existing `WorldPlaceVm`, `realm`, `region`, `settlement`, `district`, `site`, `interior`, `dungeon`, `area` are compatibility inputs until classification completes. Do not create a second unrelated world table.

For maps: prefer canonical distinction `world|detail`; keep legacy `region|settlement|scene|legacy_tiles` readable through adapters. A cartographic region is a visual feature — not a hierarchy level.

## Hierarchy, subtype and placeholder

```
world_profiles / world
  continent
    country
      place
        building
          room
```

- No cross-world parent, missing-level jump, self-parent, indirect cycle or wrong type parent. Validate in pure domain **and** enforce in RPC/DB.
- New canonical rows may only use NULL parent for `continent`; legacy NULL parents remain readable during expand.
- Placeholders: persisted + flagged; names like `Unbenannter Kontinent 1`; preview `Wird zusätzlich angelegt: …` before commit.
- States: `placeholder > draft > canonical > archived`. Rename of placeholder → draft; promotion to canonical is explicit. Placeholder/draft hidden from ordinary players unless permission-checked reveal.
- Only ancestors are auto-generated. Creating a country does not auto-generate place/building/room.

Examples:

```
Donalu / Nordkontinent / Nordreich / Dornhain (place.city)
  Alte Festung (building.fortress)
    Bossraum (room.chamber)

Donalu / Nordkontinent / Nordreich / Die Wildnis (place.wilderness)
  Verlassene Höhle (building.cave)
    Höhlenkammer (room.chamber)
```

## Primary-map contract

- One primary `world_atlas_maps` row per world root and per node (including rooms), created atomically with the node.
- Reuse `world_atlas_maps`, `parent_map_id`, `world_place_map_links`. Add unambiguous primary ownership + unique constraints.
- `map.parentMapId` MUST equal the primary map of the owning node's parent. Continent maps parent to the world root map.
- Auto creation never invents island, boundary, furniture or NPC. Track `unlocated` / `unsketched` / `ready`.
- Do **not** clone parent bounds into child (`createChildMap` today must change in later tickets).
- Tree select opens primary map. Zoom switches to child map only with grounded spatial anchor + LOD threshold.

## UX (no redesign)

- Left panel **Weltstruktur** keeps category headers, nest, fold, search/filter, inline rename, `+` / ellipsis menus.
- Categories are virtual UI headings, not DB records.
- `+` = contextual create: subtype, name, ancestor preview, confirm → server transaction.
- Bottom/center map chrome and right Werkzeuge stay. Layers are view toggles, not hierarchy.
- Adaptive: Phone/Tablet sheets; desktop map-first; AU touch ≥44px; German labels; no hover-only critical actions.
- Visible states: loading, empty/unsketched, unlocated, placeholder/draft, dirty, saving, saved (server-confirmed), conflict, offline, denied, error/retry. No fake save toast.

## Tools and cameras

- Single `AtlasTool` registry; tree `+` arms next placement tool.
- 2D and 3D edit the **same** active map document and IDs. Reuse `MapEditOperation` / `applyMapEdit`.
- Distinguish political borders from terrain. Camera zoom ≠ hierarchy change.
- Stop persisting canonical world truth under `sagatree-atlas-webgl-v3` localStorage (export/import path first).
- Label `3D` unless true spherical globe exists. Abstract `0..1000` is not meters until calibrated.

## Persistence, authz, conflicts

- Create RPC: missing ancestors + node + primary maps + links + map parent chain **atomically**; client idempotency key.
- Rename/reparent/archive/delete RPCs enforce same-world, hierarchy, cycles, saga refs. DB/RLS authoritative.
- Debounced autosave + explicit Save/Retry; revision conflicts compare/reload — never silent last-write-wins.
- Heavy assets in authorized Storage; lazy load maps; expand tree by parent.
- Saga-aware map listing/projection; fail-closed for non-editors. Check map payloads, titles, Storage URLs — not only UI hide.
- Player view excludes unauthorized drafts/placeholders and undiscovered maps.

## Migration contract (not blind rewrite)

1. Inventory actual DB + dirty local tree; backup.
2. Additive constraints + compatibility readers; preserve UUIDs / `WO-` / `SA-` / geometry.
3. Straightforward maps: `continent→continent`, `realm→country`, `settlement→place+subtype`, `area→place+subtype`, `building→building`. Ambiguous `region|district|site|interior|dungeon` → review queue.
4. Neutral placeholder ancestors for missing parents; do not invent political names as fact.
5. Link/recover primary maps; never clone parent bounds.
6. Dry-run report; block final promotion on ambiguous rows.
7. Feature-flag; rehearse restore/rollback; RLS negatives; UI goldens.
8. Retire prototype SoT and aliases last, separate PRs.

## Ticket order (Epic children)

| Issue | Deliverable |
|---|---|
| #713 | Evidence lock / goldens / backup |
| #714 | Domain glossary + parent validator + legacy mapping |
| #715 | Transactional create-with-maps RPC |
| #716 | Rename/reparent/duplicate/archive |
| #717 | Player-safe map list + Storage |
| #718 | Bind WebGL tree to real nodes |
| #719 | Contextual `+` + placeholder preview |
| #720 | Tool semantics + subtypes |
| #721 | Shared 2D/3D authoritative doc |
| #722 | Map frames / political vs terrain / LOD |
| #723 | Donalu/legacy staged migration |
| #724 | Full E2E / security / UI / migration gate |

**Must not:** replace UI design; create a second persistent semantic tree; keep localStorage as world truth; invent geography for placeholders; silently move/delete world/Saga content; conflate map level with political geography.

## Gates

- IV: no invented lore/coast/scale for placeholders; honest unlocated/unsketched.
- AU: adaptive recomposition; touch ≥44; AU-CONTENT-WIDTH.
- CE: N/A for SETUP atlas workstation (not live performance).
- Security: owner-scoped RLS; no elevated client origins; list Low/Info debt in reviews.
