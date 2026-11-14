# Feature: ATL2-G01 — GM / Player / Owner atlas scopes (#1229)

<!-- atlas-v2-epic: #1196; slice: G01; slug: atl2-g01 -->

## Intent

Host-enforced owner/GM vs player projection for atlas maps, layers, secrets,
detail maps, and assets — no client-only CSS hide.

## Preconditions

- #1223 Gate E MERGED
- #1228 Gate F MERGED
- Host Better Auth available for Browser E2E (`browser-e2e-with-host`)

## Happy Path

- [ ] Owner/GM reads full atlas maps including secret canvas entities
- [ ] Player / `playerView` with saga membership only sees party-revealed maps
- [ ] Player payloads redact secret features / secret unified-canvas entities
- [ ] Player hierarchy list does not enumerate unrevealed child maps
- [ ] Player `generator_meta` omits dungeon forge + golden seed authoring keys
- [ ] Stranger / foreign world atlas write denied (`42501` / 403)
- [ ] Non-owner cannot upsert atlas maps on another owner's world
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout)
- [ ] **IV-07**: Hidden-info safety — playerView does not invent secrets

## Edge Cases

- [ ] Unrevealed map id: player get returns not-found style deny (no existence leak where required)
- [ ] playerView without sagaPublicId: fail closed
- [ ] Party reveal then revoke (no binding): map disappears from player list

## Security Coverage

- Policy on host atlas read/write; player projection server-side only
- SC-01/02: owner-scoped worlds; cross-owner FK/write denied
- SC-03: no new public abuse surface beyond existing atlas routes

## Composition Gate

SKIPPED — security hardening / projection proof; no new producer→consumer hop
(see `.qa/runs/composition-gate-atl2-g01.md`)

## Implementation Notes

- Store: `server/src/modules/world/internal/world-atlas-store.ts` (`redactPartyMeta`, party list/get)
- Projection: `atlas-party-projection.ts` (saga_asset_bindings `reveal='party'`)
- Proof: `scripts/atl2-g01-gm-player-scopes.self-test.mjs`
