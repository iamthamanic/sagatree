# RPC-Vertrag: `get_saga_lore_timeline`

Erzeugt die Saga-Lore-Timeline aus Definition, Recaps und Asset-Bindings.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#876](https://github.com/iamthamanic/sagatree/issues/876) — RPC-SAGA-PROJECTIONS; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Vereinigt im wirksamen SQL veröffentlichte Saga-Payload, abgeschlossene Session-Recaps und geeignete Bindings zu entries.
- Antwort enthält projectId,canReadHidden,entries; jede Quellenart verwendet ihre festgelegten ID-/Visibility-/Titel-/Zeitfelder.

## Berechtigungen

- Authentifizierung und aktive Mitgliedschaft/GM; saga.lore.read erforderlich sofern nicht GM. Verborgene Inhalte verlangen separaten Hidden-Lesepfad.

## SQL-Signatur 1

`public.get_saga_lore_timeline(text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_public_id | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) (Zeilen 647–775, SHA-256 `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/get_saga_lore_timeline-1.sql](effective-sql/get_saga_lore_timeline-1.sql); SHA-256 `5b8655687e4386b99511fbf0033d6374569b4fdc095e8899006e1107cbb5d132`.

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
| 115 | unbedingt | `jsonb_build_object(     'projectId', v_project.id,     'canReadHidden', v_can_hidden,     'entries', COALESCE(v_entries, '[]'::jsonb)   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `bindingId`, `reveal`
- `id`, `kind`, `title`, `summary`, `visibility`, `occurredAt`, `meta`
- `projectId`, `canReadHidden`, `entries`
- `sessionPublicId`, `sessionNumber`, `highlightLines`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| P0001 | not authenticated | — | v_uid IS NULL |
| P0001 | saga not found | — | v_project.id IS NULL |
| P0001 | not a member | — | NOT public.current_user_is_active_project_member(v_project.id)      AND NOT public.is_project_gm(v_project.id, v_uid) |
| P0001 | missing saga.lore.read | — | NOT public.has_saga_permission(v_project.id, 'saga.lore.read')      AND NOT public.is_project_gm(v_project.id, v_uid) |

## Transaktion, Idempotenz und Folgewirkungen

- Leseaggregation; keine Erstellung oder Promotion von Lore-Facts.

**Direkt referenzierte reale Relationen:** `public.projects`, `public.saga_asset_bindings`, `public.saga_definition_versions`, `public.session_recaps`, `public.sessions`.

**Transitive reale Relationen:** `public.project_member_saga_grants`, `public.project_members`, `public.projects`, `public.saga_asset_bindings`, `public.saga_definition_versions`, `public.session_recaps`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.can_view_saga_binding(uuid,text,text)` | [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | Keine eigene RAISE | True/True |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |
| `public.has_saga_permission(uuid,text)` | [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | Keine eigene RAISE | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/saga-permission-service.ts:196

AST-Auflösung: `string-literal`; SHA-256 `d7ecf2801db6206f7e6cc6314f3783c22b453f84ccfd7de62166b238aeebc931`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async getLoreTimeline(sagaPublicId: string): Promise<SagaLoreTimelineVm> {
    const { data, error } = await supabase.rpc('get_saga_lore_timeline', {
      p_public_id: sagaPublicId.trim().toUpperCase(),
    });
    if (error) {
      throw new Error(`Lore/Verlauf: ${error.message}`);
    }
    return parseSagaLoreTimeline(data);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `SagaLoreEntryKind` | [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | 6 | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `SagaLoreTimelineEntry` | [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | 8 | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `SagaLoreTimelineVm` | [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | 17 | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `asString` | [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | 23 | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `asBool` | [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | 27 | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `KINDS` | [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | 31 | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `parseSagaLoreTimeline` | [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | 33 | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Saga mit Definitionstimeline, abgeschlossenem Recap und Binding liefert alle vorgesehenen Quellen mit stabilen unterschiedlichen IDs.
- [ ] Ohne Hidden-Recht erscheinen keine verborgenen Lore-Einträge; GM/Hidden-Grant darf sie entsprechend Source-Regeln sehen.
- [ ] Mitglied ohne lore.read und fremdes Projekt werden abgewiesen.
- [ ] Fehlende Definition/Recaps ergeben leere passende Teilmengen; Decoder und Reihenfolge anhand gemischter Zeitpunkte prüfen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/saga/permissions/lore-timeline.ts](../../../src/domains/saga/permissions/lore-timeline.ts) | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| [src/infrastructure/project/saga-permission-service.ts](../../../src/infrastructure/project/saga-permission-service.ts) | `d7ecf2801db6206f7e6cc6314f3783c22b453f84ccfd7de62166b238aeebc931` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql) | `c1eccbda2dae95cd177ba6313dfd51ef269e0740a13805a5d07a223c6bf489cd` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql) | `d02f115b12a959b1186539c310726de5791314380cc010ca337014f3045d079a` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
