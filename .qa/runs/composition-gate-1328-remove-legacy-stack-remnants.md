# Composition Gate — 1328-remove-legacy-stack-remnants

- HEAD_SHA: 3dc347ed86bf4cb9ed2d7fc40d2476693c1ea8cd
- BASE_SHA: 1490c7854b7d6ee45fdb3cccdaefe73f7d27574c
- Date: 2026-11-24
- Verdict: SKIPPED

## Event

Cleanup of retired-stack remnants (#1328 phase 1): gate scripts no longer require the legacy
archive, the host edge dispatcher allowlist becomes the single source of truth (alias exports
only), legacy-named helpers/symbols are renamed, the storage URL helper moves to
`src/lib/asset-urls.ts` (identity, unchanged behavior), code comments and docs are neutralized.
No new business events, workers, queues, routes, persistence writes or outbound side-effects.

## Hop chain

Unchanged. Browser → Host HTTP (Hono) → Policy Service → SQLite/asset store. Server diffs are
renames (`storeConfigured`, `HOST_QUERY_TIMEOUT_MS`, `legacy*` shutdown-readiness fields),
comment-only edits in migration headers (no SQL change; runner has no checksum), alias exports
in `server/src/http/edge-main-dispatcher.ts` and one 503 message text
('Host-Konfiguration fehlt.') on the session-media token route.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | No per-actor fan-out change. | No loops, queues or batch paths touched; renames only. | pass |
| Invalid/missing | Missing host store config still fails closed with 503. | Same guard, renamed flag, German message text only. | pass |
| Two consumers / crash | No duplicate side-effects. | No producer/consumer pair added or changed. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| none | note | n/a | n/a | done |

## Skip reason

Rename/comment/doc-only cleanup plus alias exports; no producer→persistence→consumer chain, side-effect destination, retarget or multi-actor fan-out changes, so a CLEAR composition proof is not required.
