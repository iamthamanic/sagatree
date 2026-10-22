# PR860 – unabhängiger Abschlussreview der Vertragsreparatur

## Aktueller Stand der unabhängigen Nachprüfung – 2026-10-21

**F1–F6 sind nach gezielter unabhängiger Nachprüfung geschlossen. Im unten gebundenen Validator-/Vertrags-Scope verbleibt kein nachgewiesener offener Critical-, High-, Medium- oder Low-Befund.** Die saubere Vergleichskopie besteht den vollständigen Prep-Pfad mit 28/28 Tests; alle vier zuvor erfolgreichen CLI-Umgehungen werden jetzt mit exit 1 zurückgewiesen. Sieben weitere gezielte Abschluss-/Freigabeproben schlagen erwartungsgemäß an. Alle 90 kanonischen Publikations-Payloads stimmen mit den vollständig rekonstruierten Verträgen überein.

Ein im Re-Review zusätzlich nachgewiesener CI-Integrationsfehler **F7 (Medium)** wurde ebenfalls korrigiert: Der bestehende Test-Gate-Job installiert nun den exakt gepinnten Python-Parser, bevor er den erweiterten Prep-Check aufruft. Die lokalen semantischen Prüfungen wurden tatsächlich ausgeführt; ein bereits absolvierter GitHub-Actions-Lauf wird hier nicht behauptet.

Dies ist eine **qualifizierte statische Vertragsnachprüfung mit ausgeführten Negativtests**, keine Gesamt-ACCEPT-, Architektur-, Produkt-, Security-Parity-, Merge- oder Release-Freigabe. Der Plan bleibt bei **90 gesperrten Tickets: 85 blocked, 5 needs-design, 0 ready, 0 done und 0 Architekturfreigaben**. Die realen DB-/Browser-Legacy-Blocker bleiben unverändert bestehen. Root führt die abschließenden übergeordneten Test- und Composition-Gates sowie die Publikationssynchronisierung gesondert durch.

Die folgenden Abschnitte bis „Abgeschlossener Re-Review“ bewahren die **historische erste Reviewrunde einschließlich damaliger Findings, Ergebnisse und Hashes**. Ihre damaligen offenen Zustände werden durch die abschließende Disposition ersetzt, nicht rückwirkend als erfolgreiche Ausführung eines anderen Quellstands dargestellt.

## Erste Reviewrunde: damaliges Urteil und geprüfter Stand

**CHANGES_REQUESTED – statischer Review mit aktiv ausgeführten Umgehungsproben.**

Der erste Abschlussreview fand sechs verbleibende Probleme: drei mit Schwere **High**, drei mit **Medium**. Drei fehlerhafte Vertragszustände bestanden den vollständigen Prep-Check einschließlich aller 20 vorhandenen Regressionstests; der vierte Gesamtpfadfehler liegt im separat aufgerufenen Publish-Payload-Helfer. Weitere Proben zeigten eine Lücke in der reinen Abschluss-/Readiness-Validierung. Der gegenwärtige unveränderte Plan enthält **90 IDs, 0 ready, 85 blocked und 5 needs-design**. Die hart gesperrte Ausgabe des Renderers verhindert derzeit eine normale Ready-Aktivierung, beseitigt aber die beschriebenen Vertrags- und Publikationslücken nicht.

Dieser Bericht erteilt **keine** Architektur-, Produkt-, Security-Parity-, Merge- oder Release-Freigabe. Die Parent-Instanz hat einen übergeordneten Test-Gate-PASS berichtet; dieser Reviewer hat die unten aufgelisteten Prüfungen selbst ausgeführt. Eine vollständige, auf den abschließenden Arbeitsbaum gebundene Composition-/ECC-/Merge-Abnahme ist nicht Bestandteil dieses Berichts.

- Ursprünglicher PR-Bereich: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248..839a8c256f53fc7f3be3375efd127ae07524458f`.
- Reparaturstand: nicht committeter Arbeitsbaum auf HEAD `839a8c256f53fc7f3be3375efd127ae07524458f`; die unten aufgeführten SHA-256-Werte binden die geprüften Dateien der ersten Reviewrunde.
- Intent: technische Reparatur der Migrationsspezifikationen und ihrer Durchsetzung; keine Produktmigration und keine Architekturentscheidung.
- Gelesene Regeln: `AGENTS.md`, Skill `review-ticket`; alle Schweregrade werden berücksichtigt.
- Eigene Änderungen in dieser Reviewrunde: ausschließlich dieser Bericht. Manipulationen wurden an In-memory-Kopien bzw. separaten `/tmp/pr860-final-cli-*`-Fixtures vorgenommen. Keine Produktdatei, SQL-Migration, Issue oder externe Freigabe wurde verändert.

Root wurde vor der Veröffentlichung dieses Berichts über alle sechs Befunde informiert und führt die Korrekturen durch. Eine inzwischen ergänzte `.github/workflows/stack-migration-contracts.yml` ist **noch kein hier nachgeprüfter Fix**; ihr Abschlussstand und die lokale RPC-Kopplung sind im Re-Review zu prüfen.

## Findings der ersten Reviewrunde

| ID | Schwere | Tag | Datei / geprüfte Stelle | Problem und Wirkung | Erforderliche Korrektur |
| --- | --- | --- | --- | --- | --- |
| F1 | **High** | hoare / leaky | `scripts/stack-migration-prep-check.mjs:38–41`; `scripts/stack-migration-contract-validation.mjs:124–136` | RPC-Quellhashes werden geprüft, abgeleitete Signaturen, Rückgaben, Caller und SQL-Extrakte jedoch nicht regeneriert. Eine frei erfundene `get_world_atlas_map`-Overload ersetzt die echte Signatur und der gesamte Prep-Check meldet trotzdem PASS. | Alle vier bestehenden RPC-Driftchecks verbindlich ausführen; Parser exakt pinnen. Lokaler Qualitätscheck und verpflichtender CI-Pfad müssen diese Abdeckung ehrlich benennen. |
| F2 | **High** | hoare | `scripts/stack-migration-contract-validation.mjs:5,26–35`; `scripts/stack-migration-issue-rendering.mjs:18,137` | Die angeblich vollständige Identitätsmenge wird aus gegenseitig veränderbaren JSON-Kopien abgeleitet. Nur zwölf IDs sind unabhängig erforderlich. Nach Entfernen von MIG-501/#842 aus Intake und Registry erzeugt der Renderer einen konsistenten 89-Issue-Plan; MIG-700 verliert diesen Cutover-Vorgänger. Der vollständige Prep-Check bleibt grün. | Alle 90 erwarteten lokalen IDs und ihre veröffentlichte GitHub-Identität aus einer überprüften kanonischen Konstante bzw. expliziten, überprüfbaren Registry-Version erzwingen. Sowohl koordinierte Löschung als auch Ersetzen/Umbenennen müssen scheitern. |
| F3 | **High** | hoare / seclv | `scripts/stack-migration-publish-payload.mjs:8–14` | Der Payload-Helfer prüft ausschließlich den Bodyhash. Repository, Issue-Identität, Titel und insbesondere Runner-Labels sind nicht an den geprüften Plan gebunden. Eine alleinige Änderung `agent-blocked → agent-ready` im Manifest wird mit exit 0 ausgegeben, während der Body weiterhin `blocked` enthält. Damit kann die ausführungsrelevante Metadaten-Sperre an der Publikationsgrenze verloren gehen. | Vor Ausgabe die vollständige Payload aus kanonischen Verträgen rekonstruieren und alle Felder vergleichen; Labels/Identität/Repository/Titel/Body gemeinsam binden. Der Helfer darf Metadatendrift nicht erst einem früheren Prep-Lauf überlassen. |
| F4 | **Medium** | hoare | `scripts/stack-migration-contract-validation.mjs:97–105`; `scripts/stack-migration-issue-contracts.mjs:47`; `scripts/stack-migration-prep-check.mjs:42` | Architekturentscheidungen werden ausschließlich beim Prüfen der Vorfahren eines ready-Issues validiert. Bei 0 ready akzeptiert der Gesamtcheck `GATE-01: APPROVED, actorType: agent`, eine ungültige Quell-URL und ein nicht existentes Evidence-File. Er druckt sogar weiterhin `architecture-approved=0`. | Die gesamte Approval-Datei unabhängig vom Nachfolgerstatus validieren: bekannte Gates, zulässige Zustände, tatsächliche menschliche Entscheidungsprovenienz und passende vorhandene Nachweise. Zähler aus geprüftem Zustand ableiten bzw. im aktuellen Vorbereitungsmodus jedes unerlaubte APPROVED ablehnen. |
| F5 | **Medium** | hoare | `scripts/stack-migration-contract-validation.mjs:96,100–107` | `completionEvidence` muss lediglich nichtleerer Text sein. Ein Issue kann trotz offener Vorgänger und mit einem nicht existenten Dateipfad als done gelten. Markiert man 13 Vorfahren auf diese Weise done und ergänzt textuelle Human-Claims mit `sourceUrl: not-a-url` und `evidenceFile: AGENTS.md`, akzeptiert der reine Validator MIG-301 als ready. | Abschlussnachweise müssen existieren und strukturiert zum betreffenden Issue, geprüften Stand und Ergebnis gehören; done und ready müssen transitive Voraussetzungen, offene Verifikationsblocker sowie erforderliche Freigaben konsistent prüfen. |
| F6 | **Medium** | parnas / leaky | `scripts/stack-migration-issue-rendering.mjs:72–87`, besonders 83 | Die Edge-Verzweigung ignoriert die vollständig inventarisierten `edge.dependencies` und verwendet nur Frontend-RPC-Namenslookups plus einzelne Sonderfälle. Dadurch fehlen transitive Pflichtkanten für acht Edge-Tickets. Besonders `session-recap` verliert `sagatree_upsert_session_recap`, weil der interne Helper kein Name der 57 Frontend-RPCs ist und durch `filter(Boolean)` verschwindet. | Deklarierte Abhängigkeiten nach Art auflösen und unbekannte Ziele als Fehler behandeln. Für interne Helper einen konkreten Besitzer bzw. eine begründete Same-Issue-Zuordnung festlegen. Tabellen-/Policy-/Asset-Vorgänger dürfen nicht still verschwinden. |

**Critical:** kein zusätzlicher Critical-Befund im geprüften Validator-/Vertrags-Scope. Die zuvor im echten DB-Harness reproduzierten Critical-Legacy-Defekte bleiben separate Produktblocker.

**Low:** kein zusätzlicher unabhängiger Low-Codefehler nachgewiesen. Die folgenden Info-Punkte sind bewusste Nachweisgrenzen, keine ausgelassenen Findings.

## Aktive Umgehungsproben

### Vollständiger CLI-Pfad

Die Probe erzeugte separate Arbeitskopien der schreibbaren Vertragsartefakte. Produktquellen und nicht betroffene Daten wurden nur gelesen. Der vollständige Ausgabebericht liegt in dieser Sitzung unter `/tmp/pr860-final-cli-4czcy0d5/results.json`, der reproduzierbare Fixture-Erzeuger unter `/tmp/pr860-full-cli-probes.py`. Die nachstehenden Mutation und Befehle beschreiben jeden Test vollständig genug für eine gezielte Regression.

| Fall | Mutation in der isolierten Kopie | Ausführung | Tatsächliches Ergebnis vor Korrektur |
| --- | --- | --- | --- |
| `rpc-overload-drift` | Nur `rpcs[get_world_atlas_map].overloads` in RPC-Inventar ersetzen durch `[{identityArguments: "p_fixture_wrong text", returns: {type: "text"}, securityDefiner: false}]`; echte SQL-Hashes behalten | `node scripts/stack-migration-prep-check.mjs` | **exit 0**, 20/20 Tests und Prep-PASS mit 90 Verträgen |
| `agent-approval` | `decisions.GATE-01 = {status: "APPROVED", actorType: "agent", actor: "fixture-agent", sourceUrl: "not-a-url", evidenceFile: "nonexistent"}` | Derselbe Prep-Check | **exit 0**, 20/20 Tests; Ausgabe `architecture-approved=0` |
| `delete-mig-501` | MIG-501 aus `intake.issues` und `registry.issues` löschen | `node scripts/stack-migration-issue-contracts.mjs --write`, danach Prep-Check | Beide **exit 0**; **89** Verträge und kein MIG-501-Vorgänger in MIG-700 |
| `publish-label-tamper` | Im Publish-Manifest für #782 nur `agent-blocked` entfernen und `agent-ready` ergänzen; Body und Bodyhash unverändert | `node scripts/stack-migration-publish-payload.mjs 782` | **exit 0**; Payload enthält `agent-ready`, Body weiterhin `Status: **blocked**` |

Der Publisher-PoC sendete **keine** GitHub-Anfrage. Der Befund betrifft den vor dem Senden erzeugten Payload.

### Reiner Validator und Schutz durch den Renderer

Zusätzliche In-memory-Proben stehen unter `/tmp/pr860-validator-probes.mjs` und `/tmp/pr860-validator-probes.json`.

- `MIG-301.status = done` mit `completionEvidence = .qa/does-not-exist-completion.md`, synchronisierten Statuskopien und weiterhin blockierten Vorfahren: **errors = []**.
- Sämtliche 13 Vorfahren von MIG-301 auf dieselbe Weise done, Human-Claims mit ungültiger URL und `AGENTS.md` als beliebigem Evidence-File, MIG-301 ready: **errors = []**.
- Den gesamten `verification.sourceFiles`-Block eines RPC durch ausschließlich den gültigen SHA-256 von `AGENTS.md` ersetzen: **errors = []**. Das belegt, dass ein nichtleerer Fingerprint-Satz ohne erneute Extraktion keine fachliche Quellenbindung garantiert.

**Wichtige Begrenzung von F5:** Der gegenwärtige Renderer setzt alle Nicht-Gates hart auf blocked und alle Gates auf needs-design. Ein normaler vollständiger Render-Driftcheck würde den manipulierten done-/ready-Plan deswegen zusätzlich zurückweisen. Der hier nachgewiesene F5-Fehler betrifft den ausdrücklich als generische Readiness-Prüfung angebotenen Validator und seine spätere Verwendung, nicht eine gegenwärtig erfolgreiche Aktivierung durch den Gesamtcheck. F2, F4 und die RPC-Signaturmutation haben den vollständigen Gesamtcheck dagegen tatsächlich bestanden.

## Exakte Prüfung der fehlenden Edge-Abhängigkeiten

Folgende read-only Query vergleicht jede deklarierte Inventory-Kante mit der gesamten Vorfahrenmenge des kanonischen Plans. Same-Issue-Voraussetzungen werden ausdrücklich nicht als fehlende Vorgänger gezählt.

```python
import json
from pathlib import Path

intake = json.loads(Path('.qa/intake/local-first-stack-migration-issues.json').read_text())
edge = json.loads(Path('.qa/intake/edge-infra-contracts/inventory.json').read_text())
by_id = {i['localId']: i for i in intake['issues']}
by_number = {i['githubIssue']: i for i in intake['issues']}

def ancestors(issue, seen=None):
    seen = set() if seen is None else seen
    for dep in issue['dependsOn']:
        if dep not in seen:
            seen.add(dep)
            ancestors(by_id[dep], seen)
    return seen

for row in edge['edges']:
    target = by_number[row['implementationIssue']]
    prior = ancestors(target)
    missing = []
    for dep in row.get('dependencies', []):
        owner = by_number.get(dep.get('issueNumber'))
        if owner and owner['localId'] != target['localId'] and owner['localId'] not in prior:
            missing.append((dep['kind'], dep['name'], owner['localId'], owner['githubIssue']))
    if missing:
        print(target['localId'], row['function'], missing)
```

Ergebnis vor Korrektur:

| Edge-Ticket | Nicht transitiv vorhandene deklarierte Voraussetzung |
| --- | --- |
| MIG-401 `ai-gm` | MIG-012 für `project_members`, `sessions` |
| MIG-402 `ai-provider-credentials` | MIG-012 für `user_ai_provider_credentials` |
| MIG-404 `character-avatar-meshy` | MIG-012 für Jobs, `characters`, Credentials |
| MIG-405 `character-lore` | MIG-012 für Memberships, `projects`, `worlds` |
| MIG-409 `item-model3d` | MIG-012 für Definitionen, Jobs/Assets, Credentials und `world_profiles` |
| MIG-410 `item-thumbnail` | MIG-012 für Definitionen, Jobs/Assets, Credentials und `world_profiles` |
| MIG-420 `session-media-token` | MIG-012 für Memberships und Sessions |
| MIG-421 `session-recap` | MIG-012 für Projekte/Recaps/Sessions sowie der deklarierte Besitzer MIG-351/#814 von `sagatree_upsert_session_recap` |

Eine Korrektur darf die interne Helper-Zuordnung präziser auf `RPC-SESSION-RECAP` oder einen belegten zuständigen Port legen. Sie muss dabei auch den Quellvertrag/Inventory-Besitzer aktualisieren; ein bloßer zusätzlicher Coordinator-Pfeil ist nicht zwingend die beste Grenze. Gegenseitige Infra-Imports als `integrationWith` zu führen ist demgegenüber nachvollziehbar: die Ports und spätere gemeinsame Integrationsabnahme sind ausdrücklich dokumentiert, und ein gegenseitiges Startverbot wäre ein Zyklus.

## Erneute Bewertung der ursprünglichen zehn Befunde

| Ursprünglicher Gegenstand | Abschlussstand dieser Runde | Beleg / Restgrenze |
| --- | --- | --- |
| R1: Owner und GM bei Atlas-Schreibrechten verwechselt | **Korrigiert** | GATE-01 beschreibt getrennte Accounts O/G, erlaubt Owner-Mutation ohne GM und verweigert GM-Weltbearbeitung ohne Ownership. Passt zum Owner-Guard aus Migration 015 und zu den echten DB-Proben. |
| R2: nicht mehr gültige Atlas-RPC-Überladung | **Inhaltlich korrigiert** | Neue PostgreSQL-AST-Verträge enthalten aktuelle Signaturen und entfernte Overloads. Eigener Katalogcheck bestätigt 177 exakte Funktionen. Der fehlende fortlaufende Driftcheck ist F1. |
| R3: ready trotz blockierter Vorfahren | **Kernfall korrigiert; Abschlussprovenienz unvollständig** | Der vorhandene transitive Negativtest schlägt korrekt an; 0 Tickets sind ready. F4/F5 betreffen falsche Abschluss-/Approval-Nachweise. |
| R4: Sonderausnahme für MIG-002 | **Korrigiert** | `MIG-002 ready` bei nicht abgeschlossenem MIG-001 wird explizit verworfen. |
| R5: leeres Objekt erfüllt Pflichttext | **Korrigiert** | Nichtleere Strings statt Truthiness; `{}` und Whitespace werden abgewiesen. |
| R6: Backticks adeln generischen Acceptance-Text | **Korrigierter nachgewiesener Fall** | Der konkrete Boilerplate-/Backtick-Regressionstest besteht; strukturierte Given/When/Then mit Quellen sind erforderlich. Fachliche Richtigkeit bleibt manuelle Reviewaufgabe. |
| R7: vollständiges Issue kann aus Prüfung verschwinden | **Nur teilweise korrigiert** | Einfache Löschung und zwölf obligatorische IDs werden erkannt. Koordinierte Löschung von MIG-501 besteht weiter den gesamten Check: F2. |
| R8: negative GitHub-Issue-Nummern | **Korrigiert** | Positive, eindeutige sichere Ganzzahlen und Kopienabgleich; synchron manipulierte negative Zahl wird erkannt. F2 ergänzt die unveränderliche Identitätsmenge. |
| R9: veralteter JSON-Qualitätsaudit trotz MD-Korrektur | **Korrigiert** | JSON/MD-Audit und Bodies werden aus demselben Renderer verglichen; 0 Implementierungsabnahmen werden behauptet. Approval-Zähler müssen zusätzlich F4 berücksichtigen. |
| R10: unvollständige Edge-Zählung / Dispatcher-Grenze | **Korrigiert** | 24 verschiedene Einträge: acht eingebundene Worker, 15 nicht eingebundene Legacy-Worker und ein Dispatcher. Beide Edge-Driftchecks laufen im Prep-Pfad. F6 betrifft verlorene Abhängigkeiten, nicht diese Zählung. |

## Selbst ausgeführte positive Prüfungen

| Befehl | Ergebnis | Nachweisgrenze |
| --- | --- | --- |
| `node scripts/stack-migration-contract-validation.test.mjs` | **20/20 PASS** | Bestehende Regressionen; die neuen Umgehungen fehlten in dieser Suite |
| `node scripts/stack-migration-prep-check.mjs` | **exit 0**; 101 Artefakte, 90 Issues, 57 RPC, 24 Edge, 13 Infra, 90 gesperrt | Vertraglicher Struktur-/Driftcheck des unveränderten Reviewstands |
| `node scripts/stack-migration-rpc-callers.mjs --check` | **exit 0**; 57 Namen, 57 aufgelöste Varianten, 0 dynamisch/unmapped | Tatsächlich geprüfte aktuelle Frontend-Aufrufabdeckung |
| `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/tmp/sagatree-rpc-py python3 scripts/stack-migration-rpc-verify-postgres.py --check` | **exit 0**; 177 Body-/Signatur-/Default-/Result-/Security-Matches | Abgleich gegen gespeicherten echten isolierten PostgreSQL-Katalog; kein Produktiv-DB-Zugriff |
| Derselbe Python-Kontext mit `stack-migration-rpc-extract.py --check` | **exit 0**; 57 RPC-Verträge, 149 effektive relevante Funktionen, 0 Parserfehler | Aus Quellcode reproduzierte RPC-Verträge |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/stack-migration-rpc-docs.py --check` | **exit 0**; 57 Dokumente und 18 verlinkte Splits | Dokumentation stimmt mit maschinenlesbaren Verträgen überein |
| `node scripts/stack-migration-pocs/gate-04/check.mjs --check` | **exit 0**; 9 Pflichtzeilen und 18 Fälle PASS; NOT APPROVED | Unabhängig erneut ausgeführte SQLite-Speicher-Fixture |

## RPC-CI: sachlich notwendiger Umfang

Die vier RPC-Checks waren im geprüften Anfangsstand weder in `package.json`, `.github/workflows` noch im Prep-Check verdrahtet. F1 beweist, dass der vorhandene Dateihashcheck diese Lücke nicht ersetzt.

Die vorhandenen Tools lassen sich ohne laufenden PostgreSQL-Server in CI betreiben:

1. `stack-migration-rpc-callers.mjs --check`: Node plus vorhandene TypeScript-Abhängigkeit.
2. `stack-migration-rpc-verify-postgres.py --check`: `pglast==7.21` und gebundener gespeicherter Katalogbeweis.
3. `stack-migration-rpc-extract.py --check`: derselbe Parser sowie Caller-/Semantik-/Katalogartefakte.
4. `stack-migration-rpc-docs.py --check`: Python-Standardbibliothek und generierte Artefakte.

Alle vier müssen ohne automatische Regeneration im Prüfmodus laufen. Ein dedizierter Job mit gepinntem Parser ist geeignet; eine lokale Prüfung soll dieselben Befehle verwenden oder ihren engeren Scope ausdrücklich kennzeichnen. Das ist Quellen-Driftprüfung, kein Ersatz für den echten DB-/Browser-Job und keine Branch-Protection-Konfiguration.

## GATE-04: zusätzlicher unabhängiger Quellenreview

Gelesen wurden `store.mjs`, `writer.mjs` und sämtliche 526 Zeilen von `check.mjs` sowie Report und beide READMEs. Der eigene Lauf verwendete Node `v24.19.0` und SQLite `3.53.3`; 1000 logische Commands wurden im gemischten 20×50-Lastfall bestätigt. Alle neun Pflichtzeilen und 18 Fälle bestanden. Gemessener Durchsatz dieses Reviewlaufs: ungefähr **933,647 Commands/s**; dies ist keine Kapazitätsfreigabe.

Die folgenden Eigenschaften sind durch Code und erneute Ausführung nachvollziehbar:

- `BEGIN IMMEDIATE` umfasst Zustand, Revision, Event und gespeichertes Idempotenz-Ergebnis.
- Actor-/Membership-Prüfung erfolgt erneut innerhalb der Transaktion, vor dem Replay-Lookup.
- Replay ist sessiongebunden, actor-/payloadgebunden und byte-stabil; aktuelle Revision ist bewusst Retry-Metadatum.
- Reply und Notification folgen dem tatsächlichen Commit; an fünf präzisen Grenzen wird der konkrete Writer-Kindprozess mit SIGKILL beendet.
- Die unabhängige relationale Prüfung vergleicht Tabellen, Event-Faltung und einen separat erzeugten 1000-Key-Ledger.
- Die Canary-Fixture committet absichtlich nur State vorzeitig; der normale Audit findet exakt die drei erwarteten Inkonsistenzen.

**Kein zusätzlicher falscher PASS in diesem eingeschränkten Scope festgestellt.** Die dokumentierten Grenzen sind wesentlich und bleiben bestehen: synthetische Token/Membership-Fixture, vereinfachte `adjust`-Operation, kein vollständiger Product-RPC-Port, keine 20 Maschinen, keine Power-Loss-/Disk-Full-Prüfung und keine garantierte Realtime-Auslieferung. Der stärkere Ziel-Replayvertrag weicht ausdrücklich vom aktuellen SQL ab und benötigt eine Entscheidung. Der beobachtete Fixture-PASS führt weder zu APPROVED noch zu Produktions-Parität.

## Info / Scope-Grenzen

- **Info I1:** 0 ready ist im aktuellen Vorbereitungsauftrag beabsichtigt. Evidence-Aufbau und Source-Verifikation berechtigen nicht zur Aktivierung des Migration-Runners.
- **Info I2:** Der Reviewer ist Autor des gesonderten DB-/Produkt-Harness. Dessen Implementierung wird hier nicht als eigene unabhängige Codefreigabe ausgegeben; der aktuelle Review-Scope liegt außerhalb dieser Dateien. GATE-04 stammt von einem anderen Agenten und wurde hier unabhängig gelesen/ausgeführt.
- **Info I3:** Publikationssynchronisierung ist laut Parent bis zur Metadatenkorrektur pausiert. Dieser Bericht behauptet keinen vollständigen GitHub-Readback der neuen Bodies/Labels. Ein solcher Readback muss exakt den endgültigen Payload-Stand betreffen.
- **Info I4:** Ein nachträglich bearbeiteter Validator oder Workflow benötigt erneute gezielte Proben. Die initialen Hashes unten dürfen nicht als Ausführung eines späteren Standes umgedeutet werden.

## Quellenbindung der ersten Reviewrunde

Die folgenden Hashes stammen aus der separat gesicherten CLI-Reviewkopie. Zeilenverweise im Findings-Abschnitt beziehen sich auf diesen Stand. Das Repository-HEAD allein bindet den uncommitteten Reparaturstand nicht.

| Datei | SHA-256 |
| --- | --- |
| `scripts/stack-migration-contract-validation.mjs` | `12a6b36318eaf745853b05558a1cc6029bf7da491b9f2f694151a333ec3d00d9` |
| `scripts/stack-migration-contract-validation.test.mjs` | `6428b73db481d1101161738013f1f30fc20e4f59ab41a8685133fd510d4dfad4` |
| `scripts/stack-migration-issue-rendering.mjs` | `b8f9abf38563de732013cc5e3c31d736f4f9fc4b442994bf58d09aed7fea19f8` |
| `scripts/stack-migration-plan-contracts.mjs` | `aa6294bebf542007c7660c593afded9283005242af5fbc0f8e9e6ec3273af569` |
| `scripts/stack-migration-issue-contracts.mjs` | `df88f3f54f2e9dcb5eeb442c2a81078c3fdf1f6a8067eb5a0101356d9a229e83` |
| `scripts/stack-migration-publish-payload.mjs` | `8801fd78259d1dcc2ba581271471bb8d6d8115c0e1beee2a7a6994fa91ccf857` |
| `scripts/stack-migration-prep-check.mjs` | `a6846db3fa4b20ecc0be37675eb8a9bab61170ae22407aaecb1b717b5b3bfb3a` |
| `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md` | `8aadeb6402a280af24c3e6fc5084d70f5e781fbc52d8ffca6b547f4082b57678` |
| `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md` | `ace8265d2231a4b4fed7c82e838a140ff493491768498c5cd06852a37eeb3fca` |
| `.qa/intake/local-first-stack-migration-issues.json` | `43fb4144ecf6816ffdf956d818af2a57ab694bdf247ecf7bfc11ba929947ba78` |
| `.qa/evidence/stack-migration-prep/published-issue-registry.json` | `a65fd4efb2e1c03c6a422d0dec858db482cbd58a359e3bd1e7b236aa43ef4461` |
| `.qa/evidence/stack-migration-prep/dependency-enforcement-plan.json` | `7c486f72f44ed493d36e063b5e79be4bef929d37420848f250608ab917676af3` |

## Abgeschlossener Re-Review

### Disposition sämtlicher Befunde

| ID | Schwere | Disposition | Unabhängiger Nachweis |
| --- | --- | --- | --- |
| F1 | High | **Geschlossen** | Prep ruft Caller-, PostgreSQL-Katalog-, Extraktions- und Dokumentationscheck im Prüfmodus auf. Saubere Kopie PASS; erfundene Atlas-Überladung scheitert ausdrücklich an `Generated source contract is stale: .qa/intake/rpc-contracts/inventory.json`, exit 1. |
| F2 | High | **Geschlossen** | `stack-migration-identities.mjs` pinnt alle 90 lokalen IDs, ihre positiven GitHub-Nummern sowie das Repository. Koordinierte Entfernung von MIG-501 scheitert bereits beim Regenerieren und danach erneut im Prep-Check. Die bestehende zusätzliche Regression für übereinstimmend umgebogene positive Nummern besteht. |
| F3 | High | **Geschlossen** | Publisher rekonstruiert alle 90 Verträge im eigenen Prozess und vergleicht das vollständige Manifest samt Repository, Identität, Titel, Labels, Body und Payloadhash. Isolierte Labelmutation scheitert mit exit 1. Alle 90 unveränderten kanonischen Payloads wurden zusätzlich einzeln gegen den Renderer geprüft und akzeptiert. |
| F4 | Medium | **Geschlossen** | Approval-Daten werden unabhängig von Readiness geprüft. `preparationAuthority.architectureApproval = false` verwirft jedes APPROVED in dieser Vorbereitung; falscher Agent-/Human-Claim und ungültige Provenienz können das nicht übersteuern. Derselbe vollständige Agent-Approval-PoC endet jetzt exit 1. |
| F5 | Medium | **Geschlossen** | done verlangt eine vorhandene strukturierte Issue-/Commit-/PASS-Proofdatei mit gehashten Prüfausgaben. done und ready prüfen transitive Vorgänger und Blocker. Sieben eigene Proben decken fehlende Datei, fremden Prosatext, falsche Issue-Bindung, falschen Ausgabehash, offene Blocker, eigenes Gate ohne Approval sowie strukturell gültigen Proof bei 13 weiterhin blockierten Vorfahren ab. Alle werden erkannt. |
| F6 | Medium | **Geschlossen** | Neuer Resolver verarbeitet alle inventarisierten Arten und wirft bei unbekannten Zielen einen Fehler. Eine zusätzliche unabhängige Query über 24 Edge- und 13 Infra-Zeilen findet 0 fehlende Pflichtvorgänger; Integration-Peers und selbst besessene Voraussetzungen stimmen ebenfalls überein. MIG-421 besitzt jetzt RPC-SESSION-RECAP/#870 und MIG-012 als echte Vorgänger sowie seinen expliziten Quota-Helper. |
| F7 | Medium | **Im Re-Review entdeckt und geschlossen** | `scripts/test-gate.mjs` ruft Prep auf; der bestehende `verify.yml`-Job hatte zunächst kein pglast installiert. Sauber isoliertes Python reproduzierte den fehlenden Parser. Root ergänzte Python 3.12 plus Installation aus der gepinnten Requirements-Datei vor dem Test-Gate. Beide betreffenden Workflows wurden danach gelesen und als YAML geparst. |

Die ursprünglichen R1–R10 sind damit im jeweils nachgewiesenen Umfang erledigt. Bei R2 ist nun auch die fortlaufende semantische Driftprüfung vorhanden; R3 erhält die fehlende Abschluss-/Approval-Provenienz; R7 die unabhängig gepinnte vollständige Identitätsmenge. Die Owner-/GM-Korrektur von GATE-01 bleibt bestätigt. Der nachträglich entwickelte neue GATE-01-Engine-PoC wurde in dieser Runde nicht vollständig unabhängig gelesen; sein Ergebnis wird hier nicht als eigene Prüfung ausgegeben.

### Tatsächlich ausgeführte Proben des korrigierten Stands

Der Reproduktions-Generator `/tmp/pr860-rereview-cli-probes.py` kopiert die betroffenen RPC-Parser und JavaScript-Dateien wirklich in die isolierten Fixtures. Damit verweist Pythons aufgelöster `__file__` auf die jeweilige manipulierte Kopie. Ein versehentlicher Test des unveränderten Originalinventars über einen Symlink wird so vermieden. Die unveränderte Kontrolle und vier Angriffe sind unter `/tmp/pr860-rereview-cli-wko4xmgf/results.json` vollständig protokolliert.

| Probe | Ergebnis |
| --- | --- |
| Saubere vollständige CLI-Kopie | exit 0; 101 Artefakte / 90 Verträge; alle vier RPC-Checks; 57 Caller/Verträge; 177 exakte PostgreSQL-Funktionsmatches; 149 relevante Funktionen; 0 Parserfehler; 24 Edge / 13 Infra; 28/28 Tests, 0 Skip |
| `rpc-overload-drift` | exit 1; fachliche Extraktionsdrift an manipuliertem Inventar erkannt |
| `agent-approval` | exit 1; nicht autorisierte Architekturfreigabe und unzureichende menschliche Provenienz erkannt |
| `delete-mig-501` | Regenerator exit 1; Prep exit 1; feste 90er-Identität und fehlender Vorgänger erkannt |
| `publish-label-tamper` | exit 1; vollständiges Manifest weicht vom rekonstruierten Vertrag ab |
| Sieben zusätzliche In-memory-Proben | 7/7 erwartete Negativfälle erkannt; keine Abnahmeartefakte in den echten Plan geschrieben |
| Alle kanonischen Publikations-Payloads | 90/90 gegen `validatePublicationEntry` und gerenderten vollständigen Body akzeptiert |
| Unabhängige normalisierte Dependency-Query | 37/37 Zeilen; 0 fehlende Vorgänger; Peers und eigene Helper vollständig |
| YAML-Struktur | `verify.yml`: 3 Jobs; `stack-migration-contracts.yml`: 1 Job; `stack-migration-baseline.yml`: 3 Jobs; alle parsebar |

Der vollständige Prep-Check wurde außerdem direkt im Repository nach der letzten Ergänzung der done-Vorfahrenprüfung ausgeführt:

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/tmp/sagatree-rpc-py node scripts/stack-migration-prep-check.mjs
```

Ergebnis: **exit 0, 28/28 Tests, 0 übersprungen, 90 gesperrte Verträge und 0 Architekturfreigaben**. Die sieben Zusatzproben stehen in `/tmp/pr860-rereview-evidence.mjs` und `/tmp/pr860-rereview-evidence.json`. Ihr virtueller, formal gültiger Completion-Proof ist ausdrücklich synthetische Testeingabe. Er wurde weder als reale Abnahme gespeichert noch zur Aktivierung verwendet. Seine Ablehnung wegen der 13 offenen Vorgänger prüft genau die letzte, nach dem früheren Root-Lauf ergänzte Abwehr.

### Präzise unabhängige Dependency-Query nach Korrektur

Die folgende Query importiert den Implementierungs-Resolver nicht. Sie löst Frontend-RPCs ausschließlich auf ihre 18 konkreten `RPC-*`-Kinder auf; die vier Coordinator-Tickets sind keine zweiten Implementierungsbesitzer. Die dokumentierte interne Recap-Helper-Zuordnung wird explizit normalisiert. Die ursprüngliche rein nummernbasierte Query würde dessen alte Coordinator-Nummer #814 weiterhin als fehlend ausgeben, obwohl jetzt der spezifische Besitzer #870 korrekt vorausgesetzt wird. Dieses rohe Ergebnis ist kein weiterhin offener F6.

```python
import json
from pathlib import Path

intake = json.loads(Path('.qa/intake/local-first-stack-migration-issues.json').read_text())
inventory = json.loads(Path('.qa/intake/edge-infra-contracts/inventory.json').read_text())
by_id = {item['localId']: item for item in intake['issues']}
by_number = {item['githubIssue']: item for item in intake['issues']}
rpc_owner = {name: item['localId'] for item in intake['issues'] if item['localId'].startswith('RPC-') for name in item.get('rpcNames', [])}
rpc_owner['sagatree_upsert_session_recap'] = 'RPC-SESSION-RECAP'
edge_owner = {row['function']: by_number[row['implementationIssue']]['localId'] for row in inventory['edges']}

def ancestors(local_id, seen=None):
    seen = set() if seen is None else seen
    for dependency in by_id[local_id]['dependsOn']:
        assert dependency in by_id, dependency
        if dependency not in seen:
            seen.add(dependency)
            ancestors(dependency, seen)
    return seen

checked = 0
for row in inventory['edges'] + inventory['infrastructure']:
    issue = by_number[row['implementationIssue']]
    local_id, prior = issue['localId'], ancestors(issue['localId'])
    hard, peers, owned = set(), set(), set()
    for dependency in row['dependencies']:
        kind, name = dependency['kind'], dependency['name']
        if kind == 'rpc':
            hard.add(rpc_owner[name])
        elif kind == 'internal-rpc':
            owner = by_number[dependency['issueNumber']]['localId']
            if owner == local_id:
                assert dependency['scope'].strip()
                owned.add(name)
            else:
                hard.add(owner)
        elif kind == 'infra':
            owner = by_number[dependency['issueNumber']]['localId']
            if owner != local_id:
                peers.add(owner)
        else:
            assert kind in {'table', 'storage', 'auth', 'http-host', 'realtime', 'edge'}, kind
            owner = by_number[dependency['issueNumber']]['localId']
            if kind == 'edge':
                assert owner == edge_owner[name]
            hard.add(owner)
            if kind == 'table':
                hard.add(by_number[dependency['policyIssueNumber']]['localId'])
    for name in row.get('rpcUsed', []):
        if name not in owned:
            hard.add(rpc_owner[name])
    hard.update(edge_owner[name] for name in row.get('edgeInvokes', []))
    assert local_id not in hard, (local_id, 'self dependency')
    assert hard <= prior, (local_id, 'missing ancestors', hard - prior)
    assert peers == set(issue.get('integrationWith', [])), (local_id, 'integration peers')
    assert owned == set(issue.get('ownedPrerequisites', [])), (local_id, 'owned prerequisites')
    checked += 1
print(json.dumps({'rows_checked': checked, 'missing_dependencies': 0,
                  'recap_owner': rpc_owner['sagatree_upsert_session_recap'],
                  'recap_depends_on': by_id['MIG-421']['dependsOn'],
                  'recap_owned': by_id['MIG-421']['ownedPrerequisites']}, indent=2))
```

Tatsächliche Ausgabe: `rows_checked: 37`, `missing_dependencies: 0`. MIG-421 hängt von `MIG-020`, `MIG-013`, `MIG-014`, `RPC-SESSION-RECAP` und `MIG-012` ab. `consume_session_recap_rate_limit` ist als eigene, im selben Issue umzusetzende Voraussetzung festgehalten.

### TypeScript-Prüfung der neuen DB-Browser-Fixture

Die beiden neuen TypeScript-Dateien wurden ausdrücklich und unabhängig von der auf getrackte Dateien begrenzten allgemeinen Dateiauswahl geprüft:

```sh
node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types node --skipLibCheck scripts/stack-migration-db/atlas-product.spec.ts scripts/stack-migration-db/product-playwright.config.ts
```

**TypeScript 5.8.3: exit 0.** `--skipLibCheck` überspringt die erneute Prüfung fremder Deklarationsdateien; die beiden angegebenen eigenen Dateien werden unter `--strict` geprüft. Keine Quelländerung war nötig. Ihre unten aufgeführten Hashes stimmen weiterhin mit der ausgeführten DB-/Produkt-Evidence überein; die frühere Laufversion wurde nicht nachträglich ersetzt. Dieser Typcheck verwandelt die weiterhin bekannten zwei Produkt-Testfehler und neun strikten DB-Sicherheits-/Semantikfehler nicht in PASS.

### Quellenbindung des korrigierten Re-Review-Stands

Die neun geprüften JavaScript-Quelldateien und die Vertragsdaten wurden beim Abschluss mit den tatsächlich getesteten sauberen CLI-Kopien verglichen: byteidentisch. Workflow-Hashes binden den danach gelesenen und geparsten CI-Stand; sie behaupten keinen bereits erfolgten GitHub-Actions-Lauf. Die ursprünglichen Hashes weiter oben bleiben die Quellenbindung der ersten Reviewrunde.

| Datei | SHA-256 |
| --- | --- |
| `scripts/stack-migration-contract-validation.mjs` | `1aa1dbdd0cb96cd3624f68ae9130216bcab8d43b976eb2f0d657293c1f08a25f` |
| `scripts/stack-migration-contract-validation.test.mjs` | `c3ae8c90885da90cd64a5089c0a1a92b66850f819d38e41a5147afacd7c44daa` |
| `scripts/stack-migration-issue-rendering.mjs` | `9191b0d9e653b6194abf923edb02861ce2a8660ed238d5f3ae7ae01c8dadd970` |
| `scripts/stack-migration-plan-contracts.mjs` | `aa6294bebf542007c7660c593afded9283005242af5fbc0f8e9e6ec3273af569` |
| `scripts/stack-migration-issue-contracts.mjs` | `d4d1d4ef1ee0bcffc50bedea408ef679d94e944e424c45a9bcdc78fb9f7cb7da` |
| `scripts/stack-migration-publish-payload.mjs` | `9a5172f2f84fcbb5b3db4f788a41587e2500e5d3f2a316d98ac1133c5ea49bd1` |
| `scripts/stack-migration-prep-check.mjs` | `f168430d198d6dfc59bde1c8fe39cf983091aeea360b82da3834609db8a50818` |
| `scripts/stack-migration-identities.mjs` | `153186b932bb04870bbe5a564614f9a0986d70720bf7e2cee470c0a01d2d3678` |
| `scripts/stack-migration-dependencies.mjs` | `8df64a6afe69ecb21ef05d8d27097c71757646a4b3e607b8e5349ed662c1fc64` |
| `.github/workflows/verify.yml` | `3a60661d8ce714ef3f20a9a24d388446ac251f48a8be2f1e6ba6aab3e2347ae6` |
| `.github/workflows/stack-migration-contracts.yml` | `41758a5e8b5fe48cbc612305de9158812bf17fe39b4238938f2b0a8cb99fdeed` |
| `.qa/intake/rpc-contracts/parser-requirements.txt` | `a23a906b3f5ff410a3759c39825bba488e455aec29afd41c0124b8e883b4e384` |
| `.qa/intake/local-first-stack-migration-issues.json` | `9d65cf4d32f38a12d49edea82746d61b4cdbf31fb80c534e3dcf3bc5d978dcf6` |
| `.qa/evidence/stack-migration-prep/published-issue-registry.json` | `a65fd4efb2e1c03c6a422d0dec858db482cbd58a359e3bd1e7b236aa43ef4461` |
| `.qa/evidence/stack-migration-prep/dependency-enforcement-plan.json` | `8f27ca3dd2f12545e235efeb7c299157854e7314f51b9ac666cdb54d0ce357f1` |
| `.qa/evidence/stack-migration-prep/issue-publish-plan.json` | `e5b8756f3f65a6b523a932e1d63c0495790b8a421c5030440c32cd815a420e8e` |
| `scripts/stack-migration-db/atlas-product.spec.ts` | `dcc51c51a2febaf79c39735471fa300f893957e35893a1a9fae9ed4edae1637a` |
| `scripts/stack-migration-db/product-playwright.config.ts` | `0ee7b18f5b853b3b6482f86a7dd0efbc58976edfbdb557dc3a25947c0590bffc` |

### Verbleibende Nachweisgrenzen

- **Info:** Globale Veröffentlichung und anschließender GitHub-Readback sind ein eigener, serieller Arbeitsschritt. Dieser Bericht bestätigt die lokalen kanonischen Payloads und meldet keine bereits vollständig synchronisierten 90 Issues.
- **Info:** Hashes und strukturierte Completion-Dateien machen Nachweise zuordenbar und prüfbar. Sie sind keine kryptografische Beglaubigung menschlicher Autorität oder eines tatsächlich ausgeführten Befehls. In diesem Auftrag bleibt eine lokale APPROVED-Behauptung ohnehin ausdrücklich unzulässig.
- **Info:** Produktparität und Architektur bleiben gesperrt. Die echten DB-/UI-Legacy-Befunde wurden nicht durch Produktcode- oder SQL-Änderungen verdeckt. Abschließender Commit, Gesamt-Test-Gate, Composition und eine mögliche Merge-Entscheidung gehören nicht zu dieser statischen Teilabnahme.
