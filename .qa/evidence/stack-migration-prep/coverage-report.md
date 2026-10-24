# Verifizierte Quellabdeckung und Ausführungsstand

Baseline: 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248. Stand: 2026-10-23 (historischer Source-Baseline-Stand separat nachweisen).

| Bereich | Anzahl | Nachweisgrenze |
| --- | --- | --- |
| SQL-Migrationsdateien | 106 | Repository-Kette; Abweichungen zum Deploy-Skript im DB-Bericht |
| Frontend-RPC-Namen | 57 | TypeScript-AST einschließlich beider typisierten Outcome-Promotion-Aufrufe |
| Edge-Verzeichnisse | 25 | 9 erlaubte Worker, 15 nicht eingebundene Worker, 1 Dispatcher |
| Infrastruktur-Bereiche | 13 | RPC, Tabellen, Storage, Realtime und Adapterbeziehungen |
| Kanonische veröffentlichte Issues | 90 | 71 Migration + Atlas #770 + 18 RPC-Untertickets |
| Ausführungsstatus ready | 1 | Runner-Status aus verifizierten Abschlussbelegen, nicht automatisch aus GitHub CLOSED |
| waiting (deps) | 25 | Voll spezifiziert; echte Vorgängerabnahmen fehlen noch |
| blocked / needs-design | 40 | Source-Defekte, Plattform-Deferral oder offene Architekturfragen |
| Menschliche Architekturfreigaben | 4 | GATE-01..04 implementation-approved; GATE-05 target selected, platform qualification deferred |

Die frühere Zahl 55 zählte nur direkte RPC-Literale. promote_session_outcome_to_saga und promote_session_outcome_to_world werden über ein typisiertes Wrapper-Argument aufgerufen und gehören zu den 57 verifizierten Namen. Die frühere Edge-Zahl 24 ist historisch; nach #879 ist `ollama-settings` der 25. Worker (vorläufig MIG-402/#818). Live-Produktionsabdeckung wird hier nicht behauptet.

Ausgeführte Datenbank-/Browser-Proben und reproduzierte Legacy-Defekte sind gesonderte Nachweise. Ein ausgeführter Defektnachweis ist keine sichere Alt/Neu-Parität.
