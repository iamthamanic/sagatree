# Composition Gate — stack-migration-mig-012 (#791)

- HEAD_SHA: 36f7f7547aab16871baeeb9ab82747951ea23aaa
- BASE_SHA: 5104e262a969a4f7ac8b0e865824249a96379e65
- Date: 2026-10-22
- Verdict: CLEAR

## Event

Host consumers read worlds only through the public world module read port. Authorization runs via permissions `world.read` before projection. Persistence is a SQLite adapter wired at the composition root; DTOs carry no owner/ORM/HTTP types.

## Hop chain

1. Producer: SQLite `worlds` rows via `createSqliteWorldReadStore`
2. Policy: `authorize('world.read', actor, { worldId })` (owner-only)
3. Port: `world.read.listOwnedWorlds` / `getWorld` → `WorldReadDto`
4. Consumer: host composition / future use-cases; frontend contract mirror only

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner vs stranger same world id | stranger denied; no private attrs | pass |
| Invalid/missing | empty worldId | missing-world; no owner widen | pass |
| Two consumers / crash | reopen DB after write | durable titles/ids | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

GATE-02/03/05 and cutover not approved. MERGE-889 known-red freigabe does not transfer.
