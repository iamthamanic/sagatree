# Acceptance — stack-migration-rpc-saga-version-read (#872)

## Intent

Port `get_native_saga_definition_by_slug` and `get_saga_definition_version` to host application + saga module with unchanged safe semantics (native catalog + GM/player projection).

## Acceptance tier

`isolated-contract` — SLICE DONE only. FEATURE VERIFIED → MIG-311/#810 / MIG-301..313 + MIG-602/#847. RELEASE APPROVED → human only.

Deferred integration: MIG-301..313 / MIG-311 session adapters as applicable.

## Edge Cases

1. Native slug resolves to newest published version; unknown slug → `P0002`
2. Access distinguishes native published, owner, and active project membership
3. GM projection follows roles; player payload strips `gm_only` knowledge facts
4. Infrastructure decoder accepts required fields and rejects invalid shapes

## Security Coverage

| ID | How |
| --- | --- |
| B-01/B-04 | Unauthenticated / foreign non-member → `42501` |
| B-08 | Policy `saga.read` (native / owner / project member) before projection |
| GM | Native alone does not mint GM; project `gm_user_id` required |

## Launch Checklist (SC)

N/A — not a launch ticket.

## Implementation Notes

- Migration `0008_projects_saga_id.sql` (nullable `projects.saga_id`)
- Ports: `getSagaDefinitionVersion`, `getNativeSagaDefinitionBySlug` on saga module
- Use-cases: `server/src/application/saga-version-read/**` + command adapters
- Self-test: `scripts/rpc-saga-version-read.self-test.mjs`
