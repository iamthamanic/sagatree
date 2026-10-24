<!-- migration-contract:v2 localId=GATE-05 -->
# GATE-05: Desktop packaging PoC (Tauri+sidecar vs Electron) — deferred until browser host parity

## Type

chore

## Intent

Desktop-Verpackung erst nach abgeschlossener Browser-Host-CI und Betriebsnachweis vergleichen.

## Goal

Desktop-Verpackung erst nach abgeschlossener Browser-Host-CI und Betriebsnachweis vergleichen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-05, .qa/design/gates/GATE-05-tauri-packaging.md.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`.
- Source Contracts: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `.qa/evidence/stack-migration-prep/pocs/gate-05`
- `.qa/design/gates/GATE-05-tauri-packaging.md`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## Runtime

| Axis | This slice |
| --- | --- |
| Desktop macOS/Windows/Linux | Tauri+Node-Sidecar; echte Plattformtests erforderlich |
| Browser/VPS | bestehender gemeinsamer Host unverändert; keine zweite Runtime |

## Security & Data

- Sidecar-Zugriff ist auf die angemeldete lokale Instanz beschränkt; Desktop-Verpackung erweitert weder Netzreichweite noch produktive Datenrechte.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: MIG-602 oder MIG-603 ist noch offen
- Wenn: der Runner die Desktop-PoC starten möchte
- Dann: Der Runner verweigert GATE-05; dieser PoC blockiert ausschließlich MIG-703 und liegt nach den Browser-Host-Wellen.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 2

- Gegeben: Browser-Host-CI und Restore-Drill sind abgeschlossen
- Wenn: Tauri+Sidecar und Electron werden auf Linux/macOS/Windows geprüft
- Dann: Start/Stop, Portkonflikt, persistentes Datenverzeichnis, signierte Updates und fehlgeschlagener Sidecar-Start haben je Plattform beobachtete Ergebnisse; nicht ausgeführte Plattformen bleiben NOT RUN.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 3

- Gegeben: Ein offenes Verpackungs-ADR
- Wenn: ein Kandidat einzelne Smoke-Tests besteht
- Dann: Teilweise Smoke-Erfolge aktivieren keinen Desktop-Produktcode; MIG-703 benötigt die verlinkte menschliche GATE-05-Freigabe.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Der Runner verweigert GATE-05; dieser PoC blockiert ausschließlich MIG-703 und liegt nach den Browser-Host-Wellen.
2. Start/Stop, Portkonflikt, persistentes Datenverzeichnis, signierte Updates und fehlgeschlagener Sidecar-Start haben je Plattform beobachtete Ergebnisse; nicht ausgeführte Plattformen bleiben NOT RUN.
3. Teilweise Smoke-Erfolge aktivieren keinen Desktop-Produktcode; MIG-703 benötigt die verlinkte menschliche GATE-05-Freigabe.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Der Runner verweigert GATE-05; dieser PoC blockiert ausschließlich MIG-703 und liegt nach den Browser-Host-Wellen.
- [ ] Start/Stop, Portkonflikt, persistentes Datenverzeichnis, signierte Updates und fehlgeschlagener Sidecar-Start haben je Plattform beobachtete Ergebnisse; nicht ausgeführte Plattformen bleiben NOT RUN.
- [ ] Teilweise Smoke-Erfolge aktivieren keinen Desktop-Produktcode; MIG-703 benötigt die verlinkte menschliche GATE-05-Freigabe.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `.qa/evidence/stack-migration-prep/pocs/gate-05`, `.qa/design/gates/GATE-05-tauri-packaging.md` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #847 (MIG-602)
- Depends on #848 (MIG-603)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-gate-05`
- Design: `.qa/design/migration-issues/stack-migration-gate-05.md`
- Status: blocked
- Reihenfolge: 86; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-086`, `agent-blocked`, `gate-issue`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-gate-05.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

