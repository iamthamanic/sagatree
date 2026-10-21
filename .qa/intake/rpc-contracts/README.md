# RPC-Quellverträge für Epic #773 / PREP-04 #777

**57 RPC-Namen vollständig erfasst:** die ursprünglichen 55 Literal-Aufrufe plus zwei über eine TypeScript-Literal-Union aufgerufene Outcome-Promotions. Die AST-Inventur enthält 57 aufgelöste Namensvarianten an 56 physischen Aufrufstellen.

**56 RPC-Namen / 57 wirksame Overloads** sind Teil der vollständig eingespielten Repository-Migrationskette. **Ein weiterer RPC-Name mit einer Signatur** ist ausschließlich in zwei optionalen Marketplace-Installationsskripten belegt. Bei save_session_recap_summary sind Zweierwrapper und Dreierfunktion beide vorhanden (get_session_recap selbst hat nur einen Overload); der Zweier-Atlas-Wrapper wurde dagegen durch Migration106 entfernt.

## Belegstand und Grenzen

- Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Sämtliche 106 SQL-Migrationsdateien wurden in voller lexikalischer Dateinamenreihenfolge verarbeitet; doppelte Nummernpräfixe werden nicht zusammengeworfen.
- PostgreSQL-/PLpgSQL-AST: pglast 7.21, 0 Parsefehler. Dynamische Umbenennungen073/079 und Funktionskörperumschreibung085 sind explizit nachgebildet.
- Isoliertes echtes PostgreSQL15: **177 von177 Public-Funktionen** stimmen in Body-Hash, Signatur, Parametern/Defaults, RETURNS, Sprache, Security-Kontext und Volatilität überein. Effektive ACL, finale Spalten und Constraints sind als Fixture-Beobachtung gespeichert.
- Für die 57 RPCs werden 149 erreichbare SQL-Funktionen einschließlich Helper und Trigger im gemeinsamen Katalog geführt. Marketplace-Trigger aus optionalen Skripten stehen separat beim Installationskandidaten.
- **Keine Aussage über eine produktiv deployte Datenbank.** apply-migrations.sh hat eine andere explizite Reihenfolge, endet107 und lässt080_item_thumbnail_webp,082_dornhain_pregen_full_sheets sowie108 aus. Die vollständige Repository-Kette ist deshalb bewusst vom unbekannten tatsächlichen Deployment getrennt.
- **Keine vollständige Verhaltens-/Produktfreigabe.** Die isolierten Negativtests reproduzieren Critical-/High-Legacy-Probleme. Die Architektur-Gates und der echte PostgREST-/JWT-/Browserpfad bleiben separat abzunehmen.

## Verbindliche Artefakte

| Datei | Inhalt |
| --- | --- |
| [inventory.json](inventory.json) | Schema v2: Signaturen, Parameter/Defaults/RETURNS, Auth, explizite Fehler mit Zweigen, reale Relationen, direkte/transitive Writes, Constraint-/Policybindung, Caller, Tests und Legacy-Sperren. |
| [effective-functions.json](effective-functions.json) | Vollständige wirksame SQL-Helper mit AST-Queries, Returns, Branches, Errors und Herkunft; Tabellen-Deklarationshistorie sowie Trigger/Policies. |
| [callers.json](callers.json) | TypeScript-AST: exakte Requests, umschließende Caller und referenzierte Decoder-/Mapper-/Typ-Deklarationen mit Hashes. |
| [postgres-proof.json](postgres-proof.json) | Isolierter Katalogvergleich inklusive finaler ACL, Spalten, Defaults und Constraints; keine Deploymentbehauptung. |
| [transport-observations.json](transport-observations.json) | Zwei echte isolierte GoTrue-/PostgREST-Antworten: Foreign-Liste HTTP403/42501 und verborgene Atlas-Karte HTTP500/P0002. |
| [legacy-observations.json](legacy-observations.json) | Echte isolierte Negativproben: rote Tests bedeuten reproduzierten Legacy-Defekt, keinen grünen Paritätsnachweis. |
| [semantics.json](semantics.json) | RPC-spezifische fachliche Source-Review, Transaktions-/Idempotenzgrenzen, 15 Runtime-Kinds und konkrete Nachfolger-Tests. |
| [split-groups.json](split-groups.json) | Exklusive maschinenlesbare Zuordnung aller57 RPCs zu18 realen Teilissues. |
| [SPLIT_TICKETS.md](SPLIT_TICKETS.md) | Verlinkte Teilissues mit vollständigem Scope, Abhängigkeiten und spezifischer Abnahme. |

## Legacy-Defekte und Entscheidungsbedarf

Sicherheitsfehler werden nicht als verpflichtende unsichere Parität fortgeschrieben. Nachfolger dürfen und müssen die explizit dokumentierten unerlaubten Zugriffe sperren.

| Schwere | ID | Betroffene RPCs | Befund |
| --- | --- | --- | --- |
| Critical | `RPC-SEC-ANON-ADVENTURE-HELPER` | `apply_session_runtime_command` | Auch anon kann im öffentlichen Adventure-Helper p_is_gm=true behaupten und fremde Projekt-Adventure-Daten schreiben. |
| Critical | `RPC-SEC-ANON-EVENT-HELPER` | `apply_session_runtime_command`, `join_session_by_code`, `leave_play_session`, `promote_session_outcome_to_saga`, `promote_session_outcome_to_world`, `set_session_player_presence`, `set_session_status` | Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen. |
| High | `RPC-RUNTIME-ROLL-OWNER-COLUMN` | `apply_session_runtime_command` | Nicht-GM-Roll-Aufruf greift auf v_character.user_id zu, obwohl characters.owner_user_id die wirksame Spalte ist; Baseline scheitert statt zu würfeln. |
| High | `RPC-SEC-CROSS-SAGA-REVEAL` | `get_world_atlas_map`, `list_world_atlas_maps`, `list_world_place_map_links`, `list_world_places` | Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen. |
| High | `RPC-SEC-LEAVE-FOREIGN` | `leave_play_session` | Authentifizierter Fremdnutzer kann bei bekannter Session-UUID Revision erhöhen und leave-Event einfügen. |
| High | `RPC-SEC-LEGACY-MAP-FLAG` | `get_world_map` | Nicht-Editor mit Welt-Leserecht kann undiscovered Pins mit p_player_view=false lesen. |
| Medium | `RPC-ACL-MARKETPLACE-DEFINER` | `increment_marketplace_downloads` | Optionale Downloadfunktion ist SECURITY DEFINER ohne search_path-Pin und ohne Akteurprüfung bei bestehenbleibendem PUBLIC-EXECUTE. |
| Medium | `RPC-DATA-SHARED-MAP-DELETE` | `delete_world_node` | Die Kartenlöschung umfasst jede Karte eines Teilbaumlinks, auch bei weiteren Links außerhalb des Teilbaums. |
| Medium | `RPC-DEPLOY-OPTIONAL-MARKETPLACE` | `increment_marketplace_downloads` | Die Funktion existiert nur in optionalen src/supabase-Installationsskripten und fehlt in der vollständig eingespielten Repository-Migrationskette. |
| Medium | `RPC-OVERLOAD-RECAP-AMBIGUITY` | `save_session_recap_summary` | Der zweiparametrige Aufruf save_session_recap_summary(uuid, text) ist durch Zweierwrapper plus Dreierfunktion mit Default mehrdeutig (SQLSTATE 42725). get_session_recap(uuid) besitzt dagegen nur einen wirksamen Overload und ist von diesem Befund nicht betroffen. |
| Medium | `RPC-POLICY-USER-PUBLISHED` | `create_project_from_saga_version` | Veröffentlichte User-Sagas können von anderen authentifizierten Nutzern als eigene GM-Spielgruppe instanziert werden. |

## Vollständiger Index

| RPC | Wirksame/optionale Signaturen | Status | Teilissue |
| --- | --- | --- | --- |
| [apply_session_runtime_command](apply_session_runtime_command.md) | 1 | source-verified | [#867](https://github.com/iamthamanic/sagatree/issues/867) |
| [archive_world_node_subtree](archive_world_node_subtree.md) | 1 | source-verified | [#866](https://github.com/iamthamanic/sagatree/issues/866) |
| [assign_npc_creature_controller](assign_npc_creature_controller.md) | 1 | source-verified | [#877](https://github.com/iamthamanic/sagatree/issues/877) |
| [clear_npc_creature_instance_temp_controllers_for_session](clear_npc_creature_instance_temp_controllers_for_session.md) | 1 | source-verified | [#877](https://github.com/iamthamanic/sagatree/issues/877) |
| [copy_native_saga_definition](copy_native_saga_definition.md) | 1 | source-verified | [#871](https://github.com/iamthamanic/sagatree/issues/871) |
| [create_play_session](create_play_session.md) | 1 | source-verified | [#868](https://github.com/iamthamanic/sagatree/issues/868) |
| [create_project_from_saga_version](create_project_from_saga_version.md) | 1 | source-verified | [#873](https://github.com/iamthamanic/sagatree/issues/873) |
| [create_project_session](create_project_session.md) | 1 | source-verified | [#868](https://github.com/iamthamanic/sagatree/issues/868) |
| [create_session_invite](create_session_invite.md) | 1 | source-verified | [#869](https://github.com/iamthamanic/sagatree/issues/869) |
| [create_user_saga_definition](create_user_saga_definition.md) | 1 | source-verified | [#871](https://github.com/iamthamanic/sagatree/issues/871) |
| [create_world_node_with_maps](create_world_node_with_maps.md) | 1 | source-verified | [#864](https://github.com/iamthamanic/sagatree/issues/864) |
| [delete_world_node](delete_world_node.md) | 1 | source-verified | [#866](https://github.com/iamthamanic/sagatree/issues/866) |
| [duplicate_saga_playthrough](duplicate_saga_playthrough.md) | 1 | source-verified | [#873](https://github.com/iamthamanic/sagatree/issues/873) |
| [duplicate_world_node](duplicate_world_node.md) | 1 | source-verified | [#865](https://github.com/iamthamanic/sagatree/issues/865) |
| [ensure_native_starter_project](ensure_native_starter_project.md) | 1 | source-verified | [#873](https://github.com/iamthamanic/sagatree/issues/873) |
| [ensure_world_atlas_root](ensure_world_atlas_root.md) | 1 | source-verified | [#862](https://github.com/iamthamanic/sagatree/issues/862) |
| [get_my_saga_permissions](get_my_saga_permissions.md) | 1 | source-verified | [#875](https://github.com/iamthamanic/sagatree/issues/875) |
| [get_native_saga_definition_by_slug](get_native_saga_definition_by_slug.md) | 1 | source-verified | [#872](https://github.com/iamthamanic/sagatree/issues/872) |
| [get_saga_definition_editor](get_saga_definition_editor.md) | 1 | source-verified | [#871](https://github.com/iamthamanic/sagatree/issues/871) |
| [get_saga_definition_version](get_saga_definition_version.md) | 1 | source-verified | [#872](https://github.com/iamthamanic/sagatree/issues/872) |
| [get_saga_lore_timeline](get_saga_lore_timeline.md) | 1 | source-verified | [#876](https://github.com/iamthamanic/sagatree/issues/876) |
| [get_saga_overview](get_saga_overview.md) | 1 | source-verified | [#876](https://github.com/iamthamanic/sagatree/issues/876) |
| [get_session_recap](get_session_recap.md) | 1 | source-verified | [#870](https://github.com/iamthamanic/sagatree/issues/870) |
| [get_session_runtime_snapshot](get_session_runtime_snapshot.md) | 1 | source-verified | [#867](https://github.com/iamthamanic/sagatree/issues/867) |
| [get_world_atlas_map](get_world_atlas_map.md) | 1 | source-verified | [#862](https://github.com/iamthamanic/sagatree/issues/862) |
| [get_world_map](get_world_map.md) | 1 | source-verified | [#861](https://github.com/iamthamanic/sagatree/issues/861) |
| [increment_marketplace_downloads](increment_marketplace_downloads.md) | 1 | source-blocked | [#878](https://github.com/iamthamanic/sagatree/issues/878) |
| [join_project_by_code](join_project_by_code.md) | 1 | source-verified | [#874](https://github.com/iamthamanic/sagatree/issues/874) |
| [join_session_by_code](join_session_by_code.md) | 1 | source-verified | [#869](https://github.com/iamthamanic/sagatree/issues/869) |
| [leave_play_session](leave_play_session.md) | 1 | source-verified | [#869](https://github.com/iamthamanic/sagatree/issues/869) |
| [list_saga_bindings](list_saga_bindings.md) | 1 | source-verified | [#875](https://github.com/iamthamanic/sagatree/issues/875) |
| [list_saga_member_permission_state](list_saga_member_permission_state.md) | 1 | source-verified | [#875](https://github.com/iamthamanic/sagatree/issues/875) |
| [list_world_atlas_maps](list_world_atlas_maps.md) | 1 | source-verified | [#862](https://github.com/iamthamanic/sagatree/issues/862) |
| [list_world_place_map_links](list_world_place_map_links.md) | 1 | source-verified | [#863](https://github.com/iamthamanic/sagatree/issues/863) |
| [list_world_places](list_world_places.md) | 1 | source-verified | [#863](https://github.com/iamthamanic/sagatree/issues/863) |
| [preview_world_node_consequences](preview_world_node_consequences.md) | 1 | source-verified | [#866](https://github.com/iamthamanic/sagatree/issues/866) |
| [promote_session_outcome_to_saga](promote_session_outcome_to_saga.md) | 1 | source-verified | [#876](https://github.com/iamthamanic/sagatree/issues/876) |
| [promote_session_outcome_to_world](promote_session_outcome_to_world.md) | 1 | source-verified | [#876](https://github.com/iamthamanic/sagatree/issues/876) |
| [publish_saga_definition_version](publish_saga_definition_version.md) | 1 | source-verified | [#871](https://github.com/iamthamanic/sagatree/issues/871) |
| [remove_npc_creature_instance](remove_npc_creature_instance.md) | 1 | source-verified | [#877](https://github.com/iamthamanic/sagatree/issues/877) |
| [rename_world_node](rename_world_node.md) | 1 | source-verified | [#864](https://github.com/iamthamanic/sagatree/issues/864) |
| [reparent_world_node](reparent_world_node.md) | 1 | source-verified | [#865](https://github.com/iamthamanic/sagatree/issues/865) |
| [resolve_session_invite](resolve_session_invite.md) | 1 | source-verified | [#869](https://github.com/iamthamanic/sagatree/issues/869) |
| [revoke_session_invite](revoke_session_invite.md) | 1 | source-verified | [#869](https://github.com/iamthamanic/sagatree/issues/869) |
| [save_saga_definition_draft](save_saga_definition_draft.md) | 1 | source-verified | [#871](https://github.com/iamthamanic/sagatree/issues/871) |
| [save_session_recap_summary](save_session_recap_summary.md) | 2 | source-verified | [#870](https://github.com/iamthamanic/sagatree/issues/870) |
| [save_world_map](save_world_map.md) | 1 | source-verified | [#861](https://github.com/iamthamanic/sagatree/issues/861) |
| [set_my_project_character](set_my_project_character.md) | 1 | source-verified | [#874](https://github.com/iamthamanic/sagatree/issues/874) |
| [set_saga_binding_reveal](set_saga_binding_reveal.md) | 1 | source-verified | [#875](https://github.com/iamthamanic/sagatree/issues/875) |
| [set_saga_member_bundle](set_saga_member_bundle.md) | 1 | source-verified | [#875](https://github.com/iamthamanic/sagatree/issues/875) |
| [set_session_player_presence](set_session_player_presence.md) | 1 | source-verified | [#867](https://github.com/iamthamanic/sagatree/issues/867) |
| [set_session_status](set_session_status.md) | 1 | source-verified | [#868](https://github.com/iamthamanic/sagatree/issues/868) |
| [spawn_npc_creature_instance](spawn_npc_creature_instance.md) | 1 | source-verified | [#877](https://github.com/iamthamanic/sagatree/issues/877) |
| [update_npc_creature_instance_runtime](update_npc_creature_instance_runtime.md) | 1 | source-verified | [#877](https://github.com/iamthamanic/sagatree/issues/877) |
| [upsert_world_atlas_map](upsert_world_atlas_map.md) | 1 | source-verified | [#862](https://github.com/iamthamanic/sagatree/issues/862) |
| [upsert_world_place](upsert_world_place.md) | 1 | source-verified | [#863](https://github.com/iamthamanic/sagatree/issues/863) |
| [upsert_world_place_map_link](upsert_world_place_map_link.md) | 1 | source-verified | [#863](https://github.com/iamthamanic/sagatree/issues/863) |

## Reproduzieren und Drift prüfen

Die Werkzeuge dienen nur der Vertragsanalyse. Sie verändern keine Produktmigrationen oder Anwendungsdaten.

```sh
python -m pip install -r .qa/intake/rpc-contracts/parser-requirements.txt
node scripts/stack-migration-rpc-callers.mjs --check
python scripts/stack-migration-rpc-verify-postgres.py --check
python scripts/stack-migration-rpc-extract.py --check
python scripts/stack-migration-rpc-docs.py --check
```

Ein frischer Datenbankvergleich importiert den vom separaten Baseline-Harness erzeugten pg-catalog.json und report.json über --catalog/--report. Ohne diese Argumente prüft das Werkzeug ausschließlich die gebundene isolierte Beobachtung gegen aktuelle Quellen. Ein Ergebnis wird dadurch nicht zu einem neuen Live-Test.
