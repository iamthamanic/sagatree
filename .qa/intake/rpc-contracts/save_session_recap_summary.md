# RPC-Vertrag: `save_session_recap_summary`

Speichert Summary und Freigabestatus eines Recaps; zwei effektive SQL-Overloads bleiben erhalten.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#870](https://github.com/iamthamanic/sagatree/issues/870) — RPC-SESSION-RECAP; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Zweiargumentiger Wrapper ruft den dreiargumentigen Hauptvertrag mit draft auf. Hauptvertrag hat p_status DEFAULT draft; beide existieren nach Migration062.
- Status wird auf draft/approved/none normalisiert und validiert. UPSERT verändert bei vorhandener Zeile Summary/Status/updated_at und bewahrt Highlight/Snapshot; neue Zeile beginnt mit leeren Highlight/Snapshot.
- Rückgabe erfolgt über get_session_recap und ist deshalb die erlaubte GM-Projektion.

## Berechtigungen

- Authentifizierter Projekt-GM der Session; kein Schreibrecht durch bloße Teilnahme.

## SQL-Signatur 1

`public.save_session_recap_summary(uuid,text,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_summary_text | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_status | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) (Zeilen 279–326, SHA-256 `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/save_session_recap_summary-1.sql](effective-sql/save_session_recap_summary-1.sql); SHA-256 `78aa2e120df0e7ea548da637210560ee04c49a1b41f06fdd235b4c6255ba638e`.

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
| 35 | unbedingt | `public.get_session_recap(p_session_id)` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 22023 | invalid summary status | — | v_status NOT IN ('draft', 'approved', 'none') |
| P0002 | Session not found | — | NOT FOUND |
| 42501 | forbidden | — | NOT public.is_project_gm(v_session.project_id, v_user) |

## SQL-Signatur 2

`public.save_session_recap_summary(uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_summary_text | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) (Zeilen 326–340, SHA-256 `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/save_session_recap_summary-2.sql](effective-sql/save_session_recap_summary-2.sql); SHA-256 `9f32efdc341c62f5fbd16922d48bdd8ebc78ac535e41fc3cebb493f0b7942c52`.

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
| 3 | unbedingt | `public.save_session_recap_summary(p_session_id, p_summary_text, 'draft')` |

### Explizite SQL-Fehler dieses Overloads

Keine eigene RAISE-EXCEPTION-Anweisung. Fehler können aus delegierten Funktionen, Typkonvertierung oder Datenbank-Constraints stammen.

## Transaktion, Idempotenz und Folgewirkungen

- UPSERT und anschließende Projektion sind eine Transaktion; gleiche Inhalte aktualisieren updated_at. Kein Request-Key.

**Direkt referenzierte reale Relationen:** `public.session_recaps`, `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_players`, `public.session_recaps`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.save_session_recap_summary(uuid,text,text)` | INSERT | `public.session_recaps` | session_id, summary_text, summary_status, highlight_lines, snapshot | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.get_session_recap(uuid)` | [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql) | 42501, P0002 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.is_session_participant(uuid,uuid)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_build_recap_highlight_lines(jsonb,boolean)` | [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-recap-ai-service.ts:126

AST-Auflösung: `string-literal`; SHA-256 `2c21ba1645d48214ea277cd15537bc93b4752737510e556e40bca11f80243c3e`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async saveSummary(
    sessionId: string,
    summaryText: string,
    status: 'draft' | 'approved',
  ): Promise<{ summaryText: string | null; summaryStatus: EpisodeSummaryStatus }> {
    if (isHostLibraryEnabled()) {
      const saved = await saveHostSessionRecapSummary(sessionId, summaryText, status);
      return {
        summaryText:
          typeof saved.summaryText === 'string' ? saved.summaryText : summaryText,
        summaryStatus:
          saved.summaryStatus === 'approved'
            ? 'approved'
            : saved.summaryStatus === 'draft'
              ? 'draft'
              : status,
      };
    }
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('save_session_recap_summary', {
        p_session_id: sessionId,
        p_summary_text: summaryText,
        p_status: status,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Speichern Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Zusammenfassung konnte nicht gespeichert werden');
    }
    if (!isRecord(data)) {
      return { summaryText, summaryStatus: status };
    }
    return {
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : summaryText,
      summaryStatus:
        data.summaryStatus === 'approved'
          ? 'approved'
          : data.summaryStatus === 'draft'
            ? 'draft'
            : 'none',
    };
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `EnvLike` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 11 | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `defaultEnv` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 16 | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `isHostLibraryExplicitlyDisabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 25 | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `EnvLike` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 12 | `1d0e576d58da7285a08cbad7ee864fabb7033d9d822841240dda6c11935a4818` |
| `defaultEnv` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 17 | `1d0e576d58da7285a08cbad7ee864fabb7033d9d822841240dda6c11935a4818` |
| `hostMutateJson` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 58 | `1d0e576d58da7285a08cbad7ee864fabb7033d9d822841240dda6c11935a4818` |
| `saveHostSessionRecapSummary` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 368 | `1d0e576d58da7285a08cbad7ee864fabb7033d9d822841240dda6c11935a4818` |
| `EpisodeSummaryStatus` | [src/infrastructure/session/session-recap-ai-service.ts](../../../src/infrastructure/session/session-recap-ai-service.ts) | 12 | `2c21ba1645d48214ea277cd15537bc93b4752737510e556e40bca11f80243c3e` |
| `isRecord` | [src/infrastructure/session/session-recap-ai-service.ts](../../../src/infrastructure/session/session-recap-ai-service.ts) | 32 | `2c21ba1645d48214ea277cd15537bc93b4752737510e556e40bca11f80243c3e` |
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

- [ ] Dreiargumentiger Aufruf mit draft/approved/none speichert die genaue Summary und schützt vorhandene Highlights/Snapshot.
- [ ] Player/Fremd-GM und ungültiger Status scheitern ohne Recap-Änderung.
- [ ] PostgreSQL-Auflösung des Zweiparameteraufrufs gegen beide Overloads prüfen; sicheren eindeutigen Nachfolgeraufruf festlegen.
- [ ] Nach approved kann ein Player die Summary lesen; Rückwechsel auf draft entfernt sie aus der Player-Projektion.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### Medium — RPC-OVERLOAD-RECAP-AMBIGUITY

Der zweiparametrige Aufruf save_session_recap_summary(uuid, text) ist durch Zweierwrapper plus Dreierfunktion mit Default mehrdeutig (SQLSTATE 42725). get_session_recap(uuid) besitzt dagegen nur einen wirksamen Overload und ist von diesem Befund nicht betroffen.

**Beleg:** supabase/migrations/061_session_recaps_and_handover.sql und 062_session_recap_ai_summary.sql; BASELINE-RPC-RECAP-OVERLOAD reproduziert für public.save_session_recap_summary(uuid, text) den Fehler function is not unique / ambiguous_function.

**Erforderliche Nachfolger-Abnahme:** Nachfolger besitzt eine eindeutig auflösbare Signatur. Der vorhandene Client sendet drei benannteParameter inklusivep_status; diesen Pfad erhalten und Zweierpfad bewusst beseitigen/kompatibel behandeln.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-RPC-RECAP-OVERLOAD`. Eigene RPC-Reproduktion: True.

## Entfernte historische Signaturen

| Entfernte Signatur | Grund | Quelle |
| --- | --- | --- |
| `public.save_session_recap_summary(uuid,text)` | explicit DROP FUNCTION | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) (Zeilen 273–278, SHA-256 `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b`) |
| `public.save_session_recap_summary(uuid,text,text)` | explicit DROP FUNCTION | [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) (Zeilen 278–279, SHA-256 `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b`) |

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | `1d0e576d58da7285a08cbad7ee864fabb7033d9d822841240dda6c11935a4818` |
| [src/infrastructure/session/session-recap-ai-service.ts](../../../src/infrastructure/session/session-recap-ai-service.ts) | `2c21ba1645d48214ea277cd15537bc93b4752737510e556e40bca11f80243c3e` |
| [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql) | `d02f115b12a959b1186539c310726de5791314380cc010ca337014f3045d079a` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/085_fix_function_bodies_sagatree.sql](../../../supabase/migrations/085_fix_function_bodies_sagatree.sql) | `36d9065b9abba7236230995842dfcd48487a428240a5d85426faf4515d1bcaa3` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
