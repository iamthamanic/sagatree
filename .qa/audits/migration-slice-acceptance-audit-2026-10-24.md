# SagaTree Migration — Slice Acceptance & Integration Audit

Date: 2026-10-24  
Epic: https://github.com/iamthamanic/sagatree/issues/773  
Audit branch: `audit/migration-slice-acceptance-20261024`  
Verified against: `origin/main` @ `5c94e0f8` (post PR #925)

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
- PR #926 remains **draft** until Phase 6 re-verification (P1 triad addressed on head `3850da0d`; Browser E2E must finish; undraft only after ECC PASS on current head).

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
| DONE + completion evidence | 18 | all PASS with checks |
| READY with incomplete preds | 0 | — |

### Status histogram (intake)

DONE 18 · READY 6 · WAITING 26 · BLOCKED 40 · needs-design 0

READY set: `MIG-021`, `RPC-SAGA-AUTHORING`, `MIG-306`, `MIG-309`, `MIG-501`, `MIG-502`

### Method

For every issue: intent/scope from design+intake, source contracts, dependsOn graph, acceptance/assertions, security wording, completion evidence (if DONE), deferred integration owner heuristic, feature verification owner (MIG-600/602/ATLAS/MIG-700). Semantic deep-dive on session/auth wave + feature owners; structural+inventory for remainder. Rows with `OK_STRUCTURAL` / `WAITING` / `BLOCKED` are not claimed as FEATURE VERIFIED.

## Phase 2 — Findings classification

| ID | Cat | Sev | Finding | Action |
| --- | --- | --- | --- | --- |
| MIG-021 | A→E | P1→Info | Client role/reveal, no-op fan-out, unmounted rooms on earlier tip | Fixed on PR #926 head `3850da0d` (authoritative `can_write`, `onFanout`, `createHost`+HTTP). Phase 6 must re-verify CI and undraft. |
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

## Phase 6 — Open PRs (in progress)

| PR | Status | Action |
| --- | --- | --- |
| #925 MIG-024 evidence | MERGED @ `5c94e0f8` | done |
| #926 MIG-021 | Draft; ECC PASS local; Browser E2E pending | Keep draft until Browser E2E green + head re-check; then undraft + squash-merge |

## Phase 7–9

See PR description / final report after merge of this audit branch and #926.

## Explicit human holdouts

- Production cutover
- Supabase Auth/DB shutdown
- GATE-05 platform qualification (MIG-703)

## Checks run

- `node scripts/stack-migration-issue-contracts.mjs --write`
- `npm run check:stack-migration-prep` → PASS
- `node scripts/composition-gate.self-test.mjs` → PASS
- Local `ECC_MERGE_GATE_PR=926` → PASS (0 unresolved P1/P2)
