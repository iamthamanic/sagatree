# Composition Gate — atlas-worldbuilder-mutations

- HEAD_SHA: 626d1bbb2f9f6e6e6a7d753063569334d3195fe0
- BASE_SHA: 9e590a8a9b55b394f8cb17f8eef95af74176da19
- Date: 2026-10-18
- Verdict: CLEAR

## Event

GM rename/reparent/duplicate/archive/delete request → single SECURITY DEFINER RPC mutates places/maps under authz with consequence preview when destructive.

## Hop chain

1. Client `worldPlaceService.*` (JWT) → mutation RPC
2. RPC: authz + same-world row load + hierarchy/cycle/confirm gates
3. One transaction updates place (+ primary map parent / archive status / new IDs) or deletes with saga FK detach
4. Preview RPC is read-only consequence JSON for UI confirm

## Simulations

| Case | Intended | Result |
|------|----------|--------|
| N-actors | Two GMs different worlds | world_profile_id scoped |
| Invalid/missing | Bad edge / cycle / no confirm / no JWT | Exception, no partial write |
| Two consumers / crash | Retry after timeout | Revision bump; no silent last-write-wins on confirm gates |

## Flags

(none)
