# Composition Gate — cut-10-restore-world-profile-lookup-by (#1145)

- HEAD_SHA: 52a1f9e3d7ab843cb9a286d9f97dd3e00ad42769
- BASE_SHA: 8b28a0bad822c0a80e5f08a57592e3e3816d7ca1
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-11 (#1146)

## Event

Under host-first, world profile resolve-by-public-id uses Host HTTP backed by
WorldPorts + `worlds.public_id` on SQLite. Soft-DENY removed. Authorization via
`world.read` after id resolve — public id is never permission.

## Hop chain

1. **Producer (UI):** WorldAtlasScreen deep link → `world-profile-service.getByPublicId`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed `/api/v1/library/worlds/by-public-id/:publicId`
4. **Authorize:** `world.read` after public→internal resolve; stranger → 404
5. **Persist:** SQLite `worlds.public_id` (WO-XXXXX)
6. **Consumer:** Same UI / routing

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot resolve owner WO- id | Policy fail-closed | pass |
| Invalid/missing | Unknown WO- → 404 | Fail-closed | pass |
| Case fold | lowercase path param works | normalize toUpperCase | pass |
| Dual-path | Flag off → Supabase | Exclusive | pass |
| Two consumers / crash | Atlas deep-link + library list both resolve same WO-; host stop mid-request fails closed | Shared WorldPorts read | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + backend + persistence hops changed; covered by cut-10-world-public-id.self-test.

## Follow-up (Codex P1/P2)

- importHostBundle restores `worlds.public_id`
- backfill forces letter-first body + fixed digit
