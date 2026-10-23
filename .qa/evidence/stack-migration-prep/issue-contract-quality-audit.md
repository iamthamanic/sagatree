# Issue-Vertragsprüfung

Stand: 2026-10-23. 90 kanonische Bodies mit Runner, Design, konkreten Given/When/Then-Fällen; Intake-`acceptance` enthält alle inventorisierten requiredTests (öffentliche Acceptance darf ≤5 zusammenfassen; Required Tests / Edge Cases bleiben vollständig).

- 5 ready, 30 waiting, 40 blocked, 0 needs-design, 15 done.
- 57 RPC-, 25 Edge- und 13 Infrastruktur-Verträge.
- 15 als implementiert abgenommene Migrationstickets; 4 menschlich freigegebene Architekturentscheidungen.
- Explizite Source-Defekte in 38 Tickets; die konkreten Befunde stehen im jeweiligen Vertrag.
- Host-Modulvertrag: docs/architecture/host-modular-monolith.md (verankert in MIG-010/#789).

Die Strukturprüfung ersetzt die unabhängige fachliche Prüfung nicht. Insbesondere bedeutet das frühere schwache weakCount:0 weder einen korrekten Vertrag noch eine Ausführungsfreigabe.
