# Separater Audit der neuen Harness-Abhängigkeiten

Stand: 21. Oktober 2026. Der grüne Root-Audit umfasst die drei eigenständigen Lockfiles der neuen Harnesses nicht. Diese wurden deshalb zusätzlich mit `npm audit --prefix <paket> --json` abgefragt. Keine Paketversion wurde danach verändert; die ausgeführten funktionalen Nachweise bleiben an ihre tatsächlich geprüften Pins gebunden.

| Lockfile / Audit-Scope | Critical | High | Moderate | Low | Exit |
| --- | --- | --- | --- | --- | --- |
| Root-Projekt, reguläres Test-Gate | 0 | 0 | 0 | 0 | 0 |
| `scripts/stack-migration-db` | 0 | 0 | 0 | 0 | 0 |
| `scripts/stack-migration-pocs/gate-02-03` | 0 | 0 | 0 | 0 | 0 |
| `scripts/stack-migration-pocs/gate-01`, einschließlich Dev-Werkzeuge | 0 | **4** | 0 | **1** | **1** |
| GATE-01 zusätzlich `--omit=dev` | 0 | 0 | 0 | 0 | 0 |

Die vier High-Pakete bilden **eine betroffene Abhängigkeitskette**, nicht vier voneinander unabhängige Advisories:

`@zenstackhq/cli@3.9.8` → `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`.

Alle vier Einträge sowie `esbuild@0.27.7` sind im Lockfile als Entwicklungsabhängigkeiten markiert. Der zusätzliche Audit ohne Dev-Abhängigkeiten bestätigt für diesen erfassten Laufzeit-Scope null Advisories. Das ist keine allgemeine Sicherheitsgarantie und keine Untersuchung eines produktiven Angriffspfads.

## Befunde aller Schweregrade

| Schwere | Advisory / Befund | Einordnung und Disposition |
| --- | --- | --- |
| High | [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), `deepmerge-ts <8.0.0` | Die Primärquelle beschreibt Stack-Erschöpfung beim Zusammenführen zyklischer Objektgraphen; gewöhnliches JSON allein erzeugt diesen Fall nicht. Behoben laut Advisory ab 8.0.0. Der exakt gepinnte Prisma-Konfigurationspfad verlangt 7.1.5; `npm audit` bietet für diese Kette keine automatische Korrektur. Offen für die bewusste Werkzeug-/Versionsentscheidung. Keine ungeprüfte Major-Override-Änderung wurde eingeführt. |
| Low | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), `esbuild >=0.27.3 <0.28.1` | Die Primärquelle betrifft den Dateiserver auf Windows; behoben ab 0.28.1. Die ausgeführten PoCs liefen auf Linux und starteten keinen esbuild-Devserver. Der Pin bleibt als offener Werkzeugbefund dokumentiert, nicht als bewiesene Ausnutzung im Fixture. |
| Info | Audit-Abdeckung und funktionales Ergebnis sind verschiedene Nachweise | Beide ORM-Kandidaten bestehen ihre fachlichen Fixture-Fälle. Daraus folgt kein grüner vollständiger Supply-Chain-Audit. Der GATE-01-CI-Job prüft den Vollaudit nach der fachlichen Ausführung und bleibt bei High-Advisories rot. |

Kein Critical- oder Moderate-Advisory wurde in diesen drei abgefragten Lockfiles gemeldet. Die beiden GitHub-Advisories wurden zusätzlich direkt gelesen; die Registry-Ausgaben bleiben die Quelle für die tatsächlich installierte Kette.

## Maschinelle Ausgaben

- [GATE-01 vollständig](audit-gate-01.json)
- [GATE-01 ohne Dev-Abhängigkeiten](audit-gate-01-runtime.json)
- [GATE-02/03](audit-gate-02-03.json)
- [Datenbank-Harness](audit-db.json)

Der Vorbereitungs-PR bleibt Draft. Der Audit ist nicht pauschal übersprungen und wird nicht durch die erfolgreich ausgeführten Fachtests als erledigt markiert.
