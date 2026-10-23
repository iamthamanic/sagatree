# GATE-01 — gemessener Linux-SQLite-Vergleich

**Ausführungsstatus:** EXECUTED_SCOPE_PASS. **Architektur:** NOT_APPROVED. Keine Migration ist dadurch freigegeben.

Beobachtet: 2026-10-23T18:45:27.741Z. Node v22.22.3, Native-ABI 127, darwin/arm64.

## Reale Ergebnisse

| Kandidat | Fachliche Tests | Write-Median (ms) | Write-p95 (ms) | Write-Maximum (ms) | Kaltstart-Median (ms) | Kaltstart-p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| drizzle | 42 PASS / 0 FAIL | 0.273 | 0.479 | 1.065 | 279.705 | 479.414 |
| zenstack | 42 PASS / 0 FAIL | 2.061 | 3.037 | 7.580 | 254.017 | 258.910 |

Je Kandidat: 100 sequentielle, echte SQLite-Transaktionen mit Revision und Quittung; zehn frische Node-Prozesse. Die Kaltstart-Wanduhr umfasst Prozessstart, Loader, Import, Datenbanköffnung und ersten autorisierten Read. OS-/Transpiler-Caches wurden nicht geleert. Das sind Messungen dieses Fixtures, keine allgemeine Leistungsgarantie.

## Fachliche Abnahme

| Gate-Zeile | Geprüfter Umfang |
| --- | --- |
| 1 | P1/P2 list/get projection, exact saga/player reveal and null GM notes |
| 2 | X cannot read W1 through A or own X saga |
| 3 | O owner without GM can edit; G/P1/P2/X cannot |
| 4 | Stale CAS revision fails atomically |
| 5 | AST checked product src/domains and PoC domain contain zero ORM imports |
| 6 | 10 cold processes and 100 sequential transactional writes; no latency threshold prescribed |
| 7 | PoC app facade and executable import allowlist prevent raw client exposure; ZenStack additionally rejects actual raw queries. Raw Drizzle capability remains unsafe if boundary is bypassed. |
| 8 | GM status authority remains distinct from world ownership |
| 9 | No actor, unknown saga, inactive/wrong-project memberships fail closed |

Die Einzelbeobachtungen einschließlich der erwarteten Denial-Fehler, Rollback-/Replay-Zustände und jeder Write-Latenz stehen in [observations.json](observations.json). Ein erwarteter Berechtigungsfehler zählt nur bei dem konkreten Denial-Code; SQL-/Compiler-/Runtime-Fehler werden nicht in einen erfolgreichen Negativtest umgedeutet.

Zusätzlich wurde ZenStack ohne Application-Handprüfungen direkt abgefragt: eigene ORM- und QueryBuilder-Policyfilter, nullable GM-Feldredaktion, verweigerter GM-Map-Write, verweigerter World-FK-Write und verweigerte Raw-SQL-Lese-/Schreibaufrufe. Alle Proben liefen gegen den echten PolicyPlugin 3.9.8 und echte SQLite-Dateien.

## Raw-SQL-Grenze

Die geprüfte PoC-Application besitzt vier Domain-Operationen und keine SQL-/Client-Funktion. Der verpflichtende PoC-Importcheck blockiert sechs konkrete Client-/Driver-Importversuche. ZenStack sperrt mit aktivem PolicyPlugin zusätzlich tatsächliche Raw-SQL-Aufrufe.

Der echte ungeschützte Drizzle-Client las im separaten Infrastruktur-Probeaufruf alle sechs Karten und änderte eine fremde Karte innerhalb einer anschließend zurückgerollten Transaktion. Diese Beobachtung macht die verpflichtende Kapselung und Importprüfung des PolicyService-Kandidaten konkret. Die Einbindung einer solchen Grenze in das Produkt-CI ist **NOT RUN**. Keiner der Kandidaten schützt gegen beliebigen Code mit direktem Dateizugriff oder einen bewusst ungeschützten Treiber.

## Codeumfang

Selbst verfasste Nichtleer-/Nichtkommentar-LOC: Drizzle **154**, ZenStack **173**, Differenz ZenStack minus Drizzle **19**. Zusätzlich erzeugt ZenStack **587** LOC. Gemeinsame Domain-, App- und Prüfdateien sind separat aufgeführt.

| Datei | Physische Zeilen | Ohne Leer-/Kommentarzeilen |
| --- | --- | --- |
| drizzle/schema.ts | 33 | 32 |
| drizzle/policy-service.ts | 71 | 63 |
| drizzle/adapter.ts | 60 | 59 |
| zenstack/schema.zmodel | 106 | 97 |
| zenstack/engine.ts | 23 | 22 |
| zenstack/adapter.ts | 56 | 54 |
| zenstack/schema.ts | 406 | 399 |
| zenstack/models.ts | 17 | 10 |
| zenstack/input.ts | 185 | 178 |
| domain/contracts.ts | 50 | 49 |
| application/commands.ts | 11 | 9 |
| boundary.ts | 51 | 47 |

LOC sind stark von Sprache und Formatierung abhängig. Entwicklerzeit zum Hinzufügen einer Ressource, subjektive Komplexität und produktiver Migrationsaufwand wurden nicht gemessen.

## Sichere Nachfolger-Zielbedingungen

- Reveal requires the same saga, active membership, player and project world; the observed cross-Saga legacy defect is deliberately rejected.
- A missing saga does not select an arbitrary project; the product null-Saga UI path requires a separate migration contract.
- Negative/null expectedRevision bypass is not implemented; nonnegative integer revision is mandatory.
- Idempotency is actor+map+key scoped, rejects changed payload, records response atomically, and rechecks current authorization on replay.
- Forged ownership/foreign-key payload fields are discarded; only title and server incremented revision can change.

## Befunde aller Schweregrade

| Schwere | ID | Status | Befund |
| --- | --- | --- | --- |
| High | G01-RAW-DRIZZLE | boundary-required | Actual unguarded Drizzle raw SQL reads all six rows and changes a foreign map inside the rolled-back probe. The application must receive only the guarded port and enforce imports; Drizzle itself has no policy engine. |
| Medium | G01-ZEN-FIELD-PREVIEW | decision-required | ZenStack field policies are documented as preview. Real nullable-field redaction and immutable worldId update rejection pass for 3.9.8; upgrade compatibility is not inferred. |
| Medium | G01-MIGRATION-SCOPE | NOT_RUN | Seven-table schema and command receipt ledger do not establish the port of 50+ tables or the PostgreSQL RPC/trigger semantics. |
| Low | G01-MEASUREMENT-SCOPE | limited-sample | Ten cold processes and 100 sequential writes on this Linux runner are reproducible smoke measurements, not production capacity or cross-platform rankings. |
| Info | G01-FIXTURE-AUTH | NOT_RUN | This gate tests authorization using explicitly trusted synthetic actors. Real JWT verification belongs to the separate auth gate. |
| Info | G01-DEPENDENCY-INSTALL | observed | npm installed the pinned package set successfully; installation warned about transitive prebuild-install and cuid deprecations. No generated CUID is used in this fixture. |

## Nicht ausgeführt

- **NOT RUN:** Human architecture approval, ADR-ST-05 or migration unblocking
- **NOT RUN:** Port/migration of 50+ product tables, PostgreSQL functions/triggers/RLS, real product payloads and all nested Atlas GeoJSON redactions
- **NOT RUN:** Production auth/JWT/HTTP integration or exposure of SQLite storage; actors are trusted synthetic harness inputs
- **NOT RUN:** Windows/macOS/ARM/mobile/desktop packaging; libSQL and Electron/Tauri adapters
- **NOT RUN:** Concurrent OS-process writers, crash/power-loss durability, database restore and schema upgrade
- **NOT RUN:** Full session lifecycle transition parity, unbounded query workloads, production bundle size
- **NOT RUN:** Controlled human time-to-add-resource measurement, subjective complexity score or total migration effort estimate
- **NOT RUN:** Production application import-boundary CI integration and exhaustive capability-bypass security review

## Einordnung für die Entscheidung

Beide Kandidaten erfüllen die geprüfte Owner-/GM-/Saga-Matrix und die Transaktions-/Idempotenzbedingungen. Drizzle hatte in diesem Lauf den niedrigeren Write-p95; dafür muss die verpflichtende Service-/Import-Grenze die rohe Datenbankfähigkeit abschirmen. ZenStack lieferte reale generierte Abfrage- und Feldpolicies einschließlich Raw-SQL-Sperre; Feldpolicies bleiben laut offizieller Dokumentation eine Preview-Funktion.

Eine belastbare Entscheidung für mehr als 50 Tabellen benötigt zusätzliche Migrations- und Plattformnachweise. Insbesondere dürfen PostgreSQL-Trigger, ACLs, RLS und die 57 RPC-Verträge nicht durch diese sieben Modelltabellen als bereits portiert gelten. Eine Architekturentscheidung oder ADR-ST-05 wurde hier nicht getroffen.

## Quellenbindung und Wiederholung

Versionen, Lizenzangaben aus installierten Paketmanifesten, vollständige Source-SHA-256, native SQLite-Binary-Hash und Beobachtungshash stehen in [report.json](report.json). Die aktuelle Quellcodebindung wird mit `npm run verify` geprüft; `npm run check` führt die Messung erneut aus.

| Paket | Version | Lizenz laut Paketmanifest |
| --- | --- | --- |
| @zenstackhq/cli | 3.9.8 | MIT |
| @zenstackhq/orm | 3.9.8 | MIT |
| @zenstackhq/plugin-policy | 3.9.8 | MIT |
| drizzle-orm | 0.45.4 | Apache-2.0 |
| better-sqlite3 | 12.5.0 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| tsx | 4.21.0 | MIT |

Offizielle API-Quellen: [ZenStack-Policies](https://zenstack.dev/docs/orm/access-control/write-policies), [PolicyPlugin/Raw-SQL](https://zenstack.dev/docs/reference/plugins/policy), [Feldpolicies](https://zenstack.dev/docs/orm/access-control/field-level), [ZenStack-Migration](https://zenstack.dev/docs/orm/migration), [Drizzle-SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite) und [Drizzle-Transaktionen](https://orm.drizzle.team/docs/transactions). Die konkrete Verhaltensevidenz stammt aus diesem ausgeführten Paket.
