# RPC-Vertrag: `get_native_saga_definition_by_slug`

Findet die neueste veröffentlichte native Saga-Version anhand des Slugs.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#872](https://github.com/iamthamanic/sagatree/issues/872) — RPC-SAGA-VERSION-READ; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Sucht origin=native und getrimmten Slug, danach Published-Version nach published_at DESC NULLS LAST.
- Fehlende native Saga oder fehlende Veröffentlichung wirft P0002; Erfolg delegiert an den vollständigen Versionsvertrag.

## Berechtigungen

- Zugriff wird durch get_saga_definition_version authentifiziert und projiziert; Slug ist kein Berechtigungsnachweis.

## SQL-Signatur 1

`public.get_native_saga_definition_by_slug(text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_slug | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) (Zeilen 182–206, SHA-256 `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/get_native_saga_definition_by_slug-1.sql](effective-sql/get_native_saga_definition_by_slug-1.sql); SHA-256 `dbf2e4d31c01a7360ba9f8d836261fe7628119d87cab65b34e08ea179305bfdc`.

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
| 16 | unbedingt | `public.get_saga_definition_version(v_ver_id)` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| P0002 | Native Saga nicht gefunden | — | v_ver_id IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Reiner Lesevertrag; keine neue Saga, Version oder Projektmitgliedschaft.

**Direkt referenzierte reale Relationen:** `public.saga_definition_versions`, `public.saga_definitions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.saga_definition_versions`, `public.saga_definitions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |
| `public.get_saga_definition_version(uuid)` | [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | 42501, P0002 | True/True |
| `public.sagatree_project_saga_definition_payload(jsonb,boolean)` | [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | Keine eigene RAISE | True/True |

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

- [ ] Slug mit umgebenden Leerzeichen löst dieselbe Saga auf; Version mit höchstem published_at wird gewählt. Bei gleichen Zeitstempeln definiert der Legacy-SQL keinen zusätzlichen Tie-Breaker.
- [ ] Gleichnamige User-Saga darf nicht als native Quelle zurückkommen.
- [ ] Fehlender Slug/Published-Version P0002; anonymer Erfolgspfad scheitert durch den delegierten Auth-Check.
- [ ] Player- und GM-Payload entsprechen exakt get_saga_definition_version für die gewählte Version.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts) | `758929f1748a796774d5cf957bd92f780a836562c7a27c3d6b3757a764ddc8dc` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql) | `c1eccbda2dae95cd177ba6313dfd51ef269e0740a13805a5d07a223c6bf489cd` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
