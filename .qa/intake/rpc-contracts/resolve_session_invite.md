# RPC-Vertrag: `resolve_session_invite`

Löst ein Invite-Token auf und liefert die für die Beitrittsoberfläche benötigten IDs und Zustände.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#869](https://github.com/iamthamanic/sagatree/issues/869) — RPC-SESSION-ACCESS; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Erwartete ungültige Token-/Sessionfälle sind JSON {ok:false,error_code}: missing_token, not_found, revoked, expired, session_missing, session_completed, saga_missing.
- Erfolg liefert ok, saga_public_id, session_public_id, project_id, session_id, session_status, already_member, is_project_gm und character_public_id.
- Aktualisiert last_resolved_at des Tokens; führt keine Aufnahme in project_members oder session_players aus.

## Berechtigungen

- Authentifizierung erforderlich; vorbestehende Mitgliedschaft ist für das Auflösen einer Einladung nicht erforderlich.

## SQL-Signatur 1

`public.resolve_session_invite(text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_token | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/055_session_invites.sql](../../../supabase/migrations/055_session_invites.sql) (Zeilen 153–243, SHA-256 `a1fd37ae48b1fdf84ef179902575a579603f0f3df6b9848785795e4a59d13e61`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/resolve_session_invite-1.sql](effective-sql/resolve_session_invite-1.sql); SHA-256 `2f8149c3ae5216fa20055d4fb2127e3bb4cf1e1d15f490f262e8b1558318e4d1`.

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
| 16 | NULLIF(BTRIM(p_token), '') IS NULL | `jsonb_build_object('ok', false, 'error_code', 'missing_token')` |
| 24 | NOT FOUND | `jsonb_build_object('ok', false, 'error_code', 'not_found')` |
| 27 | v_invite.revoked_at IS NOT NULL | `jsonb_build_object('ok', false, 'error_code', 'revoked')` |
| 30 | v_invite.expires_at <= NOW() | `jsonb_build_object('ok', false, 'error_code', 'expired')` |
| 35 | NOT FOUND | `jsonb_build_object('ok', false, 'error_code', 'session_missing')` |
| 38 | v_session.status = 'completed' | `jsonb_build_object('ok', false, 'error_code', 'session_completed')` |
| 45 | v_saga_public_id IS NULL OR BTRIM(v_saga_public_id) = '' | `jsonb_build_object('ok', false, 'error_code', 'saga_missing')` |
| 73 | unbedingt | `jsonb_build_object(     'ok', true,     'saga_public_id', upper(btrim(v_saga_public_id)),     'session_public_id', upper(btrim(v_session.public_id)),     'project_id', v_session.project_id,     'session_id', v_session.id,     'session_status', v_session.status,     'already_member', COALESCE(v_already_member, false),     'is_project_gm', v_is_gm,     'character_public_id', NULLIF(upper(btrim(COALESCE(v_character_public_id, ''))), '')   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `ok`, `error_code`
- `ok`, `saga_public_id`, `session_public_id`, `project_id`, `session_id`, `session_status`, `already_member`, `is_project_gm`, `character_public_id`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Token-Auflösung hat einen last_resolved_at-Write; kein Session-Event und keine Revisionsänderung. Wiederholung aktualisiert den Zeitstempel.

**Direkt referenzierte reale Relationen:** `public.characters`, `public.projects`, `public.session_invites`, `public.session_players`, `public.sessions`.

**Transitive reale Relationen:** `public.characters`, `public.project_members`, `public.projects`, `public.session_invites`, `public.session_players`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.resolve_session_invite(text)` | UPDATE | `public.session_invites` | last_resolved_at | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-service.ts:352

AST-Auflösung: `string-literal`; SHA-256 `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async resolveSessionInvite(token: string): Promise<SessionInviteResolveResult> {
    await this.requireAuthUser();
    const normalized = normalizeInviteToken(token);
    if (!normalized) {
      return { ok: false, errorCode: 'missing_token' };
    }
    const { data, error } = await supabase.rpc('resolve_session_invite', {
      p_token: normalized,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht gelesen werden: ${error.message}`);
    }
    return mapInviteResolvePayload(data);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `SessionInviteErrorCode` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 9 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `SessionInviteResolveOk` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 19 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `SessionInviteResolveFail` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 31 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `SessionInviteResolveResult` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 36 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `normalizeInviteToken` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 64 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `mapInviteResolvePayload` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 70 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Jeden error_code mit isoliertem Token-/Session-Fixture erzeugen; Fehlerobjekt ist kein geworfener RPC-Fehler.
- [ ] Gültiges Token als neuer Nutzer liefert already_member=false und korrekte Public IDs, ohne Mitgliedschaft/Roster anzulegen.
- [ ] Bestehendes Mitglied mit Charakter bekommt die belegten Membership-/Character-Felder und aktualisiertes last_resolved_at.
- [ ] Anonymer Aufruf wird 42501; abgelaufenes oder widerrufenes Token verrät keine Erfolgsdaten.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql) | `74a7f112720d2572bbb8b7d8c32e0f5f5abf932c35268a34b45dc4bfedc2a02a` |
| [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql) | `02874b854874e5d89ad6b697563d545f5d2b72735afe763d6927e574b2ba49ca` |
| [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql) | `c64e0659f2a2006fed326a55f4521a8be21de8dffd44d0b46bd057475b5b9dff` |
| [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql) | `b1e054d6ba6678f1974c82f5a660ab6b01e34a64f9ac0f62f00f10b42f9cfc8c` |
| [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql) | `e34e71c2edb5ec44dd665cbd32927c3d69fa56d2cf0bdf4bf72e5b65bbd08e87` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql) | `22eba40df1a0e9f4033e32a2c74a316ebafbc551d46748edba2b3e260b18778f` |
| [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql) | `faa2b4446d078e83ed00d5894ef297e5fb7322c65481873fc6fa85983fa5ccf8` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/055_session_invites.sql](../../../supabase/migrations/055_session_invites.sql) | `a1fd37ae48b1fdf84ef179902575a579603f0f3df6b9848785795e4a59d13e61` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql) | `bb8d1160118231cb724d0e01fbe5b66ba20dde397b67e052e03d8a1a9f2e6dd0` |
| [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql) | `f66c1286947dd3119ac4cfac01736a3948e1cb35648f61837e6a79fd9c519560` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
