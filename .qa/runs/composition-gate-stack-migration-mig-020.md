# Composition Gate — stack-migration-mig-020 (#795)

- HEAD_SHA: (filled after feature commit)
- BASE_SHA: 721f53e3ba42b94e7292ce2f8bd24e5970828e24
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Authenticated HTTP commands/queries enter via Hono (`server/src/api`), resolve a Better Auth cookie actor, pass Policy Service authorization, then execute a single application transport use-case. Deny paths (401/403/409/422) leave no partial mutation. Idempotent retries return the same committed result without a second revision bump. Role-scoped snapshots omit GM-only fields for players.

## Hop chain

1. Producer: Client → `POST /api/v1/sessions/:id/commands` or `GET …/snapshot` (Hono)
2. Authenticate: `identity.resolveRemoteSession` (cookie; forged solo claims denied)
3. Validate DTO → authorize (`session.gm` / `player.project.read`) → execute (`application/transport`)
4. Consumer A: In-process revision + idempotency map (transport canary; durable SessionRuntimeState is MIG-022)
5. Consumer B: Role-scoped JSON projection back to caller (no second business implementation)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM command advances revision; player command denied; player snapshot without gmNotes | mig-020 self-test | pass |
| Invalid/missing | Unauth 401; invalid payload 422; stale revision 409; no mutation | mig-020 self-test | pass |
| Two consumers / retry | Lost-response retry same idempotency key → same revision/value; conflicting payload → IDEMPOTENCY_CONFLICT | mig-020 self-test | pass |
| Legacy canaries | whoami / health / project-touch still via same Hono mount + Better Auth prefix | mig-014/015/010 self-tests | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Production cutover / Supabase Auth shutdown NOT approved. Durable SessionRuntimeState (MIG-022) and Colyseus product rooms (MIG-021) are out of scope. Ambient CI reds (Atlas E2E, PG baseline security, GATE candidate workflows) stay red — not freigegeben by this ticket.
