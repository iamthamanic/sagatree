# RPC-Vertrag: `get_session_recap`

Liest den Recap und projiziert Zusammenfassung und Highlights nach Session-Rolle.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#870](https://github.com/iamthamanic/sagatree/issues/870) — RPC-SESSION-RECAP; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Fehlender Recap liefert JSON NULL; fehlende Session P0002 nach den vorgeschalteten Auth-Prüfungen.
- GM sieht vorhandenen Summary-Text; Player erhält Summary nur bei summary_status=approved. Highlights werden aus snapshot über sagatree_build_recap_highlight_lines rollenabhängig projiziert.
- Antwort enthält sessionId, summaryText, summaryStatus, highlightLines, createdAt und updatedAt; Vollsnapshot wird nicht direkt ausgegeben.

## Berechtigungen

- Authentifizierung und is_session_participant; GM-Projektion wird separat geprüft.

## SQL-Signatur 1

`public.get_session_recap(uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql) (Zeilen 75–131, SHA-256 `d02f115b12a959b1186539c310726de5791314380cc010ca337014f3045d079a`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/get_session_recap-1.sql](effective-sql/get_session_recap-1.sql); SHA-256 `d33e6ece5a7d11bf75b7b0d63d663c5d9a52b3e6010c73b4c1365e179090437b`.

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
| 29 | NOT FOUND | `NULL` |
| 41 | unbedingt | `jsonb_build_object(     'sessionId', v_recap.session_id,     'summaryText', v_summary,     'summaryStatus', v_status,     'highlightLines', v_lines,     'createdAt', v_recap.created_at,     'updatedAt', v_recap.updated_at   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `sessionId`, `summaryText`, `summaryStatus`, `highlightLines`, `createdAt`, `updatedAt`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| P0002 | Session not found | — | NOT FOUND |
| 42501 | forbidden | — | NOT public.is_session_participant(p_session_id, v_user) |

## Transaktion, Idempotenz und Folgewirkungen

- Leseoperation ohne Mutation; Summary-Freigabe ist Bestandteil der Projektion.

**Direkt referenzierte reale Relationen:** `public.session_recaps`, `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_players`, `public.session_recaps`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.is_session_participant(uuid,uuid)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_build_recap_highlight_lines(jsonb,boolean)` | [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-recap-service.ts:29

AST-Auflösung: `string-literal`; SHA-256 `30c4a639e8e6daf815eb1cb137744c0513fcb3ed20cbb58f2c0781b928bcb7f9`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async getBySessionId(sessionId: string): Promise<SessionRecapDto | null> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_session_recap', { p_session_id: sessionId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Recap Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Recap konnte nicht geladen werden');
    }
    if (data == null) return null;
    if (!isRecord(data)) {
      throw new Error('Ungültige Recap-Antwort');
    }
    const statusRaw = typeof data.summaryStatus === 'string' ? data.summaryStatus : 'none';
    const summaryStatus =
      statusRaw === 'approved' || statusRaw === 'draft' ? statusRaw : 'none';
    return {
      sessionId: typeof data.sessionId === 'string' ? data.sessionId : sessionId,
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : null,
      summaryStatus,
      highlights: parsePersistedRecapHighlightLines(data.highlightLines),
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `RecapHighlightLine` | [src/domains/session/contracts/session-prepare-recap.ts](../../../src/domains/session/contracts/session-prepare-recap.ts) | 31 | `14a939d627bc1b7393a8e32c1a9bf9f2b74aab0058416bd6e73a9a59cbcc7c7f` |
| `RecapConsequenceInput` | [src/domains/session/contracts/session-prepare-recap.ts](../../../src/domains/session/contracts/session-prepare-recap.ts) | 107 | `14a939d627bc1b7393a8e32c1a9bf9f2b74aab0058416bd6e73a9a59cbcc7c7f` |
| `buildRecapHighlightLines` | [src/domains/session/contracts/session-prepare-recap.ts](../../../src/domains/session/contracts/session-prepare-recap.ts) | 119 | `14a939d627bc1b7393a8e32c1a9bf9f2b74aab0058416bd6e73a9a59cbcc7c7f` |
| `parsePersistedRecapHighlightLines` | [src/domains/session/contracts/session-prepare-recap.ts](../../../src/domains/session/contracts/session-prepare-recap.ts) | 170 | `14a939d627bc1b7393a8e32c1a9bf9f2b74aab0058416bd6e73a9a59cbcc7c7f` |
| `SessionRecapDto` | [src/infrastructure/session/session-recap-service.ts](../../../src/infrastructure/session/session-recap-service.ts) | 12 | `30c4a639e8e6daf815eb1cb137744c0513fcb3ed20cbb58f2c0781b928bcb7f9` |
| `isRecord` | [src/infrastructure/session/session-recap-service.ts](../../../src/infrastructure/session/session-recap-service.ts) | 22 | `30c4a639e8e6daf815eb1cb137744c0513fcb3ed20cbb58f2c0781b928bcb7f9` |
| `SUPABASE_QUERY_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 8 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutReject` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 36 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Für dieselbe Session draft/approved/none gegen GM und Player prüfen: nur approved wird Playern angezeigt.
- [ ] GM-only Konsequenz erscheint nicht in Player-Highlights; leere/fehlende Snapshot-Struktur verhält sich definiert.
- [ ] Fehlender Recap liefert NULL statt künstlicher Summary; Client bildet diesen Fall ab.
- [ ] Anonymer oder fremder Teilnehmer erhält 42501 und verändert keine Recap-Zeile.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-prepare-recap.ts](../../../src/domains/session/contracts/session-prepare-recap.ts) | `14a939d627bc1b7393a8e32c1a9bf9f2b74aab0058416bd6e73a9a59cbcc7c7f` |
| [src/infrastructure/session/session-recap-service.ts](../../../src/infrastructure/session/session-recap-service.ts) | `30c4a639e8e6daf815eb1cb137744c0513fcb3ed20cbb58f2c0781b928bcb7f9` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
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
