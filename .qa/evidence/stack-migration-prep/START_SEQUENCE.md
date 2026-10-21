# Start der Issue-Bearbeitung

Stand: 21. Oktober 2026. Die folgende Reihenfolge konkretisiert den bestehenden Plan; sie ändert keine Ausführungsberechtigung. Alle 90 Tickets bleiben `blocked` beziehungsweise `needs-design`.

**Der erste neue Host-Code kann nach Abnahme von Baseline und Inventar sowie der menschlichen Entscheidung zu GATE-01 beginnen. Ein noch offenes Auth-Gate blockiert diesen ersten Host-Grundaufbau nicht.** Die einzelnen Vorgänger und ihre Abnahmen bleiben verbindlich; die laufenden PoC-Nachweise schließen kein Ticket automatisch ab.

## Die ersten konkreten Arbeitsschritte

| Ticket | Nächste begrenzte Arbeit | Voraussetzung |
| --- | --- | --- |
| **MIG-001 [#782](https://github.com/iamthamanic/sagatree/issues/782)** — Baseline und Fixtures | Vorhandenen PostgreSQL-Lauf, SQL-/Quellhashes, wiederholbaren Fixture-Aufbau und tatsächlich geprüften Stand gegen die vier Akzeptanzpunkte abnehmen. Offene Altfehler bleiben ausdrücklich dokumentiert. | Keine Vorgänger; keine Architekturwahl nötig. |
| **ATLAS-LIVE-E2E [#770](https://github.com/iamthamanic/sagatree/issues/770)** — echter Produktpfad | Die bereits ausgeführte Browser-Suite und ihre CI-Einbindung abschließen. Der aktuelle Stand ist **1/3 PASS**; fehlende Projektion und UI-Bedienfehler verhindern die fachliche Abnahme. Erforderliche Produktkorrekturen brauchen einen ausdrücklich abgegrenzten Änderungsumfang; der aktuelle Vertrag erlaubt hauptsächlich Harness-/CI-Arbeit. | Abgenommene MIG-001. Kein ORM- oder Auth-Framework-Beschluss nötig. |
| **MIG-002 [#783](https://github.com/iamthamanic/sagatree/issues/783)** — vollständiges Inventar | Die vorhandenen 57 RPC-, 24 Edge- und 13 Infrastruktur-Verträge samt exklusiver Zuständigkeit, Driftprüfung und offener Abdeckung abnehmen. | Abgenommene MIG-001. Kann unabhängig von der noch roten Atlas-Abnahme abgeschlossen werden. |
| **GATE-01 [#784](https://github.com/iamthamanic/sagatree/issues/784)** — ORM/Berechtigungsmodell | Nach Abschluss der Evidenzprüfung die gemessenen Drizzle-/ZenStack-Ergebnisse und verbleibenden Grenzen bewerten; menschliche Entscheidung mit Quelle und Nachweis festhalten. | Abgenommene MIG-001 und MIG-002. Beide Kandidaten haben den gemessenen Fixture-Umfang bestanden; daraus folgt noch keine Auswahl. |
| **MIG-010 [#789](https://github.com/iamthamanic/sagatree/issues/789)** — Node-Host | Health-/Readiness-Endpunkte, Konfiguration, Datenverzeichnis und geordneten Lebenszyklus implementieren. Dies ist der erste Umsetzungsschritt der neuen Host-Struktur. | MIG-001, MIG-002 und freigegebenes GATE-01. |
| **MIG-011 [#790](https://github.com/iamthamanic/sagatree/issues/790)** — SQLite-Bootstrap | Freigegebenes Schema, atomisches Migrationsjournal und Fremdschlüsselprüfung implementieren. | MIG-010 sowie GATE-01 und **GATE-04 [#787](https://github.com/iamthamanic/sagatree/issues/787)**. |

Die Abhängigkeiten und vollständigen Abnahmekriterien stehen in der [verbindlichen Reihenfolge](dependency-enforcement-plan.md) und den [kanonischen Ticketverträgen](../../design/migration-issues/). Die [Identitätsregistry](published-issue-registry.json) ordnet die lokalen IDs festen GitHub-Nummern zu.

## Welche Entscheidungen noch fehlen

**GATE-04** hat den gemessenen SQLite-Umfang bestanden; die Entscheidung zu Transaktion, Revision, Ereignis und Idempotenz muss trotzdem menschlich erfolgen. **GATE-02 [#785](https://github.com/iamthamanic/sagatree/issues/785)** benötigt die Auflösung des bestätigten JavaScript-lesbaren Sitzungstokens in Cookie-Variante A. Browser-Variante B und Tauri sind nicht ausgeführt. Auth-Integration MIG-014/#793 und MIG-015/#794 bleiben daran gebunden. **GATE-03 [#786](https://github.com/iamthamanic/sagatree/issues/786)** entscheidet über HTTP-Routen im Colyseus-Host oder die zusätzliche Hono-Schicht; sein Abschluss läuft separat und sperrt später MIG-020/#795.

Die [Entscheidungsregistry](architecture-approvals.json) enthält bisher keine Freigabe. Desktop-GATE-05/#788 wartet auf Browser-Host-CI und Betrieb (#847/#848). Für den Beginn von MIG-010 ist diese spätere Desktop-Entscheidung nicht erforderlich.

## Veröffentlichung und aktuelle Grenze

Nach dem [Synchronisationsnachweis](github-contract-sync.json) sind **41 von 90** kanonischen GitHub-Verträgen aktualisiert; **49** stehen aus. Die automatische Freigabeprüfung hat das nächste Update #813 abgelehnt. Die Veröffentlichung der verbleibenden Verträge sowie des Code-/Evidenzstands einschließlich dokumentierter Sicherheitsbefunde im öffentlichen Repository `iamthamanic/sagatree`, in [PR #860](https://github.com/iamthamanic/sagatree/pull/860) und [Epic #773](https://github.com/iamthamanic/sagatree/issues/773), benötigt deshalb eine ausdrückliche sichtbare Ziel-/Inhaltsfreigabe. Eine Veröffentlichungsfreigabe allein startet keinen Runner und ersetzt keine Architekturentscheidung.

Die Vorbereitung kann bis dahin lokal abgeschlossen werden. Die [Baseline](baseline.md) bleibt mit **16/25 SQL-Proben** und **1/3 Atlas-Browserfällen** fachlich rot. Die bestätigten Berechtigungsfehler dürfen bei der Nachfolgerimplementierung keine gewollte Berechtigungsregel werden.
