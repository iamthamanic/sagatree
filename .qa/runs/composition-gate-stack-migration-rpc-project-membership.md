# Composition Gate — stack-migration-rpc-project-membership (#874)

- HEAD_SHA: ba8de6ac6dd73a35fb5e54373108e6d4bff9318c
- BASE_SHA: 82e55c451242222980c3a8a48d70037ece2b4e0e
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Host ports for join_project_by_code / set_my_project_character; project join codes + member character_id; minimal characters table for ownership; no public HTTP mount in this slice.

## Hop chain

1. Producer: join/set use-cases
2. Authorize: auth required; owned complete PC via character ports
3. Persist: project_members (+ projects.code); characters ownership rows
4. Consumer: self-test / future MIG-311 HTTP

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | One membership per actor | P0001 on duplicate | pass |
| Invalid/missing | bad code / incomplete PC | 22023 / P0002 / 42501 | pass |
| Two consumers / crash | IMMEDIATE tx insert | atomic | pass |
| Legacy defects | none required | n/a | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapters (MIG-311); full character CRUD

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
