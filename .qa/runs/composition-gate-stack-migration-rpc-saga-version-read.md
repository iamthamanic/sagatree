# Composition Gate — stack-migration-rpc-saga-version-read (#872)

- HEAD_SHA: b8a1e6d09d0b651d39ffc09a9bb4ac8e651b7c10
- BASE_SHA: a6064b9b318bba570f79f1cee6da3b132322af33
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Authenticated actors resolve native saga catalog by slug and read saga definition versions through application use-cases → saga ports → SQLite. Access is native-published / owner / project-member; GM projection filters `knowledgeFacts` via host helper (parity with `sagatree_project_saga_definition_payload`).

## Hop chain

1. Producer: `get_native_saga_definition_by_slug` / `get_saga_definition_version` commands
2. Authorize: `permissions.authorize('saga.read', actor, { sagaId })` (native, owner, or `projects.saga_id` member/GM)
3. Persist/read: `SagaDefinitionStore.getVersionRead` + slug → latest published native version
4. Consumer: projected JSON (`isGmProjection` + filtered payload) for adapters (deferred)

## Simulations

| Case | Result |
|------|--------|
| N-actors | native reader / owner GM / stranger DENY / project player / project GM | pass (`rpc-saga-version-read.self-test`) |
| Invalid/missing | unknown slug / missing version → `P0002`; unauthenticated → `42501` | pass |
| Two consumers / crash | newest published_at wins for slug; player vs GM payload cardinality | pass |

## Flags

- Acceptance tier: `isolated-contract`
- Deferred integration: MIG-301..313 / MIG-311 session adapters as applicable; feature E2E → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No production cutover. No Supabase shutdown. No HTTP RPC surface in this slice.
