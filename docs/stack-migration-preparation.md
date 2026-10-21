# Migrationsvorbereitung: Prüfungen und Übergabe

Die Vorbereitung gehört zu [Epic #773](https://github.com/iamthamanic/sagatree/issues/773) und [PR #860](https://github.com/iamthamanic/sagatree/pull/860). Sie prüft die unveränderte Quellbasis `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`, stellt ausführbare isolierte Nachweise bereit und dokumentiert die Implementierungsverträge. Sie startet keinen Migration-Runner und erteilt keine Architektur- oder Cutover-Freigabe.

## Quellverträge und Veröffentlichungsgrenze

57 Frontend-RPC-Namen, 24 Edge-Verzeichnisse und 13 Infrastruktur-Bereiche sind aus den Quellen erfasst. Die 57 RPCs verteilen sich exklusiv auf 18 Untertickets. Zusammen mit den 71 vorhandenen Migrationstickets und Atlas #770 enthält der Plan 90 fest zugeordnete Identitäten. Alle bleiben für automatische Ausführung gesperrt.

Der Prep-Check regeneriert TypeScript-Aufrufer, PostgreSQL-Funktionsverträge und Dokumentation, prüft Quellhashes und den Abhängigkeitsgraph und führt 28 gezielte Negativtests aus. Die Veröffentlichung rekonstruiert den kanonischen Plan und bindet Repository, Ticketnummer, Titel, Labels, Dateipfad und Body gemeinsam. Eine passende Body-Prüfsumme allein genügt nicht.

Der Veröffentlichungsstand ist **41/90 synchronisiert, 49 ausstehend**. Die automatische Freigabeprüfung hat das nächste GitHub-Update abgelehnt und verlangt eine ausdrückliche sichtbare Freigabe für die Veröffentlichung der verbleibenden Verträge, des Codes und der Nachweise einschließlich Sicherheitsbefunden im öffentlichen Repository. Die Korrekturen sind lokal vorbereitet; die neue PR-Fassung ist noch nicht veröffentlicht. Die genauen bestätigten Payloads stehen im [Synchronisationsnachweis](../.qa/evidence/stack-migration-prep/github-contract-sync.json).

Voraussetzungen sind die im Projekt verwendete Node-22-Laufzeit oder neuer, installierte npm-Abhängigkeiten sowie Python 3 mit `pglast==7.21`. Ein eigenes Python-Venv ist möglich; mit `STACK_MIGRATION_PYTHON=/absoluter/pfad/venv/bin/python` lässt sich dessen Interpreter wählen.

```bash
npm ci
python3 -m pip install -r .qa/intake/rpc-contracts/parser-requirements.txt
npm run check:stack-migration-prep
npm run test-gate
```

Das vollständige Test-Gate benötigt zusätzlich Deno, wie im Quality-Gates-Workflow eingerichtet. Alle aufrufenden CI-Jobs installieren den Parser ausdrücklich. Ein fehlender Parser ist ein Fehler und führt nicht zum Überspringen der SQL-Prüfung.

Die kanonischen Bodies stehen unter `.qa/design/migration-issues/`. Nach einer beabsichtigten Vertragsänderung erzeugt `node scripts/stack-migration-issue-contracts.mjs --write` die abhängigen Artefakte neu; der anschließende Prep-Check muss vollständig bestehen. Die festgehaltenen 90 Identitäten und die Vorbereitungssperre erfordern eine ausdrückliche Vertragsrevision, wenn sich der autorisierte Umfang ändert.

## Tatsächliche Datenbank und Produktbrowser

Der Harness unter `scripts/stack-migration-db/` startet eine eigene PostgreSQL-Instanz, wendet alle 106 Quellmigrationen unverändert an und verwendet echte GoTrue- und PostgREST-Dienste. Er benötigt keine Zugangsdaten zu einer vorhandenen Datenbank. PostgreSQL läuft unter einer unprivilegierten Benutzerkennung; Container mit ausschließlich UID 0 müssen einen geeigneten Ausführungskontext bereitstellen.

```bash
npm ci --prefix scripts/stack-migration-db
npm test --prefix scripts/stack-migration-db
npm run canary --prefix scripts/stack-migration-db
python3 scripts/stack-migration-db/provision-tools.py
python3 scripts/stack-migration-db/provision-browser.py
ATLAS_ISOLATED_CHROMIUM="$PWD/scripts/stack-migration-db/artifacts/chromium/chrome-headless-shell-linux64/chrome-headless-shell" npm run product --prefix scripts/stack-migration-db
```

Die Provisionierung lädt veröffentlichte Dienste und Browser in den ignorierten Harness-Artefaktpfad. Die ausführliche Anleitung nennt die Pins und Prüfsummen. Raw-Traces und lokale synthetische Zugangsdaten gehören nicht in Git; die veröffentlichten Beobachtungen und Screenshots sind bereinigt.

Der ausgeführte Stand vom 21. Oktober 2026 besteht **16 von 25 SQL-Proben** und **einen von drei Atlas-Browsertests**. Die Suites liefern wegen der reproduzierten Berechtigungs- und Produktfehler einen Fehlerstatus. Der RLS-Canary besteht: Eine tatsächliche Policy-Regression verändert das Ergebnis des betreffenden Negativtests. Diese Resultate sind keine Freigabe sicherer Alt/Neu-Parität.

Die getrennten Jobs in `.github/workflows/stack-migration-baseline.yml` führen Datenbank, Canary und Produktbrowser aus. Es gibt keine Skip-Ausnahme für die bekannten Fehler. Die Existenz eines Workflows konfiguriert allein noch keine Branch-Protection-Regel.

## PoCs und offene Entscheidungen

Die ausführbaren Architekturvergleiche stehen unter `scripts/stack-migration-pocs/`, ihre Messungen und Grenzen unter `.qa/evidence/stack-migration-prep/pocs/`. Sie testen echte Kandidatenbibliotheken und SQLite. Ein bestandener isolierter Fall bestätigt ausschließlich den jeweils beschriebenen Fixture-Scope; Browser-Tokenablage, andere Betriebssysteme und vollständige produktive Last benötigen eigene Nachweise, soweit der jeweilige Bericht sie als offen ausweist.

GATE-01 besteht nach Korrektur der Evidenzprüfung mit je 42 Fällen für Drizzle und ZenStack auf zwei getrennten Node-Versionen sowie je 13 Regressionen für die Berichtsintegrität. GATE-04 besteht im gemessenen Transaktions-/Crash-Umfang. GATE-02 ist wegen JavaScript-lesbarer authentifizierender Tokens im realen Cookie-Browsertest fachlich **FAIL**; `HttpOnly` allein erfüllt in dieser kombinierten Kandidatenkonfiguration die vollständige Credential-Isolation nicht. Die strikten PoC-CI-Schritte müssen fehlgeschlagene Pflichtkriterien mit einem Fehlerstatus melden. Ein gesonderter Diagnosemodus für reproduzierbare Durchführung ist keine Gate-Freigabe.

Der separate GATE-01-Vollaudit meldet außerdem vier High-Pakete in einer betroffenen Dev-/Generator-Abhängigkeitskette sowie ein Low-Advisory. Ohne Dev-Abhängigkeiten meldet er null; DB- und GATE-02/03-Lockfiles melden ebenfalls null. Der [Auditbericht](../.qa/evidence/stack-migration-prep/closeout/dependency-audit.md) hält die genauen Grenzen fest. Der GATE-01-Workflow führt den Vollaudit zusätzlich aus und bleibt bei den bekannten High-Advisories rot.

Die [konkrete Startfolge](../.qa/evidence/stack-migration-prep/START_SEQUENCE.md) beginnt mit Abnahme von Baseline #782 und Inventar #783. Nach der menschlichen GATE-01-Entscheidung #784 kann der neue Host #789 umgesetzt werden. Die späteren Auth-Tickets bleiben zusätzlich an GATE-02 gebunden.

Architekturfreigaben werden durch diese Vorbereitung nicht geschrieben. GATE-05 für den Desktop bleibt hinter Browser-Host-CI und Betrieb zurückgestellt. Produktmigration, Rollout, Beobachtungsfenster und Abschalten des Altstacks bleiben eigene gesperrte Schritte.

## Nachweise

- [Stand und Autorisierungsgrenzen](../.qa/evidence/stack-migration-prep/phase0-status.md)
- [Quellbasis und reproduzierte Blocker](../.qa/evidence/stack-migration-prep/baseline.md)
- [Unabhängiger Review samt erneuten Negativproben](../.qa/evidence/stack-migration-prep/PR860_FINAL_REVIEW.md)
- [GATE-01-Review und ausgeführte Verifierkorrekturen](../.qa/evidence/stack-migration-prep/pocs/GATE01_REVIEW.md)
- [Datenbank-/Browser-Ausführung](../.qa/evidence/stack-migration-prep/parity-fixtures/execution-2026-10-21/README.md)
- [Verbindliche Ticketreihenfolge](../.qa/evidence/stack-migration-prep/dependency-enforcement-plan.md)

Der Nachweis aus einer isolierten Quellinstallation beschreibt keinen unbekannten produktiven Deployment-Zustand. Insbesondere werden abweichende Deploy-Skripte, ACLs oder ausgelassene Migrationen dadurch nicht automatisch geprüft.
