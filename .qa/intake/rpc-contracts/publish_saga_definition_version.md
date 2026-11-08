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

### src/infrastructure/saga/saga-definition-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `758929f1748a796774d5cf957bd92f780a836562c7a27c3d6b3757a764ddc8dc`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * saga-definition-service — Saga definitions via host HTTP (#574 / #575, CUT-20).
 * Location: src/infrastructure/saga/saga-definition-service.ts
 */
import {
  draftToPayload,
  parseSagaDefinitionEditor,
  parseSagaDefinitionVersion,
  type SagaDefinitionDraft,
  type SagaDefinitionEditorVm,
  type SagaDefinitionVersionVm,
} from '../../domains/saga/contracts/saga-definition';
import {
  copyHostNativeSagaDefinition,
  createHostProjectFromSagaVersion,
  createHostUserSagaDefinition,
  duplicateHostSagaPlaythrough,
  getHostNativeSagaDefinitionBySlug,
  getHostSagaDefinitionEditor,
  getHostSagaDefinitionVersion,
  isHostLibraryEnabled,
  publishHostSagaDefinitionVersion,
  saveHostSagaDefinitionDraft,
} from '../host/host-saga-definition-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

class SagaDefinitionService {
  async getVersionById(versionId: string): Promise<SagaDefinitionVersionVm> {
    assertHost();
    return parseSagaDefinitionVersion(await getHostSagaDefinitionVersion(versionId));
  }

  async getNativeBySlug(slug: string): Promise<SagaDefinitionVersionVm> {
    assertHost();
    return parseSagaDefinitionVersion(await getHostNativeSagaDefinitionBySlug(slug));
  }

  async getEditor(sagaId: string): Promise<SagaDefinitionEditorVm> {
    assertHost();
    return parseSagaDefinitionEditor(await getHostSagaDefinitionEditor(sagaId));
  }

  async saveDraft(input: {
    readonly sagaId: string;
    readonly draft: SagaDefinitionDraft;
    readonly expectedRevision: number;
  }): Promise<{ readonly revision: number; readonly versionId: string }> {
    assertHost();
    const payload = draftToPayload(input.draft);
    return saveHostSagaDefinitionDraft({
      sagaId: input.sagaId,
      payload: payload as unknown as Record<string, unknown>,
      expectedRevision: input.expectedRevision,
    });
  }

  async publishVersion(input: {
    readonly sagaId: string;
    readonly expectedRevision: number;
  }): Promise<{ readonly versionId: string; readonly versionLabel: string }> {
    assertHost();
    return publishHostSagaDefinitionVersion(input);
  }

  async createCopyFromNative(sourceSagaId: string): Promise<{ readonly sagaId: string }> {
    assertHost();
    return copyHostNativeSagaDefinition(sourceSagaId);
  }

  async createUserSaga(input: {
    readonly title: string;
    readonly blurb?: string;
  }): Promise<{ readonly sagaId: string }> {
    assertHost();
    return createHostUserSagaDefinition(input);
  }

  async createProjectFromVersion(input: {
    readonly sagaId: string;
    readonly versionId: string;
    readonly name?: string;
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    assertHost();
    return createHostProjectFromSagaVersion(input);
  }

  async duplicatePlaythrough(input: {
    readonly projectId: string;
    readonly mode: 'fresh' | 'with_progress';
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    assertHost();
    return duplicateHostSagaPlaythrough(input);
  }
}

export const sagaDefinitionService = new SagaDefinitionService();

```

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
| [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts) | `758929f1748a796774d5cf957bd92f780a836562c7a27c3d6b3757a764ddc8dc` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
