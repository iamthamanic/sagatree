# ATL2-G01 — GM / Player / Owner atlas scopes

**Issue:** #1229  
**Epic:** #1196  
**Slug:** `atl2-g01`

## Purpose

Prove and harden host-side atlas authorization + player projection so GM-only
secrets, dungeon forge state, and unrevealed detail maps never reach players
via API payloads (including manipulated `playerView` / foreign world ids).

## Binding rules

| Actor | Read | Write | Secrets / forge meta |
| --- | --- | --- | --- |
| Owner / world editor | Full catalog | Upsert / delete (policy) | Full |
| Player (`playerView` or non-editor) | Party-revealed maps only | Denied | Redacted |
| Stranger | Deny | Deny | n/a |

## Projection

1. `listMaps` / `getMap` with `partyOnly` → `partyRevealedMapIds` via saga bindings.
2. Layers: drop `secret` / undiscovered GeoJSON features.
3. Unified canvas: drop secret entities / golden crypt ids.
4. `generator_meta` whitelist for party: `engine`, redacted `unifiedCanvas`,
   optional `webglRuntime` / `mapFrame` — **never** `dungeon` forge drafts or
   golden `seed` / `placeSeedKey` authoring markers.

## Evidence

- Self-test: `scripts/atl2-g01-gm-player-scopes.self-test.mjs`
- Acceptance: `.qa/acceptance/atl2-g01.md`
