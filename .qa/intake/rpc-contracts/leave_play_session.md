# RPC-Vertrag: `leave_play_session`

Entfernt die eigene Roster-Zeile; die bestehende Implementierung hat einen Fremdnutzer-Autorisierungsfehler.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#869](https://github.com/iamthamanic/sagatree/issues/869) — RPC-SESSION-ACCESS; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Bei existierender Session wird die eigene Roster-Zeile gelöscht, runtime_revision erhöht und ein leave-Event angelegt.
- Bei fehlender Session bleibt nur das Löschen einer eigenen Roster-Zeile als No-op; Rückgabe ist void.
- Sicherer Nachfolger muss den dokumentierten Fremdnutzer-Pfad ablehnen, auch wenn die unsichere Baseline ihn zulässt.

## Berechtigungen

- Legacy prüft nur auth.uid() und verlangt keine Session-/Projektmitgliedschaft vor Session-Lock, Revision und Event.

## SQL-Signatur 1

`public.leave_play_session(uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `void`.

**Wirksame Definition:** [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) (Zeilen 52–101, SHA-256 `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/leave_play_session-1.sql](effective-sql/leave_play_session-1.sql); SHA-256 `63a612d00dcb4c9772501293f253ef00459717ab542e4e4f4317434ea61af239`.

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
| 15 | NOT FOUND | `RETURN datum/void` |
| 24 | v_removed = 0 | `RETURN datum/void` |
| 7 | unbedingt | `RETURN datum/void` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Session-Lock und Roster/Revision/Event sind atomar. Wiederholte Legacy-Austritte erzeugen weitere Events/Revisionen; dieser Effekt ist kein Recht auf Fremdzugriff.

**Direkt referenzierte reale Relationen:** `public.session_players`, `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_events`, `public.session_players`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | INSERT | `public.session_events` | session_id, kind, actor_user_id, payload, revision_after, idempotency_key | unbedingt |
| `public.leave_play_session(uuid)` | DELETE | `public.session_players` | — | NOT FOUND |
| `public.leave_play_session(uuid)` | DELETE | `public.session_players` | — | unbedingt |
| `public.leave_play_session(uuid)` | UPDATE | `public.sessions` | runtime_revision, updated_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.leave_play_session(uuid)` | `public.sessions` / `update_sessions_updated_at` | `public.update_updated_at_column()` |
| `public.leave_play_session(uuid)` | `public.sessions` / `trg_sessions_forbid_public_id_change` | `public.forbid_public_id_change()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | 42501 | True/True |
| `public.forbid_public_id_change()` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.is_session_participant(uuid,uuid)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.update_updated_at_column()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-service.ts:295

AST-Auflösung: `string-literal`; SHA-256 `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async leaveSession(sessionId: string): Promise<void> {
    await this.requireAuthUser();

    const { error } = await supabase.rpc('leave_play_session', {
      p_session_id: sessionId,
    });

    if (error) {
      throw new Error(`Failed to leave session: ${error.message}`);
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

- [ ] Eigener Teilnehmer verlässt die Session: eigene Roster-Zeile weg, andere Teilnehmer unverändert, genau ein leave-Event/Revision.
- [ ] Fremder authentifizierter Akteur mit bekannter Session-ID darf im Nachfolger weder Event noch runtime_revision verändern; vorab 42501 oder ein explizit freigegebener No-op-Vertrag.
- [ ] Anonymer Aufruf scheitert 42501; fehlende Session bleibt ohne Seiteneffekt.
- [ ] Fehler beim Event-Schreiben rollt die Roster-Löschung und Revisionsänderung zurück.
- [ ] Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### High — RPC-SEC-LEAVE-FOREIGN

Authentifizierter Fremdnutzer kann bei bekannter Session-UUID Revision erhöhen und leave-Event einfügen.

**Beleg:** supabase/migrations/041_session_runtime_state.sql: leave_play_session prüft keine Teilnahme; append_session_event ist SECURITY DEFINER ohne eigene Akteurprüfung.

**Erforderliche Nachfolger-Abnahme:** Nachfolger blockiert den Fremdnutzer vor jeglichem Event-/Revision-Write; isolierter Negativtest und getrennte Sicherheitsfreigabe erforderlich.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-FOREIGN-LEAVE`. Eigene RPC-Reproduktion: True.

### Critical — RPC-SEC-ANON-EVENT-HELPER

Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.

**Beleg:** supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.

**Erforderliche Nachfolger-Abnahme:** Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-EVENT-HELPER-ANON`. Eigene RPC-Reproduktion: True.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql) | `98fd05e6d1ae794db77b46eb910fadacffdc760246cda412404c1246eaf0110e` |
| [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | `d2cc67aea9ea3751ca52d09392c0777529019e4700b80a63fdbbd4dc4fcec8b7` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
