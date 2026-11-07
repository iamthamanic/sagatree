# RPC-Vertrag: `revoke_session_invite`

Widerruft ein konkretes Session-Einladungs-Token.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#869](https://github.com/iamthamanic/sagatree/issues/869) — RPC-SESSION-ACCESS; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Leeres Token wird 22023; fehlendes Token/Session P0002. Gefundenes Invite erhält revoked_at=NOW().
- Antwort ist JSON {ok:true,id}; keine Session-/Projektmitgliedschaft wird verändert.

## Berechtigungen

- Authentifizierter Projekt-GM der über das Token gefundenen Session.

## SQL-Signatur 1

`public.revoke_session_invite(text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_token | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/055_session_invites.sql](../../../supabase/migrations/055_session_invites.sql) (Zeilen 108–149, SHA-256 `a1fd37ae48b1fdf84ef179902575a579603f0f3df6b9848785795e4a59d13e61`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/revoke_session_invite-1.sql](effective-sql/revoke_session_invite-1.sql); SHA-256 `b1fb5a736cab509595e074a3ef638a1c30b82c863e94ba8d9effde24e20c8e1e`.

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
| 34 | unbedingt | `jsonb_build_object('ok', true, 'id', v_invite.id)` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `ok`, `id`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |
| 22023 | token required | — | NULLIF(BTRIM(p_token), '') IS NULL |
| P0002 | Invite not found | — | NOT FOUND |
| P0002 | Session not found | — | NOT FOUND |
| 42501 | forbidden | — | NOT public.is_project_gm(v_session.project_id, actor) |

## Transaktion, Idempotenz und Folgewirkungen

- Ein Invite-Update pro Transaktion; Wiederholung setzt den Widerrufszeitpunkt neu.

**Direkt referenzierte reale Relationen:** `public.session_invites`, `public.sessions`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.session_invites`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.revoke_session_invite(text)` | UPDATE | `public.session_invites` | revoked_at | v_invite.revoked_at IS NULL |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `674d30a083283997b85b3f5397276675403bceb5de34832009ee1d1355ffa40a`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * session-service — Host HTTP for play sessions (CUT-20).
 * Location: src/infrastructure/session/session-service.ts
 */
import type {
  SessionVm,
  CreateSessionDto,
  JoinSessionDto,
  PlaySessionStatus,
} from '../../domains/session/contracts/session.types';
import {
  assertPlaySessionStatusTransition,
  normalizePlaySessionStatus,
  normalizeSessionJoinCode,
} from '../../domains/session/contracts/session-lifecycle';
import {
  mapInviteCreatePayload,
  mapInviteResolvePayload,
  normalizeInviteToken,
  type SessionInviteCreateResult,
  type SessionInviteResolveResult,
} from '../../domains/session/contracts/session-invite';
import {
  createHostPlaySession,
  createHostSessionInvite,
  fetchHostSession,
  fetchHostSessions,
  isHostLibraryEnabled,
  joinHostSessionByCode,
  leaveHostPlaySession,
  deleteHostPlaySession,
  resolveHostSessionInvite,
  revokeHostSessionInvite,
  setHostSessionStatus,
  type HostPlaySessionDto,
} from '../host/host-session-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function mapHostPlaySessionToVm(row: HostPlaySessionDto): SessionVm {
  const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
  const code = row.joinCode ?? row.code ?? '';
  return {
    id: row.sessionId,
    code: typeof code === 'string' ? code : '',
    name: row.name ?? '',
    adventureId: row.projectId,
    projectId: row.projectId,
    publicId: row.publicId ?? null,
    gmUserId: row.gmUserId ?? '',
    status: normalizePlaySessionStatus(row.status),
    createdAt,
    updatedAt: createdAt,
    startedAt: row.startedAt ? new Date(row.startedAt) : null,
    endedAt: row.endedAt ? new Date(row.endedAt) : null,
    players: (row.players ?? []).map((p, index) => ({
      id: p.id ?? `${row.sessionId}-${p.userId ?? index}`,
      sessionId: row.sessionId,
      userId: p.userId ?? '',
      characterId: p.characterId ?? null,
      isOnline: p.isOnline === true,
      joinedAt: p.joinedAt ? new Date(p.joinedAt) : createdAt,
    })),
  };
}

class SessionService {
  async createSession(payload: CreateSessionDto): Promise<SessionVm> {
    assertHost();
    const projectId = payload.project_id || payload.adventure_id;
    if (!projectId) {
      throw new Error('project_id ist erforderlich, um eine Session zu erstellen');
    }
    const row = await createHostPlaySession(projectId, payload.name ?? null);
    return mapHostPlaySessionToVm(row);
  }

  async joinSession(payload: JoinSessionDto): Promise<SessionVm> {
    assertHost();
    const code = normalizeSessionJoinCode(payload.code);
    const row = await joinHostSessionByCode(code, payload.character_id ?? null);
    return mapHostPlaySessionToVm(row);
  }

  async getSessionById(id: string): Promise<SessionVm> {
    assertHost();
    const row = await fetchHostSession(id);
    return mapHostPlaySessionToVm(row);
  }

  async getUserSessions(): Promise<SessionVm[]> {
    assertHost();
    const rows = await fetchHostSessions();
    return rows.map(mapHostPlaySessionToVm);
  }

  async updateSessionStatus(id: string, status: PlaySessionStatus): Promise<SessionVm> {
    assertHost();
    const current = await this.getSessionById(id);
    assertPlaySessionStatusTransition(current.status, status);
    const row = await setHostSessionStatus(id, status);
    return mapHostPlaySessionToVm(row);
  }

  async leaveSession(sessionId: string): Promise<void> {
    assertHost();
    await leaveHostPlaySession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    assertHost();
    const id = sessionId.trim();
    if (!id) {
      throw new Error('Session-ID fehlt');
    }
    try {
      await deleteHostPlaySession(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/42501|forbidden|not[_-]?authorized/i.test(message)) {
        throw new Error('Nur de
```

## Konkrete Abnahmekriterien

- [ ] GM widerruft gültiges Token, danach liefert resolve_session_invite revoked.
- [ ] Player und Fremd-GM erhalten 42501 ohne Änderung am Token.
- [ ] Leeres bzw. unbekanntes Token erzeugt 22023/P0002.
- [ ] Wiederholter Widerruf bleibt erfolgreich für dasselbe Invite und erzeugt kein neues Token.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | `674d30a083283997b85b3f5397276675403bceb5de34832009ee1d1355ffa40a` |
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
