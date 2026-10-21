## Type
feature

## Intent
Parent Epic fuer die vollstaendige Migration von SagaTree von selbst-gehostetem Supabase/PostgreSQL/Deno auf eine local-first TypeScript-Host-Runtime (Desktop lokal und Docker-VPS). Dieses Epic umfasst bewusst auch die notwendigen Vorarbeiten, Architektur-Spikes, Qualitaetsluecken, die Migration saemtlicher produktiver Funktionen, Datenuebernahme und Supabase-Abschaltung. Die untergeordneten Issues duerfen von Beginn an angelegt sein; aus der Existenz eines Issues folgt KEINE Implementierungsfreigabe.

## Goal
Ein identischer SagaTree-Host laeuft lokal ohne Cloud- oder Docker-Pflicht und in Docker auf einem VPS; Auth, Autorisierung, Daten, Storage, Realtime, KI/Edge-Nachfolger, Welt/Atlas und Spielsessions sind nachweislich funktions- und sicherheitsgleich migriert. Am Cutover-Gate sind alle produktiven Altpfade abgedeckt, Tests mit echtem Backend verpflichtend, Backup/Restore bestaetigt und der alte Supabase-Stack sicher entfernbar.

## Non-Goals
- Kein Big-Bang-Rewrite und keine zweite unabhaengige Desktop-Engine.
- Kein Tauri-Zwang waehrend Browserentwicklung.
- Kein ungepruefter Produktionsdaten-Cutover und keine automatische Entscheidung ueber kritische Technologiefragen.

## Context
- Geprüfte Source-Baseline: `main` @ `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; ein bestehendes Deployment wurde damit nicht geprüft.
- Bestehender Architekturplan: `docs/architektur-sqlite-based.md`.
- Ursprüngliche Vorbereitung: #771. Aktuelle Vertrags-/Harness-Reparatur: Draft-PR #860, Branch `docs/mig-773-contract-remediation-20261021`, 90 fest zugeordnete Kindverträge und vollständige Legacy-Matrix.
- Bestehende Atlas-Live-E2E-Luecke: #770 (**kein zweites Issue erstellen**).
- Verbindliche Projektregeln: `AGENTS.md`, `.qa/project.yaml`, `@issue-contract`, `@typed-strict`.

## Scope
In:
- Vorab: Draft-PR #860 und seine realen Nachweise abnehmen, offene Architektur-Gates entscheiden und dokumentierte Fehler in abgegrenzten Tickets bearbeiten.
- Node/TypeScript host, SQLite, Repository/Policy/Auth/HTTP/Realtime, 13 Frontend-Infra-Domaenen, 57 deduplizierte RPC-Namen, 24 Edge-Funktionen, Storage/Assets, KI/Medien, Import/Export, Docker/CI/Tauri.
- Releasesicherheit, versionierte Datenformate, Sicherheitsparitaet, Rollback und kontrollierte Abschaltung.
Out:
- Feature-Rewrites ohne Alt-zu-Neu-Vertrag; heimliche Entfernung bestehender Funktionen.
- Unkontrollierte gleichzeitige Schreibautoritaet in Supabase und SQLite.

## Runtime
| Axis | Contract |
|---|---|
| Browser dev | Vite/React/Three.js unveraendert benutzbar; Node-Host lokal |
| Local host | Solo/LAN ohne Cloud und ohne Docker-Pflicht |
| VPS | Dieselbe Host-Runtime in Docker |
| Desktop | Tauri erst vor externem Desktop-Test, Browser-Workflow bleibt |

## Security & Data
- Fail closed, deny by default, GM-Geheimnisse vor HTTP/WS/Storage/AI filtern.
- `expectedRevision`, `idempotencyKey`, transaktionale Event- und Snapshot-Semantik erhalten.
- Keine Produktsystem-Migration oder Datenloeschung ohne ausdrueckliche Freigabe.
- Keine neue Implementierung eines offenen Gate-Themas ohne dokumentierten verbindlichen Architekturentscheid.

## Edge Cases
- Unterbrochene Verbindung, Multi-User-Konflikte, Restart und Offline-Solo.
- Fremdbesitzer/GM/Spieler-Geheimnisse und signierte Asset-URL-Bypasses.
- Datenmigration mit abgebrochenem Import, Restore und verlustfreien IDs/Assets.

## Acceptance
- [ ] Alle produktiven Supabase/Auth/SQL/RPC/RLS/Storage/Realtime/Edge/Infra-Pfade haben gepruefte, implementierte Nachfolger oder dokumentierte und freigegebene Stilllegung.
- [ ] Reales, verbindliches GM+2-Spieler-E2E einschliesslich Atlas #770 und Negativtests gegen Backend/DB ist gruen und beweisbar regressionssensitiv.
- [ ] Lokaler Host und Docker-VPS verwenden dieselbe Runtime, sichern/recovern SQLite+Assets, optionales KI-/Medien-Degrade funktioniert.
- [ ] Vollstaendiger Cutover-Sperrtest verlangt explizit ALLE erforderlichen Kindissues, Restore, Security- und Paritaetsnachweise vor Supabase-Abschaltung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Runner
Labels: P0, Architecture, feature
Feature slug: `local-first-stack-migration`
Design: `.qa/design/local-first-stack-migration.md` (Reparatur in Draft-PR #860; die geprüfte Fassung muss vor Umsetzung übernommen sein)
Status: PLANNED; CHILD ISSUES ARE NOT AUTOMATICALLY AGENT-READY.

## Design
Rule for child issues: exactly ordered `Depends on #N` (acyclic). Research/specification prep is executable first; all dependency-gated implementation issues remain blocked until code-level before/after contracts are finalized and required ADRs approved. Migrations are released by authenticated integration/security tests, NOT marker-file checks.

## Verifizierte Vorbereitung — 2026-10-21

- Draft-PR #860 enthält 57 RPC-, 24 Edge- und 13 Infrastruktur-Verträge, 18 exklusive RPC-Kindtickets und einen fest gebundenen Plan mit 90 Kindidentitäten. Ein optional installierter RPC bleibt ausdrücklich source-blocked; die Quellverträge sind keine Implementierungsabnahme.
- Der Vertragsvalidator regeneriert alle semantischen Quellen und besteht 28 gezielte Regressionen. Der reguläre lokale Projekt-Testlauf besteht ebenfalls. Die Publikationsgrenze bindet Repository, Nummer, Titel, Labels und Body gemeinsam; alle Kindtickets bleiben blocked/needs-design.
- Die isolierte PostgreSQL-Baseline wendet 106 unveränderte Migrationen an und weist 177 Funktionsdefinitionen nach. Strikte SQL-Abnahme: 16/25 PASS, einschließlich offener Critical-/High-Berechtigungsbefunde. Tatsächlicher Atlas-Produktbrowser: 1/3 PASS. Der reale RLS-Canary erkennt die eingebrachte Regression. Diese Suites bleiben bei bekannten Fehlern rot.
- GATE-01: beide ORM-Kandidaten mit jeweils 42 Fällen auf Node 22 und 24; korrigierte Evidenzprüfung mit je 13 Regressionen. GATE-04: reale SQLite-Transaktionen und Crash-Punkte bestanden. GATE-03: gemessener lokaler Transport-/Last-Scope bestanden. Daraus folgt keine menschliche Architekturentscheidung.
- Separater GATE-01-Toolchain-Audit: vier High-Pakete in einer betroffenen Dev-Abhängigkeitskette sowie ein Low-Advisory. Runtime ohne Dev, DB-Harness und GATE-02/03 melden keine Advisories. Der vollständige CI-Audit bleibt rot; die Werkzeugentscheidung ist offen.
- GATE-02 bleibt FAIL: Cookie A gibt im tatsächlichen Browser authentifizierende Tokens an JavaScript aus. Browser-JWT-Speicherung, Tauri und öffentliche HTTPS-Integration sind nicht abgenommen. GATE-05 bleibt bis Browser-Host-CI und Betrieb zurückgestellt.
- Konkreter Beginn: Baseline #782 und Inventar #783 abnehmen; GATE-01 #784 menschlich entscheiden; anschließend Host #789. Der offene Auth-Befund blockiert die späteren Auth-Tickets, nicht den ersten Host-Grundaufbau. Atlas #770 behält seine eigene fachliche Abnahme.
- Nachweise und Sperrgrenzen: `.qa/evidence/stack-migration-prep/START_SEQUENCE.md`, `phase0-status.md`, `github-contract-sync.json` und `docs/stack-migration-preparation.md` in PR #860.

Aktueller Migrationsstatus: **BLOCKED FOR UNRESTRICTED MIGRATION**. Kein unbegrenzter Runner, kein automatisches Architektur-APPROVED, kein Produktivdaten-Cutover und keine Supabase-Abschaltung durch den Vorbereitungsauftrag. Veröffentlichungs-, Architektur- und Implementierungsfreigaben sind getrennte Entscheidungen.
