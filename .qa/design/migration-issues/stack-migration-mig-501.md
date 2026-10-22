<!-- migration-contract:v2 localId=MIG-501 -->
# MIG-501: Optional tus for large uploads

## Type

Task

## Intent

Optionalen fortsetzbaren Großdatei-Upload an denselben Asset-Publish-Pfad anschließen.

## Goal

Optionalen fortsetzbaren Großdatei-Upload an denselben Asset-Publish-Pfad anschließen. Zielpfade: server/src/assets/uploads.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/media, supabase/functions/media. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Optionalen fortsetzbaren Großdatei-Upload an denselben Asset-Publish-Pfad anschließen. Zielpfade: server/src/assets/uploads.

## Scope

- Quellpfade: `src/infrastructure/media`, `supabase/functions/media`
- Änderbare Zielpfade: `server/src/assets/uploads`
- Quellverträge: `src/infrastructure/media`, `supabase/functions/media`

## Security & Data

Upload-IDs sind an Actor und Ziel gebunden; jeder Chunk prüft Rechte, Gesamtlänge und Limits erneut.

## Edge Cases

### Fall 1

- Gegeben: Ein teilweise hochgeladener großer Asset-Stream
- Wenn: Netzunterbrechung und Resume am bestätigten Offset folgen
- Dann: Der Upload setzt korrekt fort und publiziert genau ein Asset mit der erwarteten Prüfsumme über MIG-500.
- Quelle: `src/infrastructure/media`, `supabase/functions/media`

### Fall 2

- Gegeben: Falscher Offset, überschrittenes Byte-Limit oder fremder Actor
- Wenn: der nächste Chunk gesendet wird
- Dann: Der Server verweigert den Chunk und veröffentlicht keine unvollständigen oder fremden Bytes.
- Quelle: `src/infrastructure/media`, `supabase/functions/media`

### Fall 3

- Gegeben: Ein Host ohne aktiviertes Großupload-Modul
- Wenn: ein normaler kleiner Upload erfolgt
- Dann: Der Host unterstützt den kleinen Upload weiterhin; ein großer Upload erhält einen erklärten Capability-Fehler statt eines hängenden Requests.
- Quelle: `src/infrastructure/media`, `supabase/functions/media`

## Acceptance

- [ ] Der Upload setzt korrekt fort und publiziert genau ein Asset mit der erwarteten Prüfsumme über MIG-500.
- [ ] Der Server verweigert den Chunk und veröffentlicht keine unvollständigen oder fremden Bytes.
- [ ] Der Host unterstützt den kleinen Upload weiterhin; ein großer Upload erhält einen erklärten Capability-Fehler statt eines hängenden Requests.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #841 (MIG-500)
- Depends on #795 (MIG-020)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-501`
- Design: `.qa/design/migration-issues/stack-migration-mig-501.md`
- Status: blocked
- Reihenfolge: 80; Welle: 5
- Labels: `P1`, `migration-wave-5-storage-export`, `migration-order-080`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-501.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
