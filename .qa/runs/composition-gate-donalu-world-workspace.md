# Composition Gate — donalu-world-workspace

- HEAD_SHA: d8f1ea3e2b4f95b35ba612b64d80b110aeab58ab
- BASE_SHA: 8485f6d7f2d98af0a817b2f112281531197f3966
- Date (UTC): 2026-10-18T07:03:43Z
- Verdict: CLEAR

## Event

PR #706 ships Donalu Places (migrations 095–097), JWT-gated adapters, Orte-Panel,
hybrid atlas 2D/3D, dungeon confirm/`manualDirty`, and player-safe place/map-link
projection with generatorMeta redaction.

## Hop chain

1. World owner / GM edits places + maps via authenticated RPCs (`assertSupabaseJwtSession`).
2. Persist: `world_places` / `world_place_map_links` / `world_atlas_maps.generator_meta`.
3. Saga overlay: `saga_asset_bindings.world_place_id` + party reveal filter.
4. Player consumers: `list_world_places` / `list_world_place_map_links` / `get_world_atlas_map` party-only + meta redaction.
5. Atlas UI: shared `UnifiedCanvasDoc` via Canvas2D + Three `applyMapEdit`.

## Simulations

### N-actors
- GM + world editor: full place catalog + map links.
- Saga player (non-editor): only `reveal=party` places/links; empty without saga id.
- Second player: same party projection; no gm_only crypt/bandit links.

### Invalid/missing
- Missing JWT → RPC `not authenticated`.
- Player view without resolvable saga → empty places/links (fail closed).
- Upsert link with cross-world place/map → rejected.

### Two consumers / crash
- Library atlas + Saga map workbench share `WorldAtlasWorkbench`; save conflict uses `expectedRevision`.
- 2D and 3D viewports edit one doc; crash mid-edit leaves last saved revision recoverable.

## Flags

- Migration `101`: direct `world_places` / `world_place_map_links` SELECT is editor-only;
  non-editors use `list_*` SECURITY DEFINER RPCs (party projection). Closes PostgREST bypass of `gm_only`.
- Migration `102`: `get_world_atlas_map` forces `v_party_only` redaction for non-editors;
  `world_atlas_maps` SELECT editor-only (RPC path for players).
- Overview refresh soft-fails when cached; Karte falls back to project `world_profile_id`.
- Residual Low: `list_world_atlas_maps` may still expose GM-prep map titles to non-editors.
- Demo Eldoria LOD remains non-canonical (`Demo-*` labels).
- Nested DB map LOD still partly discrete map list + demo rects.
- Medium security gaps from prior fail-open player list closed in `097`.
