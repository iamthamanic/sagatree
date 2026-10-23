# SagaTree host (`server/`)

Registered top-level host package for the Epic #773 modular monolith.

- Binding contract: [`docs/architecture/host-modular-monolith.md`](../docs/architecture/host-modular-monolith.md)
- First enforcement ticket: MIG-010 / #789
- GATE-01: APPROVED — Drizzle + SagaTree Policy Service ([ADR-ST-05](../docs/architecture/ADR-ST-05-gate-01-drizzle-policy.md)); ORM choice does not replace module boundaries
- GATE-04: APPROVED implementation freigabe — SQLite single-writer ([ADR-ST-08](../docs/architecture/ADR-ST-08-gate-04-sqlite-single-writer.md))
- GATE-02: APPROVED Variant A — Better Auth cookie-only ([ADR-ST-06](../docs/architecture/ADR-ST-06-gate-02-auth-handshake.md)); product cutover NOT approved
- GATE-03: APPROVED Hono+Colyseus design ([ADR-ST-07](../docs/architecture/ADR-ST-07-gate-03-hono-colyseus.md)); HTTP transport landed in MIG-020; full Colyseus room surface is MIG-021+

## Layout (MIG-010 + MIG-011 + MIG-014 + MIG-020)

| Path | Role |
| --- | --- |
| `src/bootstrap/` | Composition root (`create-host.ts`, `main.ts`) |
| `src/config/` | Loopback-first config + writable `SAGATREE_DATA_DIR` |
| `src/persistence/` | SQLite open + atomic migration journal + integrity gate (composition only) |
| `migrations/` | Ordered host schema catalog (`0001_host_bootstrap.sql`, …) |
| `src/modules/<id>/` | Public module APIs (`identity`, `permissions`, `ops`, `world`, `project`) |
| `src/modules/<id>/persistence/` | Private table ownership mirrors (no cross-module imports) |
| `src/repositories/world/` | SQLite world read adapter (composition-wired; implements world store port) |
| `src/application/<use-case>/` | Vertical use-cases (`health`, `transport`) |
| `src/api/` | Hono typed HTTP command/query surface (MIG-020) |
| `src/http/route-registry.ts` | Sole HTTP composition entry — mounts Better Auth + Hono (not a free-for-all under `http/**`) |
| `src/auth/` | Better Auth cookie profile (no JWT plugin); session resolve for HTTP + `/v1/session-ws` |
| `src/auth/solo/` | Persistent solo/loopback identity; forged local-identity deny; explicit account-link (MIG-015) |

## Run

```bash
cd server
SAGATREE_DATA_DIR=/tmp/sagatree-data npm start
# health: GET http://127.0.0.1:8787/health
npm run self-test
```

Default bind is loopback only. Remote bind requires `SAGATREE_ALLOW_REMOTE_BIND=1`.

### Better Auth cookie profile (MIG-014)

Remote-reachable mode (`SAGATREE_HOST_MODE=remote` or non-loopback with `SAGATREE_ALLOW_REMOTE_BIND=1`) **requires** `SAGATREE_BETTER_AUTH_SECRET` (≥32 chars) — fail closed otherwise.

| Env | Role |
| --- | --- |
| `SAGATREE_BETTER_AUTH_SECRET` | Session signing secret (required for auth / remote) |
| `SAGATREE_AUTH_BASE_URL` | Public origin (default `http://<host>:<port>`) |
| `SAGATREE_AUTH_TRUSTED_ORIGINS` | Comma-separated trusted origins (default = base URL) |
| `SAGATREE_AUTH_COOKIE_SECURE` | Force `Secure` cookies (`1`); auto-on for `https://` base URL |
| `SAGATREE_ENABLE_HOST_AUTH` | Enable cookie auth on loopback without remote mode |
| `SAGATREE_AUTH_ALLOW_JWT` / `SAGATREE_AUTH_ENABLE_JWT` | **Forbidden** — host refuses to start |

Cookie profile: HttpOnly + SameSite=Lax; `/api/auth/token` → 404 `JWT_ISSUANCE_DISABLED`; `Authorization: Bearer` rejected. Auth DB: `dataDir/auth.sqlite`.

### Solo local identity (MIG-015)

- Durable `dataDir/host-identity.json` (`solo-<uuid>`) — stable across restarts; never echoed in errors
- `SAGATREE_HOST_MODE=solo` + non-loopback bind → fail closed `SOLO_REQUIRES_LOOPBACK` (GATE-02 common-7)
- Forged `x-solo-user` / `localIdentity` claims → `SOLO_IDENTITY_FORBIDDEN` on remote HTTP/WS (no remote GM mint)
- Solo→remote ownership reuse requires `POST /api/solo/link-account` with `confirm: true` matching this host’s solo id; missing link → `ACCOUNT_LINK_REQUIRED`

### HTTP transport (MIG-020 / Hono)

Typed command/query routes under `/api/v1/sessions/:sessionId/*` (pipeline: validate → authorize → execute):

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/sessions/:id/snapshot?projectId=` | Role-scoped projection (`gmNotes` GM-only) |
| `POST` | `/api/v1/sessions/:id/commands` | Body: `projectId`, `expectedRevision`, `idempotencyKey`, optional `note` |

Structured errors: `401` unauthenticated, `403` policy deny, `409` stale revision / idempotency conflict, `422` validation. Idempotent retries return the same application result without a second mutation. Full durable SessionRuntimeState is MIG-022; Colyseus rooms are MIG-021+.

## Persistence (MIG-011)

- Driver: Node `node:sqlite` with GATE-04 PRAGMAs (`WAL`, `synchronous=FULL`, `busy_timeout=250`, `foreign_keys=ON`)
- Upgrade exclusivity: SQLite `BEGIN IMMEDIATE` per migration step; `schema_version` re-read inside the transaction (no PID/file lock authority)
- Legacy `schema-upgrade.lock`: **fail-closed** if present (may mean an old host is mid-upgrade). Never auto-deleted. Clear only via `clearLegacySchemaUpgradeLockAfterVerifiedStandstill({ oldHostVerifiedStopped: true })` after the old host is confirmed stopped
- Journal: `schema_migrations` (owned by `ops`); failed steps recorded in `migration-failure.json` beside the DB
- Bootstrap catalog tables: `worlds` (`world`), `projects` + `project_members` (`project`)
- World read port (MIG-012): policy-guarded `world.read` + SQLite store via `repositories/world` (Drizzle encapsulation remains follow-on); Policy Service is MIG-013

## Non-claims

GATE-05 and production cutover / Supabase Auth shutdown are **not** approved. GATE-04 capacity remains **NOT RUN** (MIG-700/#849). HTTPS Secure-cookie platform proofs and full Colyseus product rooms remain later tickets.
