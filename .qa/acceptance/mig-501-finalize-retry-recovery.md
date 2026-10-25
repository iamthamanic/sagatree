# Feature: P1: MIG-501 Upload-Finalisierung nach Abbruch idempotent wiederaufnehmen

<!-- seeded by ecc-runner from issue #938 on 2026-10-25 — @implement may refine -->

## Intent
Den bereits gemergten MIG-501-Uploadpfad so korrigieren, dass ein verlorener Response, ein Fehler beim Publish oder ein Fehler beim Markieren als finalisiert niemals zu dauerhaft feststeckenden Sessions oder doppelten Assets führt.

## Happy Path
- [x] - [x] Derselbe letzte Chunk bzw. expliziter Finalize-Retry liefert nach verlorenem Response dieselbe Asset-ID; exakt ein Asset wird veröffentlicht.
- [x] - [x] Fehler bei Publish, `markFinalized` und Crash/Restart lassen sich reproduzieren und sicher recovern; kein permanentes `offset-mismatch`/`already-finalized`-Dead-End.
- [x] - [x] `head` zeigt eindeutig Offset, Finalisierungszustand und autorisiertes Ergebnis; fremde Actoren bleiben ausgeschlossen.
- [x] - [x] MIG-501-Self-Test und neue persistente Retry-/Crash-Regressionstests laufen mit PASS und nachweisbarer CI-Evidenz.
- [x] - [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases
- [x] (from .qa/edge-cases.md + @implement)

## Regression
- [x] Feed and topic routes still load

## Assumptions
- none

## Screenshots
| Step | Filename |
|------|----------|
| 1 | `01-happy-path.png` |

## Implementation Notes
<!-- filled after coding -->


## Verification evidence
- `node scripts/mig-501-resumable-uploads.self-test.mjs` PASS (includes #938 lost-response retry, empty finalize, crash remount, foreign deny, single published asset)
- Migration `0009_upload_finalize_idempotency.sql` adds `pending_asset_id`
- Publish accepts stable `assetId` for idempotent resumable finalize
