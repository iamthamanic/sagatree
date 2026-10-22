# RPC-Vertrag: `set_saga_member_bundle`

Ersetzt die Bundle-Berechtigungen eines Saga-Mitglieds atomar.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#875](https://github.com/iamthamanic/sagatree/issues/875) — RPC-SAGA-GOVERNANCE; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Löscht bisherige Grants, setzt den neuen festgelegten Key-Satz und upsertet das Bundle-Assignment.
- Guard schützt davor, die letzte Governance-Berechtigung für Mitglieder-/Bundle-Verwaltung zu entfernen.
- Antwort {memberId,bundleId,grantCount}; ein UI-Rollenname ersetzt keinen Permission-Key.

## Berechtigungen

- Authentifizierung und saga.members.set_bundle oder Projekt-GM; Zielmitglied gehört zum angegebenen Projekt; Bundle-ID ist im festen Bundle-Katalog bekannt.

## SQL-Signatur 1

`public.set_saga_member_bundle(uuid,uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_project_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_member_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_bundle_id | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) (Zeilen 346–432, SHA-256 `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/set_saga_member_bundle-1.sql](effective-sql/set_saga_member_bundle-1.sql); SHA-256 `5db38ddbb8d34b4460e2568b02994f9745e23bbaf9181c6050dc23f82b020f6d`.

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
| 68 | unbedingt | `jsonb_build_object(     'memberId', p_member_id,     'bundleId', p_bundle_id,     'grantCount', (       SELECT COUNT(*)::INT FROM public.project_member_saga_grants WHERE member_id = p_member_id     )   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `memberId`, `bundleId`, `grantCount`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| P0001 | not authenticated | — | v_uid IS NULL |
| P0001 | missing saga.members.set_bundle | — | NOT public.has_saga_permission(p_project_id, 'saga.members.set_bundle')      AND NOT public.is_project_gm(p_project_id, v_uid) |
| P0001 | unknown bundle % | p_bundle_id | NOT EXISTS (SELECT 1 FROM public.saga_permission_bundles WHERE id = p_bundle_id) |
| P0001 | member not found | — | NOT FOUND |
| P0001 | cannot revoke last saga.members.set_bundle grant | — | p_bundle_id <> 'bundle.saga.gm' ∧ COALESCE(v_governance_left, 0) < 1        AND EXISTS (          SELECT 1 FROM public.project_member_saga_grants          WHERE member_id = p_member_id AND permission_key = 'saga.members.set_bundle'        ) |

## Transaktion, Idempotenz und Folgewirkungen

- Grant-Löschung, neue Grants und Assignment sind eine Transaktion; wiederholtes Setzen ist bezüglich des resultierenden Key-Satzes stabil.

**Direkt referenzierte reale Relationen:** `public.project_member_saga_bundles`, `public.project_member_saga_grants`, `public.project_members`, `public.saga_permission_bundle_keys`, `public.saga_permission_bundles`.

**Transitive reale Relationen:** `public.project_member_saga_bundles`, `public.project_member_saga_grants`, `public.project_members`, `public.projects`, `public.saga_permission_bundle_keys`, `public.saga_permission_bundles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.set_saga_member_bundle(uuid,uuid,text)` | DELETE | `public.project_member_saga_grants` | — | unbedingt |
| `public.set_saga_member_bundle(uuid,uuid,text)` | INSERT | `public.project_member_saga_grants` | project_id, member_id, user_id, permission_key, source_bundle_id, granted_by | unbedingt |
| `public.set_saga_member_bundle(uuid,uuid,text)` | INSERT | `public.project_member_saga_bundles` | member_id, project_id, user_id, bundle_id, assigned_by, updated_at | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.has_saga_permission(uuid,text)` | [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | Keine eigene RAISE | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/saga-permission-service.ts:151

AST-Auflösung: `string-literal`; SHA-256 `d7ecf2801db6206f7e6cc6314f3783c22b453f84ccfd7de62166b238aeebc931`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async setMemberBundle(input: {
    projectId: string;
    memberId: string;
    bundleId: SagaBundleId;
  }): Promise<void> {
    const { error } = await supabase.rpc('set_saga_member_bundle', {
      p_project_id: input.projectId,
      p_member_id: input.memberId,
      p_bundle_id: input.bundleId,
    });
    if (error) {
      throw new Error(`Bundle konnte nicht gesetzt werden: ${error.message}`);
    }
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Jeder unterstützte Bundle-Wechsel liefert genau die katalogisierten Grants und entsprechende grantCount.
- [ ] Fremdes Projekt/Zielmitglied und unbekannter Bundle-Key werden vor Teiländerungen abgewiesen.
- [ ] Letzten Governance-Berechtigten herunterstufen wird abgelehnt und erhält sämtliche ursprüngliche Grants.
- [ ] Fehler beim Grant-Insert rollt das vorherige Löschen und die Bundle-Zuordnung zurück; Wiederholung führt zum gleichen Key-Satz.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/project/saga-permission-service.ts](../../../src/infrastructure/project/saga-permission-service.ts) | `d7ecf2801db6206f7e6cc6314f3783c22b453f84ccfd7de62166b238aeebc931` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
