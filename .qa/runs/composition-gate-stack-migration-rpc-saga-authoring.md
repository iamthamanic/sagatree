# Composition Gate — stack-migration-rpc-saga-authoring (#871)

- HEAD_SHA: WORKTREE
- BASE_SHA: 4aab6cd6d8a5a166ff5d04da75c66acf351acc21
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Authenticated actors author user saga definitions through application use-cases → saga ports → SQLite `saga_definitions` / `saga_definition_versions`. Native rows stay immutable; revision conflicts deny without publishing.

## Hop chain

1. Producer: command / use-case (`create_user_saga_definition` …)
2. Authorize: `permissions.authorize('saga.read'|'saga.write', actor, { sagaId? })`
3. Persist: `SagaDefinitionStore` owner/native/revision rules
4. Consumer: editor/publish projections; draft ensured idempotently

## Simulations

| Case | Result |
|------|--------|
| N-actors | owner vs stranger / native immutable | pass |
| Invalid/missing | empty title, conflict 40001 | pass |
| Two consumers / crash | draft ensure once; publish adds vN | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred: frontend adapter cutover + feature E2E → MIG-600/602

## Non-claims

No production cutover. No Supabase shutdown. No HTTP RPC surface in this slice.
