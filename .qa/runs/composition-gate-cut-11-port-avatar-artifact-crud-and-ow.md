# Composition Gate — cut-11-port-avatar-artifact-crud-and-ow (#1146)

- HEAD_SHA: 1622c9ad65de7cbf3279eb1050265fa3b66d3bba
- BASE_SHA: 9e9e71122095d19862d2f24125acae346438a5f2
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-12 (#1147)

## Event

Under host-first, Avatar V2 artifact metadata CRUD uses Host HTTP backed by
CharacterPorts + SQLite `character_avatar_artifacts` V2. Soft-DENY removed.
Authorization is owner-scoped; public paths are never authority.

## Hop chain

1. **Producer (UI):** Character Studio artifacts → `character-avatar-artifact-service`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed `/api/v1/library/avatar-artifacts*`
4. **Authorize:** actor owner loop via `libraryActorIds`; stranger → 404
5. **Persist:** SQLite Avatar V2 columns (+ activation uniqueness)
6. **Consumer:** Same UI / preview panels

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot read owner artifact | Fail-closed 404 | pass |
| Invalid/missing | Unknown id / traversal storage path | 404 / 422 | pass |
| Dual-path | Flag off → Supabase | Exclusive | pass |
| Two consumers / crash | List + activate share store; host stop mid-request fails closed | Shared CharacterPorts | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + backend + persistence hops changed; covered by cut-11-avatar-artifacts.self-test.

## Follow-up (Codex)

- Origin derived from source ids; analysis host-internal; linked-owner retry; store-unavailable → 503.
