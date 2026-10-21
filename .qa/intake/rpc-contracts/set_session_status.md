# RPC-Vertrag: `set_session_status`

Führt den GM-Statusübergang einer Session einschließlich Abschluss-Recap und Handover aus.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#868](https://github.com/iamthamanic/sagatree/issues/868) — RPC-SESSION-LIFECYCLE; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Erlaubte Zielwerte waiting/active/paused/completed. Bestehendes scheduled wird für die Übergangsprüfung als waiting behandelt. Übergänge: waiting→active/completed, active→paused/completed, paused→active/completed; completed ist terminal. Kein Übergang führt zurück auf waiting.
- Session wird gesperrt; Status, relevante Zeitstempel, runtime_revision und Status-Event ändern sich gemeinsam.
- Beim Abschluss ruft sagatree_upsert_session_recap den Recap-/Adventure-Handover auf: gültiges schemaVersion=1 Adventure nach projects.adventure_runtime, Highlights/Snapshot upserten und manuelle Summary erhalten.
- Returns public.sessions. Ungültige oder gleichbleibende Zustandsübergänge sind keine stillen idempotenten Erfolge.

## Berechtigungen

- Authentifizierter Projekt-GM; Welt-Ownership allein verleiht keine Session-GM-Rechte.

## SQL-Signatur 1

`public.set_session_status(uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_status | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `public.sessions`.

**Wirksame Definition:** [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) (Zeilen 222–279, SHA-256 `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/set_session_status-1.sql](effective-sql/set_session_status-1.sql); SHA-256 `1c6f30f85e9cabff01631c424723fc681f6b1e80edb5f96a6ad01a5234b484ef`.

**Nachträgliche Transformationen:**

- body-rewrite: [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) (Zeilen 1–28, SHA-256 `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3`)

### Vollständige Row-Antwort

Die folgenden finalen Spalten stammen aus pg_attribute/pg_attrdef der isolierten, vollständig migrierten PostgreSQL-Datenbank. Ihre Reihenfolge ist die reale Composite-Reihenfolge.

| Spalte | Typ | NOT NULL | Default |
| --- | --- | --- | --- |
| id | `uuid` | True | `gen_random_uuid()` |
| project_id | `uuid` | False | Kein Default |
| session_number | `integer` | True | Kein Default |
| name | `character varying(255)` | False | Kein Default |
| description | `text` | False | Kein Default |
| status | `character varying(20)` | False | `'scheduled'::character varying` |
| started_at | `timestamp with time zone` | False | Kein Default |
| ended_at | `timestamp with time zone` | False | Kein Default |
| notes | `text` | False | Kein Default |
| world_state | `jsonb` | False | `'{}'::jsonb` |
| created_at | `timestamp with time zone` | False | `now()` |
| updated_at | `timestamp with time zone` | False | `now()` |
| public_id | `text` | True | Kein Default |
| code | `text` | False | Kein Default |
| runtime_revision | `bigint` | True | `0` |
| look_profile_id | `text` | False | Kein Default |

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
| 50 | unbedingt | `v_session` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `from`, `to`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |
| 22023 | Invalid session status | — | p_status NOT IN ('waiting', 'active', 'paused', 'completed') |
| P0002 | Session not found | — | NOT FOUND |
| 42501 | forbidden | — | NOT public.is_project_gm(v_session.project_id, actor) |
| 22023 | Completed sessions cannot change status | — | v_from = 'completed' |
| 22023 | Illegal status transition from % to % | v_from, p_status | NOT (     (v_from = 'waiting' AND p_status IN ('active', 'completed'))     OR (v_from = 'active' AND p_status IN ('paused', 'completed'))     OR (v_from = 'paused' AND p_status IN ('active', 'completed'))   ) |

## Transaktion, Idempotenz und Folgewirkungen

- Row-Lock serialisiert Statuswechsel. Status, Event, Recap und Handover sind eine Transaktion; kein Idempotency-Key.

**Direkt referenzierte reale Relationen:** `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_events`, `public.session_recaps`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | INSERT | `public.session_events` | session_id, kind, actor_user_id, payload, revision_after, idempotency_key | unbedingt |
| `public.sagatree_upsert_session_recap(uuid)` | UPDATE | `public.projects` | adventure_runtime, updated_at | jsonb_typeof(v_adv) = 'object' AND COALESCE((v_adv->>'schemaVersion')::int, 0) = 1 |
| `public.sagatree_upsert_session_recap(uuid)` | INSERT | `public.session_recaps` | session_id, summary_text, highlight_lines, snapshot, created_at, updated_at | unbedingt |
| `public.set_session_status(uuid,text)` | UPDATE | `public.sessions` | status, runtime_revision, updated_at, started_at, ended_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.set_session_status(uuid,text)` | `public.sessions` / `update_sessions_updated_at` | `public.update_updated_at_column()` |
| `public.set_session_status(uuid,text)` | `public.sessions` / `trg_sessions_forbid_public_id_change` | `public.forbid_public_id_change()` |
| `public.sagatree_upsert_session_recap(uuid)` | `public.projects` / `update_projects_updated_at` | `public.update_updated_at_column()` |
| `public.sagatree_upsert_session_recap(uuid)` | `public.projects` / `trg_projects_forbid_public_id_change` | `public.forbid_public_id_change()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.forbid_public_id_change()` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_build_recap_highlight_lines(jsonb,boolean)` | [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_upsert_session_recap(uuid)` | [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | P0002 | True/True |
| `public.update_updated_at_column()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-service.ts:278

AST-Auflösung: `string-literal`; SHA-256 `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async updateSessionStatus(
    id: string,
    status: PlaySessionStatus,
  ): Promise<SessionVm> {
    const current = await this.getSessionById(id);
    assertPlaySessionStatusTransition(current.status, status);

    const { data, error } = await supabase.rpc('set_session_status', {
      p_session_id: id,
      p_status: status,
    });

    if (error || !data) {
      throw new Error(`Failed to update session: ${error?.message ?? 'unknown'}`);
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    const players = await this.loadPlayers(id);
    return this.mapToViewModel(dto, players);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `PlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 7 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `canTransitionPlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 23 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `assertPlaySessionStatusTransition` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 30 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `SessionVm` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 48 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `SessionPlayerVm` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 64 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `SessionRow` | [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | 41 | `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Jeden erlaubten Übergang sowie waiting→paused, completed→active und same-state mit exakten Status-/Zeitstempel-/SQLSTATE-Fixtures prüfen.
- [ ] Player und bloßer Welt-Owner ohne GM-Rolle erhalten 42501 ohne Status/Event-Änderung.
- [ ] Abschluss speichert Recap/Projekt-Handover und bewahrt bestehende manuelle Summary; nicht gültiges Adventure wird nicht als Handover übernommen.
- [ ] Ein Fehler im Recap-/Event-Helper rollt Status, Revision und Projekthandover vollständig zurück.
- [ ] Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### Critical — RPC-SEC-ANON-EVENT-HELPER

Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.

**Beleg:** supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.

**Erforderliche Nachfolger-Abnahme:** Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-EVENT-HELPER-ANON`. Eigene RPC-Reproduktion: True.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql) | `98fd05e6d1ae794db77b46eb910fadacffdc760246cda412404c1246eaf0110e` |
| [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | `d2cc67aea9ea3751ca52d09392c0777529019e4700b80a63fdbbd4dc4fcec8b7` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql) | `d02f115b12a959b1186539c310726de5791314380cc010ca337014f3045d079a` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
