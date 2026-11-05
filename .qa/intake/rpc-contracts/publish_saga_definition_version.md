# RPC-Vertrag: `publish_saga_definition_version`

Veröffentlicht den eigenen aktuellen Draft als neue unveränderliche Version.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#871](https://github.com/iamthamanic/sagatree/issues/871) — RPC-SAGA-AUTHORING; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Sperrt Definition und prüft erwartete draft_revision mit 40001 bei Konflikt; Draft/Titel müssen gültig sein.
- Erzeugt eine neue Published-Version aus dem Draft mit dem SQL-seitig ermittelten Label und veröffentlichtem Zeitstempel; vorhandene Versionen bleiben erhalten.
- Antwort enthält sagaId,versionId,versionLabel,revision; Veröffentlichung ist keine Projektmigration auf diese Version.

## Berechtigungen

- Authentifizierter Owner; native Saga bleibt unveränderlich.

## SQL-Signatur 1

`public.publish_saga_definition_version(uuid,integer)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_saga_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_expected_revision | `integer` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) (Zeilen 180–252, SHA-256 `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/publish_saga_definition_version-1.sql](effective-sql/publish_saga_definition_version-1.sql); SHA-256 `2fc26577b1eccc258d9579082d92fcc35d4aff1213ec51f33fe03edbbb2cdec7`.

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
| 58 | unbedingt | `jsonb_build_object(     'sagaId', v_def.id,     'versionId', v_new.id,     'versionLabel', v_new.version_label,     'revision', v_def.draft_revision   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `sagaId`, `versionId`, `versionLabel`, `revision`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| P0002 | Saga-Definition nicht gefunden | — | NOT FOUND |
| 42501 | Native Sagas sind unveränderlich | — | v_def.origin = 'native' |
| 42501 | forbidden | — | v_def.owner_user_id IS DISTINCT FROM v_user |
| 40001 | Revisionskonflikt — bitte neu laden | — | v_def.draft_revision IS DISTINCT FROM COALESCE(p_expected_revision, -1) |
| 22023 | Titel darf nicht leer sein | — | NULLIF(BTRIM(COALESCE(v_draft.payload->>'title', v_def.title, '')), '') IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Definition-Lock, Draft-Sicherung und Published-Insert sind eine Transaktion; kein Request-Key.

**Direkt referenzierte reale Relationen:** `public.saga_definition_versions`, `public.saga_definitions`.

**Transitive reale Relationen:** `public.saga_definition_versions`, `public.saga_definitions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.publish_saga_definition_version(uuid,integer)` | INSERT | `public.saga_definition_versions` | saga_id, version_label, status, payload, published_at | unbedingt |
| `public.sagatree_ensure_saga_draft(uuid)` | INSERT | `public.saga_definition_versions` | saga_id, version_label, status, payload, published_at | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.sagatree_ensure_saga_draft(uuid)` | [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/saga/saga-definition-service.ts:126

AST-Auflösung: `string-literal`; SHA-256 `bff1c95f3554628b28ba1db530db0807bcd3351e8f76139730756e9b1a54fea3`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async publishVersion(input: {
    readonly sagaId: string;
    readonly expectedRevision: number;
  }): Promise<{ readonly versionId: string; readonly versionLabel: string }> {
    if (isHostLibraryEnabled()) {
      return publishHostSagaDefinitionVersion(input);
    }
    assertHostProductSurfaceAvailable('Saga-Definitionen');
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('publish_saga_definition_version', {
        p_saga_id: input.sagaId,
        p_expected_revision: input.expectedRevision,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Veröffentlichen Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Fassung konnte nicht veröffentlicht werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Publish-Antwort');
    }
    const row = data as { versionId?: string; versionLabel?: string };
    if (typeof row.versionId !== 'string') {
      throw new Error('Publish ohne versionId');
    }
    return {
      versionId: row.versionId,
      versionLabel: typeof row.versionLabel === 'string' ? row.versionLabel : 'v?',
    };
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `EnvLike` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 11 | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `defaultEnv` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 16 | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `isHostLibraryExplicitlyDisabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 25 | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `isHostLibraryEnabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 30 | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `assertHostProductSurfaceAvailable` | [src/infrastructure/host/host-product-deny.ts](../../../src/infrastructure/host/host-product-deny.ts) | 10 | `69b148debc95006bb31daa7a94caf4e1507ac3089fdf399952102c4effa3759c` |
| `EnvLike` | [src/infrastructure/host/host-saga-definition-http.ts](../../../src/infrastructure/host/host-saga-definition-http.ts) | 12 | `3bf857114def303681691297c71f09a9b6278658e51cad659f0d7e51e0a819f1` |
| `defaultEnv` | [src/infrastructure/host/host-saga-definition-http.ts](../../../src/infrastructure/host/host-saga-definition-http.ts) | 17 | `3bf857114def303681691297c71f09a9b6278658e51cad659f0d7e51e0a819f1` |
| `hostMutateJson` | [src/infrastructure/host/host-saga-definition-http.ts](../../../src/infrastructure/host/host-saga-definition-http.ts) | 58 | `3bf857114def303681691297c71f09a9b6278658e51cad659f0d7e51e0a819f1` |
| `publishHostSagaDefinitionVersion` | [src/infrastructure/host/host-saga-definition-http.ts](../../../src/infrastructure/host/host-saga-definition-http.ts) | 164 | `3bf857114def303681691297c71f09a9b6278658e51cad659f0d7e51e0a819f1` |
| `EnvLike` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 31 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `defaultEnv` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 33 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `getHostAuthBaseUrl` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 53 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `SUPABASE_QUERY_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 8 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutReject` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 36 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 13 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 15 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 16 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostAuthUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 17 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostFirst` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 18 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 58 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 59 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 61 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

## Konkrete Abnahmekriterien

- [ ] Gültiger Draft erzeugt neue Published-Version mit identischer Payload und korrekt ermitteltem Label.
- [ ] Alte Published-Versionen und bestehende project.saga_version_id bleiben unverändert.
- [ ] Fremder Actor/native Ursprung 42501; veraltete Revision 40001 ohne neue Published-Zeile.
- [ ] Wiederholung mit noch gültiger Revision hat den tatsächlichen neuen-Version-Effekt; kein unbewiesener Dedup-Vertrag.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| [src/infrastructure/host/host-product-deny.ts](../../../src/infrastructure/host/host-product-deny.ts) | `69b148debc95006bb31daa7a94caf4e1507ac3089fdf399952102c4effa3759c` |
| [src/infrastructure/host/host-saga-definition-http.ts](../../../src/infrastructure/host/host-saga-definition-http.ts) | `3bf857114def303681691297c71f09a9b6278658e51cad659f0d7e51e0a819f1` |
| [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts) | `bff1c95f3554628b28ba1db530db0807bcd3351e8f76139730756e9b1a54fea3` |
| [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
