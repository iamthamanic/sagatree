# Issue #753 — atlas-followup-real-donalu-inventory

## Phases
- setup: acceptance present; branch feat/issue-753-atlas-followup-real-donalu-inventory
- implement: world-scoped inventory domain + dry-run `--world` + checks + evidence
- verify: migration-check + real-donalu-inventory-check PASS
- composition-gate: CLEAR
- review: ACCEPT
- ecc-check: pending parent

## Notes
Fixed misleading #723 dry-run that merged 38-world orphans + `sample:*` into a Donalu-labeled report. New inventory uses real Donalu UUIDs from #713 evidence CSVs only.
