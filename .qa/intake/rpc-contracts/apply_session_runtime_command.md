# RPC-Vertrag: `apply_session_runtime_command`

Führt genau einen der 15 Session-Runtime-Befehlstypen mit Revisionsprüfung, Event und rollenabhängiger Snapshot-Antwort aus.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#867](https://github.com/iamthamanic/sagatree/issues/867) — RPC-SESSION-RUNTIME; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Validierte Kinds: join, leave, presence, status, roll, damage, condition, scene, combat, gameplay, program, reveal, life, adventure, cue. Vollständige Varianten und Helper-Verträge stehen im operations-Feld und im verlinkten SQL.
- Erfolgreicher Erstaufruf erhöht runtime_revision um eins, schreibt world_state und append_session_event und liefert den aktuell erlaubten Snapshot mit idempotentReplay=false.
- join/leave sind hier reine Runtime-Events ohne Roster-Aufnahme/-Entfernung. status prüft GM und erzeugt Event/Revision, ändert aber sessions.status nicht. Dafür existieren getrennte Lifecycle-RPCs.
- presence setzt nur die eigene vorhandene Roster-Zeile. scene unterscheidet vollständige Präsentation und sceneId; gameplay übernimmt sceneId und nur ganzzahliges checkTarget.
- Bei vorhandenem sessionbezogenem Idempotency-Key wird vor dem Session-Lock der aktuelle Snapshot mit idempotentReplay=true und eventId zurückgegeben, nicht eine gespeicherte Originalantwort.
- Bekannter Legacy-Blocker: Player-roll erreicht den veralteten v_character.user_id-Feldzugriff und scheitert in der aktuellen PostgreSQL-Baseline; der beabsichtigte Roll-Vertrag ist ohne Korrektur nicht ausführbar.

## Berechtigungen

- auth.uid() und is_session_participant(session, actor) sind erforderlich; GM wird über is_project_gm bestimmt, Director getrennt über sagatree_session_has_director.
- Nach Abschluss sind nur leave und presence erlaubt. Szenen, Gameplay, Reveal, Life und Adventure verlangen GM; Program und Cue erlauben GM oder Director; Combat/Roll haben weitere konkrete Helper-Prüfungen.

## SQL-Signatur 1

`public.apply_session_runtime_command(uuid,bigint,text,jsonb,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_expected_revision | `bigint` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_kind | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_payload | `jsonb` | DEFAULT | `CAST('{}' AS jsonb)` |
| p_idempotency_key | `text` | DEFAULT | `NULL` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) (Zeilen 233–426, SHA-256 `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/apply_session_runtime_command-1.sql](effective-sql/apply_session_runtime_command-1.sql); SHA-256 `bb69a3638e9e085c410b89afa5218eb221830484f6011824b19bd784019bf9ae`.

**Nachträgliche Transformationen:**

- body-rewrite: [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) (Zeilen 1–28, SHA-256 `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3`)

### Ausführungskontext und ACL

| Eigenschaft | Belegter Wert |
| --- | --- |
| SECURITY DEFINER | True |
| search_path | `SET search_path TO 'public', 'pg_temp'` |
| Migration-/Skript-EXECUTE-Deklarationen | authenticated |
| ACL-Scope | Migration/optional-script declarations starting from PostgreSQL PUBLIC default; platform default ACL is separate below. |

Die Plattform setzt zusätzliche Defaultprivilegien. Deshalb ist die folgende beobachtete ACL für das isolierte Fixture maßgeblich, nicht allein die GRANT/REVOKE-Liste der Migration. EXECUTE-Berechtigung ist vom inneren Auth-Guard zu unterscheiden.

| Owner | Effektive Fixture-ACL | authenticated EXECUTE | anon EXECUTE |
| --- | --- | --- | --- |
| postgres | `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | True |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 45 | v_key IS NOT NULL ∧ FOUND | `public.get_session_runtime_snapshot(p_session_id)         \\|\\| jsonb_build_object('idempotentReplay', true, 'eventId', v_existing.id)` |
| 178 | unbedingt | `public.get_session_runtime_snapshot(p_session_id)     \\|\\| jsonb_build_object('idempotentReplay', false)` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `idempotentReplay`
- `idempotentReplay`, `eventId`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |
| 22023 | session_id required | — | p_session_id IS NULL |
| 22023 | Invalid event kind | — | p_kind NOT IN (     'join', 'leave', 'presence', 'status', 'roll', 'damage',     'condition', 'scene', 'combat', 'gameplay', 'program', 'reveal',     'life', 'adventure', 'cue'   ) |
| 42501 | forbidden | — | NOT public.is_session_participant(p_session_id, actor) |
| P0002 | Session not found | — | NOT FOUND |
| 22023 | Completed sessions cannot accept gameplay commands | — | v_session.status = 'completed' AND p_kind NOT IN ('leave', 'presence') |
| 40001 | stale revision: expected %, actual % | p_expected_revision, v_session.runtime_revision | v_session.runtime_revision IS DISTINCT FROM p_expected_revision |
| 42501 | forbidden | — | ELSE AFTER: p_kind = 'roll' ; p_kind = 'combat' ; p_kind = 'damage' ; p_kind = 'condition' ; p_kind = 'life' ; p_kind = 'adventure' ; p_kind = 'cue' ∧ p_kind = 'scene' ∧ NOT v_is_gm |
| 42501 | forbidden | — | ELSE AFTER: p_kind = 'roll' ; p_kind = 'combat' ; p_kind = 'damage' ; p_kind = 'condition' ; p_kind = 'life' ; p_kind = 'adventure' ; p_kind = 'cue' ; p_kind = 'scene' ∧ p_kind = 'program' ∧ NOT v_is_gm AND NOT v_is_director |
| 42501 | forbidden | — | ELSE AFTER: p_kind = 'roll' ; p_kind = 'combat' ; p_kind = 'damage' ; p_kind = 'condition' ; p_kind = 'life' ; p_kind = 'adventure' ; p_kind = 'cue' ; p_kind = 'scene' ; p_kind = 'program' ∧ p_kind = 'reveal' ∧ NOT v_is_gm |
| 42501 | forbidden | — | ELSE AFTER: p_kind = 'roll' ; p_kind = 'combat' ; p_kind = 'damage' ; p_kind = 'condition' ; p_kind = 'life' ; p_kind = 'adventure' ; p_kind = 'cue' ; p_kind = 'scene' ; p_kind = 'program' ; p_kind = 'reveal' ∧ p_kind = 'gameplay' ∧ NOT v_is_gm |
| 42501 | forbidden | — | p_kind = 'status' ∧ NOT v_is_gm |

## Transaktion, Idempotenz und Folgewirkungen

- Eine SQL-Funktionsausführung ist eine Transaktion; SELECT sessions FOR UPDATE serialisiert Änderungen derselben Session.
- Key wird getrimmt; leer wird NULL. Dedup-Schlüssel ist session_id+idempotency_key, ohne Actor-/Payload-Vergleich. Replay-Lookup erfolgt vor der Sperre; gleichzeitige Erstaufrufe können deshalb 40001 statt Replay erhalten.
- Keine externen Netzwerkaufrufe; Folgewirkungen erfolgen über SQL-Helper, Trigger und Session-Event in derselben Transaktion.

**Direkt referenzierte reale Relationen:** `public.session_events`, `public.session_players`, `public.sessions`.

**Transitive reale Relationen:** `public.characters`, `public.npc_creature_instances`, `public.project_members`, `public.projects`, `public.session_events`, `public.session_players`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | INSERT | `public.session_events` | session_id, kind, actor_user_id, payload, revision_after, idempotency_key | unbedingt |
| `public.apply_session_runtime_command(uuid,bigint,text,jsonb,text)` | UPDATE | `public.session_players` | is_online | p_kind = 'presence' |
| `public.apply_session_runtime_command(uuid,bigint,text,jsonb,text)` | UPDATE | `public.sessions` | runtime_revision, world_state, updated_at | unbedingt |
| `public.sagatree_resolve_adventure_command(uuid,jsonb,boolean,jsonb)` | UPDATE | `public.projects` | adventure_runtime, updated_at | v_op IS DISTINCT FROM 'hydrate_from_project' OR v_in->>'forcePersist' = 'true' ∧ v_op IN (       'set_flag', 'set_relationship', 'tick_clock', 'add_consequence',       'set_definition_ref', 'persist_to_project',       'advance_time', 'apply_simulation_batch', 'set_party_location'     ) |
| `public.sagatree_sync_npc_instance_from_participant(jsonb)` | UPDATE | `public.npc_creature_instances` | runtime, updated_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.apply_session_runtime_command(uuid,bigint,text,jsonb,text)` | `public.sessions` / `update_sessions_updated_at` | `public.update_updated_at_column()` |
| `public.apply_session_runtime_command(uuid,bigint,text,jsonb,text)` | `public.sessions` / `trg_sessions_forbid_public_id_change` | `public.forbid_public_id_change()` |
| `public.sagatree_sync_npc_instance_from_participant(jsonb)` | `public.npc_creature_instances` / `trg_npc_creature_instances_updated_at` | `public.set_npc_creature_instances_updated_at()` |
| `public.sagatree_resolve_adventure_command(uuid,jsonb,boolean,jsonb)` | `public.projects` / `update_projects_updated_at` | `public.update_updated_at_column()` |
| `public.sagatree_resolve_adventure_command(uuid,jsonb,boolean,jsonb)` | `public.projects` / `trg_projects_forbid_public_id_change` | `public.forbid_public_id_change()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | 42501 | True/True |
| `public.forbid_public_id_change()` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.get_session_runtime_snapshot(uuid)` | [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | 22023, 42501, P0002 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.is_session_participant(uuid,uuid)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_applied_experience_bonus(integer,integer)` | [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_apply_knowledge_reveal(jsonb,jsonb,uuid)` | [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | 22023 | True/True |
| `public.sagatree_build_encounter_participant_npc(public.npc_creature_instances)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_build_encounter_participant_pc(public.characters)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_build_program_presentation(jsonb,jsonb)` | [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql) | 22023 | True/True |
| `public.sagatree_build_scene_presentation(jsonb)` | [supabase/migrations/043_session_shared_scene_presentation.sql](../../../supabase/migrations/043_session_shared_scene_presentation.sql) | 22023 | True/True |
| `public.sagatree_empty_adventure_runtime()` | [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_ensure_adventure_v2(jsonb)` | [supabase/migrations/065_saga_simulation_ops.sql](../../../supabase/migrations/065_saga_simulation_ops.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_experience_bonus(integer)` | [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_fresh_action_economy()` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_grade_rank(text)` | [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_is_http_url(text)` | [supabase/migrations/043_session_shared_scene_presentation.sql](../../../supabase/migrations/043_session_shared_scene_presentation.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_life_conditions(text,integer)` | [supabase/migrations/049_session_death_lifecycle.sql](../../../supabase/migrations/049_session_death_lifecycle.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_life_start_level(text,boolean)` | [supabase/migrations/049_session_death_lifecycle.sql](../../../supabase/migrations/049_session_death_lifecycle.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_merge_life_into_conditions(jsonb,jsonb)` | [supabase/migrations/049_session_death_lifecycle.sql](../../../supabase/migrations/049_session_death_lifecycle.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_pc_health(integer,integer)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_pc_initiative_bonus(integer,integer,integer)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_project_shared_adventure(jsonb,boolean)` | [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_project_shared_knowledge(jsonb,boolean,uuid)` | [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_resolve_adventure_command(uuid,jsonb,boolean,jsonb)` | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | 22023, 42501, P0002 | True/True |
| `public.sagatree_resolve_combat_command(uuid,uuid,jsonb,boolean,jsonb)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | 22023, 42501, P0002 | True/True |
| `public.sagatree_resolve_condition_command(jsonb,boolean,jsonb)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | 22023, 42501, P0002 | True/True |
| `public.sagatree_resolve_cue_command(jsonb,boolean,boolean,jsonb)` | [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | 22023, 42501 | True/True |
| `public.sagatree_resolve_damage_command(jsonb,boolean,jsonb)` | [supabase/migrations/049_session_death_lifecycle.sql](../../../supabase/migrations/049_session_death_lifecycle.sql) | 22023, 42501, P0002 | True/True |
| `public.sagatree_resolve_life_command(jsonb,boolean,jsonb)` | [supabase/migrations/049_session_death_lifecycle.sql](../../../supabase/migrations/049_session_death_lifecycle.sql) | 22023, 42501 | True/True |
| `public.sagatree_resolve_probe_grade(integer,integer,integer)` | [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_resolve_session_check(uuid,uuid,jsonb,boolean)` | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | 22023, 42501, P0002 | True/True |
| `public.sagatree_roll_d20()` | [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_session_has_director(uuid,uuid)` | [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_skill_attribute_key(text)` | [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_sort_encounter_participants(jsonb)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_strip_forged_encounter_keys(jsonb)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_strip_forged_roll_keys(jsonb)` | [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_sync_npc_instance_from_participant(jsonb)` | [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | Keine eigene RAISE | True/True |
| `public.set_npc_creature_instances_updated_at()` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | Keine eigene RAISE | True/True |
| `public.update_updated_at_column()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Alle 15 Runtime-Kinds und Unteroperationen

Jeder erfolgreiche Erstaufruf endet im gemeinsamen Session-Lock-/Revision-/Event-/Snapshot-Vertrag. Replay und vorab abgewiesene Aufrufe führen diesen Abschluss nicht erneut aus.

### `join`

**Rolle:** Session-Teilnehmer.

**Request:** p_payload wird ohne kind-spezifische Objektprüfung als Event-Payload übernommen.

**Varianten:**

- `join-event`

- Keine Roster-/Projektaufnahme; Session-Revision und join-Event durch gemeinsamen Abschluss.

**Spezifische Abnahme:**

- Teilnehmer sendet join: exakt Event/Revision, unveränderte session_players und project_members.

**Normativer Zweig:** direkt im Runtime-RPC.

### `leave`

**Rolle:** Session-Teilnehmer, auch in completed.

**Request:** p_payload als Event-Payload.

**Varianten:**

- `leave-event`

- Keine Roster-Löschung; Session-Revision und leave-Event durch gemeinsamen Abschluss.

**Spezifische Abnahme:**

- Teilnehmer sendet leave: Roster bleibt; completed erlaubt, fremder Nutzer42501 vor Mutation.

**Normativer Zweig:** direkt im Runtime-RPC.

### `presence`

**Rolle:** Session-Teilnehmer, auch in completed.

**Request:** isOnline wird zu Boolean gecastet; NULL/fehlend wird true.

**Varianten:**

- `online`
- `offline`

- UPDATE eigener session_players-Zeile, dann presence-Event/Revision. Keine fremde user_id-Auswahl.

**Spezifische Abnahme:**

- isOnline false und fehlend liefern offline/online; falscher Booleantext erzeugt SQL-Cast-Fehler mit vollständigem Rollback.

**Normativer Zweig:** direkt im Runtime-RPC.

### `status`

**Rolle:** Projekt-GM.

**Request:** p_payload als Event-Payload; es wird kein status-Wert validiert oder übernommen.

**Varianten:**

- `status-event`

- GM-Guard, danach nur Runtime-Revision/Event; sessions.status unverändert.

**Spezifische Abnahme:**

- status-Payload mit beliebigem Status ändert den Lifecycle nicht; Player42501.

**Normativer Zweig:** direkt im Runtime-RPC.

### `roll`

**Rolle:** GM oder beabsichtigt eigener PC-Owner; Legacy-Playerpfad ist blockiert.

**Request:** skill, mode(default normal), useDrive(default false), characterId oder characterPublicId; GM kann target/resistance setzen.

**Varianten:**

- `normal`
- `advantage`
- `disadvantage`

- Serverseitiger Skill-/Attribut-/Rang-/Experience-Bonus, Würfelzufall, Ergebnisgrad und optionale Drive-Nutzung; gefälschte Ergebnisfelder werden entfernt.
- world_state.shared.lastRoll und driveByCharacter werden gesetzt; Event-Payload enthält natural/naturals,total,grade,driveSpent,driveRemaining und Actor/Character-IDs.
- Kein Character-Tabellen-Update; bekannte veraltete v_character.user_id-Prüfung muss vor Player-Erfolg korrigiert werden.

**Spezifische Abnahme:**

- Eigener Player-PC würfelt nach Owner-Spaltenkorrektur in allen drei Modi; fremder PC42501 und kein Event.
- GM-Ziel/Resistance, ungültiger Skill, fehlender Charakter und verbrauchter Drive prüfen; Wiederholung desselben Runtime-Keys würfelt nicht erneut.

**Normative Helper:** `public.sagatree_resolve_session_check(uuid,uuid,jsonb,boolean)`.

### `combat`

**Rolle:** start/end/nextTurn: GM; spendAction: GM oder aktueller eigener PC.

**Request:** action; für start participants mit kind=pc/npc, refId (alternativ characterId/instanceId) und optionalem Namen; für spendAction participantId und slot.

**Varianten:**

- `start`
- `end`
- `nextTurn`
- `spendAction`

- start verlangt GM, liest PC- und NPC-Zeilen und berücksichtigt höchstens 24 Seeds. NPC-Instanzen müssen zum Session-Projekt gehören; ein bereits aktiver Encounter wird abgewiesen.
- end beendet den aktiven Encounter. nextTurn erhöht Zugindex und gegebenenfalls Runde und erneuert die Aktionsökonomie nach den Helper-Regeln.
- spendAction reduziert main, move, free oder reaction um eins. Ohne GM darf nur der Owner des PC im aktuellen Zug ausgeben; ein NPC-Controller erhält diesen Pfad nicht.
- Encounter und combatActive werden im Session-World-JSON geändert. Dieser Helper schreibt die gelesenen PC-/NPC-Zeilen nicht zurück.

**Spezifische Abnahme:**

- Alle vier Actions prüfen: Start mit PC/NPC, Doppelstart und Ende ohne aktiven Encounter mit 22023, nextTurn am Rundenende.
- spendAction nur durch GM oder aktuellen eigenen PC; fremder PC, NPC-Controller und falscher Zug erhalten 42501, erschöpfter Slot 22023.

**Normative Helper:** `public.sagatree_resolve_combat_command(uuid,uuid,jsonb,boolean,jsonb)`.

### `damage`

**Rolle:** Projekt-GM.

**Request:** participantId, mode=damage (Default) oder heal, amount als ganzzahliger Wert zwischen 0 und 9999.

**Varianten:**

- `damage`
- `heal`

- Verlangt GM und aktiven Encounter. Verändert HP innerhalb 0 und Maximalwert sowie Bewusstlosigkeit und Life-Zustand nach Heroisch/Standard/Hart.
- Für PC werden hpByCharacter, conditionsByCharacter und gegebenenfalls lifeByCharacter angepasst. Für NPC schreibt der Sync-Helper die Instanz-Runtime.
- Event enthält mode, participantId, amount, hpCurrent, hpMax, authoritative und lifeStatus.

**Spezifische Abnahme:**

- Schaden und Heilung für PC/NPC an den HP-Grenzen, Downed-Übergang und Heilung aus 0 prüfen.
- Fehlender Encounter 22023, Nicht-GM 42501, ungültiger Betrag und fehlender Teilnehmer; NPC-Sync und Event müssen gemeinsam zurückrollen.

**Normative Helper:** `public.sagatree_resolve_damage_command(jsonb,boolean,jsonb)`, `public.sagatree_sync_npc_instance_from_participant(jsonb)`.

### `condition`

**Rolle:** Projekt-GM.

**Request:** participantId; op=add (Default) oder remove; condition wird getrimmt und auf 80 Zeichen begrenzt.

**Varianten:**

- `add`
- `remove`

- Verlangt GM und aktiven Encounter. add fügt nur einen noch fehlenden Zustand hinzu, solange weniger als 24 Zustände existieren; remove entfernt den passenden Wert.
- PC-Zustände werden in conditionsByCharacter gespiegelt; NPC-Runtime wird über den Sync-Helper aktualisiert. Event enthält op, participantId, condition und authoritative.

**Spezifische Abnahme:**

- add, remove, wiederholtes add und die Grenze von 24 Zuständen prüfen; voller oder bereits enthaltener Zustand ist ein fachlicher No-op mit äußerem Event.
- Nicht-GM 42501, fehlender Encounter 22023 und fehlender Teilnehmer P0002; NPC-Sync wird atomar zurückgerollt.

**Normative Helper:** `public.sagatree_resolve_condition_command(jsonb,boolean,jsonb)`, `public.sagatree_sync_npc_instance_from_participant(jsonb)`.

### `scene`

**Rolle:** Projekt-GM.

**Request:** Präsentationszweig bei title, visibleActors, backdropUrl, description, locationLabel oder sceneRef; ansonsten optional sceneId.

**Varianten:**

- `presentation`
- `sceneId-only`

- Präsentation verlangt Titel (maximal 120 Zeichen), begrenzt Location auf 120 und Description auf 500 Zeichen und prüft einen optionalen http(s)-Backdrop bis 2048 Zeichen. Referenzen und sichtbare Actors folgen dem vollständigen Builder-Vertrag.
- shared.scenePresentation wird ersetzt; interne _sceneId wird aus der Präsentation entfernt und als world.sceneId verwendet, falls vorhanden. Servereigene Marker werden neu gesetzt.
- Ohne Präsentationsfelder ändert nur eine vorhandene sceneId den State; der gemeinsame Runtime-Abschluss schreibt das Event.

**Spezifische Abnahme:**

- Präsentation mit Titel/Actors und sceneId-only getrennt prüfen; Präsentationszweig ohne Titel ergibt 22023.
- data:- oder javascript:-Backdrop abweisen, ungültiges Porträt nach Helper-Regel NULL setzen; Player erhält 42501.

**Normative Helper:** `public.sagatree_build_scene_presentation(jsonb)`.

### `gameplay`

**Rolle:** Projekt-GM.

**Request:** Optionale sceneId und checkTarget mit ganzzahligem Textformat.

**Varianten:**

- `sceneId`
- `checkTarget`
- `combined-or-empty`

- GM darf sceneId und ein gültiges ganzzahliges checkTarget setzen. Nichtnumerisches checkTarget wird ignoriert und erzeugt keinen eigenen Validierungsfehler.
- Eine leere Payload erzeugt trotzdem den gemeinsamen Event- und Revisionsschritt.

**Spezifische Abnahme:**

- Positives und negatives ganzzahliges Target übernehmen, nichtnumerisches ignorieren; Player erhält 42501.
- Leere Payload ändert nur Revision/Event; sceneId und checkTarget einzeln und gemeinsam prüfen.

**Normativer Zweig:** direkt im Runtime-RPC.

### `program`

**Rolle:** Projekt-GM oder Director.

**Request:** source mit kind und optional lookId; layout mit kind; overlay mit kind=title und text. Servereigene Marker werden entfernt.

**Varianten:**

- `neutral`
- `shared-scene`
- `look`

- source.kind erlaubt neutral, shared-scene und look; andere Werte werden shared-scene. lookId ist auf 128 Zeichen begrenzt. Layout erlaubt fullscreen-16x9 (Default) oder letterbox; Titel-Overlay maximal 120 Zeichen.
- shared.programPresentation erhält schemaVersion=1, authoritative=true, programRevision+1 und Serverzeit.
- gm_only und character_specific werden vor der nachfolgenden Guard-Prüfung entfernt. Der aktuelle Builder verwirft diese Schlüssel; die spätere Ausnahme wird dadurch nicht ausgelöst.

**Spezifische Abnahme:**

- Drei Source-Arten, beide Layouts, Overlay-Grenze und programRevision+1 prüfen.
- GM und Director dürfen senden, Player erhält 42501. Gefälschte Revision, Servermarker und entfernte Secret-Schlüssel erscheinen nicht in der Programmprojektion.

**Normative Helper:** `public.sagatree_build_program_presentation(jsonb,jsonb)`.

### `reveal`

**Rolle:** Projekt-GM.

**Request:** factId bis 128 Zeichen; target mit kind=everyone/program/players/character und für character zusätzlich characterId. Neue Facts nutzen die expliziten Builder-Felder.

**Varianten:**

- `everyone`
- `program`
- `players`
- `character`

- GM erzeugt oder aktualisiert autoritative Knowledge-Struktur und hängt ein Reveal mit Actor und Zeitstempel an.
- Für everyone, players und character wird ein noch fehlender Discovery-Eintrag ergänzt. program ergänzt kein Discovery.
- character verlangt characterId bis 128 Zeichen. Das Event enthält das neue Reveal; der anschließende Snapshot projiziert den State nach Rolle.

**Spezifische Abnahme:**

- Alle vier Targets prüfen: program ohne Discovery, character nur in der passenden Player-Projektion; Nicht-GM erhält 42501.
- Fehlende Fact-ID, ungültiges Target und character ohne ID ergeben 22023. Wiederholung dedupliziert Discovery, aber ohne Runtime-Key nicht das Event.

**Normative Helper:** `public.sagatree_apply_knowledge_reveal(jsonb,jsonb,uuid)`.

### `life`

**Rolle:** Projekt-GM.

**Request:** op; außer bei set_difficulty ist characterId erforderlich. Optional participantId, grade, difficulty, confirmDead und note bis 200 Zeichen.

**Varianten:**

- `set_difficulty`
- `death_save`
- `stabilize`
- `mark_dead`
- `clear_alive`
- `enter_downed`

- set_difficulty akzeptiert Heroisch, Standard oder Hart und verändert shared.lifeDifficulty.
- Andere Operationen verändern lifeByCharacter mit status, dyingLevel, wounds und Life-Zuständen. Aktive PC-Encounter-Teilnehmer und conditionsByCharacter werden angepasst.
- death_save verarbeitet crit_success, success, failure und crit_failure im Downed-Zustand. mark_dead benötigt confirmDead; stabilize akzeptiert ausschließlich passende nicht tote Zustände.
- Die Effekte liegen im Session-Runtime-JSON; es wird keine persistente Character-Zeile geändert.

**Spezifische Abnahme:**

- Alle sechs Operationen mit den drei Schwierigkeitsgraden, dying-Grenze 3 und Wounds-Übergängen prüfen; Event und Snapshot müssen übereinstimmen.
- mark_dead ohne Bestätigung, death_save für alive/dead und ungültige Difficulty ergeben 22023; Nicht-GM erhält 42501.

**Normative Helper:** `public.sagatree_resolve_life_command(jsonb,boolean,jsonb)`.

### `adventure`

**Rolle:** Projekt-GM.

**Request:** op; fehlt op bei nichtleerem key, wird set_flag angenommen. Die zehn Unteroperationen definieren die weiteren Felder.

**Varianten:**

| Op | Input | Effekt |
| --- | --- | --- |
| hydrate_from_project | Keine weiteren Pflichtfelder. | Kopiert gültiges Projekt-Adventure mit Schema 1/2 in die Session und erhöht sliceRevision; kein Projekt-Write. |
| set_definition_ref | definitionRef darf nicht leer sein. | Setzt Definition-Referenz und persistiert Projekt-Adventure. |
| set_flag | key, optional value und visibility. | Setzt Flag nach den Helper-Defaults; Visibility public/shared/gm_only; persistiert Projekt-Adventure. |
| set_relationship | actorRef und targetRef sowie konkrete Relationship-Felder des Helpers. | Setzt Relationship und validierte Visibility; persistiert Projekt-Adventure. |
| tick_clock | Clock-Felder einschließlich clockId, delta, max und visibility gemäß Helper. | Aktualisiert Clock mit Grenzen und Defaults; persistiert Projekt-Adventure. |
| add_consequence | summary darf nicht leer sein; optionale Visibility und ID. | Ergänzt Konsequenz mit begrenzter Summary, hält höchstens 64 und persistiert Projekt-Adventure. |
| persist_to_project | Keine weiteren Pflichtfelder. | Persistiert aktuelles Session-Adventure und erhöht sliceRevision. |
| advance_time | days zwischen 1 und 30, statePatch als Objekt, optional appendConsequences. | Übernimmt validierten Simulationspatch, verwendet Schema 2 und persistiert Projekt-Adventure. |
| apply_simulation_batch | statePatch als Objekt, optional appendConsequences. | Erlaubte Patch-Keys: time, clocks, threats, deadlines, flags, rngSeed, partyLocationRef, rules. Schema 2 und Projektpersistenz. |
| set_party_location | partyLocationRef. | Setzt oder entfernt Party-Location; Schema 2 und Projektpersistenz. |

- Jeder erfolgreiche Adventure-Befehl erhöht sliceRevision, setzt updatedAt und shared.adventure. Simulation und Party-Location verwenden schemaVersion=2.
- Nur die explizit aufgezählten Mutationstypen schreiben projects.adventure_runtime. hydrate_from_project bleibt bezüglich Projekt lesend; auch forcePersist=true überwindet die innere Op-Liste nicht.
- Simulation verlangt ein Patch-Objekt mit erlaubten Keys, höchstens 64 Threats und Deadlines sowie höchstens 32 neue Batch-Konsequenzen. Die Konsequenzliste wird auf 64 begrenzt.
- Event enthält op, key, batchId, days, definitionRef, sliceRevision und authoritative; die ursprüngliche vollständige Payload ist nicht das Event.

**Spezifische Abnahme:**

- Alle zehn Unteroperationen anhand des genauen Session- und Projekt-Diffs prüfen; hydrate schreibt auch mit forcePersist kein Projekt.
- advance_time mit 0/31 Tagen, fremder Patch-Key, mehr als 32 neue Konsequenzen, unbekannter Op und Nicht-GM werden abgewiesen, ohne Projektteilupdate.
- Schema 1→2, Slice-Revision und die Grenzen von 64 Elementen mit echten Daten-Fixtures prüfen.

**Normative Helper:** `public.sagatree_resolve_adventure_command(uuid,jsonb,boolean,jsonb)`.

### `cue`

**Rolle:** Projekt-GM oder Director.

**Request:** op mit Default apply_cue; source, layout, trigger, manual, overlayText/note; set_automatic_mode nutzt mode, set_preview nutzt source/layout.

**Varianten:**

- `set_automatic_mode`
- `set_preview`
- `take_preview_to_program`
- `apply_cue`
- `other-op-uses-apply-path`

- set_automatic_mode setzt nur bei mode=on auf on, sonst off. set_preview aktualisiert Director-Preview ohne Programmübernahme.
- Take übernimmt Preview manuell ins Programm. Automatische Apply-Cues prüfen automaticMode und Cooldown; übersprungene Übernahme ist ein erfolgreicher Return mit applied=false und reason=automatic_mode_off/cooldown.
- Übernahme aktualisiert director.program.revision, lastCue, Manual-/Auto-Zeit und bereinigte programPresentation samt eigenem programRevision-Zähler.
- gm_only/character_specific auf Payload-Ebene werden mit 22023 abgewiesen. Andere unbekannte op-Werte fallen im Legacy ebenfalls in den Apply-Pfad.
- Auch applied=false erhält durch den äußeren RPC einen Session-Revisionsschritt und ein Event.

**Spezifische Abnahme:**

- Vier benannte Ops und den unbekannten Op gegen den tatsächlichen Fallback prüfen; Preview bleibt vor Take vom Programm getrennt.
- Automatik aus oder Cooldown liefert applied=false, aber Revision/Event+1. Manuelles Take umgeht Cooldown.
- GM/Director erlaubt, Player 42501 und Secret-Schlüssel 22023; Programm- und Director-Revisionszähler getrennt prüfen.

**Normative Helper:** `public.sagatree_build_program_presentation(jsonb,jsonb)`, `public.sagatree_resolve_cue_command(jsonb,boolean,boolean,jsonb)`.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-runtime-service.ts:107

AST-Auflösung: `string-literal`; SHA-256 `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async applyCommand(input: {
    sessionId: string;
    expectedRevision: number;
    kind: SessionEventKind | string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<SessionRuntimeState> {
    const kind = assertSessionEventKind(input.kind);
    const { data, error } = await supabase.rpc('apply_session_runtime_command', {
      p_session_id: input.sessionId,
      p_expected_revision: input.expectedRevision,
      p_kind: kind,
      p_payload: input.payload ?? {},
      p_idempotency_key: input.idempotencyKey ?? null,
    });

    if (error) {
      if (isStaleRpcError(error.message)) {
        const snap = await this.getSnapshot(input.sessionId);
        throw new StaleRuntimeRevisionError(input.expectedRevision, snap.revision);
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Runtime-Befehl lieferte kein Ergebnis');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `PlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 7 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `normalizePlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 17 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `SessionEventKind` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 11 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `EVENT_KINDS` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 28 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `SessionPresenceEntry` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 46 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `SessionGameplayState` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 56 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `SessionRuntimeState` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 65 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `StaleRuntimeRevisionError` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 85 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `isSessionEventKind` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 97 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `assertSessionEventKind` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 101 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `emptyGameplayState` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 108 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `normalizeRuntimeStatus` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 167 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `SnapshotJson` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 20 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `mapRoster` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 31 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `mapGameplay` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 49 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `mapSnapshotJson` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 64 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `isStaleRpcError` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 83 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Für alle 15 Kinds jeweils erlaubte Rolle, genaue Payload, erwartete world_state-Änderung und genau ein Event prüfen; status/join/leave dürfen keine getrennten Lifecycle-Effekte erfinden.
- [ ] Fremdteilnehmer: 42501; completed+roll: 22023; falsche oder NULL-Revisionsannahme: 40001; jeweils unveränderte Session, Events und transitive Projektdaten.
- [ ] Zwei konkurrierende unterschiedliche Keys mit gleicher Revision: nur eine erfolgreiche Mutation. Gleicher Key nach Commit: identische eventId, keine zusätzliche Revision und aktueller gefilterter Snapshot.
- [ ] Adventure set_flag/tick_clock/add_consequence/advance_time übertragen nur die im Helper erlaubten Felder nach projects.adventure_runtime; Fehler am Event-Insert rollt auch diesen Projekt-Write zurück.
- [ ] Roll, Combat spendAction, GM/Director Cue und Player-Snapshot mit fremdem Charakter/GM-Feldern prüfen; alle in operations genannten Unterbefehle erhalten eigene positive und negative Fixtures.
- [ ] Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.
- [ ] Helper nicht öffentlich exponieren oder Actor/Projekt-GM selbst prüfen; frei gelieferte Booleans dürfen kein Recht verleihen. Anon/Fremdnutzer-Flags müssen unverändert bleiben.
- [ ] Runtime kind=join: Teilnehmer sendet join: exakt Event/Revision, unveränderte session_players und project_members.
- [ ] Runtime kind=leave: Teilnehmer sendet leave: Roster bleibt; completed erlaubt, fremder Nutzer42501 vor Mutation.
- [ ] Runtime kind=presence: isOnline false und fehlend liefern offline/online; falscher Booleantext erzeugt SQL-Cast-Fehler mit vollständigem Rollback.
- [ ] Runtime kind=status: status-Payload mit beliebigem Status ändert den Lifecycle nicht; Player42501.
- [ ] Runtime kind=roll: Eigener Player-PC würfelt nach Owner-Spaltenkorrektur in allen drei Modi; fremder PC42501 und kein Event.
- [ ] Runtime kind=roll: GM-Ziel/Resistance, ungültiger Skill, fehlender Charakter und verbrauchter Drive prüfen; Wiederholung desselben Runtime-Keys würfelt nicht erneut.
- [ ] Runtime kind=combat: Alle vier Actions prüfen: Start mit PC/NPC, Doppelstart und Ende ohne aktiven Encounter mit 22023, nextTurn am Rundenende.
- [ ] Runtime kind=combat: spendAction nur durch GM oder aktuellen eigenen PC; fremder PC, NPC-Controller und falscher Zug erhalten 42501, erschöpfter Slot 22023.
- [ ] Runtime kind=damage: Schaden und Heilung für PC/NPC an den HP-Grenzen, Downed-Übergang und Heilung aus 0 prüfen.
- [ ] Runtime kind=damage: Fehlender Encounter 22023, Nicht-GM 42501, ungültiger Betrag und fehlender Teilnehmer; NPC-Sync und Event müssen gemeinsam zurückrollen.
- [ ] Runtime kind=condition: add, remove, wiederholtes add und die Grenze von 24 Zuständen prüfen; voller oder bereits enthaltener Zustand ist ein fachlicher No-op mit äußerem Event.
- [ ] Runtime kind=condition: Nicht-GM 42501, fehlender Encounter 22023 und fehlender Teilnehmer P0002; NPC-Sync wird atomar zurückgerollt.
- [ ] Runtime kind=scene: Präsentation mit Titel/Actors und sceneId-only getrennt prüfen; Präsentationszweig ohne Titel ergibt 22023.
- [ ] Runtime kind=scene: data:- oder javascript:-Backdrop abweisen, ungültiges Porträt nach Helper-Regel NULL setzen; Player erhält 42501.
- [ ] Runtime kind=gameplay: Positives und negatives ganzzahliges Target übernehmen, nichtnumerisches ignorieren; Player erhält 42501.
- [ ] Runtime kind=gameplay: Leere Payload ändert nur Revision/Event; sceneId und checkTarget einzeln und gemeinsam prüfen.
- [ ] Runtime kind=program: Drei Source-Arten, beide Layouts, Overlay-Grenze und programRevision+1 prüfen.
- [ ] Runtime kind=program: GM und Director dürfen senden, Player erhält 42501. Gefälschte Revision, Servermarker und entfernte Secret-Schlüssel erscheinen nicht in der Programmprojektion.
- [ ] Runtime kind=reveal: Alle vier Targets prüfen: program ohne Discovery, character nur in der passenden Player-Projektion; Nicht-GM erhält 42501.
- [ ] Runtime kind=reveal: Fehlende Fact-ID, ungültiges Target und character ohne ID ergeben 22023. Wiederholung dedupliziert Discovery, aber ohne Runtime-Key nicht das Event.
- [ ] Runtime kind=life: Alle sechs Operationen mit den drei Schwierigkeitsgraden, dying-Grenze 3 und Wounds-Übergängen prüfen; Event und Snapshot müssen übereinstimmen.
- [ ] Runtime kind=life: mark_dead ohne Bestätigung, death_save für alive/dead und ungültige Difficulty ergeben 22023; Nicht-GM erhält 42501.
- [ ] Runtime kind=adventure: Alle zehn Unteroperationen anhand des genauen Session- und Projekt-Diffs prüfen; hydrate schreibt auch mit forcePersist kein Projekt.
- [ ] Runtime kind=adventure: advance_time mit 0/31 Tagen, fremder Patch-Key, mehr als 32 neue Konsequenzen, unbekannter Op und Nicht-GM werden abgewiesen, ohne Projektteilupdate.
- [ ] Runtime kind=adventure: Schema 1→2, Slice-Revision und die Grenzen von 64 Elementen mit echten Daten-Fixtures prüfen.
- [ ] Runtime kind=cue: Vier benannte Ops und den unbekannten Op gegen den tatsächlichen Fallback prüfen; Preview bleibt vor Take vom Programm getrennt.
- [ ] Runtime kind=cue: Automatik aus oder Cooldown liefert applied=false, aber Revision/Event+1. Manuelles Take umgeht Cooldown.
- [ ] Runtime kind=cue: GM/Director erlaubt, Player 42501 und Secret-Schlüssel 22023; Programm- und Director-Revisionszähler getrennt prüfen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### High — RPC-RUNTIME-ROLL-OWNER-COLUMN

Nicht-GM-Roll-Aufruf greift auf v_character.user_id zu, obwohl characters.owner_user_id die wirksame Spalte ist; Baseline scheitert statt zu würfeln.

**Beleg:** supabase/migrations/042_session_shared_rolls.sql:212; spätere073/079/085 benennen den Helper um, korrigieren aber nicht den Feldzugriff. Isolierter PostgreSQL15-Player-Roll reproduziert record has no field user_id.

**Erforderliche Nachfolger-Abnahme:** Owner-Prüfung gegen owner_user_id; positiver eigenerPlayer-Roll und negativerFremdcharakter-Roll müssen vor Runtime-Abnahme bestehen. Fehler darf keine Revision/Event erzeugen.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `PAR-08`. Eigene RPC-Reproduktion: True.

### Critical — RPC-SEC-ANON-EVENT-HELPER

Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.

**Beleg:** supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.

**Erforderliche Nachfolger-Abnahme:** Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-EVENT-HELPER-ANON`. Eigene RPC-Reproduktion: True.

### Critical — RPC-SEC-ANON-ADVENTURE-HELPER

Auch anon kann im öffentlichen Adventure-Helper p_is_gm=true behaupten und fremde Projekt-Adventure-Daten schreiben.

**Beleg:** supabase/migrations/065_saga_simulation_ops.sql plus 073/079/085-Transformationen; Helper vertraut übergebenem GM-Boolean bei erhaltenen anon-Defaultprivilegien.

**Erforderliche Nachfolger-Abnahme:** Helper nicht öffentlich exponieren oder Actor/Projekt-GM selbst prüfen; frei gelieferte Booleans dürfen kein Recht verleihen. Anon/Fremdnutzer-Flags müssen unverändert bleiben.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-ADVENTURE-HELPER-ANON`. Eigene RPC-Reproduktion: True.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql) | `74a7f112720d2572bbb8b7d8c32e0f5f5abf932c35268a34b45dc4bfedc2a02a` |
| [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql) | `02874b854874e5d89ad6b697563d545f5d2b72735afe763d6927e574b2ba49ca` |
| [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql) | `c64e0659f2a2006fed326a55f4521a8be21de8dffd44d0b46bd057475b5b9dff` |
| [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql) | `b1e054d6ba6678f1974c82f5a660ab6b01e34a64f9ac0f62f00f10b42f9cfc8c` |
| [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql) | `e34e71c2edb5ec44dd665cbd32927c3d69fa56d2cf0bdf4bf72e5b65bbd08e87` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql) | `22eba40df1a0e9f4033e32a2c74a316ebafbc551d46748edba2b3e260b18778f` |
| [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | `36720ac8bf2973fae37ef3ab2fd5d8be7397d48ca1cb133b9a6e09a0d1b48008` |
| [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql) | `faa2b4446d078e83ed00d5894ef297e5fb7322c65481873fc6fa85983fa5ccf8` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/042_session_shared_rolls.sql](../../../supabase/migrations/042_session_shared_rolls.sql) | `ba87cf0ed1b75250d07333cfe3b5a26a54db069bd96dc5835e9f4069128ca906` |
| [supabase/migrations/043_session_shared_scene_presentation.sql](../../../supabase/migrations/043_session_shared_scene_presentation.sql) | `0e96dece1e2e76bfdc15ca674c57f39c02d3132ae82d2d46f97087b264c605fc` |
| [supabase/migrations/044_session_combat_encounter.sql](../../../supabase/migrations/044_session_combat_encounter.sql) | `e1168e2c35a90d3de3c9be1f796026dc289c21803e9590951e72391576505c35` |
| [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql) | `98fd05e6d1ae794db77b46eb910fadacffdc760246cda412404c1246eaf0110e` |
| [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | `d2cc67aea9ea3751ca52d09392c0777529019e4700b80a63fdbbd4dc4fcec8b7` |
| [supabase/migrations/049_session_death_lifecycle.sql](../../../supabase/migrations/049_session_death_lifecycle.sql) | `4bd6e5dcde665d7a6c5f08034662a9e1646cff7a5acd6a6328f11d4226456be2` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/065_saga_simulation_ops.sql](../../../supabase/migrations/065_saga_simulation_ops.sql) | `a7fa13ff4d2868abd79f26593690f8907d2e2982e54023a027ec6f8f29f97ba9` |
| [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql) | `c55f1f4ab96ba5b53c89c7cb620d86f476a1c35217a0c9976a7d5b83caed73f8` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql) | `bb8d1160118231cb724d0e01fbe5b66ba20dde397b67e052e03d8a1a9f2e6dd0` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
| [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql) | `f66c1286947dd3119ac4cfac01736a3948e1cb35648f61837e6a79fd9c519560` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
