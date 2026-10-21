# GATE-01 — ausführbarer SQLite-Vergleich

Dieses isolierte Paket führt zwei echte Implementierungen derselben fachlichen Schnittstelle aus:

- **Drizzle 0.45.4** mit `better-sqlite3 12.5.0` und zentralem `PolicyService`.
- **ZenStack 3.9.8** mit demselben SQLite-Treiber, echtem ZModel-Compiler und eigenem `PolicyPlugin`. Die Autorisierung steht in `zenstack/schema.zmodel`; der Adapter enthält keine Owner-/GM-/Mitgliedschafts-Handprüfungen.

**GATE-01 bleibt NOT APPROVED.** Dieses Paket verändert keine Produktdateien, PostgreSQL-Migrationen, Gate-Spezifikation oder Architekturfreigaben.

## Ausführen

Im Paketverzeichnis unter Linux mit Node 22 oder 24:

```sh
npm ci --no-audit --no-fund
npm run check
```

`check` generiert die tatsächliche ZenStack-Schemaimplementierung, prüft TypeScript strikt, führt beide Kandidaten aus, rendert den Bericht und vergleicht die Evidenz mit allen gebundenen Dateien. Der ausführbare TypeScript-Einstieg verwendet `node --import tsx`; der zusätzliche IPC-Server des `tsx`-CLI ist hier nicht erforderlich.

Der Runner öffnet echte SQLite-Dateien mit WAL und `synchronous=FULL`, verwendet für jeden Test ein frisches synthetisches Fixture und misst anschließend 100 sequentielle Writes sowie zehn frische Node-Prozesse je Kandidat. Eine Sandbox muss lokale Kindprozesse samt Standardausgabe zulassen. Fehler beim Prozessstart sind harte Fehler und werden nicht als Messwert ausgegeben.

Ein vorhandener Bericht lässt sich ohne erneute Ausführung prüfen:

```sh
npm run verify
```

Das ist ausschließlich eine Prüfung der aufgezeichneten Evidenz gegen aktuelle Quellen.

### Node 22 mit frischer nativer Installation

```sh
python provision-node22.py
python run-node22.py
```

Das erste Werkzeug lädt das offizielle, auf SHA-256 gepinnte Node-22.23.3-Archiv. Das zweite erzeugt eine isolierte Kopie ohne `node_modules`, führt mit der Node-22-Toolchain ein eigenes `npm ci` aus, lädt die tatsächliche native SQLite-Bibliothek und führt die vollständige Suite erneut aus. Node-24-Bindings werden dabei nicht wiederverwendet. Installations-/Build-Logs und der zweite Bericht liegen unter `pocs/gate-01/node22/`.

## Rollen und Daten

| Identität | Rechte im Fixture |
| --- | --- |
| O | Eigentümer von W1; keine GM-Zuordnung und keine Projektmitgliedschaft |
| G | Aktiver GM in Saga A/B mit W1; kein Welt-Owner |
| P1 | Aktiver Spieler in A; keine Mitgliedschaft in B |
| P2 | Aktiver Spieler in A und B |
| X | Eigentümer von W2 und GM des eigenen Projekts X; keine Mitgliedschaft in A/B |
| INACTIVE | Inaktive Spielermitgliedschaft in A |

Eine öffentliche Karte ist sichtbar. Eine weitere Karte ist nur P1 in A enthüllt. Andere Karten bleiben verborgen oder sind nur in B enthüllt. Das Fixture enthält absichtlich einen Reveal für P1 in B ohne Mitgliedschaft sowie einen widersprüchlichen Reveal von A auf eine W2-Karte. Beide Autorisierungsversuche müssen scheitern. GM-Notizen werden für Spieler auf SQL-Ebene zu `null` projiziert.

## Transaktions- und Sicherheitsumfang

`updateMapTitle` prüft Berechtigung, Revision und Idempotenz innerhalb einer echten Transaktion. Die Revision steigt serverseitig; die Ergebnisquittung wird atomar gespeichert. Gleiche Requests liefern dieselbe Quittung, veränderte Requests mit demselben Schlüssel scheitern. Nach Entzug des Weltbesitzes autorisiert eine alte Quittung keinen Replay. Ein injizierter Fehler zwischen Map-Update und Quittung rollt beide Effekte zurück. Zwei gleichzeitig eingereichte Requests werden über dieselbe Verbindung serialisiert; dies ist kein Mehrprozess-Schreiblastnachweis.

Die Application erhält ausschließlich `ApplicationPort`. Ein ausführbarer TypeScript-AST-Check verbietet in den PoC-App-Dateien alle Imports außerhalb des Domain-Vertrags und prüft konkrete Raw-Client-Importversuche. Zusätzlich kontrolliert er sämtliche Produktdateien unter `src/domains/**` auf direkte Drizzle-/ZenStack-Imports.

**Der direkte Drizzle-Client hat keine Policy-Sperre.** Der tatsächliche Raw-SQL-Probeaufruf liest alle sechs Karten und verändert innerhalb einer anschließend zurückgerollten Transaktion eine fremde Karte. Darum gehören Handle-Kapselung und verpflichtende Import-Grenzen zum Kandidaten A. Der echte ZenStack-Policy-Client sperrt im selben Probeumfang Raw-SQL und filtert ORM-/QueryBuilder-Abfragen selbst. Ein bewusst ungeschützter Datenbanktreiber oder eine deaktivierte Policy ist bei beiden Kandidaten außerhalb der geschützten Application-Grenze; dieses Paket ist kein Betriebssystem-Sandboxing.

## Ergebnis und Grenzen

Der aktuelle, aus tatsächlichen Messungen gerenderte Bericht steht unter:

- `.qa/evidence/stack-migration-prep/pocs/gate-01/report.md`
- `.qa/evidence/stack-migration-prep/pocs/gate-01/report.json`
- `.qa/evidence/stack-migration-prep/pocs/gate-01/observations.json`
- `.qa/evidence/stack-migration-prep/pocs/gate-01/node22/report.md`

Die berichteten LOC unterscheiden selbst verfasste Schema-/Policy-/Adapterdateien, gemeinsame Dateien und generierten ZenStack-Code. Sie messen weder Entwicklerzeit noch eine allgemeine Komplexität. Kaltstarts bedeuten frische Node-Prozesse; Betriebssystem- und Transpiler-Caches werden nicht geleert. Die Ergebnisse gelten für diesen Linux-Runner und dieses kleine Fixture.

**NOT RUN** bleiben die Migration der mehr als 50 Produkttabellen, PostgreSQL-RPCs/Trigger/RLS, vollständige Atlas-GeoJSON-Redaktion, vollständige Session-Zustandsmaschine, echte JWT-/HTTP-Integration, weitere Plattformen, Desktop-Paketierung, Mehrprozess-Schreiblast, Crash-/Restore-Verhalten und kontrollierte Zeitmessung zum Hinzufügen einer Ressource. ZenStack-Migrationswerkzeuge sind anhand der offiziellen Dokumentation eingeordnet, wurden für eine Produktmigration hier aber nicht ausgeführt. ZenStack-Feldpolicies sind in der Dokumentation als Preview bezeichnet; eine zukünftige Upgrade-Kompatibilität wird nicht behauptet.

Die erkannten Legacy-Sicherheitsfehler sind sichere Nachfolger-Zielbedingungen: Ein fremder Saga-Reveal, fehlender Saga-Kontext, manipulierte Owner-Felder oder negative Revisionswerte eröffnen hier keine Berechtigung. Die tatsächlichen Legacy-RPC-Verträge und ihre Blocker bleiben separat maßgeblich.

Offizielle Quellen und verwendete Paket-Implementierungen sind in `sources.json` gebunden. Paketversionen und Artefaktintegrität stehen im eigenen `package-lock.json`.
