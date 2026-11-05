# Composition Gate — cut-07-restore-look-profile-append-vers (#1142)

- HEAD_SHA: 5d2b483c979b2e2a257f07e70a5f17aeb27da13c
- BASE_SHA: c73c60539f648b9e4f464315d8dfd1e491819788
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-08 character presets (#1143)

## Event

Under host-first, LookProfile appendVersion / listVersions use Host HTTP backed by
existing LookProfilePorts on SQLite. Legacy Supabase remains only when host library is off.

## Hop chain

1. **Producer (UI):** Look editor → `look-service`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST/GET `/api/v1/library/looks/:id/versions`
4. **Authorize:** Owner (incl. linked solo) via LookProfilePorts
5. **Persist:** SQLite `look_profile_versions` append-only + current_version CAS
6. **Consumer:** Same UI lists full history; current selection is latest

Cardinality: one version row per (profileId, version). No mutation of prior versions.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot append/list | Owner ACL | pass |
| Invalid/missing | Missing profile → 404; archived append → 400 | Fail-closed | pass |
| Two consumers / crash | Dual-path exclusive | Flag off → Supabase | pass |
| Concurrent append | CAS on current_version | 409 conflict | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + backend + persistence hops changed; covered by cut-07-look-versions.self-test.
