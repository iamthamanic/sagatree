# Composition Gate — stack-migration-mig-500 (#841)

- HEAD_SHA: 410cdbcbb9568e70412f90c37229b9799aa41649
- BASE_SHA: 9018c44648eecf1208c726aefba45412e3f60d95
- Date: 2026-10-22
- Verdict: CLEAR

## Event

Local protected asset publish/read enters the host via `server/src/assets` composed in `create-host.ts`. Bytes are staged under `dataDir/assets` with atomic rename; metadata commits in SQLite `assets` (owned by media). Access is gated by Policy Service ops `asset.publish` / `asset.read` — path and URL are never authorization.

## Hop chain

1. Producer: use-case/composition → `assets.publish|get(actor, …)`
2. `permissions.authorize('asset.*', actor, { assetId? })` against durable SQLite ownership
3. `LocalAssetStore` resolves storage keys only under `dataDir/assets` (no traversal / symlink escape)
4. Consumer: published bytes + checksum — unpublished rows never readable

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Owner publish+read | allow + checksum match | self-test Fall 1 | pass |
| Stranger get | not-authorized, no payload | self-test Fall 2 | pass |
| Traversal / symlink | path-traversal-denied | self-test Fall 2 | pass |
| Reopen host | durable metadata+bytes | self-test Fall 3 | pass |
| Incomplete publish | unpublished not visible | self-test | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

No production Storage cutover. No world-member share matrix. No HTTP media routes / signed URLs in this ticket.
