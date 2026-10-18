# Debug: remove atlas bar / Orte chrome / Orte tab

## Result
PASS — three chrome pieces removed; `/world` deep-link lands on Karte.

## Changes
1. `[data-atlas-native-3d] .bar { display: none }` — hides Atlas bereit / Import / PNG / JSON
2. Welt shell always uses `SagaWorldMapPanel` (no Orte & Lore row)
3. Orte removed from `WORLD_TABS`; `resolveSagaWorldSub('world')` → `map`

## Verify (localhost:3004 `/sagas/SA-E979J/world` + `/world/map`)
| Check | Value |
| --- | --- |
| `.bar` display | `none` (height 0) |
| Orte & Lore button | absent |
| GM hint | absent |
| `data-saga-world-sub=places` | absent |
| Subtabs | map, npc-creatures, items, quests, lore |
| `/world` selects Karte | yes |

## Checks
- `dornhain-full-catalog-seed-check.mjs` OK (wires MapPanel)
- `world-look-preview-check.mjs` OK
