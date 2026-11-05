# Composition Gate — cut-08-migrate-character-preset-crud-pu (#1143)

- HEAD_SHA: 6512e13e2921308a2cbfe4067fde80333e646672
- BASE_SHA: 81b6de294 (main @ CUT-07)
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-09 (#1144)

## Event

Under host-first, character preset list/create/release/rename/duplicate/delete use
Host HTTP backed by CharacterPorts product preset store on SQLite. Soft-DENY removed.
Legacy Supabase remains only when host library is off.

## Hop chain

1. **Producer (UI):** CharacterPresetPanel / CreateCharacterEntryDialog → `character-preset-service`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed `/api/v1/library/character-presets/*`
4. **Authorize:** Owner (incl. linked solo) via CharacterPorts; origin=user only
5. **Persist:** SQLite `character_presets` + `versions_json` append-only levels
6. **Consumer:** Same UI; missing source character flagged after delete

Cardinality: at most one user preset per (owner, source_character_id). Levels unique per preset.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot mutate/list owner presets | Owner ACL | pass |
| Invalid/missing | Bad schema → 400; missing → 404; dup level/source → 409 | Fail-closed | pass |
| Two consumers / crash | Dual-path exclusive | Flag off → Supabase | pass |
| Source deleted | List marks source_character_missing | Soft-delete characters | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + backend + persistence hops changed; covered by cut-08-presets.self-test.
