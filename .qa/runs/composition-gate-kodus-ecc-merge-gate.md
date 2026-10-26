# Composition Gate — kodus-ecc-merge-gate

- HEAD_SHA: PLACEHOLDER
- BASE_SHA: d5b6a4d329d921477ba0d2281d68ed10f5404bf5
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Kodus (kody-ai) review completion + finding severities feed ECC Merge Gate; workflow re-runs on check_run/issue_comment; Codex P1/P2 path unchanged.

## Hop chain

1. Producer: kody-ai check-run + review threads / issue comments
2. Authorize: app slug kody-ai + bot login allowlist (spoof → FAIL)
3. Persist: N/A (policy scripts + yaml)
4. Consumer: ecc-merge-gate-check evaluateMergeGate → CI required check
5. Agent: AGENTS.md External AI Review Contract + .qa/runner-kodus-contract.md

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Codex + Kodus findings concurrent | self-tests | pass |
| Invalid/missing | missing/pending/started/spoofed Kody check | self-tests + live #993 | pass |
| Two consumers / crash | late finding after green ECC; issue_comment edit | workflow triggers + evaluateMergeGate | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: optional GitHub ruleset listing of Kody Code Review (human)

## Non-claims

No production cutover; no LLM calls inside test-gate.
