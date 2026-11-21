# Arbeitsauftrag: SagaTree-Dokumentation auf den aktuellen Produktstand konsolidieren

> **Art:** Ausführbarer Arbeitsauftrag für Cursor/Codex/einen Coding-Agenten, kein Architekturvertrag und kein Beleg für eine bereits erledigte Bereinigung.
>
> **Ziel:** Die aktive SagaTree-Dokumentation beschreibt genau einen, durch Code und Tests belegten Ist-Zustand. Veraltete Aussagen erscheinen nicht mehr als aktuelle Produktanweisungen. Historische Migrationsbelege bleiben unverfälscht erhalten.
>
> **Ausführung:** Diesen Arbeitsauftrag vollständig ausführen; nicht nur analysieren oder einen Plan schreiben. Änderungen auf einem separaten Branch mit PR liefern. Nicht direkt auf main pushen und keine Quality Gates umgehen.

## Auftrag

Du arbeitest im Repository SagaTree. Bereinige die gesamte **aktive** Produkt-, Architektur-, Entwickler- und Betriebsdokumentation, sodass sie sich nicht mehr widerspricht, keine abgeschalteten Produkt-Stacks als aktiv empfiehlt und den **nachweisbar implementierten Stand des aktuellen Branch-HEAD** wiedergibt.

**Wichtig:** Nicht einfach global Begriffe wie „Supabase“ löschen und nicht das Wort „modern“ mit „implementiert“ gleichsetzen. Verifiziere jede relevante Ist-Aussage an ausführbarem Code, tatsächlich aktivierter Laufzeitkonfiguration, Tests und aktuellen Merge-Entscheidungen.

### 1. Vor dem Editieren: verbindliche Quellen lesen

Mindestens folgende Quellen vollständig oder im relevanten Kontext prüfen:

- AGENTS.md; README.md; README_SELFHOST.md
- src/ARCHITECTURE.md
- docs/architecture/host-modular-monolith.md
- docs/architektur-sqlite-based.md
- docs/ops/host-compose-profiles.md und docs/ops/host/backup-restore.md
- docs/ops/compose-profiles.md (als historische Weiterleitung/Einordnung)
- docker-compose.yml; deployment/docker-compose.host.yml; deployment/Dockerfile.host
- server/src/bootstrap/, server/src/http/, server/src/modules/, server/package.json
- src/app/, src/domains/, src/infrastructure/ sowie die tatsächlich verwendeten Frontend-Adapter
- package.json; scripts/test-gate.mjs; scripts/architecture-boundary-check.mjs; scripts/composition-gate.mjs
- .qa/merge-gate.yaml; einschlägige .github/workflows/
- docs/concepts/ sowie Design-/UI-Verträge, soweit von geänderten Aussagen betroffen
- abgeschlossene CUT-21/CUT-22/CUT-23-Änderungen und deren Akzeptanz-/Evidenzdateien, soweit für Aussagen über die Produkt-Runtime notwendig

Priorität bei Konflikten:

1. **Tatsächlich verdrahteter Produktionspfad am geprüften Commit**: Bootstrap, Routen, Adapter, Deploy-/Compose-Konfiguration.
2. **Ausführbare Prüfungen, Integrationstests und belegte Akzeptanz**: Was wird wirklich getestet, was nur behauptet?
3. **Explizit freigegebene Architektur-/Produktentscheidungen**: Normativ verbindlich, aber nicht automatisch schon implementiert.
4. **Aktuelle Dokumentation**: Zu korrigierende Beschreibung, keine eigenständige Evidenz.
5. **Alte Konzepte, PR-Texte, Migrationstickets und Archiv**: historische Belege für damalige Zustände, nicht die aktuelle Betriebsanleitung.

Bei Abweichungen zwischen implementierter Realität und noch geltendem Zielvertrag: **Ist und Soll getrennt benennen**, niemals stillschweigend die Norm umdefinieren.

### 2. Ist-Zustand und Dokumentationswidersprüche erfassen

Erstelle zunächst eine knappe, belegte Bestandsaufnahme pro Bereich:

- Produkt-Runtime und Deployment
- Authentifizierung und Berechtigungen
- Datenbank, Persistenz, Realtime und Asset-Speicherung
- Frontend-Schichten, Adapter und öffentliche Modul-APIs
- AI-/Media-Provider und optionale Integrationen
- Desktop/Tauri, Mobile und noch nicht gemergte Arbeiten
- Tests, CI, Review- und Merge-Gates
- Backup, Restore, Betrieb und Fehlerfall

Ordne jede Behauptung genau einer Kategorie zu:

- **AKTIV:** im aktuellen Produktpfad implementiert und nachweisbar.
- **OPTIONAL:** vorhandene, explizit zuschaltbare Funktion/Integration.
- **GEPLANT/EXPERIMENTELL:** Idee, PoC, offene Entscheidung oder nicht gemergter PR.
- **HISTORISCH/ARCHIVIERT:** früherer Stack, frühere Architektur, Migrationsbeleg.
- **UNGEKLÄRT:** Quellen widersprechen sich oder Evidenz reicht nicht.

Für jede entdeckte Inkonsistenz notieren: Datei/Abschnitt, veraltete Aussage, aktuellen Beleg, Zieländerung. Keine erfundenen Fakten zur Schließung von Lücken.

### 3. Bekannte Konflikte gezielt untersuchen

Die folgenden Punkte wurden im Repository beobachtet. Sie sind **Prüfhypothesen**, keine Freigabe zum blinden Ersetzen:

1. README.md beschreibt stellenweise den selbst gehosteten Supabase-Stack mit GoTrue/Postgres/Storage/Realtime als aktuelle Laufzeit, enthält aber zugleich bereits die Node-Host-/SQLite-CUT-22-Beschreibung.
2. AGENTS.md nennt Node/Hono, Better Auth, SQLite und das archivierte Supabase-Setup, führt an anderer Stelle aber noch aktive Supabase-Adapter, RLS-/Edge-Vorgaben und konkrete supabase-js-/Edge-Aufrufbeispiele als kanonische Produktintegration auf.
3. src/ARCHITECTURE.md definiert relevante Frontend-Importgrenzen, beschreibt weiter unten jedoch ebenfalls einen Supabase-Backend-Stack als Gegenwart und nennt teils alte Adapterbezeichnungen.
4. docs/architektur-sqlite-based.md trägt einen historischen Stand vom 19.10.2026 und bezeichnet Node/SQLite als noch nicht implementierten Architekturvorschlag; nach den CUT-Abschlüssen darf dieser Text nicht als aktueller Implementierungsstatus erscheinen.
5. docs/architecture/host-modular-monolith.md enthält frühe Migrations- und Freigabevorbehalte. Prüfe, welche davon heute historische Momentaufnahmen sind und welche Verträge weiterhin gelten.
6. Einzelne Ops- und Test-Dokumente enthalten isolierte Migrationsnachweise. Sie dürfen nicht mit der aktuellen Standard-Deployment-Anleitung verwechselt werden.
7. Bei Tauri/Desktop strikt zwischen bereits gemergter Produktfunktion, offenem PR, PoC und angekündigter Release-Fähigkeit unterscheiden. Ein offener PR ist **kein** aktueller main-Produktstand.

### 4. Zielbild der aktiven Dokumentation

Erzeuge **keine** zweite konkurrierende Dokumentationswelt. Belasse die bestehenden kanonischen Einstiegspunkte und konsolidiere deren Zuständigkeiten:

| Datei / Bereich | Einzige Aufgabe |
| --- | --- |
| README.md | Aktueller Produktüberblick, Stack in wenigen Zeilen, Quick Start und Links |
| AGENTS.md | Tatsächlich gültige Agentenregeln, Architekturgrenzen, Prüf- und Reviewpflichten; nur aktuelle Beispiele |
| README_SELFHOST.md | Aktueller Self-Host-Start und Link auf verbindliche Betriebsrunbooks |
| src/ARCHITECTURE.md | Gültige Frontend-Schichten, Imports und Public-API-Regeln; keine veraltete Backend-Betriebsbeschreibung |
| docs/architecture/host-modular-monolith.md | Gültiger Node-Host-Modulvertrag und klare Abgrenzung zu historischen Migrationsphasen |
| docs/ops/host-compose-profiles.md | Verbindliches aktuelles Compose-/Profilverhalten |
| docs/ops/host/* | Aktuelle Host-Runbooks, jeweils mit belegtem Funktions- und Freigabestatus |
| docs/concepts/* und UI-Guides | Gültige Produkt-/UX-Verträge; keine beiläufigen falschen Backend-Annahmen |
| docs/architektur-sqlite-based.md | Historischen Vorschlag klar als historischen Entwurf ausweisen oder seinen Status sauber abgrenzen; historische Entscheidungsbegründungen nicht umschreiben |

Präzisiere technische Tatsachen am aktuellen Code. Nach dem nachgewiesenen CUT-22/CUT-23-Zielbild ist die aktive Standard-Runtime **React/Vite → Node/Hono Host → Better Auth/Policy Service/SQLite → lokale Assets**, mit optionalen externen AI-/Media-Providern. Verifiziere diese Aussage erneut, einschließlich eventueller Änderungen seit den CUT-PRs.

Der alte Supabase-/GoTrue-/PostgREST-/Deno-/Postgres-Produktpfad darf **nicht** mehr als aktuelle Standard-Runtime, Startanleitung oder kanonische neue Integrationsrichtung auftauchen. Legitime Erwähnungen bleiben nur als **klar gekennzeichnete** Archiv-, Migrations-, Kompatibilitäts- oder Testreferenzen erhalten. Verwechsle PostgreSQL-Testharnesses nicht mit der Produktdatenbank.

### 5. Konkrete Bearbeitungsregeln

- Bearbeite bestehende kanonische Dateien statt neue parallele Architekturübersichten zu erzeugen.
- Ersetze veraltete Ist-Aussagen durch nachweislich aktuelle. Kürze redundante Wiederholungen; verwende Links auf die jeweilige kanonische Quelle.
- Entferne veraltete Setup-Schritte, unzutreffende Beispiele und irreführende „aktuell“, „geplant“, „nicht implementiert“ oder „nicht freigegeben“-Aussagen aus **aktiven** Handbüchern, soweit deren Status tatsächlich überholt ist.
- Übernehme aktuelle Code- und Begriffsnamen. Erfinde keine API-Endpunkte, Dateipfade, Architekturgrenzen, Releases oder Testabdeckungen.
- Unterscheide strikt zwischen **implemented**, **tested**, **approved**, **deployed** und **planned**. Ein bestandener isolierter Test belegt keinen produktiven Rollout.
- Bestehende Importgrenzen und Architekturentscheidungen nicht stillschweigend lockern. Wenn sie nicht mehr passen, dokumentiere den Konflikt und den tatsächlichen Source-Code-Befund.
- Historische ADRs, alte Migrationsberichte, Issue-/PR-Evidenz, archived code, Lizenzen und Prüf-Snapshots **nicht umschreiben oder löschen**, nur weil sie damals korrekte alte Zustände festhalten. Wenn nötig, oben einen eindeutig datierten Archiv-/Statushinweis und einen Link zum aktuellen Einstieg setzen.
- Keine produktiven Funktionen, Runtime-Abhängigkeiten, Datenmigrationen oder Sicherheitsregeln im Rahmen dieses Auftrags ändern.
- Keine großflächige Dokumentations-Neuschreibung ohne Nutzen; Änderungen minimal, nachvollziehbar und auf Quellen gestützt halten.
- Bei ungeklärtem Sachverhalt **UNGEKLÄRT** mit konkretem Beleg und Folgeticket dokumentieren, nicht raten.

### 6. Wiederauftreten von Widersprüchen verhindern

Prüfe vorhandene Dok-/Linkchecks. Ergänze **nur falls nicht bereits wirksam vorhanden** einen kleinen deterministischen Dokumentations-Drift-Check, der mindestens diese kritischen Invarianten für **aktive Einstiegspunkte** prüft:

- Der aktuelle Default-Startweg und die produktive Datenbank widersprechen sich nicht.
- Keine aktive Setup-Anweisung startet den archivierten Supabase-Produktstack.
- Verlinkte kanonische Dokumente und referenzierte Befehle existieren.
- Historische Dokumente werden nicht fälschlich als aktueller Betriebseinstieg verlinkt.

Der Check darf **nicht** pauschal jedes Auftreten von „Supabase“, „Postgres“, „Edge“ oder „Deno“ verbieten: Archivreferenzen, historische Belege und isolierte Migrationstests sind legitim. Bevorzuge gezielte Assertions mit Selbsttest gegen Positiv- und Negativbeispiele; kein fragiler globaler Keyword-Filter.

Falls dafür ein neues Skript nötig ist: klein halten, an die vorhandenen Prüfroutinen anschließen und nur diesen expliziten, notwendigen Code ändern. Kein weiterer QA-Framework-Aufbau und kein Ausbau der großen test-gate.mjs um umfangreiche zusätzliche Speziallogik.

### 7. Verifikation / Definition of Done

Vor PR-Erstellung bzw. Merge folgende Punkte nachweislich erledigen:

1. Alle oben genannten aktiven Einstiegspunkte auf Widersprüche prüfen und konsolidieren.
2. Repo-weite Suche nach veralteten Runtime-Aussagen in Markdown, README, AGENTS, Runbooks und Konfigurationsbeispielen durchführen. Jeden Treffer als aktuell, optional, historisch oder falsch bewerten.
3. Markdown-Links, relative Pfade und alle im Text empfohlenen Start-/Prüfbefehle auf Existenz und richtige Zielverwendung prüfen.
4. Explizit prüfen, dass AGENTS.md und README.md denselben aktuellen Standard-Stack benennen und dass src/ARCHITECTURE.md sowie die Host-Architektur damit kompatibel sind.
5. Prüfen, dass kein historischer Beleg versehentlich als neuer Ist-Zustand umetikettiert wurde.
6. Bei neuem Drift-Check dessen Positiv-/Negativ-Selbsttests ausführen und dokumentieren. Bestehende relevante Checks sowie vorgeschriebene CI/PR-Gates gemäß AGENTS.md laufen lassen; keine grünen Ergebnisse behaupten, die nicht gelaufen sind.
7. Jeder geänderte Abschnitt hat einen konkreten Beleg aus Code, Konfiguration, Tests oder gültigem Produktvertrag. Nicht belegbare Aussagen fehlen im aktuellen Handbuch oder tragen einen klaren Status.
8. Keine Produktcode-/Schema-/Runtime-Verhaltensänderung; Dokumentation und gegebenenfalls ein minimaler Drift-Check sind der gesamte Diff.

Nützliche Suchbasis (danach **manuell nach Kontext bewerten**):

    rg -n -i --glob '*.md' 'supabase|gotrue|postgrest|postgres|deno|edge functions|node host|better auth|sqlite|cutover|migration|tauri|not implemented|not approved|geplant|nicht implementiert' README.md README_SELFHOST.md AGENTS.md src docs

### 8. Abgabeformat

Liefere einen vollständigen PR, nicht nur einen Audit-Text:

- **Änderungsübersicht:** Welche aktuellen Dokumente wurden berichtigt, gekürzt oder miteinander verlinkt?
- **Widerspruchstabelle:** Alter Widerspruch → neue kanonische Aussage → Code-/Test-/Entscheidungsbeleg.
- **Historie:** Welche historischen Dokumente bleiben bewusst unverändert und warum?
- **Prüfprotokoll:** Exakte ausgeführte Commands, PASS/FAIL/SKIPPED und Gründe.
- **Offene Punkte:** Nur echte, nach Quellenprüfung verbleibende Unklarheiten mit Datei/Abschnitt.
- **PR-Link:** Gegen main, alle Merge-/Review-Gates respektieren; kein Admin-Bypass, kein direkter Push auf main.

**Erfolgskriterium:** Ein neuer Entwickler oder KI-Agent kann README.md → AGENTS.md → Architektur → Self-Host-Runbook durchgehen und erhält **eine konsistente Beschreibung des aktuell ausführbaren Produkts**. Er muss nicht aus alten und neuen Dokumenten selbst die Wahrheit rekonstruieren.
