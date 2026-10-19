# Evidence — Real Donalu inventory (#753)

- Scope: `--world=WO-9FFK6` (evidence CSVs filtered to Donalu only).
- Source: `.qa/evidence/atlas-worldbuilder-evidence/sql/donalu_*.csv` + saga bindings.
- No `sample:*` synthetic IDs. No multi-world orphan_places merge.
- Read-only: no DB writes; migration gate remains default-off.

## Artifacts

- `donalu-inventory-report.json`
- `REVIEW_QUEUE.md`

## Proof points

- placeCount=6 (Donalu places only)
- orphanSettlementCount=1 (not 38)
- ambiguousReviewCount=3
- sagaCount=1
