<!-- migration-contract:v2 localId=MIG-023 -->
# MIG-023: Invite/join codes without privilege escalation

## Type

Task

## Intent

Einladungen und Join-Codes mit serverseitiger Rolle und widerrufbarer Mitgliedschaft portieren.

## Goal

Einladungen und Join-Codes mit serverseitiger Rolle und widerrufbarer Mitgliedschaft portieren. Zielpfade: server/src/application/session/invites.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/migrations/055_session_invites.sql, src/infrastructure/session. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Einladungen und Join-Codes mit serverseitiger Rolle und widerrufbarer Mitgliedschaft portieren. Zielpfade: server/src/application/session/invites.

## Scope

- Quellpfade: `supabase/migrations/055_session_invites.sql`, `src/infrastructure/session`
- Änderbare Zielpfade: `server/src/application/session/invites`
- Quellverträge: `supabase/migrations/055_session_invites.sql`, `src/infrastructure/session`

## Security & Data

Ein Code ist kein GM-Nachweis. Ablauf, Zielprojekt, Zielsession und Widerruf gelten atomar mit dem Mitgliedschaftseintrag.

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

## Acceptance

- [ ] Die Membership entsteht ausschließlich im Zielprojekt mit der serverseitig vorgegebenen Spielerrolle; Wiederholung erstellt keinen zweiten Eintrag.
- [ ] Der Join wird ohne neue Membership und ohne Session-Zustandsänderung abgewiesen.
- [ ] Einmaligkeits-/Nutzungslimits bleiben atomar und der Request kann keine GM- oder Owner-Rechte vergeben.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #797 (MIG-022)
- Depends on #785 (GATE-02)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-023`
- Design: `.qa/design/migration-issues/stack-migration-mig-023.md`
- Status: blocked
- Reihenfolge: 17; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-017`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-023.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
