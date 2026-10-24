<!-- migration-contract:v2 localId=MIG-501 -->
# MIG-501: Optional tus for large uploads

## Type

feature

## Intent

Optionalen fortsetzbaren Großdatei-Upload an denselben Asset-Publish-Pfad anschließen.

## Goal

Optionalen fortsetzbaren Großdatei-Upload an denselben Asset-Publish-Pfad anschließen. Zielpfade: server/src/assets/uploads.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/media`, `supabase/functions/media`.
- Source Contracts: `src/infrastructure/media`, `supabase/functions/media`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/assets/uploads`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Upload-IDs sind an Actor und Ziel gebunden; jeder Chunk prüft Rechte, Gesamtlänge und Limits erneut.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

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

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Der Upload setzt korrekt fort und publiziert genau ein Asset mit der erwarteten Prüfsumme über MIG-500.
2. Der Server verweigert den Chunk und veröffentlicht keine unvollständigen oder fremden Bytes.
3. Der Host unterstützt den kleinen Upload weiterhin; ein großer Upload erhält einen erklärten Capability-Fehler statt eines hängenden Requests.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Der Upload setzt korrekt fort und publiziert genau ein Asset mit der erwarteten Prüfsumme über MIG-500.
- [ ] Der Server verweigert den Chunk und veröffentlicht keine unvollständigen oder fremden Bytes.
- [ ] Der Host unterstützt den kleinen Upload weiterhin; ein großer Upload erhält einen erklärten Capability-Fehler statt eines hängenden Requests.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/assets/uploads` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | TBD by dependency successors: MIG-500/#841, MIG-020/#795 |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #841 (MIG-500)
- Depends on #795 (MIG-020)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-501`
- Design: `.qa/design/migration-issues/stack-migration-mig-501.md`
- Status: ready
- Reihenfolge: 80; Welle: 5
- Labels: `P1`, `migration-wave-5-storage-export`, `migration-order-080`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-501.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

