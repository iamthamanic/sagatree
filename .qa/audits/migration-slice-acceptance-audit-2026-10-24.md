# SagaTree Migration — Slice Acceptance & Integration Audit (Draft)

Date: 2026-10-24
Epic: https://github.com/iamthamanic/sagatree/issues/773

## Decision

Keep the 90 canonical issue identities. Separate **slice DONE** from **feature VERIFIED**. A slice may be complete while its later, explicitly owned integration is not. Do not reopen a DONE slice solely because an out-of-scope successor has not run. Do not defer an exploitable trust-boundary failure to an unspecified successor.

## Evidence and scope

- Structural audit of `.qa/evidence/stack-migration-prep/dependency-enforcement-plan.json`: 90 rows, 90 unique local IDs, 90 unique GitHub IDs, 90 unique order positions, no missing internal predecessor IDs, no backward predecessor edges (not a proof of full runtime correctness).
- Existing source-to-successor mapping: `.qa/evidence/stack-migration-prep/legacy-target-matrix.md`. Has 57 frontend RPC entries, edge/infra mappings, and explicit follow-up integration owners.
- Sampled substantive contracts: MIG-021/#796, MIG-024/#799, MIG-311/#810, MIG-600/#845, MIG-602/#847, MIG-700/#849, and owner architecture decisions. **Not** a complete manual semantic review of all 90 issue bodies or all application paths. The follow-up audit must do that before claiming comprehensive semantic coverage.
- Snapshot caveat: main dependency plan had MIG-024 as READY and MIG-021 as WAITING although GitHub #799 had already closed and #796 was READY; PR #925 provides synchronization. The live canonical state and committed snapshot must not be conflated.

## Structural coverage map (existing owners, not new feature issues)

| Area | Implementation slices | Later integration owner | Feature/security verification | Decision |
| --- | --- | --- | --- | --- |
| Identity and auth | MIG-013/014/015 | MIG-020/021, host entrypoints | MIG-600, MIG-602 | Preserve |
| Session role projection | MIG-024 | MIG-021 and MIG-311 where applicable | MIG-600, MIG-602 | Specify actor-grant source in consumers |
| Session realtime | MIG-020/021/022/023/024 | MIG-021 host room mount vs MIG-311 legacy frontend adapter — boundary requires explicit ownership | MIG-600, MIG-602 | Fix contract ownership |
| Session legacy adapters | MIG-311 and RPC-SESSION-* | MIG-311 | MIG-600, MIG-602 | Preserve |
| World/Atlas | RPC-WORLD-*, MIG-350, MIG-313 | Host/client adapters | ATLAS-LIVE-E2E #770 and MIG-602 | Preserve |
| Data/RPC | MIG-011/012/503, 18 RPC slices, MIG-350..353 | MIG-301..313 | MIG-602, MIG-700 | Preserve |
| Edge/AI/media | MIG-401..424, MIG-500/501 | MIG-301..313, authorized host routes | MIG-600/602 | Preserve legacy 404 contracts |
| Ops/release | MIG-502/601/603 | MIG-700/701/702/703 | Explicit human release approval | Preserve |

## Verified gaps in PR #926 (MIG-021)

1. **P1, security, current-slice defect:** `server/src/realtime/index.ts` `asProjectionActor` copies `input.role` and `input.revealedObjectIds` into projection privileges. A member can claim GM/reveals. Require server-authoritative session policy/role/grants. Add negative self-test against forged role/grants and authorization re-check upon commit/resync. Do not postpone this trust boundary.
2. **P1, fan-out contract defect:** `onCommitted` is a no-op with respect to delivery. The self-test calls it, then manually calls `resync`; thus it cannot prove the claimed live broadcast to N connected actors. Add explicit subscriber-delivery assertion, revocation/race, failed/rolled-back event and no duplicate replay.
3. **P1, unclear ownership:** `createRealtimeSessionRooms` is only directly exercised in isolated test; does not mount on production host/Colyseus. The MIG-021 contract says `server/src/realtime` only yet demands live WebSocket behavior and the architecture mandates Colyseus. Decide and record unambiguous ownership: either MIG-021 includes host mount in-scope with real integration tests, or a *named existing future issue* assumes host mount with a sufficient runtime activation gate. MIG-311 is for legacy client adapters; do not silently assume it owns host assembly.
4. **Prior MIG-024 integration evidence limit:** current main transport projects only GM/player with empty objects/events. Confirm which later owner connects real actor-specific objects/events and spectator; add explicit integration negative tests there. A standalone projection helper can remain DONE if its own contract is fulfilled.

Review references:
- https://github.com/iamthamanic/sagatree/pull/926
- https://github.com/iamthamanic/sagatree/issues/796
- https://github.com/iamthamanic/sagatree/issues/799

## Process change — minimal and surgical

In **each affected issue contract**, record:
- `Slice deliverable`: what this issue guarantees now.
- `Deferred integration`: named successor GitHub issue IDs plus precise missing activation/test obligations; `none` when fully integrated.
- `Acceptance tier`: isolated unit/contract, host integration, end-to-end feature. Never claim higher tiers from a lower-tier test.
- `Security invariants`: untrusted actor, role, membership, grant, secret, revoke, idempotency, rollback, where applicable.
- `Required evidence`: one executable negative case per security invariant; N-actor fan-out/consumer simulation for realtime.
- `Feature closure owner`: existing later acceptance issue, usually MIG-600 and MIG-602; maintain release gates MIG-700..702.

Before acceptance: verify every claim in `Composition Gate` refers to a *real connected call path* at the appropriate acceptance tier. A draft adapter with no host caller is not a passing host-integration proof. Missing proof yields `NOT_RUN`/deferred with named owner, not `PASS`.

Review/merge: ensure unresolved P1/P2 findings block merge on the PR's **current head and latest review timestamp**, not merely a green historical ECC check run. Preserve prior approvals and do not add a global all-90 E2E requirement to each slice.

## Action proposal (draft only, no new issues yet)

A. PR #926 remains Draft while P1 security, event fan-out, and host-mount ownership are resolved.
B. Amend MIG-021 #796 accepted tests: forged GM/reveal denied; event push to authorized N members; revocation; host mount or named successor. Update regenerated canonical source, design, published issue body, dependencies together.
C. Amend MIG-024 integration follow-up mapping (do not retroactively claim full transport activation); attach spectator/object/event canary to actual consumer owner.
D. Audit remaining canonical 90 bodies semantically against source-to-target matrix in manageable batches; compare mandatory runtime paths, intended In/Out scope and future owner; produce issue-specific patch suggestions and *only* propose additional issue(s) when ownership is genuinely missing.
E. Run `npm run check:stack-migration-prep`, GitHub source contract checks, negative test probes, and validate readiness/report consistency before autonomous resume.
F. Do not initiate production cutover or Supabase shutdown; those require independent human approval.

## Current status

- Structural 90-node validation: COMPLETE.
- Sampled substantive gaps: FOUND.
- Complete 90-body semantic/functional audit: NOT YET VERIFIED.
- Existing contract changes: DRAFT RECOMMENDATIONS ONLY.
- Newly created migration issues: NONE.
- Current feature coverage completeness: UNVERIFIED.
