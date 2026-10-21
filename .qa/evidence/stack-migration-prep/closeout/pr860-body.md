## Problem und Zweck

Die bisherige Migrationsvorbereitung enthielt unzureichend belegte RPC-/Edge-Verträge und konnte manipulierte Vertrags- oder Freigabedaten fälschlich akzeptieren. Dieser Entwurf macht die Vorbereitung für Epic #773 prüfbar und liefert echte isolierte Datenbank-, Browser- und Kandidatennachweise.

## Änderungen

- 57 RPC-Namen, 24 Edge-Verzeichnisse und 13 Infrastruktur-Bereiche mit Quellen, Aufrufern und Wirkungen; 18 exklusive RPC-Unterverträge und 90 fest gebundene Issue-Identitäten. Ein RPC bleibt wegen seines optionalen Installations-/ACL-Pfads ausdrücklich source-blocked.
- Vollständige semantische Regeneration, Prüfung aller Abhängigkeiten und 28 Regressionen für Identität, Abschluss, Architekturautorität und vollständige Publikations-Payloads. Alle 90 Tickets bleiben blocked/needs-design; 0 ready, 0 done.
- Isolierter PostgreSQL-/GoTrue-/PostgREST-/Produktbrowser-Harness sowie Drizzle-/ZenStack-, Better-Auth-/Colyseus-/Hono- und SQLite-Crash-PoCs. CI führt die strikten Integrations-/Pflichtkriterien ohne Skip-Ausnahme aus.
- Unabhängige Reviews, korrigierte Evidence-Verifier, gehashte tatsächliche Beobachtungen und eine konkrete erste Issue-Reihenfolge.

## Tatsächlich geprüfter lokaler Stand

| Prüfung | Ergebnis |
| --- | --- |
| Reguläres `npm run test-gate`, einschließlich Prep und Dependency-Audit | PASS; 28 Vertragsregressionen; Audit 0 Critical/High/Moderate/Low |
| Separate Harness-Audits | DB und GATE-02/03: 0 Advisories; GATE-01 Vollaudit: 4 High in einer Dev-Abhängigkeitskette plus 1 Low; ohne Dev: 0 |
| Unveränderte Quellmigrationen / Funktionsvergleich | 106/106 angewendet; 177/177 Funktionsdefinitionen zugeordnet |
| Neue strikte SQL-Baseline | 16 PASS / 9 FAIL |
| Tatsächlicher Atlas-Produktbrowser | 1 PASS / 2 FAIL / 0 Skip |
| Tatsächlicher RLS-Canary | PASS: konkrete Policy-Regression erkannt |
| GATE-01 auf Node 22 und 24 | Je Kandidat und Runtime 42 PASS; je Runtime 13 Evidence-Regressionen PASS |
| GATE-02 | FAIL: Cookie A gibt im Browser authentifizierende Tokens an JavaScript aus; Browser JWT/Tauri bleibt NOT RUN |
| GATE-03 | PASS im dokumentierten lokalen Transport-/Last-Scope; keine Architekturfreigabe |
| GATE-04 | PASS im dokumentierten SQLite-/Crash-Scope; separat auf Node 22 ausgeführt |

Der GATE-01-Vollaudit bleibt wegen der Generator-Abhängigkeiten zusätzlich rot; Einzelheiten stehen in `closeout/dependency-audit.md`. Die neun SQL-Fehler enthalten zwei Critical- und fünf High-Berechtigungsbefunde. Der echte Browser bestätigt außerdem zwei Produktfehler. Diese Defekte sind dokumentiert und werden nicht durch Produktcodeänderungen oder weichere Assertions verdeckt. Lokale PASS-Ergebnisse sind kein bereits erfolgter GitHub-Actions-Lauf.

## Entscheidung und nächste Arbeit

Dieser PR bleibt **Draft**. Keine Architekturentscheidung, kein Runner-Start, kein Cutover und keine Release-Freigabe. Die ersten konkreten Abnahmen sind #782 und #783; nach menschlichem GATE-01-Beschluss #784 kann der neue Node-Host #789 beginnen. Der Auth-Befund sperrt die späteren Auth-Tickets, nicht diesen ersten Host-Grundaufbau.

Nachweise: `.qa/evidence/stack-migration-prep/`, Anleitung: `docs/stack-migration-preparation.md`, Startfolge: `.qa/evidence/stack-migration-prep/START_SEQUENCE.md`. Die genaue, separat verifizierte GitHub-Synchronisation steht in `github-contract-sync.json`; aus der Existenz dieses Entwurfs folgt keine vollständig abgeschlossene Publikation.
