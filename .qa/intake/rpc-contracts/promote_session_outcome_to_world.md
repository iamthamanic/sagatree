# RPC-Vertrag: `promote_session_outcome_to_world`

Übernimmt eine Session-Konsequenz als Lore-Fact in die verbundene eigene Welt.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#876](https://github.com/iamthamanic/sagatree/issues/876) — RPC-SAGA-PROJECTIONS; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Bestehende Promotion nach Projekt/Konsequenz/world_fact liefert idempotent=true. Fehlende Welt 22023, fehlende Konsequenz P0002, leerer Text 22023.
- Sperrt world_profiles und ergänzt modules.promotedLore.facts, falls die Fact-ID noch fehlt; speichert sourceSessionId/sourceConsequenceId, auf 200 Zeichen begrenzte Summary und Visibility.
- Fact-ID ist promoted:+erste 64 Zeichen der consequence_id. Anders als Saga-Promotion wird Visibility hier nicht gegen einen festen Wertkatalog normalisiert.
- Promotion-Zeile und adventure-Event werden atomar geschrieben; Antwort {ok,idempotent,targetKind,targetRef,messageDe}; keine Session-Revisionssteigerung.

## Berechtigungen

- Authentifizierter Session-Projekt-GM und current_user_can_edit_world_profile für dessen gebundene Welt; Projekt-GM allein reicht nicht.

## SQL-Signatur 1

`public.promote_session_outcome_to_world(uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_consequence_id | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/070_saga_promote_session_outcomes.sql](../../../supabase/migrations/070_saga_promote_session_outcomes.sql) (Zeilen 214–346, SHA-256 `1b9498004ab77efbc59a5ff7bbd1676275da6d44b30d7afe6861b68a4f4fdcb7`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/promote_session_outcome_to_world-1.sql](effective-sql/promote_session_outcome_to_world-1.sql); SHA-256 `2801e39d44b020a191a25d58b6712b8064f5a5900c019807098a4da7e81a31a2`.

**Nachträgliche Transformationen:**

- body-rewrite: [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) (Zeilen 1–28, SHA-256 `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3`)

### Ausführungskontext und ACL

| Eigenschaft | Belegter Wert |
| --- | --- |
| SECURITY DEFINER | True |
| search_path | `SET search_path TO 'public'` |
| Migration-/Skript-EXECUTE-Deklarationen | authenticated |
| ACL-Scope | Migration/optional-script declarations starting from PostgreSQL PUBLIC default; platform default ACL is separate below. |

Die Plattform setzt zusätzliche Defaultprivilegien. Deshalb ist die folgende beobachtete ACL für das isolierte Fixture maßgeblich, nicht allein die GRANT/REVOKE-Liste der Migration. EXECUTE-Berechtigung ist vom inneren Auth-Guard zu unterscheiden.

| Owner | Effektive Fixture-ACL | authenticated EXECUTE | anon EXECUTE |
| --- | --- | --- | --- |
| postgres | `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | True |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 45 | FOUND | `jsonb_build_object(       'ok', true,       'idempotent', true,       'targetKind', 'world_fact',       'targetRef', v_promo.target_ref     )` |
| 117 | unbedingt | `jsonb_build_object(     'ok', true,     'idempotent', false,     'targetKind', 'world_fact',     'targetRef', v_fact_id,     'messageDe', 'In die Welt übernommen.'   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `id`, `visibility`, `summary`, `sourceSessionId`, `sourceConsequenceId`
- `ok`, `idempotent`, `targetKind`, `targetRef`
- `ok`, `idempotent`, `targetKind`, `targetRef`, `messageDe`
- `op`, `target`, `consequenceId`, `factId`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| P0002 | Session nicht gefunden | — | NOT FOUND |
| 42501 | Nur Gamemaster darf übernehmen | — | NOT public.is_project_gm(v_project.id, v_user) |
| 22023 | Keine Welt an diese Gruppe gebunden | — | v_world IS NULL |
| 42501 | Nur die Welt-Besitzerin/der Welt-Besitzer darf übernehmen | — | NOT public.current_user_can_edit_world_profile(v_world) |
| P0002 | Ereignis nicht gefunden | — | v_cons IS NULL |
| 22023 | Ereignis ohne Text | — | v_summary IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Welt-Row-Lock schützt Fact-Update; Promotion-Lookup liegt davor. Fact/Promotion/Event sind atomar, paralleler Duplicate-Key-Fehler rollt die zweite Transaktion zurück.

**Direkt referenzierte reale Relationen:** `public.projects`, `public.session_outcome_promotions`, `public.sessions`, `public.world_profiles`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_events`, `public.session_outcome_promotions`, `public.session_players`, `public.session_recaps`, `public.sessions`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | INSERT | `public.session_events` | session_id, kind, actor_user_id, payload, revision_after, idempotency_key | unbedingt |
| `public.promote_session_outcome_to_world(uuid,text)` | UPDATE | `public.world_profiles` | modules, updated_at | NOT v_exists |
| `public.promote_session_outcome_to_world(uuid,text)` | INSERT | `public.session_outcome_promotions` | project_id, session_id, source_kind, source_id, target_kind, target_ref, created_by | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.promote_session_outcome_to_world(uuid,text)` | `public.world_profiles` / `trg_world_profiles_forbid_public_id_change` | `public.forbid_public_id_change()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | 42501 | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.forbid_public_id_change()` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.is_session_participant(uuid,uuid)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_find_session_consequence(uuid,text)` | [supabase/migrations/070_saga_promote_session_outcomes.sql](../../../supabase/migrations/070_saga_promote_session_outcomes.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/saga/session-outcome-promotion-service.ts:16

AST-Auflösung: `literal-union-parameter`; SHA-256 `f6e4246d0c8bf4dc93557c2a82a91d4638e1f2e5755cd79494b7a18fa49205c3`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async function callPromote(
  rpc: 'promote_session_outcome_to_saga' | 'promote_session_outcome_to_world',
  sessionId: string,
  consequenceId: string,
): Promise<PromoteRpcResult> {
  const { data, error } = await supabase.rpc(rpc, {
    p_session_id: sessionId,
    p_consequence_id: consequenceId,
  });
  if (error) {
    console.error(`[session-outcome-promotion] ${rpc} failed`, error);
    return {
      ok: false,
      messageDe: error.message || 'Übernehmen fehlgeschlagen',
    };
  }
  return parsePromoteRpcResult(data);
}
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `PromoteRpcResult` | [src/domains/session/contracts/session-outcome-promotion.ts](../../../src/domains/session/contracts/session-outcome-promotion.ts) | 56 | `d3c26e886f5f1da3b617723feaad5510218d486413ea7953bbc382593578bedd` |
| `parsePromoteRpcResult` | [src/domains/session/contracts/session-outcome-promotion.ts](../../../src/domains/session/contracts/session-outcome-promotion.ts) | 64 | `d3c26e886f5f1da3b617723feaad5510218d486413ea7953bbc382593578bedd` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Owner-GM übernimmt Konsequenz in die richtige Welt und erhält world_fact targetRef samt Quellenreferenzen.
- [ ] GM ohne Welt-Ownership und fremder Akteur 42501; fehlende Welt/Konsequenz erzeugt keine Promotion.
- [ ] Wiederholung liefert idempotent=true ohne zusätzliche Facts oder Events; gleichzeitige Erstanfragen prüfen die Unique-Constraint-Rollback-Semantik.
- [ ] Summary-Grenze, Visibility-Beibehaltung und Fact-ID-Kollision ab Zeichen65 explizit prüfen; Session-Revision bleibt gleich.
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
| [src/domains/session/contracts/session-outcome-promotion.ts](../../../src/domains/session/contracts/session-outcome-promotion.ts) | `d3c26e886f5f1da3b617723feaad5510218d486413ea7953bbc382593578bedd` |
| [src/infrastructure/saga/session-outcome-promotion-service.ts](../../../src/infrastructure/saga/session-outcome-promotion-service.ts) | `f6e4246d0c8bf4dc93557c2a82a91d4638e1f2e5755cd79494b7a18fa49205c3` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
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
| [supabase/migrations/070_saga_promote_session_outcomes.sql](../../../supabase/migrations/070_saga_promote_session_outcomes.sql) | `1b9498004ab77efbc59a5ff7bbd1676275da6d44b30d7afe6861b68a4f4fdcb7` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
