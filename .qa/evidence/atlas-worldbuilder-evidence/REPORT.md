# Atlas Worldbuilder Evidence Lock — Report (#713)

**Captured (UTC):** 2026-10-18T21:35Z  
**Branch:** `chore/atlas-worldbuilder-evidence-713`  
**Local HEAD:** `2ef4e3d540517e3f0fd6d32d32a292337066af56` (`fix(atlas): map-first chrome… #711`)  
**origin/main at capture:** `162b79778e3fcd90110f5a77c10b764385759e43` (local behind by 4 dep-bump commits only)  
**DB:** Docker `sagatree-db` (self-host Postgres) — **read-only inventur**; restore probe on isolated DB `atlas_evidence_restore_713` then dropped.

> Stale handoff `.qa/handoff/sagatree-current-state/` (2026-10-17) is **not** evidence for this ticket.

## 1. Git inventory

See `git-inventory.txt`.

| Fact | Value |
|------|-------|
| Uncommitted `src/` / `supabase/` | **none** |
| Unrelated dirty `.qa/evidence|runs|tmp|handoff` | present — **left untouched**, not part of this PR |
| New evidence root | `.qa/evidence/atlas-worldbuilder-evidence/` |

## 2. Database rowcounts (measured)

Source: `sql/counts.csv`

| Table / metric | n |
|----------------|--:|
| world_profiles | 38 |
| name = Donalu | 1 |
| name ~ Dornhain | 37 |
| world_places | 228 |
| world_atlas_maps | 116 |
| world_place_map_links | 83 |
| world_maps (legacy) | 38 |
| worlds (legacy) | 0 |

### Place kinds (all worlds)

| kind | status | n | parent NULL | with parent |
|------|--------|--:|--:|--:|
| area | canonical | 38 | 0 | 38 |
| building | canonical | 38 | 0 | 38 |
| dungeon | canonical | 38 | 0 | 38 |
| settlement | canonical | 38 | **38** | 0 |
| site | canonical | 76 | 0 | 76 |

### Map kinds

| kind | n | parent NULL | has unifiedCanvas | has engine |
|------|--:|--:|--:|--:|
| legacy_tiles | 38 | 38 | 0 | 38 |
| scene | 2 | 0 | 0 | 2 |
| settlement | 38 | 0 | 38 | 38 |
| world | 38 | 38 | 38 | 38 |

### Link usages

overview 40 · footprint 40 · entrance 1 · interior 1 · dungeon 1

## 3. Donalu (`WO-9FFK6`) + Saga (`SA-E979J`)

**World name:** Donalu (1 profile).  
**Saga:** `SA-E979J` „Das Flüstern unter Dornhain“ → world `WO-9FFK6`; **25** bindings.

Places (seed_key → kind → parent_seed):

| seed_key | kind | parent |
|----------|------|--------|
| place.dornhain | settlement | (null) |
| loc.tavern | building | place.dornhain |
| loc.market | site | place.dornhain |
| loc.woods | area | place.dornhain |
| loc.crypt | dungeon | place.dornhain |
| loc.bandit-camp | site | place.dornhain |

Maps: world „Dornhain Übersicht (Unified)“ + legacy tiles + settlement Dornhain + scene Taverne + scene Krypta.

Location bindings: all 5 have `world_place_id` (party: tavern/market/woods; gm_only: crypt/bandit).

## 4. Backup / restore probe

| Artifact | Path |
|----------|------|
| Dump (Fc, world tables only) | `backups/atlas-world-tables-20261018-2135utc.dump` (72K) |
| Pre rowcounts | `backups/pre-backup-rowcounts-20261018-2135utc.csv` |
| Post restore rowcounts | `backups/post-restore-rowcounts-20261018-2135utc.csv` |
| Source after probe | `backups/source-after-restore-probe-20261018-2135utc.csv` |
| Restore log | `backups/restore-log-20261018-2135utc.txt` |

**Procedure (rehearsed):**

```bash
# dump
docker exec sagatree-db pg_dump -U postgres -d postgres -Fc \
  -t public.world_profiles -t public.world_places -t public.world_atlas_maps \
  -t public.world_place_map_links -t public.world_maps -t public.worlds \
  -f /tmp/atlas_wb_713.dump

# isolated restore
docker exec sagatree-db psql -U postgres -c "CREATE DATABASE atlas_evidence_restore_713;"
docker exec sagatree-db pg_restore -U postgres -d atlas_evidence_restore_713 \
  --no-owner --no-acl --disable-triggers /tmp/atlas_wb_713.dump
# expect: policy/helper-function warnings; DATA rowcounts match
docker exec sagatree-db psql -U postgres -c "DROP DATABASE atlas_evidence_restore_713;"
```

**Results:** `RESTORE_ROWCOUNT_MATCH` · `SOURCE_UNCHANGED_OK`  
**Notes:** Empty restore DB lacks `current_user_can_*_world_profile` → RLS policy create errors ignored by `pg_restore` (30 warnings); table data fully present.

## 5. Kind-string conflict matrix (pre-#714)

| Layer | Values | Conflict vs Epic #712 |
|-------|--------|------------------------|
| DB/Domain places | continent,realm,region,settlement,district,site,building,interior,dungeon,area | Epic wants continent/country/place/building/room (+ subtypes) |
| DB/Domain maps | world,region,settlement,scene,legacy_tiles | Epic wants world\|detail (+ legacy adapter) |
| Prototype nav UI | world,kontinent,land,ort,gebaeude,raum | Aligns with product DE labels; not DB kinds |
| Authoring UI | region\|settlement\|building only | Incomplete vs six-level tree |
| Persistence | Prototype `localStorage` `sagatree-atlas-webgl-v3` | Must not remain world SoT |

## 6. UI goldens

Live capture (Local Admin JWT, Vite `:3004`), 2026-10-18:

| File | Viewport | Notes |
|------|----------|-------|
| `screenshots/01-atlas-desktop-1440.png` | 1440×900 | Saga map: Ebenen / Werkzeuge / zoom HUD; Westmark/Nordreich/Dornhain labels |
| `screenshots/02-atlas-tablet-768.png` | 768×1024 | Same chrome, tablet |
| `screenshots/03-atlas-phone-390.png` | 390×844 | Map-first stage + sheet-friendly chrome |
| `screenshots/04-atlas-focus-or-tools.png` | 1440×900 | Tools/layers chrome baseline |
| `screenshots/05-library-world-map-1440.png` | 1440×900 | Library WO-9FFK6 map entry |
| `screenshots/prior-05-world-map-WORKING-FOCUS.png` | prior handoff | Secondary #711 focus reference |
| `screenshots/prior-06-region-map.png` | prior | Secondary |
| `screenshots/prior-17-map-mobile.png` | prior | Secondary |
| `screenshots/_capture-log.json` | — | Capture metadata |

**Visual freeze for later PRs:** map-first stage, Ebenen/Werkzeuge buttons, bottom zoom/compass HUD, Saga Welt→Karte tabs — no redesign.

## 7. Persistence / RLS dataflow notes (read-only)

- Places/maps RLS via `current_user_can_read/edit_world_profile`
- Player projection migrations present (`097`, `101`, `102`) — not re-executed here
- Map titles listed via atlas RPCs (saga-aware redaction is #717 scope)
- No secrets committed (no auth.users dump, no JWT, no `.env`)

## 8. Design contract

Normative Epic Design copied/condensed to `.qa/design/atlas-worldbuilder-contract.md`.
