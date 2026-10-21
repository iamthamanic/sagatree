# GATE-01: unabhängige Befunde und Abschluss der Korrekturen

Stand: 21. Oktober 2026. Dies ergänzt den auf den Vertragsvalidator begrenzten [PR860-Review](../PR860_FINAL_REVIEW.md).

## Prüfumfang und Herkunft

Der unabhängige Reviewer prüfte beide gespeicherten Runtime-Ausführungen, die Trennung von World-Owner und GM, echte ZenStack-Policies, Denial-Fehler und unveränderte Zustände bei verweigerten Mutationen. Er verglich außerdem die tatsächlichen Node-22-/Node-24-ABIs, die unterschiedlichen SQLite-Binaries und die damaligen sieben Node-22-Ausführungslogs. Seine positive Kontrolle bestand.

Der Reviewer meldete anschließend drei reproduzierte Lücken im Evidence-Verifier aus isolierten Kopien. Die abschließende Korrektur und die erneute Ausführung des korrigierten Stands wurden durch die Hauptinstanz vorgenommen. Die letzte Wiederholung ist daher eine Implementierungsverifikation und wird nicht als zweite vollständige unabhängige Prüfung ausgegeben.

## Befunde aller Schweregrade

| ID | Schwere | Befund | Disposition und konkrete Prüfung |
| --- | --- | --- | --- |
| G01-R1 | Medium | Der Report konnte 420 statt 42 PASS oder einen frei geänderten p95 melden, obwohl die Einzelbeobachtungen unverändert waren. | Korrigiert: Counts und Report-Latenzen müssen vollständig aus den Beobachtungen hervorgehen. Beide Statistikreihen werden aus den einzelnen Samples neu berechnet; die 100 Writes sind zusätzlich mit dem betreffenden Fachtest verbunden. Regressionen für Report- und koordinierten Summary-Drift bestehen. |
| G01-R2 | Medium | Eine veränderte Policy-Datei konnte aus der frei kürzbaren `sourceFiles`-Liste entfernt werden; ihr Hash wurde dann nicht geprüft. | Korrigiert: Der Verifier ermittelt selbst den vollständigen kanonischen Quellbaum einschließlich der sechs festen Produkt-/Gate-Quellen und verlangt exakte Pfad-/Hash-Gleichheit. Entfernen des Policy-Pfads und Entfernen der Observations-Bindung werden abgelehnt. |
| G01-R3 | Medium | Ein duplizierter PASS ersetzte einen Pflichtfall; direkte Engine-, Raw- und App-Import-Komponenten konnten ganz fehlen. | Korrigiert: Exakt 42 unabhängig benannte, eindeutige Fälle je Kandidat sowie beide Kandidaten und alle drei Komponenten sind erforderlich. Fehlende Engine-Denials, Importproben und Kaltstart-Beobachtungen werden abgelehnt. |
| G01-R4 | Low | Die Node-22-Logs waren vorhanden und gehasht, durch das allgemeine Git-Ignore jedoch noch nicht Bestandteil des lokalen Veröffentlichungsumfangs. | Die acht Logs des neuen Laufs werden gezielt zusammen mit `node22/execution.json` aufgenommen. Der zusätzliche achte Schritt prüft die 13 Evidence-Regressionen. |
| G01-R5 | Info | Quellen- und Ausgabehashes sind Zuordnungs-/Driftprüfungen, keine kryptografische Beglaubigung einer menschlichen Entscheidung oder eines ganzen Ausführungsrechners. | Grenze bleibt ausdrücklich bestehen; `architectureApproval=NOT_APPROVED` und `implementationUnblocked=false` sind zwingend. |

Zusätzliche Critical- oder High-Fehler wurden in dieser eng begrenzten Evidence-Prüfung nicht festgestellt. Die weiterhin relevanten High-/Medium-/Low-/Info-Einschränkungen der eigentlichen Kandidaten stehen in den beiden ausführlichen Reports, einschließlich der erforderlichen Drizzle-Kapselung, ZenStack-Feldpolicy-Vorschau und nicht ausgeführter Produktintegration.

## Tatsächlich erneut ausgeführter korrigierter Stand

| Laufzeit | Drizzle | ZenStack | Evidence-Regressionen | Generator und strikter Typcheck |
| --- | --- | --- | --- | --- |
| Node 24.19.0, ABI 137 | 42 PASS / 0 FAIL | 42 PASS / 0 FAIL | 13 PASS / 0 FAIL / 0 Skip | PASS |
| Node 22.23.3, ABI 127, eigene saubere Installation | 42 PASS / 0 FAIL | 42 PASS / 0 FAIL | 13 PASS / 0 FAIL / 0 Skip | PASS |

Node 24 wurde mit `npm run check --prefix scripts/stack-migration-pocs/gate-01` ausgeführt. Der Node-22-Lauf verwendet dieselben kanonischen Quellen in einer getrennten Kopie, sein eigenes `npm ci` und acht einzeln protokollierte Schritte. Die Quellenbindung enthält nach Ergänzung des Regressionstests 32 Dateien.

Die gespeicherten Beobachtungen wurden durch neue echte Ausführungen ersetzt; alte Messergebnisse wurden nicht durch bloßes Umschreiben ihrer Quellhashes auf den neuen Prüfer umgebunden. Beide Reports enthalten sämtliche aktuellen Einzelmessungen. Die Unterschiede zwischen einzelnen Läufen sind normale lokale Laufzeitschwankungen und kein Produktlastvergleich.

- [Node-24-Report](gate-01/report.md), [maschineller Report](gate-01/report.json), [Beobachtungen](gate-01/observations.json)
- [Node-22-Report](gate-01/node22/report.md), [Ausführung mit Loghashes](gate-01/node22/execution.json)
- [Verifier](../../../../scripts/stack-migration-pocs/gate-01/verify.mjs), [13 Regressionen](../../../../scripts/stack-migration-pocs/gate-01/verify.test.mjs)

Ergebnis: Der beschriebene isolierte GATE-01-Scope besteht mit korrigierter Evidenzprüfung. Architekturentscheidung, vollständige Produktparität und Migration bleiben offen.

## Separater Toolchain-Audit beim lokalen Abschluss

Der danach ausgeführte Vollaudit des eigenen GATE-01-Lockfiles meldet vier High-Pakete in einer betroffenen Generator-Abhängigkeitskette und ein Low-Advisory. Der Audit ohne Dev-Abhängigkeiten meldet null. Diese zusätzlichen High-/Low-/Info-Befunde bleiben offen und sind im [Auditbericht](../closeout/dependency-audit.md) mit Primärquellen und den vollständigen Registry-Ausgaben dokumentiert. Der funktionale Tabellen-PASS oben ist damit ausdrücklich kein grüner vollständiger Toolchain-Audit; CI prüft beides gesondert.
