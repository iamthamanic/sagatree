# Composition Gate — cut-09-migrate-character-adventure-arcs (#1144)

- HEAD_SHA: 60e6125d7ebc73d3b2cd8decf9e3d18f9390e792
- BASE_SHA: 87df28a89c3789231976a34b8c3f70669c211385
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-10 (#1145)

## Event

Under host-first, character adventure arc list/sync and development append use
Host HTTP backed by CharacterAdventureArcStore on SQLite. Soft-DENY removed.
Membership enrichment comes from ProjectPorts; session counts from SessionLookup.
Legacy Supabase remains only when host library is off.

## Hop chain

1. **Producer (UI):** CharacterStatisticsPanel → `character-adventure-arc-service`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed `/api/v1/library/characters/:id/adventure-arcs` (+ developments POST)
4. **Authorize:** Character owner via CharacterPorts; stranger → 403/404
5. **Persist:** SQLite `character_adventure_arcs` + `developments_json`
6. **Consumer:** Same UI with project_name / session_count enrichment

Cardinality: at most one arc per (character_id, project_id). Sync is idempotent.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot list/append owner arcs | Owner ACL | pass |
| Invalid/missing | Bad kind → 400; missing → 404 | Fail-closed | pass |
| Two consumers / crash | Dual-path exclusive | Flag off → Supabase | pass |
| Repeated sync | No duplicate arcs | UNIQUE (character, project) | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + backend + persistence hops changed; covered by cut-09-character-arcs.self-test.
