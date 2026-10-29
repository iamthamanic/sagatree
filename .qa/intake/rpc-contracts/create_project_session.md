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

**Wirksame Definition:** [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) (Zeilen 284–350, SHA-256 `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921`).

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
| `public.allocate_next_session_number(uuid)` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.enforce_session_look_profile_binding()` | [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | P0001 | True/True |
| `public.ensure_public_id()` | [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | Keine eigene RAISE | True/True |
| `public.generate_sagatree_public_id(text)` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.generate_unique_session_code()` | [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | P0001 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/project-service.ts:747

AST-Auflösung: `string-literal`; SHA-256 `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async createProjectSession(payload: {
    projectId: string;
    name?: string;
    notes?: string;
  }): Promise<SessionVm> {
    const { data, error } = await supabase.rpc('create_project_session', {
      p_project_id: payload.projectId,
      p_name: payload.name ?? null,
      p_notes: payload.notes ?? null,
    });

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    if (!isSessionDto(data)) {
      throw new Error('Failed to create session: invalid response');
    }

    const normalized = normalizeSessionDto(data);
    return {
      id: normalized.id,
      publicId: typeof normalized.public_id === 'string' ? normalized.public_id : '',
      projectId: normalized.project_id,
      sessionNumber: normalized.session_number,
      name: normalized.name,
      notes: normalized.notes,
      status: normalized.status,
      startedAt: normalized.started_at,
      endedAt: normalized.ended_at,
      durationMinutes: normalized.duration_minutes,
      lookProfileId:
        typeof normalized.look_profile_id === 'string' ? normalized.look_profile_id : null,
      createdAt: normalized.created_at,
    };
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `ProjectSessionStatus` | [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts) | 40 | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| `SessionDto` | [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts) | 48 | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| `SessionVm` | [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts) | 80 | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| `isRecord` | [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts) | 36 | `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257` |
| `isSessionStatus` | [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts) | 118 | `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257` |
| `isSessionDto` | [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts) | 129 | `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257` |
| `normalizeSessionDto` | [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts) | 164 | `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

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
| [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts) | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts) | `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/046_look_profiles.sql](../../../supabase/migrations/046_look_profiles.sql) | `fd88d270538c2e6839540de7a8542e63410463ea1b081a670850134c2979aa2d` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | `1dcc8707454b4968ae783f102ae45aeb2300ee8ebb5e25e3559c003d5802b396` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
