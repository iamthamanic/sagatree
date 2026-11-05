# RPC-Vertrag: `create_session_invite`

Rotiert als Session-GM das Einladungs-Token mit sieben Tagen Gültigkeit.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#869](https://github.com/iamthamanic/sagatree/issues/869) — RPC-SESSION-ACCESS; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Sperrt Session, widerruft alle noch nicht widerrufenen vorhandenen Einladungen, erzeugt neues Token und expires_at=NOW()+7 days.
- JSON-Antwort nutzt snake_case für session_id und expires_at sowie id und token; der Client mappt diese Felder.

## Berechtigungen

- Authentifizierter Projekt-GM der Session; Session muss existieren und darf nicht completed sein.

## SQL-Signatur 1

`public.create_session_invite(uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_session_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/055_session_invites.sql](../../../supabase/migrations/055_session_invites.sql) (Zeilen 52–104, SHA-256 `a1fd37ae48b1fdf84ef179902575a579603f0f3df6b9848785795e4a59d13e61`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/create_session_invite-1.sql](effective-sql/create_session_invite-1.sql); SHA-256 `4ec6008871addc8a98e487d8fac6b70f59fe4a7f56571e50fab09c330d8a29c1`.

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
| 40 | unbedingt | `jsonb_build_object(     'id', v_id,     'token', v_token,     'session_id', v_session.id,     'expires_at', v_expires   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `id`, `token`, `session_id`, `expires_at`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |
| 22023 | session_id required | — | p_session_id IS NULL |
| P0002 | Session not found | — | NOT FOUND |
| 22023 | Session is completed | — | v_session.status = 'completed' |
| 42501 | forbidden | — | NOT public.is_project_gm(v_session.project_id, actor) |

## Transaktion, Idempotenz und Folgewirkungen

- Widerruf und Neuanlage sind atomar; jeder erfolgreiche Aufruf rotiert, keine Idempotenz.

**Direkt referenzierte reale Relationen:** `public.session_invites`, `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_invites`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.create_session_invite(uuid)` | UPDATE | `public.session_invites` | revoked_at | unbedingt |
| `public.create_session_invite(uuid)` | INSERT | `public.session_invites` | session_id, token, created_by, expires_at | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.generate_session_invite_token()` | [supabase/migrations/055_session_invites.sql](../../../supabase/migrations/055_session_invites.sql) | P0001 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-service.ts:413

AST-Auflösung: `string-literal`; SHA-256 `13cae162249e329b2e55dccf63ea63c63fecda761a922f21f8aa3dcdca01d296`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async createSessionInvite(sessionId: string): Promise<SessionInviteCreateResult> {
    if (isHostLibraryEnabled()) {
      const invite = await createHostSessionInvite(sessionId);
      const mapped = mapInviteCreatePayload(invite);
      if (!mapped) {
        throw new Error('Einladung konnte nicht erstellt werden: ungültige Server-Antwort');
      }
      return mapped;
    }
    await this.requireAuthUser();
    const { data, error } = await supabase.rpc('create_session_invite', {
      p_session_id: sessionId,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht erstellt werden: ${error.message}`);
    }
    const mapped = mapInviteCreatePayload(data);
    if (!mapped) {
      throw new Error('Einladung konnte nicht erstellt werden: ungültige Server-Antwort');
    }
    return mapped;
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `SessionInviteCreateResult` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 38 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `mapInviteCreatePayload` | [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | 110 | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `EnvLike` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 11 | `73aff05d4133b8501c130d41f8e4430f09cfe24f7c6e7b115b653c8f96903a84` |
| `defaultEnv` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 16 | `73aff05d4133b8501c130d41f8e4430f09cfe24f7c6e7b115b653c8f96903a84` |
| `isHostLibraryExplicitlyDisabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 25 | `73aff05d4133b8501c130d41f8e4430f09cfe24f7c6e7b115b653c8f96903a84` |
| `EnvLike` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 12 | `b4ce6f60d82bbf2ca14d7732e278d85422ede333c3841e06205b8afb2cf8d719` |
| `defaultEnv` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 17 | `b4ce6f60d82bbf2ca14d7732e278d85422ede333c3841e06205b8afb2cf8d719` |
| `hostMutateJson` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 58 | `b4ce6f60d82bbf2ca14d7732e278d85422ede333c3841e06205b8afb2cf8d719` |
| `createHostSessionInvite` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 284 | `b4ce6f60d82bbf2ca14d7732e278d85422ede333c3841e06205b8afb2cf8d719` |
| `EnvLike` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 31 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `defaultEnv` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 33 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `getHostAuthBaseUrl` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 53 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 13 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 15 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 16 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostAuthUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 17 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostFirst` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 18 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 58 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 59 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 61 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

## Konkrete Abnahmekriterien

- [ ] Erstanlage liefert Token/id/session_id und Ablauf nach sieben Tagen; Client-Decoder akzeptiert exakt diese Schlüsselnamen.
- [ ] Rotation widerruft alle vorher aktiven Tokens und lässt genau das neue gültig.
- [ ] Player, Fremd-GM und abgeschlossene Session scheitern mit 42501 bzw. 22023 ohne vorherige Tokens zu widerrufen.
- [ ] Parallele Rotation wird am Session-Lock serialisiert; nur zuletzt erzeugtes Token bleibt aktiv.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-invite.ts](../../../src/domains/session/contracts/session-invite.ts) | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | `73aff05d4133b8501c130d41f8e4430f09cfe24f7c6e7b115b653c8f96903a84` |
| [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | `b4ce6f60d82bbf2ca14d7732e278d85422ede333c3841e06205b8afb2cf8d719` |
| [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | `13cae162249e329b2e55dccf63ea63c63fecda761a922f21f8aa3dcdca01d296` |
| [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/055_session_invites.sql](../../../supabase/migrations/055_session_invites.sql) | `a1fd37ae48b1fdf84ef179902575a579603f0f3df6b9848785795e4a59d13e61` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
