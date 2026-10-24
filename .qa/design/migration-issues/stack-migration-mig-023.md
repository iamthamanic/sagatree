<!-- migration-contract:v2 localId=MIG-023 -->
# MIG-023: Invite/join codes without privilege escalation

## Type

feature

## Intent

Einladungen und Join-Codes mit serverseitiger Rolle und widerrufbarer Mitgliedschaft portieren.

## Goal

Einladungen und Join-Codes mit serverseitiger Rolle und widerrufbarer Mitgliedschaft portieren. Zielpfade: server/src/application/session/invites.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/migrations/055_session_invites.sql`, `src/infrastructure/session`.
- Source Contracts: `supabase/migrations/055_session_invites.sql`, `src/infrastructure/session`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/session/invites`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## User Journey

1. Der berechtigte Nutzer startet den bereits vorhandenen SagaTree-Vorgang (keine neuen UX-Flows oder UI-Varianten erfinden).
2. Der bestehende UI-/Service-Adapter erreicht den benannten Host-Use-Case unter unveränderten DTO-/Fehler- und Rollenverträgen.
3. Die UI zeigt denselben fachlichen Zustand und die erlaubte Projektion; Lade-, Fehler-, Reload- und Reconnect-Verhalten bleibt äquivalent.
4. Bei einem Fremdbesitzer, fehlender Membership oder nicht veröffentlichter GM-Information liefert der Host einen nachgewiesenen DENY statt nur versteckter UI.

UI-Parität, soweit betroffen: `src/THEME_GUIDE.md`, `docs/ui-styleguide.md`, `docs/concepts/adaptive-ui-experience-contract.md`, `docs/concepts/conductor-experience-contract.md` und `docs/concepts/imagination-first-visualization-contract.md`.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Ein Code ist kein GM-Nachweis. Ablauf, Zielprojekt, Zielsession und Widerruf gelten atomar mit dem Mitgliedschaftseintrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein gültiger Invite für Projekt A und ein angemeldeter Spieler
- Wenn: der Spieler den Code einlöst
- Dann: Die Membership entsteht ausschließlich im Zielprojekt mit der serverseitig vorgegebenen Spielerrolle; Wiederholung erstellt keinen zweiten Eintrag.
- Quelle: `supabase/migrations/055_session_invites.sql`, `src/infrastructure/session`

### Fall 2

- Gegeben: Abgelaufener, widerrufener oder projektfremder Code
- Wenn: der Join versucht wird
- Dann: Der Join wird ohne neue Membership und ohne Session-Zustandsänderung abgewiesen.
- Quelle: `supabase/migrations/055_session_invites.sql`, `src/infrastructure/session`

### Fall 3

- Gegeben: Zwei gleichzeitige Einlösungen und manipuliertes role=gm
- Wenn: der Einlösepfad unter Konkurrenz läuft
- Dann: Einmaligkeits-/Nutzungslimits bleiben atomar und der Request kann keine GM- oder Owner-Rechte vergeben.
- Quelle: `supabase/migrations/055_session_invites.sql`, `src/infrastructure/session`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Die Membership entsteht ausschließlich im Zielprojekt mit der serverseitig vorgegebenen Spielerrolle; Wiederholung erstellt keinen zweiten Eintrag.
2. Der Join wird ohne neue Membership und ohne Session-Zustandsänderung abgewiesen.
3. Einmaligkeits-/Nutzungslimits bleiben atomar und der Request kann keine GM- oder Owner-Rechte vergeben.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Die Membership entsteht ausschließlich im Zielprojekt mit der serverseitig vorgegebenen Spielerrolle; Wiederholung erstellt keinen zweiten Eintrag.
- [ ] Der Join wird ohne neue Membership und ohne Session-Zustandsänderung abgewiesen.
- [ ] Einmaligkeits-/Nutzungslimits bleiben atomar und der Request kann keine GM- oder Owner-Rechte vergeben.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Invite/join codes create player membership only; never GM proof; redeem limits and deny paths. |
| **Acceptance tier** | `host-integration` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | Product UX adapters MIG-311/#810; feature verify MIG-602/#847. |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 (+ MIG-311/#810 for legacy adapters) |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #797 (MIG-022)
- Depends on #785 (GATE-02)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-023`
- Design: `.qa/design/migration-issues/stack-migration-mig-023.md`
- Status: done
- Reihenfolge: 17; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-017`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-023.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

