<!-- migration-contract:v2 localId=MIG-703 -->
# MIG-703: Tauri integration before external desktop test phase

## Type

feature

## Intent

Die freigegebene Desktop-Verpackung auf dem fertigen Browser-Host integrieren.

## Goal

Die freigegebene Desktop-Verpackung auf dem fertigen Browser-Host integrieren. Zielpfade: desktop, docs/ops/desktop.

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
- `desktop`
- `docs/ops/desktop`

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

- Desktop-Bridge und Sidecar erlauben nur freigegebene Operationen; Localhost-Port und Dateizugriff verleihen Web-Inhalten keine pauschalen Host-Rechte.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: GATE-05 ohne menschliches APPROVED oder unvollständige Browser-Host-CI
- Wenn: Desktop-Implementierung gestartet werden soll
- Dann: MIG-703 bleibt gesperrt; Tauri/Electron-Abhängigkeiten werden nicht als Nebenwirkung früher Browser-Wellen eingeführt.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 2

- Gegeben: Die freigegebene Verpackung auf Linux/macOS/Windows
- Wenn: Start, Stop, erneuter Start und Sidecar-Ausfall geprüft werden
- Dann: Pro Plattform sind App-/Sidecar-Lebenszyklus, Datenerhalt und erklärtes Fehlerbild belegt; nicht ausgeführte Plattformen bleiben offene Abnahmepunkte.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

### Fall 3

- Gegeben: Ein fremder Web-Origin oder manipulierte Bridge-Nachricht
- Wenn: Datei-/Netzwerkprivilegien angefordert werden
- Dann: Die Bridge verweigert den Zugriff; ein Update-/Rollback-Drill erhält bestehende Host-Daten und ihre Berechtigungen.
- Quelle: `.qa/design/gates/GATE-05-tauri-packaging.md`, `docs/architektur-sqlite-based.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. MIG-703 bleibt gesperrt; Tauri/Electron-Abhängigkeiten werden nicht als Nebenwirkung früher Browser-Wellen eingeführt.
2. Pro Plattform sind App-/Sidecar-Lebenszyklus, Datenerhalt und erklärtes Fehlerbild belegt; nicht ausgeführte Plattformen bleiben offene Abnahmepunkte.
3. Die Bridge verweigert den Zugriff; ein Update-/Rollback-Drill erhält bestehende Host-Daten und ihre Berechtigungen.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] MIG-703 bleibt gesperrt; Tauri/Electron-Abhängigkeiten werden nicht als Nebenwirkung früher Browser-Wellen eingeführt.
- [ ] Pro Plattform sind App-/Sidecar-Lebenszyklus, Datenerhalt und erklärtes Fehlerbild belegt; nicht ausgeführte Plattformen bleiben offene Abnahmepunkte.
- [ ] Die Bridge verweigert den Zugriff; ein Update-/Rollback-Drill erhält bestehende Host-Daten und ihre Berechtigungen.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `desktop`, `docs/ops/desktop` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #788 (GATE-05)
- Depends on #847 (MIG-602)
- Depends on #848 (MIG-603)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-703`
- Design: `.qa/design/migration-issues/stack-migration-mig-703.md`
- Status: waiting
- Reihenfolge: 90; Welle: 7
- Labels: `P2`, `migration-wave-7-cutover-tauri`, `migration-order-090`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-703.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

