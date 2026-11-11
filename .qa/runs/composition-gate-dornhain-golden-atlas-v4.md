# Composition Gate — dornhain-golden-atlas-v4

- HEAD_SHA: b177df7c69c787a4f007702aa81cb315963b3a4c
- BASE_SHA: e7f7981067c5c1b3a6fd2dd2b96aa15039ef7f48
- Date: 2026-11-11
- Verdict: SKIPPED

## Skip reason

Golden seed + owner-gated Reset/view toggle reuse existing owner-scoped
`upsert_world_atlas_map` / place upsert paths; no new N-actor producer→consumer hop.

## Event

Dornhain ships editable Golden unified world canvas (v4 land/pins/settlement LOD)
instead of blank ocean, with Reset-to-Golden dialog and GM-only Voll/Spieleransicht.
Host ensure upgrades blank v3 ocean roots once; painted maps stay untouched.
Revision bumps on Golden upgrade so open editors conflict instead of overwriting.

## Hop chain

1. **Producer (UI):** `WorldAtlasWorkbench` / `AtlasGoldenResetDialog` (owner `canEdit`)
2. **Domain:** `dornhain-unified-starter` + `dornhain-golden-reset` (pure)
3. **Host bootstrap:** `ensureDornhainDefaultCatalog` → `seedOwnedDornhainAtlas`
   (owner-scoped `world_profile_id` + `INSERT OR IGNORE` places)
4. **Persist (existing):** `world_atlas_maps` / `world_places` / `world_place_map_links`
5. **Consumer:** same atlas editor reload — no second actor path

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | N/A — owner/solo seed | no cross-owner FK invent | skip |
| Invalid/missing | painted map / non-blank v3 | `needsGolden` false → no rewrite | pass (self-test) |
| Two consumers / crash | open editor + host upgrade | revision +1 → conflict | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
