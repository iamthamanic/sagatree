# SagaTree Migration — Slice Acceptance & Integration Audit

Date: 2026-10-24  
Epic: https://github.com/iamthamanic/sagatree/issues/773  
Audit branch: `audit/migration-slice-acceptance-20261024`  
Verified against: `origin/main` @ `7eb4f6b2` (post PR #926 MIG-021)

## Decision (binding)

Keep the **90 canonical issue identities**. Never equate:

| State | Meaning |
| --- | --- |
| **SLICE DONE** | Issue scope implemented + Required Tests PASS with hashed evidence |
| **INTEGRATION DONE** | Named callers/consumers actually wired |
| **FEATURE VERIFIED** | Product path E2E via MIG-600 / MIG-602 / ATLAS-LIVE-E2E as applicable |
| **RELEASE APPROVED** | Independent human approval (cutover / Supabase shutdown) |

## Phase 0 — Runner pause (COMPLETE)

- User-requested pause recorded in `/tmp/ecc-runner-loop-773-handoff.md` (`paused: true`, `pauseReason: user-requested-full-migration-audit`).
- No new migration tickets claimed.
- PR #925 **MERGED**.
- PR #926 **MERGED** after Phase 6 (P1 triad + fan-out recheck + tip-delta omit; ECC PASS; Browser E2E PASS).

## Phase 1 — Full 90-contract audit (COMPLETE)

### Artifacts

| Artifact | Path |
| --- | --- |
| Coverage matrix (machine) | `.qa/audits/migration-90-coverage-matrix-2026-10-24.json` |
| Coverage matrix (human) | `.qa/audits/migration-90-coverage-matrix-2026-10-24.md` |
| Legacy source→target | `.qa/evidence/stack-migration-prep/legacy-target-matrix.md` |
| Dependency plan | `.qa/evidence/stack-migration-prep/dependency-enforcement-plan.json` |
| Readiness | `.qa/evidence/stack-migration-prep/readiness-2026-10-23.json` |

### Inventory coverage

| Inventory | Count | Issue ownership |
| --- | ---: | --- |
| Canonical issues | 90 | 90 unique localId / GitHub / topo order |
| Frontend RPCs | 57 | 57 owned (no orphans) |
| Edge functions | 25 | each has `implementationIssue` |
| Infra areas | 13 | mapped in legacy-target-matrix |
| DONE + completion evidence | 19 | all PASS with hashed checks (incl. MIG-021 after #926/#928) |
| READY with incomplete preds | 0 | — |

### Status histogram (intake)

DONE 19 · READY 5 · WAITING 26 · BLOCKED 40 · needs-design 0

READY set: `RPC-SAGA-AUTHORING`, `MIG-306`, `MIG-309`, `MIG-501`, `MIG-502`

### Method

For every issue: intent/scope from design+intake, source contracts, dependsOn graph, acceptance/assertions, security wording, completion evidence (if DONE), deferred integration owner heuristic, feature verification owner (MIG-600/602/ATLAS/MIG-700). Semantic deep-dive on session/auth wave + feature owners; structural+inventory for remainder. Rows with `OK_STRUCTURAL` / `WAITING` / `BLOCKED` are not claimed as FEATURE VERIFIED.

## Phase 2 — Findings classification

| ID | Cat | Sev | Finding | Action |
| --- | --- | --- | --- | --- |
| MIG-021 | A→E | P1→Info | Client role/reveal, no-op fan-out, unmounted rooms on earlier tip | Fixed and merged via #926 (authoritative `can_write`, `onFanout`, `createHost`+HTTP, fan-out membership recheck, tip-delta omit). |
| MIG-021 | B | P2 | Colyseus Room package not in `server/package.json` | **VALID DEFERRED**: HTTP host mount satisfies slice activation; full Colyseus Room schema before FEATURE VERIFIED via MIG-602/#847. Contract text updated. |
| MIG-024 | B | P2 | Projection helper DONE; real object/event/spectator consumer partial | Keep DONE; deferred to MIG-021/#796 + MIG-311/#810; FEATURE VERIFIED via MIG-600/#845. Contract tiers added. |
| MIG-014/015/020/022/023/024/021 | D | P2 | Missing explicit Slice/Deferred/Feature-tier language | **Fixed**: `Acceptance tiers` section regenerated into all 90 design bodies via renderer. |
| Composition Gate | D | P2 | CLEAR proofs could omit call-site / deferred honesty | **Fixed**: CLEAR requires Acceptance-tier language or Deferred integration or host call-site markers; self-test updated. |
| C missing ownership | — | — | None found for RPC/Edge inventories | No new issues created |

**False positives:** None claimed without evidence.

## Phase 3 — Contract repairs (COMPLETE on audit branch)

- Extended `scripts/stack-migration-issue-rendering.mjs` with `Acceptance tiers` (SLICE DONE / tier / Deferred integration / FEATURE VERIFIED / RELEASE APPROVED).
- Special rows for MIG-014/015/020/021/022/023/024/311/600/602/700/ATLAS-LIVE-E2E; defaults for all other issues.
- Regenerated 101 artifacts via `node scripts/stack-migration-issue-contracts.mjs --write`.
- `npm run check:stack-migration-prep` → **PASS**.

## Phase 4 — Feature verification owners

| Feature area | Implementation slices | Integration owner | FEATURE VERIFIED owner |
| --- | --- | --- | --- |
| Session/realtime/auth | MIG-013..024, RPC-SESSION-* | MIG-021 host + MIG-311 adapters | MIG-600 + MIG-602 |
| World/Atlas | RPC-WORLD-*, MIG-350/313 | adapters | ATLAS-LIVE-E2E #770 + MIG-602 |
| Edge/media/storage | MIG-40x/41x/42x/500/501 | host routes | MIG-600 + MIG-602 |
| Adapters/RPC ports | MIG-301..313, RPC-* | self | MIG-602 |
| Release | MIG-700..703 | human | RELEASE APPROVED only |

No new issues required: existing MIG-311/600/602/700/ATLAS cover ownership.

## Phase 5 — Gate repairs (COMPLETE on audit branch)

| Gate | Change |
| --- | --- |
| Composition Gate | CLEAR proofs must include acceptance-tier / deferred / host call-site markers |
| composition-gate.self-test | Fixture proofs updated; all PASS |
| ECC Merge Gate | Unchanged — already blocks unresolved P1/P2 on **current PR head** (verified locally for #926) |
| Acceptance tiers in contracts | Prevents equating unit PASS with FEATURE VERIFIED |

## Phase 6 — Open migration PRs (COMPLETE)

| PR | Result |
| --- | --- |
| #925 MIG-024 evidence | MERGED earlier (`5c94e0f8`) |
| #927 Audit + acceptance tiers | MERGED (`acd79215`) |
| #926 MIG-021 realtime rooms | MERGED (`7eb4f6b2`) after P1 fixes (authoritative roles, host mount, fan-out, membership recheck, tip-delta omit) |
| #928 MIG-021 completion evidence | This PR — DONE 19 / READY 5 sync |

## Phase 7 — Audit correction PR (COMPLETE)

- Coverage matrix + contract repairs shipped in #927.
- Composition CLEAR honesty: Acceptance tier **and** Deferred integration required independently.
- Renderer empty-path fix + matrix-backed deferred owners.

## Phase 8 — Runner resume

Resume criteria met. Next READY by topology: `RPC-SAGA-AUTHORING` #871, `MIG-306` #805, `MIG-309` #808, `MIG-501` #842, `MIG-502` #843.

## Phase 9 — Closing counts

| Metric | Value |
| --- | ---: |
| Issues audited | 90 |
| Contracts structurally OK / ownership mapped | 90 |
| Corrected issue contracts | 90 (Acceptance tiers) + targeted MIG-021/024 |
| New issues created | 0 |
| Audit PR | #927 |
| MIG-021 ship PR | #926 |
| MIG-021 evidence PR | #928 |
| Readiness | DONE 19 · READY 5 |
| Human approvals still required | Cutover / Supabase shutdown / GATE-05 platform qualification |

## Explicit human holdouts

- Production cutover
- Supabase Auth/DB shutdown
- GATE-05 platform qualification (MIG-703)

## Checks run

- `node scripts/stack-migration-issue-contracts.mjs --write`
- `npm run check:stack-migration-prep` → PASS
- `node scripts/composition-gate.self-test.mjs` → PASS
- Local `ECC_MERGE_GATE_PR=926` → PASS (0 unresolved P1/P2) after merge prerequisites

## Phase 9 — Final status (2026-10-24 session close)

| Metric | Value |
| --- | ---: |
| Issues audited | 90 |
| Contracts corrected (Acceptance tiers) | 90 |
| New issues created | 0 |
| Coverage gaps closed (ownership) | 0 remaining unowned RPC/Edge |
| PRs merged this audit window | #927, #926, #928, #929 |
| Readiness after MIG-306 evidence | DONE 20 · READY 4 |
| Runner | resumed; queue continues |
| Human holdouts | Cutover / Supabase shutdown / GATE-05 |

