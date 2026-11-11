# Design — Dornhain Golden Atlas v4

## Root goal
Editable **Golden Dornhain** world (atlas + places) as the product reference; blank ocean is no longer the default starter. New-adventure / Procedualgen later write the same `UnifiedCanvasDoc` shape.

## Decisions (grill 2026-11-11)

| ID | Decision |
|----|----------|
| 1D | Golden is session-ready in intent (secret *definitions* + start scene live in seed/author data) |
| 2C | Seed = Golden for owner/solo **and** remains editable |
| 3 | Reset-to-Golden is mandatory |
| 4C | Author-Full vs Play-Sparse (two modes) |
| 5B | Default reset = Atlas + Places (not session runtime) |
| 5c | Secret **definitions** = author/seed; **reveal state** = session runtime; default reset does not clear session; „alles“ may |
| 6C | Reset opens a dialog (scope choices) |
| 7C | One world truth + Reveal/Fog for sparse play |
| 8B | Manual Voll / Spieleransicht toggle in atlas chrome |
| 8b | Spieler never get a toggle that exposes unrevealed GM secrets |

## Layers

1. **Author / seed** — geometry, hierarchy, secret definitions, start scene copy  
2. **Session runtime** — reveal/fog progress, notes  
3. **Views** — GM Voll vs Spieleransicht (projection); not a second document

## Reset dialog (v1)

| Mode | Effect |
|------|--------|
| `atlas` | Root unified canvas → Golden v4 |
| `atlas_places` (default) | Canvas + upsert Golden places/anchors |
| `everything` | Same as `atlas_places` + session-progress reset when API exists (v1: clear toast if unavailable) |

User-authored places **without** Golden `seed_key` are not deleted by default modes.

## Procedualgen (later)

Same `UnifiedCanvasDoc` + places writer; not in this ticket.

## Out of scope (this ticket)

- Full Procedualgen wizard  
- Crypt child-map deep interior authoring beyond root LOD stamps  
- Session reveal wipe implementation if no host API yet  
- Eldoria `demoSeed` path changes beyond staying unused for Dornhain  
