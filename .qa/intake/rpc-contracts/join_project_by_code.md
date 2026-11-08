# RPC-Vertrag: `join_project_by_code`

Erzeugt die eigene aktive Player-Mitgliedschaft anhand eines Projektcodes.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#874](https://github.com/iamthamanic/sagatree/issues/874) — RPC-PROJECT-MEMBERSHIP; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Trimmt und normalisiert Join-Code, prüft Projekt und bestehende Mitgliedschaft; legt aktive Player-Zeile an.
- Antwort ist Projekt-UUID, nicht die neue Mitgliedschafts-ID; Fehler ohne ERRCODE fallen auf P0001.

## Berechtigungen

- Authentifizierung; optionaler Charakter muss eigener vollständiger Charakter sein; bestehende Mitgliedschaft wird nicht still ersetzt.

## SQL-Signatur 1

`public.join_project_by_code(text,uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_code | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_character_id | `uuid` | DEFAULT | `NULL` |

**RETURNS:** `uuid`.

**Wirksame Definition:** [archive/supabase-legacy/supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql](../../../archive/supabase-legacy/supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql) (Zeilen 1–82, SHA-256 `fd866217f4b6ebcd23cff6a8b346b0937ba6b3d8a472b440876c914e6154fc28`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/join_project_by_code-1.sql](effective-sql/join_project_by_code-1.sql); SHA-256 `29a3fa4e518109ef238308a78a42b33979d2baa6ef58486bc735185c2e69dc04`.

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
| postgres | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | False |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 69 | unbedingt | `v_project_id` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | v_user_id IS NULL |
| 22023 | Project code is required | — | NULLIF(BTRIM(p_code), '') IS NULL |
| P0002 | Project not found | — | v_project_id IS NULL |
| P0001 | Project membership already exists with status % | v_existing_status | FOUND |
| 42501 | Character is not owned by the current user | — | p_character_id IS NOT NULL ∧ NOT FOUND |
| 22023 | Unvollständige Charakterbögen können keinem Abenteuer beitreten | — | p_character_id IS NOT NULL ∧ COALESCE(v_sheet_status, 'complete') <> 'complete' |

## Transaktion, Idempotenz und Folgewirkungen

- Mitgliedschafts-Insert ist atomar; keine idempotente Wiederbeitrittsantwort.

**Direkt referenzierte reale Relationen:** `public.characters`, `public.project_members`, `public.projects`.

**Transitive reale Relationen:** `public.characters`, `public.project_members`, `public.projects`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.join_project_by_code(text,uuid)` | INSERT | `public.project_members` | project_id, user_id, character_id, role, status | unbedingt |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/project-member-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `e67c3c5c9dd332d15d699a489dce4db743c183a5ce6aab09efc2deb89628236f`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * project-member-service — Host HTTP adapter for project membership (CUT-20).
 * Location: src/infrastructure/project/project-member-service.ts
 */
import type { ProjectMemberDto, JoinProjectDto } from '../../domains/project/contracts/project.types';
import {
  isHostLibraryEnabled,
  joinHostProjectByCode,
  listHostProjectMembers,
  setHostMyProjectCharacter,
} from '../host/host-project-http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${operation} returned an invalid identifier`);
  }
  return value;
}

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

export const projectMemberService = {
  async getMembers(projectId: string): Promise<ProjectMemberDto[]> {
    assertHost();
    const rows = await listHostProjectMembers(projectId);
    return rows.map((row) => ({
      id: row.id,
      project_id: row.projectId,
      user_id: row.userId,
      character_id: row.characterId,
      role: row.role,
      status: row.status === 'active' ? 'active' : 'inactive',
      joined_at: row.joinedAt ?? new Date(0).toISOString(),
    }));
  },

  async joinByCode(dto: JoinProjectDto): Promise<ProjectMemberDto> {
    assertHost();
    const joined = await joinHostProjectByCode(dto.code.toUpperCase(), dto.character_id || null);
    const projectId = requireUuid(joined.projectId, 'join_project_by_code');
    const userId = requireUuid(joined.userId, 'join_project_by_code.userId');
    return {
      id: projectId,
      project_id: projectId,
      user_id: userId,
      role: 'player',
      status: 'active',
      character_id: dto.character_id || null,
      joined_at: new Date().toISOString(),
    } as ProjectMemberDto;
  },

  async updateCharacter(projectId: string, characterId: string): Promise<ProjectMemberDto> {
    assertHost();
    const updated = await setHostMyProjectCharacter(projectId, characterId);
    const memberId = requireUuid(updated.memberId, 'set_my_project_character');
    const userId = requireUuid(updated.userId, 'set_my_project_character.userId');
    return {
      id: memberId,
      project_id: projectId,
      user_id: userId,
      role: 'player',
      status: 'active',
      character_id: characterId,
      joined_at: new Date().toISOString(),
    } as ProjectMemberDto;
  },

  /**
   * Leave saga membership — PARITY_MISSING (#1159): no host route yet; Soft-DENY.
   */
  async leave(projectId: string, _userId: string): Promise<void> {
    void projectId;
    void _userId;
    assertHost();
    throw new Error('Saga-Mitgliedschaft verlassen ist im Host-Modus noch nicht verfügbar.');
  },

  /** Unused in product after CUT-20 — retained for contract stability. */
  async getMyProjects(_userId: string): Promise<ProjectMemberDto[]> {
    void _userId;
    return [];
  },
};

```

## Konkrete Abnahmekriterien

- [ ] Code mit Kleinschreibung/Leerzeichen führt zum erwarteten Projekt und genau einer aktiven Player-Mitgliedschaft.
- [ ] Bestehende aktive/inaktive Mitgliedschaft folgt dem belegten Ablehnungsvertrag statt doppelt einzutreten.
- [ ] Fremder/unvollständiger Charakter und unbekannter Code erzeugen keine Mitgliedschaft.
- [ ] Rückgabe wird als Projekt-ID decodiert; NULL-Charakter erzeugt erlaubten unbelegten Slot.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [archive/supabase-legacy/supabase/migrations/001_initial.sql](../../../archive/supabase-legacy/supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [archive/supabase-legacy/supabase/migrations/002_character_trait_arrays.sql](../../../archive/supabase-legacy/supabase/migrations/002_character_trait_arrays.sql) | `74a7f112720d2572bbb8b7d8c32e0f5f5abf932c35268a34b45dc4bfedc2a02a` |
| [archive/supabase-legacy/supabase/migrations/004_project_membership_security.sql](../../../archive/supabase-legacy/supabase/migrations/004_project_membership_security.sql) | `c1eccbda2dae95cd177ba6313dfd51ef269e0740a13805a5d07a223c6bf489cd` |
| [archive/supabase-legacy/supabase/migrations/005_character_ruleset_metadata.sql](../../../archive/supabase-legacy/supabase/migrations/005_character_ruleset_metadata.sql) | `02874b854874e5d89ad6b697563d545f5d2b72735afe763d6927e574b2ba49ca` |
| [archive/supabase-legacy/supabase/migrations/007_sagadrive_character_profile.sql](../../../archive/supabase-legacy/supabase/migrations/007_sagadrive_character_profile.sql) | `c64e0659f2a2006fed326a55f4521a8be21de8dffd44d0b46bd057475b5b9dff` |
| [archive/supabase-legacy/supabase/migrations/010_characters_v3_columns.sql](../../../archive/supabase-legacy/supabase/migrations/010_characters_v3_columns.sql) | `b1e054d6ba6678f1974c82f5a660ab6b01e34a64f9ac0f62f00f10b42f9cfc8c` |
| [archive/supabase-legacy/supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../archive/supabase-legacy/supabase/migrations/014_character_abilities_emotion_profiles.sql) | `e34e71c2edb5ec44dd665cbd32927c3d69fa56d2cf0bdf4bf72e5b65bbd08e87` |
| [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [archive/supabase-legacy/supabase/migrations/016_character_inventory_v2.sql](../../../archive/supabase-legacy/supabase/migrations/016_character_inventory_v2.sql) | `22eba40df1a0e9f4033e32a2c74a316ebafbc551d46748edba2b3e260b18778f` |
| [archive/supabase-legacy/supabase/migrations/029_character_sheet_status.sql](../../../archive/supabase-legacy/supabase/migrations/029_character_sheet_status.sql) | `faa2b4446d078e83ed00d5894ef297e5fb7322c65481873fc6fa85983fa5ccf8` |
| [archive/supabase-legacy/supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql](../../../archive/supabase-legacy/supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql) | `fd866217f4b6ebcd23cff6a8b346b0937ba6b3d8a472b440876c914e6154fc28` |
| [archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [archive/supabase-legacy/supabase/migrations/050_session_adventure_runtime.sql](../../../archive/supabase-legacy/supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql](../../../archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [archive/supabase-legacy/supabase/migrations/059_saga_state_column_privileges.sql](../../../archive/supabase-legacy/supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [archive/supabase-legacy/supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../archive/supabase-legacy/supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [archive/supabase-legacy/supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../archive/supabase-legacy/supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [archive/supabase-legacy/supabase/migrations/079_drop_sagadrive_aliases.sql](../../../archive/supabase-legacy/supabase/migrations/079_drop_sagadrive_aliases.sql) | `bb8d1160118231cb724d0e01fbe5b66ba20dde397b67e052e03d8a1a9f2e6dd0` |
| [archive/supabase-legacy/supabase/migrations/089_gm_presence_character_type.sql](../../../archive/supabase-legacy/supabase/migrations/089_gm_presence_character_type.sql) | `f66c1286947dd3119ac4cfac01736a3948e1cb35648f61837e6a79fd9c519560` |
| [archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql](../../../archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts) | `e67c3c5c9dd332d15d699a489dce4db743c183a5ce6aab09efc2deb89628236f` |
