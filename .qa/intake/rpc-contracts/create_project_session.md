# RPC-Vertrag: `create_project_session`

Legt eine geplante Projekt-Session mit Adventure- und Wissensübergabe an.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#868](https://github.com/iamthamanic/sagatree/issues/868) — RPC-SESSION-LIFECYCLE; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Erzeugt status scheduled mit neuer Projekt-Session-Nummer/Join-Code und getrimmtem Namen bzw. Notes.
- Übernimmt projects.adventure_runtime, sofern es ein JSON-Objekt ist. Knowledge stammt aus der höchsten abgeschlossenen session_number unter den Sessions mit vorhandenem shared.knowledge-Schlüssel; ist dieser Wert kein Objekt, wird Knowledge weggelassen, ohne erneut eine ältere Session zu suchen.
- Returns public.sessions als vollständige Zeile; Validierungsfehler ohne explizites ERRCODE verwenden P0001.

## Berechtigungen

- Authentifizierung; erlaubt sind projects.gm_user_id oder aktive project_members mit role gm/player. Dieser RPC ist im Quellcode nicht GM-exklusiv.

## SQL-Signatur 1

`public.create_project_session(uuid,text,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_project_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_name | `text` | DEFAULT | `NULL` |
| p_notes | `text` | DEFAULT | `NULL` |

**RETURNS:** `public.sessions`.

**Wirksame Definition:** [archive/supabase-legacy/supabase/migrations/061_session_recaps_and_handover.sql](../../../archive/supabase-legacy/supabase/migrations/061_session_recaps_and_handover.sql) (Zeilen 284–350, SHA-256 `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/create_project_session-1.sql](effective-sql/create_project_session-1.sql); SHA-256 `1533db17f221b19e74f244585af22502bc6fd45794e007dcaeaebdd4b4a2b320`.

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
| 55 | unbedingt | `created` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `adventure`
- `adventure`, `knowledge`
- `shared`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| P0001 | not authenticated | — | actor IS NULL |
| P0001 | forbidden | — | NOT is_member |

## Transaktion, Idempotenz und Folgewirkungen

- Session-Anlage und Nummernvergabe sind eine Transaktion; Wiederholung erzeugt neue Session.

**Direkt referenzierte reale Relationen:** `public.project_members`, `public.projects`, `public.sessions`.

**Transitive reale Relationen:** `public.look_profiles`, `public.project_members`, `public.projects`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.create_project_session(uuid,text,text)` | INSERT | `public.sessions` | project_id, session_number, name, notes, status, code, world_state | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.create_project_session(uuid,text,text)` | `public.sessions` / `trg_sessions_ensure_public_id` | `public.ensure_public_id()` |
| `public.create_project_session(uuid,text,text)` | `public.sessions` / `trg_sessions_look_binding` | `public.enforce_session_look_profile_binding()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.allocate_next_session_number(uuid)` | [archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.enforce_session_look_profile_binding()` | [archive/supabase-legacy/supabase/migrations/053_sessions_look_override.sql](../../../archive/supabase-legacy/supabase/migrations/053_sessions_look_override.sql) | P0001 | True/True |
| `public.ensure_public_id()` | [archive/supabase-legacy/supabase/migrations/084_look_profiles_public_id.sql](../../../archive/supabase-legacy/supabase/migrations/084_look_profiles_public_id.sql) | Keine eigene RAISE | True/True |
| `public.generate_sagatree_public_id(text)` | [archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.generate_unique_session_code()` | [archive/supabase-legacy/supabase/migrations/040_session_join_code_security.sql](../../../archive/supabase-legacy/supabase/migrations/040_session_join_code_security.sql) | P0001 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/project-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `29846df2ae25287b68cba443a9c85f2f9952fa9cc1afd3faf762a78eb57a6fa6`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * project-service — Host HTTP adapter for projects/campaigns (CUT-20).
 * Location: src/infrastructure/project/project-service.ts
 *
 * Product runtime uses host Library + project routes only — no Supabase client.
 */
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
import {
  fetchHostLibraryProjects,
  isHostLibraryEnabled,
  type HostLibraryProjectDto,
} from '../host/host-library-http';
import {
  createHostProject,
  createHostProjectSession,
  deleteHostProject,
  updateHostProject,
  updateHostSessionLook,
  type HostProjectWriteDto,
} from '../host/host-project-http';
import { fetchHostSessions, type HostPlaySessionDto } from '../host/host-session-http';
import { projectMemberService } from './project-member-service';
import type {
  ProjectDto,
  ProjectMemberDto,
  ProjectSummaryVm,
  ProjectVm,
  CreateProjectDto,
  JoinProjectDto,
  SessionDto,
  SessionVm,
} from '../../domains/project/contracts/project.types';
import { normalizePlaySessionStatus } from '../../domains/session/contracts/session-lifecycle';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function isProjectStatus(value: unknown): value is ProjectDto['status'] {
  return value === 'active' || value === 'paused' || value === 'completed' || value === 'archived';
}

class ProjectService {
  private mapHostPlaySessionToSessionDto(row: HostPlaySessionDto): SessionDto {
    const status = normalizePlaySessionStatus(row.status);
    const createdAt =
      typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString();
    const updatedAt = createdAt;
    return {
      id: row.sessionId,
      public_id: typeof row.publicId === 'string' ? row.publicId : undefined,
      project_id: row.projectId,
      session_number: typeof row.sessionNumber === 'number' ? row.sessionNumber : 0,
      name: row.name ?? null,
      notes: null,
      status,
      started_at: row.startedAt ?? null,
      ended_at: row.endedAt ?? null,
      duration_minutes: null,
      look_profile_id:
        typeof row.lookProfileId === 'string' ? row.lookProfileId : null,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }

  private hostProjectRowToProjectDto(row: HostProjectWriteDto | HostLibraryProjectDto): ProjectDto {
    const statusRaw = row.status ?? 'active';
    const status = isProjectStatus(statusRaw) ? statusRaw : 'active';
    const createdAt =
      'createdAt' in row && typeof row.createdAt === 'string'
        ? row.createdAt
        : new Date().toISOString();
    const updatedAt =
      'updatedAt' in row && typeof row.updatedAt === 'string' ? row.updatedAt : createdAt;
    return {
      id: row.id,
      public_id: typeof row.publicId === 'string' ? row.publicId : undefined,
      code: typeof row.code === 'string' ? row.code : '',
      name: row.name,
      description: row.description ?? null,
      world_id: row.worldId ?? null,
      world_profile_id: row.worldProfileId ?? row.worldId ?? null,
      default_look_profile_id:
        'defaultLookProfileId' in row && typeof row.defaultLookProfileId === 'string'
          ? row.defaultLookProfileId
          : null,
      allow_player_character_look_override:
        'allowPlayerCharacterLookOverride' in row &&
        typeof row.allowPlayerCharacterLookOverride === 'boolean'
          ? row.allowPlayerCharacterLookOverride
          : true,
      gm_user_id: row.gmUserId,
      status,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }

  /**
   * Map DTO to View Model
   */
  private mapToViewModel(
    project: ProjectDto,
    members: ProjectMemberDto[],
    sessions: SessionDto[],
  ): ProjectVm {
    const mappedMembers = members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      characterId: member.character_id,
      role: member.role,
      joinedAt: member.joined_at,
      status: member.sta
```

## Konkrete Abnahmekriterien

- [ ] Projekt-GM und aktiver Player können jeweils scheduled-Session anlegen; inactive/foreign member scheitert ohne neue Zeile.
- [ ] Zwei abgeschlossene Sessions mit unterschiedlicher Nummer und Knowledge: höchste Nummer mit vorhandenem shared.knowledge-Schlüssel gewinnt. Eine höhere Session ohne Schlüssel wird übersprungen; ein nichtobjektförmiger gewählter Wert wird weggelassen.
- [ ] Fehlendes oder nicht objektförmiges Adventure/Knowledge erzeugt den definierten leeren Anfangszustand.
- [ ] Parallele Anlage vergibt eindeutige Nummern; Notes/Name trimmen und vollständige Row-Decoder prüfen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [archive/supabase-legacy/supabase/migrations/001_initial.sql](../../../archive/supabase-legacy/supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [archive/supabase-legacy/supabase/migrations/040_session_join_code_security.sql](../../../archive/supabase-legacy/supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [archive/supabase-legacy/supabase/migrations/041_session_runtime_state.sql](../../../archive/supabase-legacy/supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [archive/supabase-legacy/supabase/migrations/046_look_profiles.sql](../../../archive/supabase-legacy/supabase/migrations/046_look_profiles.sql) | `fd88d270538c2e6839540de7a8542e63410463ea1b081a670850134c2979aa2d` |
| [archive/supabase-legacy/supabase/migrations/050_session_adventure_runtime.sql](../../../archive/supabase-legacy/supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql](../../../archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [archive/supabase-legacy/supabase/migrations/053_sessions_look_override.sql](../../../archive/supabase-legacy/supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [archive/supabase-legacy/supabase/migrations/059_saga_state_column_privileges.sql](../../../archive/supabase-legacy/supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [archive/supabase-legacy/supabase/migrations/061_session_recaps_and_handover.sql](../../../archive/supabase-legacy/supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [archive/supabase-legacy/supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../archive/supabase-legacy/supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [archive/supabase-legacy/supabase/migrations/084_look_profiles_public_id.sql](../../../archive/supabase-legacy/supabase/migrations/084_look_profiles_public_id.sql) | `1dcc8707454b4968ae783f102ae45aeb2300ee8ebb5e25e3559c003d5802b396` |
| [archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql](../../../archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts) | `29846df2ae25287b68cba443a9c85f2f9952fa9cc1afd3faf762a78eb57a6fa6` |
