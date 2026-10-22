# RPC-Teilaufgaben — exakte Partition aller57 RPCs

18 veröffentlichte Teilissues besitzen jedes RPC genau einmal. Koordinatoren813–816 werden nicht als zweite Implementierungszuordnung gezählt. Vorgeschlagene Serverpfade benennen den Review-Scope; sie genehmigen weder Architektur noch Bibliothekswahl.

| Teilissue | Scope | Koordinator | RPC-Anzahl |
| --- | --- | --- | --- |
| [#861](https://github.com/iamthamanic/sagatree/issues/861) | Legacy-Weltkarte lesen und speichern | [#813](https://github.com/iamthamanic/sagatree/issues/813) | 2 |
| [#862](https://github.com/iamthamanic/sagatree/issues/862) | Atlas-Kartenprojektion und Revision | [#813](https://github.com/iamthamanic/sagatree/issues/813) | 4 |
| [#863](https://github.com/iamthamanic/sagatree/issues/863) | Orte und Kartenverknüpfungen | [#813](https://github.com/iamthamanic/sagatree/issues/813) | 4 |
| [#864](https://github.com/iamthamanic/sagatree/issues/864) | Kanonischen Weltknoten erstellen und benennen | [#813](https://github.com/iamthamanic/sagatree/issues/813) | 2 |
| [#865](https://github.com/iamthamanic/sagatree/issues/865) | Weltknoten verschieben und duplizieren | [#813](https://github.com/iamthamanic/sagatree/issues/813) | 2 |
| [#866](https://github.com/iamthamanic/sagatree/issues/866) | Folgenvorschau, Archivierung und Löschung | [#813](https://github.com/iamthamanic/sagatree/issues/813) | 3 |
| [#867](https://github.com/iamthamanic/sagatree/issues/867) | Session-Runtime, Snapshot und Presence | [#814](https://github.com/iamthamanic/sagatree/issues/814) | 3 |
| [#868](https://github.com/iamthamanic/sagatree/issues/868) | Session anlegen und Status wechseln | [#814](https://github.com/iamthamanic/sagatree/issues/814) | 3 |
| [#869](https://github.com/iamthamanic/sagatree/issues/869) | Session-Beitritt, Austritt und Einladung | [#814](https://github.com/iamthamanic/sagatree/issues/814) | 5 |
| [#870](https://github.com/iamthamanic/sagatree/issues/870) | Recap-Projektion und Zusammenfassung | [#814](https://github.com/iamthamanic/sagatree/issues/814) | 2 |
| [#871](https://github.com/iamthamanic/sagatree/issues/871) | Saga-Entwurf, Kopie und Veröffentlichung | [#815](https://github.com/iamthamanic/sagatree/issues/815) | 5 |
| [#872](https://github.com/iamthamanic/sagatree/issues/872) | Saga-Versionen und native Katalogprojektion | [#815](https://github.com/iamthamanic/sagatree/issues/815) | 2 |
| [#873](https://github.com/iamthamanic/sagatree/issues/873) | Spielgruppe aus Version und Starter-Provisionierung | [#815](https://github.com/iamthamanic/sagatree/issues/815) | 3 |
| [#874](https://github.com/iamthamanic/sagatree/issues/874) | Projektbeitritt und eigener Charakter | [#815](https://github.com/iamthamanic/sagatree/issues/815) | 2 |
| [#875](https://github.com/iamthamanic/sagatree/issues/875) | Saga-Berechtigungen, Bindings und Bundles | [#815](https://github.com/iamthamanic/sagatree/issues/815) | 5 |
| [#876](https://github.com/iamthamanic/sagatree/issues/876) | Saga-Übersicht, Lore und Outcome-Übernahme | [#815](https://github.com/iamthamanic/sagatree/issues/815) | 4 |
| [#877](https://github.com/iamthamanic/sagatree/issues/877) | NPC-Instanzen und Controller-Zuordnung | [#816](https://github.com/iamthamanic/sagatree/issues/816) | 5 |
| [#878](https://github.com/iamthamanic/sagatree/issues/878) | Marketplace-Downloadzähler und Fallback | [#816](https://github.com/iamthamanic/sagatree/issues/816) | 1 |

## RPC-WORLD-MAP — [#861](https://github.com/iamthamanic/sagatree/issues/861)

Legacy-Weltkarte lesen und speichern

**Koordinator:** [#813](https://github.com/iamthamanic/sagatree/issues/813).

**RPCs:**

- [get_world_map](get_world_map.md)
- [save_world_map](save_world_map.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04.

**Abnahme:**

- [ ] Leere Weltkarte liefert revision 0 und size 24; gespeicherte JSON-Payload und Client-Decoding sind belegt.
- [ ] Nur Welt-Editoren speichern; Größe 1–60, Bildpfad-Grenzen und JSON-Objekt-Validierung bleiben geprüft.
- [ ] Revision-Konflikt führt zu SQLSTATE 40001 ohne Teilupdate; expliziter Legacy-Bypass bei NULL/negativer Erwartungsrevision ist entschieden.
- [ ] Player-Ansicht schützt verborgene Pins serverseitig unabhängig von einem manipulierbaren p_player_view-Flag; unsichere Legacy-Parität ist gesperrt.

**Legacy-Sperren:** `RPC-SEC-LEGACY-MAP-FLAG`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/world-map/get_world_map/index.ts`
- `server/src/application/world-map/save_world_map/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/get_world_map.ts`
- `server/src/application/commands/save_world_map.ts`
- `server/src/application/world-map/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/world/world-map-service.ts](../../../src/infrastructure/world/world-map-service.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/068_world_maps.sql](../../../supabase/migrations/068_world_maps.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-ATLAS-MAPS — [#862](https://github.com/iamthamanic/sagatree/issues/862)

Atlas-Kartenprojektion und Revision

**Koordinator:** [#813](https://github.com/iamthamanic/sagatree/issues/813).

**RPCs:**

- [ensure_world_atlas_root](ensure_world_atlas_root.md)
- [list_world_atlas_maps](list_world_atlas_maps.md)
- [get_world_atlas_map](get_world_atlas_map.md)
- [upsert_world_atlas_map](upsert_world_atlas_map.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-WORLD-MAP.

**Abnahme:**

- [ ] Migration 106 wird berücksichtigt: get_world_atlas_map hat ausschließlich die dreiargumentige Signatur mit optionalem p_saga_public_id.
- [ ] Player-Liste und Detail liefern nur im konkreten Saga-Kontext freigegebene kanonische Orte; GM-Daten, Parent-IDs und Azgaar-Pfade bleiben geschützt.
- [ ] Root-Erzeugung ist bei Wiederholung stabil; Parent-Karte muss dieselbe Welt besitzen.
- [ ] GeoJSON-FeatureCollection, 1.500.000-Byte-Limit und Revision-Konflikt sind mit echten SQL- und Decoder-Fixtures abgenommen.

**Legacy-Sperren:** `RPC-SEC-CROSS-SAGA-REVEAL`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/world-atlas/ensure_world_atlas_root/index.ts`
- `server/src/application/world-atlas/list_world_atlas_maps/index.ts`
- `server/src/application/world-atlas/get_world_atlas_map/index.ts`
- `server/src/application/world-atlas/upsert_world_atlas_map/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/ensure_world_atlas_root.ts`
- `server/src/application/commands/list_world_atlas_maps.ts`
- `server/src/application/commands/get_world_atlas_map.ts`
- `server/src/application/commands/upsert_world_atlas_map.ts`
- `server/src/application/world-atlas/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/world/world-atlas-service.ts](../../../src/infrastructure/world/world-atlas-service.ts)
- [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/068_world_maps.sql](../../../supabase/migrations/068_world_maps.sql)
- [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)
- [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)
- [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql)
- [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql)
- [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql)
- [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql)
- [supabase/migrations/106_atlas_get_map_overload_fix.sql](../../../supabase/migrations/106_atlas_get_map_overload_fix.sql)

## RPC-WORLD-PLACES — [#863](https://github.com/iamthamanic/sagatree/issues/863)

Orte und Kartenverknüpfungen

**Koordinator:** [#813](https://github.com/iamthamanic/sagatree/issues/813).

**RPCs:**

- [list_world_places](list_world_places.md)
- [list_world_place_map_links](list_world_place_map_links.md)
- [upsert_world_place](upsert_world_place.md)
- [upsert_world_place_map_link](upsert_world_place_map_link.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-ATLAS-MAPS.

**Abnahme:**

- [ ] Editor- und Party-Projektionen werden getrennt durch vorhandene Rechte erzwungen; fehlender Saga-Kontext liefert leere Party-Listen.
- [ ] Orte, Parent und Karte gehören derselben Welt; fremde IDs scheitern ohne verwaiste Verknüpfung.
- [ ] UPSERT über place/map/usage aktualisiert genau eine Verknüpfung und liefert die belegten JSON-Felder.
- [ ] Trigger für kanonische Hierarchie, Primary-Link und Kartenabgleich sind Teil der Transaktion und der Nachfolger-Tests.

**Legacy-Sperren:** `RPC-SEC-CROSS-SAGA-REVEAL`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/world-places/list_world_places/index.ts`
- `server/src/application/world-places/list_world_place_map_links/index.ts`
- `server/src/application/world-places/upsert_world_place/index.ts`
- `server/src/application/world-places/upsert_world_place_map_link/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/list_world_places.ts`
- `server/src/application/commands/list_world_place_map_links.ts`
- `server/src/application/commands/upsert_world_place.ts`
- `server/src/application/commands/upsert_world_place_map_link.ts`
- `server/src/application/world-places/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts)
- [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)
- [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)
- [supabase/migrations/096_donalu_place_map_link_rpc.sql](../../../supabase/migrations/096_donalu_place_map_link_rpc.sql)
- [supabase/migrations/097_donalu_player_place_projection.sql](../../../supabase/migrations/097_donalu_player_place_projection.sql)
- [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql)
- [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql)
- [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql)

## RPC-WORLD-CREATE — [#864](https://github.com/iamthamanic/sagatree/issues/864)

Kanonischen Weltknoten erstellen und benennen

**Koordinator:** [#813](https://github.com/iamthamanic/sagatree/issues/813).

**RPCs:**

- [create_world_node_with_maps](create_world_node_with_maps.md)
- [rename_world_node](rename_world_node.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-WORLD-PLACES.

**Abnahme:**

- [ ] Jeder kanonische Ortstyp erzeugt die erforderliche Vorfahrenkette, Primärkarte und Verknüpfung in einer Transaktion.
- [ ] Der weltbezogene Idempotency-Key liefert bei Wiederholung dieselben IDs ohne zusätzliche Orte oder Karten.
- [ ] Fremde/inkompatible Parents und leere Namen werden vor Seiteneffekten abgewiesen.
- [ ] Umbenennung erhöht die Ortsrevision; Placeholder wechseln zu draft, bestehende andere Status bleiben erhalten.

**Legacy-Sperren:** Keine zusätzlich erfassten RPC-spezifischen Sperren.

**Vorgeschlagene Zielmodule:**

- `server/src/application/world-create/create_world_node_with_maps/index.ts`
- `server/src/application/world-create/rename_world_node/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/create_world_node_with_maps.ts`
- `server/src/application/commands/rename_world_node.ts`
- `server/src/application/world-create/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts)
- [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)
- [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql)
- [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql)
- [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql)
- [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql)

## RPC-WORLD-RESTRUCTURE — [#865](https://github.com/iamthamanic/sagatree/issues/865)

Weltknoten verschieben und duplizieren

**Koordinator:** [#813](https://github.com/iamthamanic/sagatree/issues/813).

**RPCs:**

- [reparent_world_node](reparent_world_node.md)
- [duplicate_world_node](duplicate_world_node.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-WORLD-CREATE.

**Abnahme:**

- [ ] Reparent verlangt Bestätigung, verbietet Selbst-/Nachfahrenzyklen und aktualisiert Ort und Primärkarten-Parent atomar.
- [ ] Ungültige Hierarchiekante oder fremder Parent liefert 23514 ohne Teilverschiebung.
- [ ] Duplizieren erzeugt neue IDs und Karten; shallow kopiert nur die Wurzel, deep die vollständige Unterstruktur.
- [ ] Die Transaktion verwendet eine lokale Duplikat-Zuordnung; parallele Kopien teilen weder temporäre Datensätze noch neue IDs.

**Legacy-Sperren:** Keine zusätzlich erfassten RPC-spezifischen Sperren.

**Vorgeschlagene Zielmodule:**

- `server/src/application/world-restructure/reparent_world_node/index.ts`
- `server/src/application/world-restructure/duplicate_world_node/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/reparent_world_node.ts`
- `server/src/application/commands/duplicate_world_node.ts`
- `server/src/application/world-restructure/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts)
- [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)
- [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql)
- [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql)
- [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql)
- [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql)

## RPC-WORLD-DESTRUCTIVE — [#866](https://github.com/iamthamanic/sagatree/issues/866)

Folgenvorschau, Archivierung und Löschung

**Koordinator:** [#813](https://github.com/iamthamanic/sagatree/issues/813).

**RPCs:**

- [preview_world_node_consequences](preview_world_node_consequences.md)
- [archive_world_node_subtree](archive_world_node_subtree.md)
- [delete_world_node](delete_world_node.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-WORLD-RESTRUCTURE.

**Abnahme:**

- [ ] Die Vorschau zählt Nachfahren und Saga-Bindings exakt und gibt requiresConfirm für die betroffene Struktur zurück.
- [ ] Archivierung umfasst Wurzel und Nachfahren und erhöht deren Revision; Wiederholung bleibt definiert.
- [ ] Löschung entfernt nur den bestätigten Teilbaum mit zugehörigen Links/Karten und löst Saga-Ortsreferenzen in derselben Transaktion.
- [ ] Fehlende Bestätigung oder fehlende Editor-Rechte verändert weder Orte, Bindings noch Karten.

**Legacy-Sperren:** `RPC-DATA-SHARED-MAP-DELETE`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/world-destructive/preview_world_node_consequences/index.ts`
- `server/src/application/world-destructive/archive_world_node_subtree/index.ts`
- `server/src/application/world-destructive/delete_world_node/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/preview_world_node_consequences.ts`
- `server/src/application/commands/archive_world_node_subtree.ts`
- `server/src/application/commands/delete_world_node.ts`
- `server/src/application/world-destructive/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts)
- [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)
- [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql)
- [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql)
- [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql)
- [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql)

## RPC-SESSION-RUNTIME — [#867](https://github.com/iamthamanic/sagatree/issues/867)

Session-Runtime, Snapshot und Presence

**Koordinator:** [#814](https://github.com/iamthamanic/sagatree/issues/814).

**RPCs:**

- [apply_session_runtime_command](apply_session_runtime_command.md)
- [get_session_runtime_snapshot](get_session_runtime_snapshot.md)
- [set_session_player_presence](set_session_player_presence.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04.

**Abnahme:**

- [ ] Alle 15 Runtime-Kinds haben getrennte Request-, Rollen-, Helper-, Event- und Snapshot-Fixtures; status/join/leave werden nicht mit separaten Lifecycle-RPCs verwechselt.
- [ ] Session-Lock, erwartete Revision, Event und Helper-Effekte committen atomar; konkurrierende veraltete Revisionen liefern 40001.
- [ ] Idempotenz ist sessionbezogen; Replay liefert die aktuelle erlaubte Projektion und erzeugt kein zweites Event.
- [ ] GM/Director/Player-Projektionen und Presence erlauben weder fremde Figurensteuerung noch verborgene Scene-/Adventure-Daten.

**Legacy-Sperren:** `RPC-RUNTIME-ROLL-OWNER-COLUMN`, `RPC-SEC-ANON-ADVENTURE-HELPER`, `RPC-SEC-ANON-EVENT-HELPER`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/session-runtime/apply_session_runtime_command/index.ts`
- `server/src/application/session-runtime/get_session_runtime_snapshot/index.ts`
- `server/src/application/session-runtime/set_session_player_presence/index.ts`
- `server/src/modules/session/index.ts`
- `server/src/application/commands/apply_session_runtime_command.ts`
- `server/src/application/commands/get_session_runtime_snapshot.ts`
- `server/src/application/commands/set_session_player_presence.ts`
- `server/src/application/session-runtime/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts)
- [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts)
- [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql)
- [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql)
- [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql)
- [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql)
- [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql)
- [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql)
- [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql)
- [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql)
- [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql)
- [supabase/migrations/043_session_shared_scene_presentation.sql](../../../supabase/migrations/043_session_shared_scene_presentation.sql)
- [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql)
- [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql)
- [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql)
- [supabase/migrations/049_session_death_lifecycle.sql](../../../supabase/migrations/049_session_death_lifecycle.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/065_saga_simulation_ops.sql](../../../supabase/migrations/065_saga_simulation_ops.sql)
- [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql)
- [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql)
- [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql)
- [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-SESSION-LIFECYCLE — [#868](https://github.com/iamthamanic/sagatree/issues/868)

Session anlegen und Status wechseln

**Koordinator:** [#814](https://github.com/iamthamanic/sagatree/issues/814).

**RPCs:**

- [create_play_session](create_play_session.md)
- [create_project_session](create_project_session.md)
- [set_session_status](set_session_status.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SESSION-RUNTIME.

**Abnahme:**

- [ ] create_play_session verlangt GM; create_project_session erlaubt den im Quellcode belegten aktiven GM-/Player-Mitgliedschaftspfad.
- [ ] Parallele Erzeugung vergibt eindeutige Session-Nummern und Join-Codes; scheduled/waiting und Kopie des letzten Abschlusswissens bleiben korrekt.
- [ ] Nur erlaubte waiting/active/paused/completed-Übergänge verändern Status und Revision; completed ist terminal.
- [ ] Abschluss erzeugt Recap/Handover und Status-Event atomar; Fehler in einem Helper rollen alles zurück.

**Legacy-Sperren:** `RPC-SEC-ANON-EVENT-HELPER`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/session-lifecycle/create_play_session/index.ts`
- `server/src/application/session-lifecycle/create_project_session/index.ts`
- `server/src/application/session-lifecycle/set_session_status/index.ts`
- `server/src/modules/session/index.ts`
- `server/src/application/commands/create_play_session.ts`
- `server/src/application/commands/create_project_session.ts`
- `server/src/application/commands/set_session_status.ts`
- `server/src/application/session-lifecycle/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts)
- [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts)
- [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts)
- [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts)
- [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql)
- [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql)
- [supabase/migrations/046_look_profiles.sql](../../../supabase/migrations/046_look_profiles.sql)
- [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql)
- [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql)
- [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql)
- [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-SESSION-ACCESS — [#869](https://github.com/iamthamanic/sagatree/issues/869)

Session-Beitritt, Austritt und Einladung

**Koordinator:** [#814](https://github.com/iamthamanic/sagatree/issues/814).

**RPCs:**

- [join_session_by_code](join_session_by_code.md)
- [leave_play_session](leave_play_session.md)
- [create_session_invite](create_session_invite.md)
- [resolve_session_invite](resolve_session_invite.md)
- [revoke_session_invite](revoke_session_invite.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SESSION-LIFECYCLE.

**Abnahme:**

- [ ] Beitritt normalisiert Codes, prüft vollständigen eigenen Charakter und verbindet Projektmitgliedschaft, Roster, Revision und Join-Event atomar.
- [ ] Fremdnutzer-Austritt darf weder Session-Revision noch Events verändern; der bekannte Legacy-Defekt ist explizit behoben.
- [ ] Einladung erzeugen/widerrufen verlangt Session-GM; Erneuern widerruft vorherige aktive Tokens.
- [ ] Abgelaufenes/widerrufenes/fehlendes Token und abgeschlossene Session liefern die belegten Fehlercodes; reine Auflösung tritt der Session nicht bei.

**Legacy-Sperren:** `RPC-SEC-ANON-EVENT-HELPER`, `RPC-SEC-LEAVE-FOREIGN`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/session-access/join_session_by_code/index.ts`
- `server/src/application/session-access/leave_play_session/index.ts`
- `server/src/application/session-access/create_session_invite/index.ts`
- `server/src/application/session-access/resolve_session_invite/index.ts`
- `server/src/application/session-access/revoke_session_invite/index.ts`
- `server/src/modules/session/index.ts`
- `server/src/application/commands/join_session_by_code.ts`
- `server/src/application/commands/leave_play_session.ts`
- `server/src/application/commands/create_session_invite.ts`
- `server/src/application/commands/resolve_session_invite.ts`
- `server/src/application/commands/revoke_session_invite.ts`
- `server/src/application/session-access/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts)
- [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts)
- [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts)
- [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql)
- [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql)
- [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql)
- [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql)
- [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql)
- [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql)
- [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql)
- [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql)
- [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql)
- [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql)
- [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql)
- [supabase/migrations/055_session_invites.sql](../../../supabase/migrations/055_session_invites.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql)
- [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-SESSION-RECAP — [#870](https://github.com/iamthamanic/sagatree/issues/870)

Recap-Projektion und Zusammenfassung

**Koordinator:** [#814](https://github.com/iamthamanic/sagatree/issues/814).

**RPCs:**

- [get_session_recap](get_session_recap.md)
- [save_session_recap_summary](save_session_recap_summary.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SESSION-LIFECYCLE.

**Abnahme:**

- [ ] GM sieht Draft; Player erhält ausschließlich freigegebene Zusammenfassung und redigierte Highlights.
- [ ] Beide SQL-Overloads und die mögliche Zweiparameter-Auflösungsambiguität werden gegen PostgreSQL geprüft; Zielaufruf ist eindeutig.
- [ ] Draft/approved/none-Speicherung verändert nur Summary-Felder eines vorhandenen Recaps und erhält Highlights/Snapshot.
- [ ] Fremdprojekt, nicht teilnehmender Akteur und ungültiger Status scheitern ohne Summary-Änderung.

**Legacy-Sperren:** `RPC-OVERLOAD-RECAP-AMBIGUITY`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/session-recap/get_session_recap/index.ts`
- `server/src/application/session-recap/save_session_recap_summary/index.ts`
- `server/src/modules/session/index.ts`
- `server/src/application/commands/get_session_recap.ts`
- `server/src/application/commands/save_session_recap_summary.ts`
- `server/src/application/session-recap/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/session/contracts/session-prepare-recap.ts](../../../src/domains/session/contracts/session-prepare-recap.ts)
- [src/infrastructure/session/session-recap-ai-service.ts](../../../src/infrastructure/session/session-recap-ai-service.ts)
- [src/infrastructure/session/session-recap-service.ts](../../../src/infrastructure/session/session-recap-service.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql)
- [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql)
- [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-SAGA-AUTHORING — [#871](https://github.com/iamthamanic/sagatree/issues/871)

Saga-Entwurf, Kopie und Veröffentlichung

**Koordinator:** [#815](https://github.com/iamthamanic/sagatree/issues/815).

**RPCs:**

- [create_user_saga_definition](create_user_saga_definition.md)
- [copy_native_saga_definition](copy_native_saga_definition.md)
- [get_saga_definition_editor](get_saga_definition_editor.md)
- [save_saga_definition_draft](save_saga_definition_draft.md)
- [publish_saga_definition_version](publish_saga_definition_version.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04.

**Abnahme:**

- [ ] Owner-Scope schützt Entwurf und Veröffentlichung; native Definitionen bleiben unveränderlich.
- [ ] Editor-Lesen kann fehlenden Draft anlegen; wiederholtes Lesen erzeugt keinen zweiten Draft.
- [ ] Save/Publish sperren die Definition und prüfen erwartete Revision; Konflikt 40001 hinterlässt keine neue Veröffentlichung.
- [ ] Native Kopie erzeugt eigene Definition mit korrekten Draft-/Published-Versionen; Veröffentlichung überschreibt keine bestehende Version.

**Legacy-Sperren:** Keine zusätzlich erfassten RPC-spezifischen Sperren.

**Vorgeschlagene Zielmodule:**

- `server/src/application/saga-authoring/create_user_saga_definition/index.ts`
- `server/src/application/saga-authoring/copy_native_saga_definition/index.ts`
- `server/src/application/saga-authoring/get_saga_definition_editor/index.ts`
- `server/src/application/saga-authoring/save_saga_definition_draft/index.ts`
- `server/src/application/saga-authoring/publish_saga_definition_version/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/create_user_saga_definition.ts`
- `server/src/application/commands/copy_native_saga_definition.ts`
- `server/src/application/commands/get_saga_definition_editor.ts`
- `server/src/application/commands/save_saga_definition_draft.ts`
- `server/src/application/commands/publish_saga_definition_version.ts`
- `server/src/application/saga-authoring/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts)
- [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql)
- [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql)

## RPC-SAGA-VERSION-READ — [#872](https://github.com/iamthamanic/sagatree/issues/872)

Saga-Versionen und native Katalogprojektion

**Koordinator:** [#815](https://github.com/iamthamanic/sagatree/issues/815).

**RPCs:**

- [get_native_saga_definition_by_slug](get_native_saga_definition_by_slug.md)
- [get_saga_definition_version](get_saga_definition_version.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SAGA-AUTHORING.

**Abnahme:**

- [ ] Native Slug-Auflösung wählt die neueste veröffentlichte Version; unbekannter Slug liefert P0002.
- [ ] Versionszugriff unterscheidet native Veröffentlichung, eigenen Inhalt und aktive Projektmitgliedschaft.
- [ ] Die GM-Projektion folgt nachgewiesenen Rollen; Player-Payload entfernt GM-Bereiche über den referenzierten Helper.
- [ ] Infrastruktur-Decoder verarbeitet alle Pflichtfelder und verwirft ungültige Payload-Formen.

**Legacy-Sperren:** Keine zusätzlich erfassten RPC-spezifischen Sperren.

**Vorgeschlagene Zielmodule:**

- `server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts`
- `server/src/application/saga-version-read/get_saga_definition_version/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/get_native_saga_definition_by_slug.ts`
- `server/src/application/commands/get_saga_definition_version.ts`
- `server/src/application/saga-version-read/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts)
- [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql)
- [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-SAGA-PROVISION — [#873](https://github.com/iamthamanic/sagatree/issues/873)

Spielgruppe aus Version und Starter-Provisionierung

**Koordinator:** [#815](https://github.com/iamthamanic/sagatree/issues/815).

**RPCs:**

- [create_project_from_saga_version](create_project_from_saga_version.md)
- [duplicate_saga_playthrough](duplicate_saga_playthrough.md)
- [ensure_native_starter_project](ensure_native_starter_project.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SAGA-VERSION-READ.

**Abnahme:**

- [ ] Neue Spielgruppe bindet passende veröffentlichte Saga-Version und Actor-GM-Mitgliedschaft in derselben Transaktion.
- [ ] fresh und with_progress erzeugen neue Projekte; nur with_progress übernimmt laufenden Fortschritt, keine Session-Identitäten werden wiederverwendet.
- [ ] Dornhain-Starter-Aufrufe liefern dieselbe vorhandene Spielgruppe und reparieren definierte Seed-/Binding-/Charakterdaten idempotent.
- [ ] Fremde private_backfill-Versionen, unpassende Saga/Version und unzulässige Duplizierung werden abgewiesen; Zugriffsregel für user-Veröffentlichungen ist ausdrücklich entschieden.

**Legacy-Sperren:** `RPC-POLICY-USER-PUBLISHED`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/saga-provision/create_project_from_saga_version/index.ts`
- `server/src/application/saga-provision/duplicate_saga_playthrough/index.ts`
- `server/src/application/saga-provision/ensure_native_starter_project/index.ts`
- `server/src/modules/project/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/create_project_from_saga_version.ts`
- `server/src/application/commands/duplicate_saga_playthrough.ts`
- `server/src/application/commands/ensure_native_starter_project.ts`
- `server/src/application/saga-provision/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts)
- [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql)
- [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql)
- [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql)
- [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql)
- [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql)
- [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/046_look_profiles.sql](../../../supabase/migrations/046_look_profiles.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql)
- [supabase/migrations/067_ensure_native_starter_project.sql](../../../supabase/migrations/067_ensure_native_starter_project.sql)
- [supabase/migrations/068_world_maps.sql](../../../supabase/migrations/068_world_maps.sql)
- [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql)
- [supabase/migrations/076_dornhain_full_catalog_seed.sql](../../../supabase/migrations/076_dornhain_full_catalog_seed.sql)
- [supabase/migrations/077_dornhain_default_all_accounts.sql](../../../supabase/migrations/077_dornhain_default_all_accounts.sql)
- [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql)
- [supabase/migrations/082_dornhain_pregen_full_sheets.sql](../../../supabase/migrations/082_dornhain_pregen_full_sheets.sql)
- [supabase/migrations/082_duplicate_saga_playthrough.sql](../../../supabase/migrations/082_duplicate_saga_playthrough.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql)
- [supabase/migrations/088_gm_earthspirit_presence_character.sql](../../../supabase/migrations/088_gm_earthspirit_presence_character.sql)
- [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql)
- [supabase/migrations/090_dornhain_basic_world_map.sql](../../../supabase/migrations/090_dornhain_basic_world_map.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)
- [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)
- [supabase/migrations/098_dornhain_unified_atlas_starter.sql](../../../supabase/migrations/098_dornhain_unified_atlas_starter.sql)
- [supabase/migrations/099_dornhain_unified_world_map_v2.sql](../../../supabase/migrations/099_dornhain_unified_world_map_v2.sql)
- [supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql](../../../supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql)
- [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql)
- [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql)
- [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql)

## RPC-PROJECT-MEMBERSHIP — [#874](https://github.com/iamthamanic/sagatree/issues/874)

Projektbeitritt und eigener Charakter

**Koordinator:** [#815](https://github.com/iamthamanic/sagatree/issues/815).

**RPCs:**

- [join_project_by_code](join_project_by_code.md)
- [set_my_project_character](set_my_project_character.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SAGA-PROVISION.

**Abnahme:**

- [ ] Projektbeitritt normalisiert Join-Code und erzeugt genau eine aktive Player-Mitgliedschaft.
- [ ] Vorhandene Mitgliedschaft und unbekannter Code folgen den belegten Fehlerfällen ohne doppelte Zeile.
- [ ] Nur vollständiger eigener Charakter darf zugeordnet werden; NULL entfernt die Zuordnung.
- [ ] Änderung der Figur erfordert die eigene aktive Projektmitgliedschaft und verändert keine fremde Mitgliedschaft.

**Legacy-Sperren:** Keine zusätzlich erfassten RPC-spezifischen Sperren.

**Vorgeschlagene Zielmodule:**

- `server/src/application/project-membership/join_project_by_code/index.ts`
- `server/src/application/project-membership/set_my_project_character/index.ts`
- `server/src/modules/project/index.ts`
- `server/src/application/commands/join_project_by_code.ts`
- `server/src/application/commands/set_my_project_character.ts`
- `server/src/application/project-membership/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts)
- [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql)
- [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql)
- [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql)
- [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql)
- [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql)
- [supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql](../../../supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql)
- [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-SAGA-GOVERNANCE — [#875](https://github.com/iamthamanic/sagatree/issues/875)

Saga-Berechtigungen, Bindings und Bundles

**Koordinator:** [#815](https://github.com/iamthamanic/sagatree/issues/815).

**RPCs:**

- [get_my_saga_permissions](get_my_saga_permissions.md)
- [list_saga_bindings](list_saga_bindings.md)
- [list_saga_member_permission_state](list_saga_member_permission_state.md)
- [set_saga_member_bundle](set_saga_member_bundle.md)
- [set_saga_binding_reveal](set_saga_binding_reveal.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-PROJECT-MEMBERSHIP.

**Abnahme:**

- [ ] GM, explizite Grants und aktive Mitgliedschaft bestimmen die dokumentierten Permission-Keys und sichtbaren Bindings.
- [ ] Bundle-Wechsel ersetzt Grants und Assignment atomar; der letzte Governance-Berechtigte kann nicht ausgesperrt werden.
- [ ] Binding-Reveal akzeptiert nur gm_only/party/unlisted und bleibt auf das konkrete Projekt beschränkt.
- [ ] Unlisted wird auch für GM nicht in der Standardliste ausgegeben; Mitglieder-/Binding-Decoder und Reihenfolge bleiben belegt.

**Legacy-Sperren:** Keine zusätzlich erfassten RPC-spezifischen Sperren.

**Vorgeschlagene Zielmodule:**

- `server/src/application/saga-governance/get_my_saga_permissions/index.ts`
- `server/src/application/saga-governance/list_saga_bindings/index.ts`
- `server/src/application/saga-governance/list_saga_member_permission_state/index.ts`
- `server/src/application/saga-governance/set_saga_member_bundle/index.ts`
- `server/src/application/saga-governance/set_saga_binding_reveal/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/modules/permissions/index.ts`
- `server/src/application/commands/get_my_saga_permissions.ts`
- `server/src/application/commands/list_saga_bindings.ts`
- `server/src/application/commands/list_saga_member_permission_state.ts`
- `server/src/application/commands/set_saga_member_bundle.ts`
- `server/src/application/commands/set_saga_binding_reveal.ts`
- `server/src/application/saga-governance/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/project/saga-permission-service.ts](../../../src/infrastructure/project/saga-permission-service.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)
- [supabase/migrations/096_donalu_place_map_link_rpc.sql](../../../supabase/migrations/096_donalu_place_map_link_rpc.sql)

## RPC-SAGA-PROJECTIONS — [#876](https://github.com/iamthamanic/sagatree/issues/876)

Saga-Übersicht, Lore und Outcome-Übernahme

**Koordinator:** [#815](https://github.com/iamthamanic/sagatree/issues/815).

**RPCs:**

- [get_saga_overview](get_saga_overview.md)
- [get_saga_lore_timeline](get_saga_lore_timeline.md)
- [promote_session_outcome_to_saga](promote_session_outcome_to_saga.md)
- [promote_session_outcome_to_world](promote_session_outcome_to_world.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SAGA-GOVERNANCE, RPC-SESSION-RECAP.

**Abnahme:**

- [ ] Übersicht und Lore berücksichtigen aktive Mitgliedschaft, geheimen Inhalt und freigegebenen Session-/Adventure-Fortschritt.
- [ ] Beide Promotion-Namen werden über die TypeScript-Literal-Union vollständig erfasst; Request p_session_id/p_consequence_id und Decoder bleiben belegt.
- [ ] Outcome-Übernahme ergänzt genau die gewählte Konsequenz im Saga-Draft bzw. Weltmodul; nur ein neuer Saga-Fact erhöht draft_revision, die Session-Revision bleibt unverändert.
- [ ] Nicht-GM, fehlende Konsequenz und Wiederholung haben explizite Fixtures ohne fremde Zustandsänderung.

**Legacy-Sperren:** `RPC-SEC-ANON-EVENT-HELPER`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/saga-projections/get_saga_overview/index.ts`
- `server/src/application/saga-projections/get_saga_lore_timeline/index.ts`
- `server/src/application/saga-projections/promote_session_outcome_to_saga/index.ts`
- `server/src/application/saga-projections/promote_session_outcome_to_world/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/get_saga_overview.ts`
- `server/src/application/commands/get_saga_lore_timeline.ts`
- `server/src/application/commands/promote_session_outcome_to_saga.ts`
- `server/src/application/commands/promote_session_outcome_to_world.ts`
- `server/src/application/saga-projections/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts)
- [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts)
- [src/domains/session/contracts/session-outcome-promotion.ts](../../../src/domains/session/contracts/session-outcome-promotion.ts)
- [src/infrastructure/project/saga-overview-service.ts](../../../src/infrastructure/project/saga-overview-service.ts)
- [src/infrastructure/project/saga-permission-service.ts](../../../src/infrastructure/project/saga-permission-service.ts)
- [src/infrastructure/saga/session-outcome-promotion-service.ts](../../../src/infrastructure/saga/session-outcome-promotion-service.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql)
- [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql)
- [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql)
- [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql)
- [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql)
- [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/060_saga_overview.sql](../../../supabase/migrations/060_saga_overview.sql)
- [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql)
- [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql)
- [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql)
- [supabase/migrations/069_party_location_overview.sql](../../../supabase/migrations/069_party_location_overview.sql)
- [supabase/migrations/070_saga_promote_session_outcomes.sql](../../../supabase/migrations/070_saga_promote_session_outcomes.sql)
- [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql)
- [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql)
- [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql)
- [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql)
- [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql)
- [supabase/migrations/091_saga_overview_world_profile_id.sql](../../../supabase/migrations/091_saga_overview_world_profile_id.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)
- [supabase/migrations/093_fix_saga_overview_shared_adventure.sql](../../../supabase/migrations/093_fix_saga_overview_shared_adventure.sql)
- [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql)

## RPC-NPC-INSTANCES — [#877](https://github.com/iamthamanic/sagatree/issues/877)

NPC-Instanzen und Controller-Zuordnung

**Koordinator:** [#816](https://github.com/iamthamanic/sagatree/issues/816).

**RPCs:**

- [assign_npc_creature_controller](assign_npc_creature_controller.md)
- [clear_npc_creature_instance_temp_controllers_for_session](clear_npc_creature_instance_temp_controllers_for_session.md)
- [spawn_npc_creature_instance](spawn_npc_creature_instance.md)
- [update_npc_creature_instance_runtime](update_npc_creature_instance_runtime.md)
- [remove_npc_creature_instance](remove_npc_creature_instance.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04, RPC-SESSION-LIFECYCLE.

**Abnahme:**

- [ ] Instanzerzeugung/Entfernung verlangen den belegten GM-Scope und überprüfen Projekt-/Session-Zugehörigkeit.
- [ ] Runtime-Updates sind GM-exklusiv, ersetzen das vollständige Runtime-Objekt und lassen den Snapshot unverändert; permanente oder temporäre Controller erhalten dadurch keine Schreibberechtigung.
- [ ] Controller-Zuordnung verlangt aktives Projektmitglied; gespeicherte Definitionen müssen aktiv und full-sheet sein.
- [ ] Session-Cleanup entfernt ausschließlich deren temporäre Controller und liefert die exakte Anzahl geänderter Instanzen.

**Legacy-Sperren:** Keine zusätzlich erfassten RPC-spezifischen Sperren.

**Vorgeschlagene Zielmodule:**

- `server/src/application/npc-instances/assign_npc_creature_controller/index.ts`
- `server/src/application/npc-instances/clear_npc_creature_instance_temp_controllers_for_session/index.ts`
- `server/src/application/npc-instances/spawn_npc_creature_instance/index.ts`
- `server/src/application/npc-instances/update_npc_creature_instance_runtime/index.ts`
- `server/src/application/npc-instances/remove_npc_creature_instance/index.ts`
- `server/src/modules/npc-creature/index.ts`
- `server/src/application/commands/assign_npc_creature_controller.ts`
- `server/src/application/commands/clear_npc_creature_instance_temp_controllers_for_session.ts`
- `server/src/application/commands/spawn_npc_creature_instance.ts`
- `server/src/application/commands/update_npc_creature_instance_runtime.ts`
- `server/src/application/commands/remove_npc_creature_instance.ts`
- `server/src/application/npc-instances/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/npc-creature/npc-creature-controller.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-controller.persistence.ts)
- [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts)
- [src/infrastructure/npc-creature/npc-creature-service.ts](../../../src/infrastructure/npc-creature/npc-creature-service.ts)
- [src/infrastructure/npc-creature/npc-creature.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature.persistence.ts)
- [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts)
- [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts)
- [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts)
- [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql)
- [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql)
- [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql)
- [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql)
- [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql)
- [supabase/migrations/021_npc_creature_definitions.sql](../../../supabase/migrations/021_npc_creature_definitions.sql)
- [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql)
- [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql)
- [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql)
- [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql)
- [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql)
- [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql)
- [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql)
- [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql)
- [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql)
- [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql)
- [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql)
- [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql)
- [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql)

## RPC-MARKETPLACE-COUNT — [#878](https://github.com/iamthamanic/sagatree/issues/878)

Marketplace-Downloadzähler und Fallback

**Koordinator:** [#816](https://github.com/iamthamanic/sagatree/issues/816).

**RPCs:**

- [increment_marketplace_downloads](increment_marketplace_downloads.md)

**Abhängigkeiten:** GATE-01, GATE-02, GATE-04.

**Abnahme:**

- [ ] Die zwei identischen Definitionen außerhalb der Migrationskette werden als alternative Installationsquellen geführt; eine Deployment-Entscheidung liegt vor.
- [ ] Vorhandenes Item erhöht downloads atomar um eins, unbekanntes Item bleibt No-op; NULL-Verhalten ist belegt.
- [ ] Öffentliche Ausführbarkeit, fehlender search_path und fehlende Akteurprüfung sind explizite Legacy-Entscheidungen und werden nicht still als sicher übernommen.
- [ ] Client-RPC-Fehler und fehlende Funktion aktivieren den dokumentierten direkten Tabellenfallback; dessen Race-/RLS-Verhalten ist geprüft.

**Legacy-Sperren:** `RPC-ACL-MARKETPLACE-DEFINER`, `RPC-DEPLOY-OPTIONAL-MARKETPLACE`.

**Vorgeschlagene Zielmodule:**

- `server/src/application/marketplace-count/increment_marketplace_downloads/index.ts`
- `server/src/modules/marketplace/index.ts`
- `server/src/application/commands/increment_marketplace_downloads.ts`
- `server/src/application/marketplace-count/__tests__`

**Quellpfade einschließlich transitiver Definitionen/Decoder:**

- [src/infrastructure/marketplace/marketplace-service.ts](../../../src/infrastructure/marketplace/marketplace-service.ts)
- [src/lib/supabase.ts](../../../src/lib/supabase.ts)
- [src/supabase/add_marketplace_rpc.sql](../../../src/supabase/add_marketplace_rpc.sql)
- [src/supabase/deploy_marketplace.sql](../../../src/supabase/deploy_marketplace.sql)
