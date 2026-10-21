# Issue-Vertragsprüfung

Stand: 2026-10-21. 90 kanonische Bodies mit Runner, Design, konkreten Given/When/Then-Fällen; Acceptance enthält alle inventorisierten requiredTests (keine Bullet-Cap-Kürzung bei Co-Ownership).

- 0 ready, 85 blocked, 5 needs-design.
- 57 RPC-, 25 Edge- und 13 Infrastruktur-Verträge.
- 0 als implementiert abgenommene Migrationstickets; 0 menschlich freigegebene Architekturentscheidungen.
- Explizite Source-Defekte in 37 Tickets; die konkreten Befunde stehen im jeweiligen Vertrag.
- Host-Modulvertrag: docs/architecture/host-modular-monolith.md (verankert in MIG-010/#789).

Die Strukturprüfung ersetzt die unabhängige fachliche Prüfung nicht. Insbesondere bedeutet das frühere schwache weakCount:0 weder einen korrekten Vertrag noch eine Ausführungsfreigabe.
