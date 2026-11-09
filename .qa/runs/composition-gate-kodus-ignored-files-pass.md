# Composition Gate — kodus-ignored-files-pass

- HEAD_SHA: c88122b797c6bf11f6e3604e9303bd5f14a4fd86
- BASE_SHA: 7045b9162a2f8d7db38604514960ba022b8c0130
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
