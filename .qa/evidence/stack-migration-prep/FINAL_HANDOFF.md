# SagaTree: Migrationsvorbereitung und konkreter Beginn

Stand: 21. Oktober 2026. Gehört zu [Epic #773](https://github.com/iamthamanic/sagatree/issues/773) und [Draft-PR #860](https://github.com/iamthamanic/sagatree/pull/860).

## Ergebnis und verbleibende Grenze

Die Quellverträge, ihre Prüfung, die isolierten Datenbank-/Browser-Harnesses und die begrenzten Architektur-PoCs sind lokal vorbereitet und ausgeführt. Die nächsten Tickets haben eine konkrete Reihenfolge. Die Veröffentlichung ist noch **teilweise blockiert: 41 von 90 kanonischen Issue-Verträgen sind auf GitHub verifiziert, 49 stehen aus.** Der neue Code-/Evidenzstand ist noch nicht im PR veröffentlicht.

Die automatische Freigabeprüfung hat das nächste Issue-Update #813 abgelehnt, weil im sichtbaren Chat eine ausreichend ausdrückliche Erlaubnis für den öffentlichen Zielort und die Inhalte einschließlich Sicherheitsbefunden fehlt. Nach dieser Ablehnung wurden keine weiteren GitHub-Schreibaktionen versucht. Die genaue Historie und die bereits bestätigten Hashes stehen im [Synchronisationsnachweis](github-contract-sync.json). Die dafür nötige Erlaubnis betrifft die Veröffentlichung dieses Vorbereitungspakets; sie ersetzt weder Architekturentscheidungen noch Runner- oder Cutover-Freigaben.

## Wann die ersten Issues beginnen können

Die ersten Schritte benötigen keine weitere breite Untersuchung:

1. **MIG-001 / #782:** Die vorhandene Baseline, reproduzierbaren Fixtures, Migrationen und Quellbindungen gegen den bestehenden Vertrag abnehmen. Das Ticket hat keine Vorgänger. Bekannte Altfehler müssen als tatsächliches Verhalten dokumentiert bleiben.
2. **MIG-002 / #783:** Inventar und konkrete Zuständigkeiten abnehmen. Parallel kann der tatsächliche Atlas-Harness in **#770** weiterbearbeitet werden; dessen fachliche Abnahme bleibt wegen zwei Produktfehlern offen.
3. **GATE-01 / #784:** Die geprüften Drizzle-/ZenStack-Alternativen menschlich entscheiden und die Entscheidung dokumentieren.
4. **MIG-010 / #789:** Danach beginnt der erste neue Node-Host mit Health/Readiness, Konfiguration, Datenverzeichnis und geordnetem Lebenszyklus. Der offene Auth-PoC ist kein zusätzlicher Vorgänger dieses Tickets.
5. **MIG-011 / #790:** Für SQLite-Bootstrap und Migrationsjournal kommt GATE-04 / #787 als Entscheidung hinzu. Die späteren Auth-Tickets #793/#794 warten auf GATE-02; HTTP #795 wartet zusätzlich auf GATE-03.

Die [Startfolge](START_SEQUENCE.md) enthält genaue Quellen und Grenzen. Der auf Harness-/CI-Arbeit gerichtete Atlas-Vertrag erlaubt nicht stillschweigend jede Produktkorrektur. Alle 90 Tickets bleiben bis zu ihren tatsächlichen Abnahmen und erforderlichen Entscheidungen `blocked` beziehungsweise `needs-design`; es gibt **0 ready, 0 done und 0 Architekturfreigaben**.

## Was das Paket enthält

**94 Legacy-Bereiche sind erfasst:** 57 Frontend-RPC-Namen, 24 Edge-Verzeichnisse und 13 Infrastruktur-Bereiche. Die 57 RPC-Namen sind exklusiv auf 18 Untertickets verteilt. 56 RPC-Verträge sind quellverifiziert; der optionale Installations-/ACL-Pfad von `increment_marketplace_downloads` bleibt ausdrücklich `source-blocked`. Der Plan verdeckt diese Lücke nicht.

Die Prüfung erzwingt alle 90 Issue-Identitäten und ihre festen Nummern. Sie regeneriert TypeScript-Aufrufer und SQL-Verträge, prüft sämtliche Quellhashes, aufgelöste Abhängigkeiten, transitive Abschlüsse und erforderliche Entscheidungen. Ein freier Text als angeblicher Abschluss oder eine selbst behauptete menschliche Architekturfreigabe genügt nicht. An der Publikationsgrenze müssen Repository, Issue-Nummer, Titel, Labels, Bodypfad und Body gemeinsam mit dem rekonstruierten Vertrag übereinstimmen.

Der isolierte Baseline-Harness verwendet PostgreSQL, GoTrue, PostgREST und einen tatsächlichen Produktbrowser. Die PoCs verwenden echte Kandidatenbibliotheken und SQLite. Sie sind zusätzliche Prüfungen mit genau dokumentiertem Umfang. Die Workflows für Contracts, Baseline und PoCs sind vorbereitet; ihre Existenz konfiguriert keine Branch-Protection und ist kein bereits absolvierter GitHub-Actions-Lauf.

## Tatsächlich ausgeführte Ergebnisse

| Prüfung | Ergebnis | Bedeutung |
| --- | --- | --- |
| Abschließendes reguläres `npm run test-gate` | **PASS**, exit 0 | Bestehende Projektprüfungen einschließlich vollständigem Prep-Check; [Ausgabe](closeout/test-gate.txt). |
| Vertragsregressionen | **28/28 PASS**, 0 Skip | Konkrete Fehlerfälle für Quell-/Identitäts-/Freigabe-/Publikationsdrift werden abgewiesen. |
| Root-Dependency-Audit | **0 Critical / High / Moderate / Low** | Tatsächlicher Audit innerhalb des abschließenden Test-Gates. |
| Separate neue Harness-Lockfiles | DB und GATE-02/03: **0 Advisories**; GATE-01 vollständig: **4 High / 1 Low**, ohne Dev: **0** | Die vier High-Pakete bilden eine betroffene Generator-Abhängigkeitskette. Der vollständige GATE-01-Audit bleibt rot; [Einordnung und Ausgaben](closeout/dependency-audit.md). |
| Neue DB-Browser-TypeScript-Dateien | **PASS** unter TS 5.8.3 und `--strict` | Explizite Prüfung beider eigenen Dateien; fremde Deklarationen mit `skipLibCheck`. Der allgemeine `src/`-Typcheck ist hier nicht der Nachweis für neue Harness-Dateien. |
| Unveränderte PostgreSQL-Quellinstallation | **106/106 Migrationen**, **177/177 Funktionsdefinitionen** | Tatsächlich angewendete SQL-Kette und Abgleich von Körpern, Signaturen, Defaults, Ergebnissen und Security-Merkmalen. |
| Strikte SQL-Sicherheits-/Semantikproben | **16 PASS / 9 FAIL** | Zwei Critical-, fünf High- und zwei Medium-Befunde im dokumentierten Fixture. |
| Tatsächliche Atlas-Produktbrowser-Fälle | **1 PASS / 2 FAIL / 0 Skip** | Autorisierter Fremdbesitz-Denial funktioniert; Player-Projektion und normale Werkzeug-Bedienung sind noch fehlerhaft. |
| Tatsächlicher RLS-Regressions-Canary | **PASS** | Eine echte Policy-Änderung kippt den erwarteten Negativtest. |
| GATE-01: Node 22.23.3 und 24.19.0 | **Je Kandidat und Runtime 42 PASS**, zusätzlich je **13 Evidence-Regressionen PASS** | Beide ORM-Kandidaten erfüllen die begrenzte Rollen-/Saga-/Transaktionsmatrix. Native ABIs und Installationen sind getrennt. |
| GATE-02: Auth | **FAIL**; Pflichtkriterien 12 PASS / 1 FAIL / 1 NOT RUN | Cookie A verletzt im tatsächlichen Browser die Credential-Isolation. JWT-Browserablage bleibt ungeprüft; Tauri und HTTPS sind separate offene Nachweise. |
| GATE-03: HTTP/Realtime | **10/10 Pflichtkriterien PASS** im beschriebenen Scope | Beide Router bestehen die gemeinsamen Policy-/Fehler-/Command-Proben und reale 200 Reconnects während 200 HTTP-Commands; ACKs, Revisionen und Überlappung werden geprüft. |
| GATE-04: SQLite | **18 Fälle PASS** im beschriebenen Scope; Node 22 separat bestätigt | 1000 logische Commits, 950 erzwungene Konflikte und fünf SIGKILL-Positionen ohne verlorene bestätigte Zustandsänderung. |

GATE-02 unterscheidet erfolgreiche Reproduktion eines Fehlers von erfolgreicher fachlicher Abnahme. Der strikte `--check` liefert bei dem offenen Pflichtkriterium **exit 1**. Der gesonderte Modus `--check-execution` bewertet die reproduzierbare Durchführung und lässt das fachliche GATE-02-Ergebnis ausdrücklich FAIL. CI verwendet den strikten Aufruf.

## Wesentliche offene Befunde

| Schwere | Befund | Konsequenz |
| --- | --- | --- |
| Critical, zwei SQL-Proben | Anonyme SQL-Aufrufer erreichen zwei privilegierte Helper für Session-Ereignisse beziehungsweise Adventure-Kommandos. | Im isolierten Bestand sind fremde Mutationen möglich. Diese Berechtigungslücken sind keine erwünschte Nachfolgersemantik. |
| High, fünf SQL-Proben | Fremde angemeldete Aufrufer erreichen dieselben Helper; weitere Proben zeigen eine fremde Session-Mutation beim Verlassen, Cross-Saga-Offenlegung und unzureichende Pin-Redaktion. | Vor einer Sicherheits-/Paritätsfreigabe gezielt beheben und mit den vorhandenen Negativfällen nachweisen. Direkter Player-Tabellenzugriff auf versteckte Atlas-Karten wurde dagegen korrekt abgewiesen. |
| Medium, zwei SQL-Proben | Die Würfelauflösung referenziert eine umbenannte Spalte; der zweiparametrige `save_session_recap_summary`-Aufruf ist wegen Overloads mehrdeutig. | Funktionale Portierungsblocker bleiben einzeln dokumentiert. |
| High, Auth-PoC | Der HttpOnly-Cookie ist vor `document.cookie` verborgen, aber Login-JSON und `set-auth-token` liefern authentifizierende Tokens an JavaScript. | Cookie A bleibt FAIL. Es wurde kein ungeprüfter Tokenfilter oder Auth-Proxy als Architekturentscheidung eingeführt. |
| High / Medium, Kandidatengrenzen | Drizzle benötigt eine verbindliche Policy-/Import-Kapselung; ZenStack-Feldpolicies haben einen dokumentierten Vorschau-Status. Sieben Modelltabellen belegen keine vollständige Produktmigration. | Diese Grenzen müssen in GATE-01 ausdrücklich bewertet werden. |
| High / Low, Generator-Werkzeuge | Der separate GATE-01-Audit meldet die betroffene Dev-Kette ZenStack-CLI → Prisma → deepmerge-ts sowie ein esbuild-Advisory für den Windows-Devserver. | Offen dokumentiert; Runtime-Audit ohne Dev-Abhängigkeiten meldet 0. CI prüft zusätzlich den Vollaudit und kann die bekannten High-Advisories nicht als grünen Gesamtstand ausgeben. |
| Medium / Low, Agent-Konfigurationsscan | AgentShield meldet eine fehlende Output-Control-Anweisung und einen fehlenden Stop-Hook; zwei Info-Einträge bestätigen vorhandene Verbote. Ergebnis A, 99/100, 0 Critical/High. | Bestehende Konfiguration wurde nicht außerhalb des Auftrags umgebaut. Alle vier Befunde stehen in der [Ausgabe](closeout/agentshield.txt). |
| Low, Formatierung | `git diff --cached --check` meldet 576 nachgestellte Leerzeichen und 35 zusätzliche Schlussleerzeilen in Markdown-/Quellauszügen und Ausführungslogs. | Kein behaupteter Whitespace-PASS. Quellgetreue Auszüge, Markdown-Zeilenumbrüche und die bereits gebundenen Issue-Payloads wurden nicht durch eine pauschale Formatierung verändert. |
| Info, Nachweisgrenzen | Keine produktive Datenbank, öffentliche TLS-Installation, vollständige Alt/Neu-Parität, verteilte Last oder Desktop-Abnahme ausgeführt. | Kein Produktrelease, Cutover oder Supabase-Shutdown freigegeben. |

Die vollständigen Dispositionen einschließlich der behobenen Validator-/Evidence-Fehler stehen im [Vertragsreview](PR860_FINAL_REVIEW.md), [GATE-01-Review](pocs/GATE01_REVIEW.md) und [GATE-02/03-Review](pocs/GATE0203_REVIEW.md). Die zugrunde liegenden [Datenbank-/Browser-Nachweise](parity-fixtures/execution-2026-10-21/README.md) beschreiben eine isolierte Quellinstallation, keinen unbekannten Produktionszustand.

## Prüfumfang, Dateien und Veröffentlichung

Der lokale Index enthält ausschließlich die Migrationsvorbereitung. Unabhängige QA-/Asset-Ausgaben, die im Arbeitsbaum vorhanden sind, wurden weder zurückgesetzt noch in das Paket aufgenommen. Der Arbeitsbaum ist deshalb nicht insgesamt sauber. Rohtraces, Toolchains, `node_modules`, temporäre Datenbanken und zur Laufzeit ausgestellte Sitzungstokens gehören nicht zum Veröffentlichungsumfang. Die reproduzierbaren Harnesses verwenden ausdrücklich synthetische Fixture-Identitäten; Produktionszugangsdaten wurden nicht verwendet.

Die vorhandene Composition-Klassifikation und Secret-Regeln wurden zusätzlich auf den lokalen Index angewendet. Die Klassifikation lautet **SKIPPED: tooling/docs/QA-only**, weil sich keine Produkt-Ereigniskette ändert; der Secret-Scan besteht. Das ist ausdrücklich kein auf einen neuen Commit bezogener CLI-Lauf: Der bisherige PR-HEAD bleibt `839a8c256f53fc7f3be3375efd127ae07524458f`. Die [Prüfmetadaten](closeout/index-review.json) nennen den tatsächlich geprüften Indexbaum und die unveränderten Prüfscripthashes.

Für den letzten Veröffentlichungsschritt sind die [PR-Beschreibung](closeout/pr860-body.md), der [vollständige Epic-Body](closeout/epic773-body.md) und ein [strukturiertes Publikationsmanifest](closeout/publication-draft.json) vorbereitet. Der Draft-Status von PR #860 bleibt erhalten. Vor einem späteren Schreiben müssen der aktuelle Branch-HEAD und der Epic-Ausgangstext erneut auf zwischenzeitliche Änderungen geprüft werden. Die verbleibenden 49 Issue-Updates verwenden weiterhin ausschließlich die kanonischen gesperrten Payloads.

Die benötigte ausdrückliche Freigabe lautet inhaltlich: **Dieses konkrete Vorbereitungspaket einschließlich dokumentierter Sicherheitsbefunde im öffentlichen Repository `iamthamanic/sagatree` veröffentlichen, PR #860 und Epic #773 aktualisieren und die verbleibenden 49 kanonischen Issue-Verträge synchronisieren; alle Ausführungssperren beibehalten.**
