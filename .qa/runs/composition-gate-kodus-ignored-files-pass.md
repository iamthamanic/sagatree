# Composition Gate — kodus-ignored-files-pass

- HEAD_SHA: 9a2edfa81a35eb92b8300a021e48ec891ade3b8e
- BASE_SHA: dc15f483f9dbf03d2636580f2d9999f7bfbf0e8f
- Date: 2026-11-09
- Verdict: CLEAR
- Acceptance tier: tool-only

## Event

ECC Merge Gate no longer fails Dependabot PRs when Kody intentionally skips
because every changed path is on its ignore list.

## Hop chain

1. **Producer:** Kody check-run conclusion=skipped + All Files Ignored summary
2. **Gate:** `isKodusIgnoredFilesSkip` → `kodus-ignored-files`
3. **Consumer:** ECC Merge Gate PASS (when other checks green)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Dependabot package-only PR | ignored-files skip PASS | pass |
| Invalid/missing | skipped without ignore wording | still kodus-failed | pass |
| Two consumers / crash | self-test + gate agree | kodus-merge-gate.self-test | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
