# RPC-Vertrag: `create_user_saga_definition`

Erzeugt eine eigene User-Saga mit erstem Entwurf und Revision null.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#871](https://github.com/iamthamanic/sagatree/issues/871) — RPC-SAGA-AUTHORING; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Titel wird getrimmt und muss nicht leer sein. Neue saga_definitions-Zeile erhält zugehörigen Draft mit initialer versionierter Payload.
- Antwort enthält sagaId, versionId und revision=0; dieser Vertrag ist kein Published-Version-Vertrag.

## Berechtigungen

- auth.uid() muss gesetzt sein; Owner und origin=user werden serverseitig gesetzt.

## SQL-Signatur 1

`public.create_user_saga_definition(text,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_title | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_blurb | `text` | DEFAULT | `''` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [archive/supabase-legacy/supabase/migrations/064_saga_editor_v1.sql](../../../archive/supabase-legacy/supabase/migrations/064_saga_editor_v1.sql) (Zeilen 325–382, SHA-256 `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/create_user_saga_definition-1.sql](effective-sql/create_user_saga_definition-1.sql); SHA-256 `e39d559d982b652c57f4367686e99ddb5c73940ba2c326d6206b89fd0157e3fb`.

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
| 48 | unbedingt | `jsonb_build_object('sagaId', v_new_id, 'versionId', v_draft_id, 'revision', 0)` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `packageId`, `title`, `blurb`, `synopsis`, `knowledgeFacts`, `locations`, `pregens`
- `sagaId`, `versionId`, `revision`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 22023 | Titel darf nicht leer sein | — | v_title IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Definition und Draft werden atomar angelegt; keine Idempotenz.

**Direkt referenzierte reale Relationen:** `public.saga_definition_versions`, `public.saga_definitions`.

**Transitive reale Relationen:** `public.saga_definition_versions`, `public.saga_definitions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.create_user_saga_definition(text,text)` | INSERT | `public.saga_definitions` | id, slug, title, synopsis, origin, owner_user_id, draft_revision | unbedingt |
| `public.create_user_saga_definition(text,text)` | INSERT | `public.saga_definition_versions` | id, saga_id, version_label, status, payload, published_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.create_user_saga_definition(text,text)` | `public.saga_definitions` / `trg_forbid_native_saga_insert` | `public.sagatree_forbid_native_saga_insert()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.sagatree_forbid_native_saga_insert()` | [archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql) | 42501 | True/True |

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

- [ ] Gültiger Titel/Synopsis erzeugt genau eine eigene Definition und Draft mit den gespeicherten IDs.
- [ ] Leerer/Whitespace-Titel wird 22023 und erzeugt keine Definition.
- [ ] Anonymer Aufruf ist 42501; Client kann keinen fremden Owner oder native origin einschleusen.
- [ ] Zwei Aufrufe erzeugen zwei unabhängige Definitionen; initialer Draft lässt sich über Editor unverändert decodieren.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [archive/supabase-legacy/supabase/migrations/064_saga_editor_v1.sql](../../../archive/supabase-legacy/supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [archive/supabase-legacy/supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../archive/supabase-legacy/supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [archive/supabase-legacy/supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../archive/supabase-legacy/supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts) | `758929f1748a796774d5cf957bd92f780a836562c7a27c3d6b3757a764ddc8dc` |
