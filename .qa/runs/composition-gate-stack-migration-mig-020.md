# Composition Gate — stack-migration-mig-020 (#795)

- HEAD_SHA: c7646309a7510fe3c33ba158fecf9376431a9270
- BASE_SHA: 7aa71f2b273fba2caf5871f4d9acf3bc5da8c2e6
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Authenticated HTTP commands/queries enter via Hono (`server/src/api`), resolve a Better Auth cookie actor, pass Policy Service authorization, then execute a single application transport use-case. Deny paths (401/403/409/422) leave no partial mutation. Idempotent retries use a **session-scoped** key with stored actor binding (GM handover cannot re-execute). `expectedRevision` is replay metadata only. Snapshot reads never invent session→project associations from client IDs.

## Hop chain

1. Producer: Client → `POST /api/v1/sessions/:id/commands` or `GET …/snapshot` (Hono)
2. Authenticate: `identity.resolveRemoteSession` (cookie; forged solo claims denied)
3. Validate DTO → authorize (`session.gm` / `player.project.read`) → execute (`application/transport`)
4. Consumer A: In-process revision + session-scoped idempotency map (actor-bound stored result)
5. Consumer B: Role-scoped JSON projection; snapshot lookup is read-only against server-owned session records

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM command advances; player denied; player snapshot without gmNotes; second GM same key → IDEMPOTENCY_CONFLICT | mig-020 self-test | pass |
| Invalid/missing | Unauth 401; invalid 422; stale 409; unknown session snapshot FORBIDDEN (no create); cross-project snap SESSION_MISMATCH | mig-020 self-test | pass |
| Two consumers / crash | Lost-response retry + refreshed expectedRevision → same revision; conflicting payload → IDEMPOTENCY_CONFLICT | mig-020 self-test | pass |
| Legacy canaries | whoami / health still via same Hono mount + Better Auth prefix | mig-014/015/010 self-tests | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Production cutover / Supabase Auth shutdown NOT approved. Durable SessionRuntimeState (MIG-022) and Colyseus product rooms (MIG-021) are out of scope. Ambient CI reds (Atlas E2E, PG baseline security, GATE candidate workflows) stay red — not freigegeben by this ticket. Rebase onto MIG-014/015 hardening (#913) required before merge.
