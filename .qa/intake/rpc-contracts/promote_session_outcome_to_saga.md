# RPC-Vertrag: `promote_session_outcome_to_saga`

Übernimmt eine Session-Konsequenz idempotent als Knowledge-Fact in den eigenen Saga-Entwurf.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#876](https://github.com/iamthamanic/sagatree/issues/876) — RPC-SAGA-PROJECTIONS; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Sperrt saga_definitions. Bestehende Promotion nach project_id+source_kind=consequence+source_id+target_kind=saga_fact liefert {ok:true,idempotent:true,targetKind,targetRef}.
- Konsequenz muss vorhanden sein und nichtleere Summary haben. Fact-ID ist promoted:+erste 64 Zeichen der consequence_id; Summary wird auf 200 Zeichen begrenzt; Visibility wird auf public/shared/gm_only/discovered/character_specific begrenzt, sonst shared.
- Fehlt Fact, wird er in draft.payload.knowledgeFacts ergänzt und draft_revision erhöht. Promotion-Zeile und adventure-Event mit op=promote_outcome werden auch bei bereits vorhandenem Fact erzeugt.
- Neue Erfolgsantwort hat idempotent=false und messageDe. Das Event verwendet die vorhandene Session-Revision; runtime_revision wird hier nicht erhöht.

## Berechtigungen

- Authentifizierter Session-Projekt-GM und Owner der gebundenen nicht-nativen Saga; native Definition unveränderlich.

## SQL-Signatur 1

`public.promote_session_outcome_to_saga(uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_consequence_id | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/070_saga_promote_session_outcomes.sql](../../../supabase/migrations/070_saga_promote_session_outcomes.sql) (Zeilen 69–209, SHA-256 `1b9498004ab77efbc59a5ff7bbd1676275da6d44b30d7afe6861b68a4f4fdcb7`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/promote_session_outcome_to_saga-1.sql](effective-sql/promote_session_outcome_to_saga-1.sql); SHA-256 `eaaad9b9a97d013521067be45ec34fd37df77e4db317028e2752d998d216d537`.

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
| 52 | FOUND | `jsonb_build_object(       'ok', true,       'idempotent', true,       'targetKind', 'saga_fact',       'targetRef', v_promo.target_ref     )` |
| 125 | unbedingt | `jsonb_build_object(     'ok', true,     'idempotent', false,     'targetKind', 'saga_fact',     'targetRef', v_fact_id,     'messageDe', 'In die Saga-Definition übernommen (Entwurf).'   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `id`, `visibility`, `summary`
- `ok`, `idempotent`, `targetKind`, `targetRef`
- `ok`, `idempotent`, `targetKind`, `targetRef`, `messageDe`
- `op`, `target`, `consequenceId`, `factId`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| P0002 | Session nicht gefunden | — | NOT FOUND |
| 42501 | Nur Gamemaster darf übernehmen | — | NOT public.is_project_gm(v_project.id, v_user) |
| 22023 | Keine Saga-Definition an diese Gruppe gebunden | — | v_project.saga_id IS NULL |
| P0002 | Saga-Definition nicht gefunden | — | NOT FOUND |
| 42501 | Native Sagas sind unveränderlich — bitte zuerst als Kopie speichern | — | v_def.origin = 'native' |
| 42501 | Nur die Autorin/der Autor der Saga darf in die Definition übernehmen | — | v_def.owner_user_id IS DISTINCT FROM v_user |
| P0002 | Ereignis nicht gefunden | — | v_cons IS NULL |
| 22023 | Ereignis ohne Text | — | v_summary IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Definition-Lock serialisiert Saga-Promotion; Fact, Draft-Revision, Promotion-Zeile und Event sind atomar. Dedup-Scope enthält Projekt und Konsequenz, nicht die Session-ID.

**Direkt referenzierte reale Relationen:** `public.projects`, `public.saga_definition_versions`, `public.saga_definitions`, `public.session_outcome_promotions`, `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.saga_definition_versions`, `public.saga_definitions`, `public.session_events`, `public.session_outcome_promotions`, `public.session_players`, `public.session_recaps`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | INSERT | `public.session_events` | session_id, kind, actor_user_id, payload, revision_after, idempotency_key | unbedingt |
| `public.promote_session_outcome_to_saga(uuid,text)` | UPDATE | `public.saga_definition_versions` | payload | NOT v_exists |
| `public.promote_session_outcome_to_saga(uuid,text)` | UPDATE | `public.saga_definitions` | draft_revision, updated_at | NOT v_exists |
| `public.promote_session_outcome_to_saga(uuid,text)` | INSERT | `public.session_outcome_promotions` | project_id, session_id, source_kind, source_id, target_kind, target_ref, created_by | unbedingt |
| `public.sagatree_ensure_saga_draft(uuid)` | INSERT | `public.saga_definition_versions` | saga_id, version_label, status, payload, published_at | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | 42501 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.is_session_participant(uuid,uuid)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_ensure_saga_draft(uuid)` | [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | Keine eigene RAISE | True/True |
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

- [ ] Owner-GM übernimmt vorhandene Konsequenz: genau ein Draft-Fact, eine Promotion, ein adventure-Event und eine Draft-Revisionssteigerung.
- [ ] Wiederholung im selben Projekt liefert idempotent=true und targetRef ohne neue Promotion/Event/Revision.
- [ ] Nicht-GM, fremder Saga-Owner und native Saga werden 42501; fehlende Konsequenz P0002 und leere Summary 22023.
- [ ] Visibility-Normalisierung, 64-/200-Zeichen-Grenzen und vorhandener Fact ohne Promotion separat testen; Session-Revision bleibt gleich.
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
| [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [supabase/migrations/070_saga_promote_session_outcomes.sql](../../../supabase/migrations/070_saga_promote_session_outcomes.sql) | `1b9498004ab77efbc59a5ff7bbd1676275da6d44b30d7afe6861b68a4f4fdcb7` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
