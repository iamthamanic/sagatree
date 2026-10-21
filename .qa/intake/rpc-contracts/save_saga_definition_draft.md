# RPC-Vertrag: `save_saga_definition_draft`

Speichert den eigenen Saga-Entwurf mit optimistischer Revisionskontrolle.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#871](https://github.com/iamthamanic/sagatree/issues/871) — RPC-SAGA-AUTHORING; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Sperrt die Definition FOR UPDATE und vergleicht draft_revision mit p_expected_revision; Konflikt ist 40001.
- Validiert Payload/Titel, sorgt für Draft und aktualisiert Payload, Titel/Synopsis, Revision und Zeitstempel.
- Antwort {sagaId,versionId,revision,payload} enthält die neue Draft-Revision.

## Berechtigungen

- Authentifizierter Owner; native Definition ist unveränderlich.

## SQL-Signatur 1

`public.save_saga_definition_draft(uuid,jsonb,integer)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_saga_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_payload | `jsonb` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_expected_revision | `integer` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) (Zeilen 111–176, SHA-256 `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/save_saga_definition_draft-1.sql](effective-sql/save_saga_definition_draft-1.sql); SHA-256 `43a035657375ca60f01af75e875557644371b2967f45936206e3343dc5b0b051`.

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
| 49 | unbedingt | `jsonb_build_object(     'sagaId', v_def.id,     'versionId', v_ver.id,     'revision', v_def.draft_revision,     'payload', v_ver.payload   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `sagaId`, `versionId`, `revision`, `payload`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| P0002 | Saga-Definition nicht gefunden | — | NOT FOUND |
| 42501 | Native Sagas sind unveränderlich | — | v_def.origin = 'native' |
| 42501 | forbidden | — | v_def.owner_user_id IS DISTINCT FROM v_user |
| 40001 | Revisionskonflikt — bitte neu laden | — | v_def.draft_revision IS DISTINCT FROM COALESCE(p_expected_revision, -1) |
| 22023 | Titel darf nicht leer sein | — | v_title IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Definition-Row-Lock, Draft-Sicherung und Payload-/Revision-Update sind atomar; eine alte Revision ist kein Idempotency-Key.

**Direkt referenzierte reale Relationen:** `public.saga_definition_versions`, `public.saga_definitions`.

**Transitive reale Relationen:** `public.saga_definition_versions`, `public.saga_definitions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.sagatree_ensure_saga_draft(uuid)` | INSERT | `public.saga_definition_versions` | saga_id, version_label, status, payload, published_at | unbedingt |
| `public.save_saga_definition_draft(uuid,jsonb,integer)` | UPDATE | `public.saga_definition_versions` | payload | unbedingt |
| `public.save_saga_definition_draft(uuid,jsonb,integer)` | UPDATE | `public.saga_definitions` | title, synopsis, draft_revision, updated_at | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.sagatree_ensure_saga_draft(uuid)` | [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/saga/saga-definition-service.ts:60

AST-Auflösung: `string-literal`; SHA-256 `f822494e28a12fb507a934430baeed0e77e8b60ed1f84e17eca2e3f68e6ed6a4`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async saveDraft(input: {
    readonly sagaId: string;
    readonly draft: SagaDefinitionDraft;
    readonly expectedRevision: number;
  }): Promise<{ readonly revision: number; readonly versionId: string }> {
    const payload = draftToPayload(input.draft);
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('save_saga_definition_draft', {
        p_saga_id: input.sagaId,
        p_payload: payload,
        p_expected_revision: input.expectedRevision,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Speichern Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Entwurf konnte nicht gespeichert werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Speicher-Antwort');
    }
    const row = data as { revision?: number; versionId?: string };
    if (typeof row.revision !== 'number' || typeof row.versionId !== 'string') {
      throw new Error('Speicher-Antwort unvollständig');
    }
    return { revision: row.revision, versionId: row.versionId };
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `SagaDefinitionOrigin` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 8 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SagaKnowledgeFact` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 18 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SagaLocationRef` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 24 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SagaPregenRef` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 29 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SagaDefinitionFactionTemplate` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 35 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SagaDefinitionSimulationSlice` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 45 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SagaDefinitionPayload` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 124 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SagaDefinitionDraft` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 150 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `draftToPayload` | [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | 434 | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `SUPABASE_QUERY_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 8 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutReject` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 36 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Owner speichert gültige Payload: neue Revision und zurückgegebene Payload entsprechen gespeicherten Daten.
- [ ] Zwei Saves mit gleicher erwarteter Revision: nur einer erfolgreich, anderer 40001 ohne Teiländerung.
- [ ] Fremder Owner/native Definition 42501 und ungültiger Titel 22023; Draft-Zeilen bleiben unverändert.
- [ ] Vorher fehlender Draft wird zusammen mit Änderungen atomar erzeugt; Published-Versionen werden nicht überschrieben.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/saga/contracts/saga-definition.ts](../../../src/domains/saga/contracts/saga-definition.ts) | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts) | `f822494e28a12fb507a934430baeed0e77e8b60ed1f84e17eca2e3f68e6ed6a4` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
