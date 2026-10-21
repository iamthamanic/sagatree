# Verifizierte Quellabdeckung und Ausführungsstand

Baseline: 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248. Stand: 2026-10-21 (nach Main #879 neu verifiziert).

| Bereich | Anzahl | Nachweisgrenze |
| --- | --- | --- |
| SQL-Migrationsdateien | 106 | Repository-Kette; Abweichungen zum Deploy-Skript im DB-Bericht |
| Frontend-RPC-Namen | 57 | TypeScript-AST einschließlich beider typisierten Outcome-Promotion-Aufrufe |
| Edge-Verzeichnisse | 25 | 9 erlaubte Worker, 15 nicht eingebundene Worker, 1 Dispatcher |
| Infrastruktur-Bereiche | 13 | RPC, Tabellen, Storage, Realtime und Adapterbeziehungen |
| Kanonische veröffentlichte Issues | 90 | 71 Migration + Atlas #770 + 18 RPC-Untertickets |
| Ausführungsstatus ready | 0 | Keine persistente Runner-Aktivierung durch den Vorbereitungsauftrag |
| blocked / needs-design | 90 | Transitive Sperren und offene GATEs |
| Menschliche Architekturfreigaben | 0 | GATE-01–04 offen, GATE-05 zusätzlich zeitlich zurückgestellt |

Die frühere Zahl 55 zählte nur direkte RPC-Literale. promote_session_outcome_to_saga und promote_session_outcome_to_world werden über ein typisiertes Wrapper-Argument aufgerufen und gehören zu den 57 verifizierten Namen. Die frühere Edge-Zahl 24 ist historisch; nach #879 ist `ollama-settings` der 25. Worker (vorläufig MIG-402/#818). Live-Produktionsabdeckung wird hier nicht behauptet.

Ausgeführte Datenbank-/Browser-Proben und reproduzierte Legacy-Defekte sind gesonderte Nachweise. Ein ausgeführter Defektnachweis ist keine sichere Alt/Neu-Parität.
