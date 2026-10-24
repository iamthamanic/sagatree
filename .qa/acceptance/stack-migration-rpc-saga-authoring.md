# Acceptance — stack-migration-rpc-saga-authoring (#871)

## Intent

Port create/copy/editor/save/publish saga-definition RPCs to host application + saga module with unchanged safe semantics.

## Acceptance tier

`isolated-contract` — SLICE DONE only. FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

## Edge Cases

1. Owner-scope protects draft/publish; native immutable
2. Editor ensures draft once; repeat read does not duplicate
3. Revision conflict `40001` leaves no new publish
4. Native copy yields own draft + published; subsequent publish adds version (no overwrite)

## Security Coverage

| ID | How |
| --- | --- |
| B-01/B-04 | Owner-bound write; foreign actor → `42501` |
| B-08 | Policy `saga.read`/`saga.write` before store mutations |
| Native | Immutable via policy + store |

## Launch Checklist (SC)

N/A — not a launch ticket.

## Implementation Notes

- Migration `0007_saga_definitions.sql`
- Ports: `server/src/modules/saga`
- Use-cases: `server/src/application/saga-authoring/**` + command adapters
