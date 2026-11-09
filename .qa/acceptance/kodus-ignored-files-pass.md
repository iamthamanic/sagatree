# Acceptance — kodus-ignored-files-pass

## Intent
Treat Kody "All Files Ignored" / Code Review Skipped check-runs as a completed
no-op review so Dependabot lockfile-only PRs are not blocked by ECC.

## Happy Path
- [x] `isKodusIgnoredFilesSkip` + `evaluateKodusCheckRun` → `kodus-ignored-files`
- [x] Generic `skipped` without ignore wording still fails closed
- [x] Self-test covers both paths

## Composition Gate
See `.qa/runs/composition-gate-kodus-ignored-files-pass.md`
