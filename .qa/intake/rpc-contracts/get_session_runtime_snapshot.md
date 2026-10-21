# RPC-Vertrag: `get_session_runtime_snapshot`

Liest den aktuellen Runtime-Zustand einer Session und projiziert Knowledge/Adventure anhand der Rolle.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#867](https://github.com/iamthamanic/sagatree/issues/867) — RPC-SESSION-RUNTIME; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Antwort enthält sessionId, revision, status, roster, gameplay und updatedAt. scheduled wird für den Runtime-Vertrag als waiting ausgegeben.
- Roster enthält userId, characterId, isOnline und joinedAt; gameplay enthält sceneId, combatActive und shared.
- project_shared_knowledge und project_shared_adventure entfernen nicht erlaubtes Wissen bzw. Adventure-Daten aus der Antwort; die gespeicherte Session bleibt unverändert.

## Berechtigungen

- Authentifizierter Session-Teilnehmer über is_session_participant; GM-Rechte werden separat über Projekt bestimmt.

## SQL-Signatur 1

`public.get_session_runtime_snapshot(uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) (Zeilen 508–582, SHA-256 `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/get_session_runtime_snapshot-1.sql](effective-sql/get_session_runtime_snapshot-1.sql); SHA-256 `52ceeac44ab281c6aaab0f95e59c15d458329801603e4f942ae4c8861bed81b7`.

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
| 51 | unbedingt | `jsonb_build_object(     'sessionId', v_session.id,     'revision', v_session.runtime_revision,     'status', CASE WHEN v_session.status = 'scheduled' THEN 'waiting' ELSE v_session.status END,     'roster', v_roster,     'gameplay', jsonb_build_object(       'sceneId', COALESCE(v_session.world_state->>'sceneId', v_session.world_state->>'scene_id'),       'combatActive', COALESCE(         (v_session.world_state->>'combatActive')::boolean,         (v_session.world_state->>'combat_active')::boolean,         false       ),       'shared', v_shared     ),     'updatedAt', v_session.updated_at   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `sceneId`, `combatActive`, `shared`
- `sessionId`, `revision`, `status`, `roster`, `gameplay`, `updatedAt`
- `userId`, `characterId`, `isOnline`, `joinedAt`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |
| 22023 | session_id required | — | p_session_id IS NULL |
| 42501 | forbidden | — | NOT public.is_session_participant(p_session_id, actor) |
| P0002 | Session not found | — | NOT FOUND |

## Transaktion, Idempotenz und Folgewirkungen

- Reiner Lesevertrag ohne Roster-/Event-/Revision-Write; Antwort ist aktueller Zustand, keine Event-Replay-Historie.

**Direkt referenzierte reale Relationen:** `public.session_players`, `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_players`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.is_session_participant(uuid,uuid)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_project_shared_adventure(jsonb,boolean)` | [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_project_shared_knowledge(jsonb,boolean,uuid)` | [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-runtime-service.ts:90

AST-Auflösung: `string-literal`; SHA-256 `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async getSnapshot(sessionId: string): Promise<SessionRuntimeState> {
    const { data, error } = await supabase.rpc('get_session_runtime_snapshot', {
      p_session_id: sessionId,
    });
    if (error || !data) {
      throw new Error(error?.message ?? 'Runtime-Snapshot fehlgeschlagen');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `PlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 7 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `normalizePlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 17 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `SessionPresenceEntry` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 46 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `SessionGameplayState` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 56 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `SessionRuntimeState` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 65 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `emptyGameplayState` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 108 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `normalizeRuntimeStatus` | [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | 167 | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `SnapshotJson` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 20 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `mapRoster` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 31 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `mapGameplay` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 49 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `mapSnapshotJson` | [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | 64 | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] GM- und Player-Aufruf derselben Session gegen vollständige JSON-Fixtures vergleichen, einschließlich versteckter/charakterspezifischer Facts.
- [ ] scheduled-Session liefert waiting; leeres world_state produziert die belegte leere Gameplay-Struktur.
- [ ] Anonymer oder fremder Akteur erhält 42501; fehlende Session folgt dem belegten Teilnehmer-/P0002-Pfad.
- [ ] Snapshot-Aufruf verändert weder Revision noch roster, session_events oder projects.adventure_runtime.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| [src/domains/session/contracts/session-runtime.ts](../../../src/domains/session/contracts/session-runtime.ts) | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| [src/infrastructure/session/session-runtime-service.ts](../../../src/infrastructure/session/session-runtime-service.ts) | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | `d2cc67aea9ea3751ca52d09392c0777529019e4700b80a63fdbbd4dc4fcec8b7` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql) | `c55f1f4ab96ba5b53c89c7cb620d86f476a1c35217a0c9976a7d5b83caed73f8` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
