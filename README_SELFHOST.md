# SagaTree Self-Host (host-only)

**Product runtime:** React/Vite frontend → Node/Hono host → SQLite + Better Auth + local assets.  
Optional AI / LiveKit / Meshy are external providers — not mediated by Supabase.

Legacy Supabase/Edge/Postgres Compose is archived under `archive/supabase-legacy/` and is **not** the product path (CUT-22 / #1157).

## Features

- Node host (`server/`) — Better Auth cookie sessions, Policy Service, SQLite
- Local asset store under `SAGATREE_DATA_DIR`
- Host realtime (SSE / session rooms); Colyseus where already wired
- Optional Ollama / BYOK AI and LiveKit media via env — core stays up without them

## Architecture

```
┌──────────────────────────────────────────────┐
│  Frontend (React + Vite + TypeScript)        │
└─────────────────────┬────────────────────────┘
                      │ cookie / JSON
              ┌───────▼────────┐
              │  SagaTree Host │  :8787
              │  Hono + Better │
              │  Auth + SQLite │
              └───────┬────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   SQLite+WAL    /data/assets    optional AI/LiveKit
```

## Quick start (Docker)

Prerequisites: Docker Compose v2+, ~2 GB RAM for host-only (more if `--profile ai`).

```bash
cp deployment/.env.host.example deployment/.env.host
# set SAGATREE_BETTER_AUTH_SECRET (≥32 chars): openssl rand -base64 48

# From repo root — compose includes deployment/docker-compose.host.yml
docker compose --env-file deployment/.env.host up -d --build

curl -fsS http://127.0.0.1:8787/health
```

Optional local Ollama:

```bash
SAGATREE_COMPOSE_PROFILE_AI=1 docker compose --env-file deployment/.env.host \
  --profile ai up -d --build
```

**Never** `docker compose down -v` on a data volume you care about.

Runbook: [`docs/ops/host-compose-profiles.md`](docs/ops/host-compose-profiles.md)  
Backup / restore: [`docs/ops/host/backup-restore.md`](docs/ops/host/backup-restore.md)

## Quick start (solo / no Docker)

```bash
cp .env.example .env   # or export vars
export SAGATREE_DATA_DIR=./.sagatree-data
export SAGATREE_BETTER_AUTH_SECRET="$(openssl rand -base64 48)"
export SAGATREE_HOST_MODE=solo
npm ci
npm run host:dev
```

Frontend (separate terminal): set `VITE_SAGATREE_HOST_AUTH_URL=http://127.0.0.1:8787` and `npm run dev`.

## Environment

| Variable | Role |
| --- | --- |
| `SAGATREE_BETTER_AUTH_SECRET` | Required (≥32) for remote/Compose |
| `SAGATREE_DATA_DIR` | SQLite + assets root |
| `SAGATREE_HOST` / `SAGATREE_PORT` | Listen bind (Compose uses `0.0.0.0:8787` inside) |
| `SAGATREE_AUTH_BASE_URL` | Cookie origin (default loopback `http://127.0.0.1:8787`) |
| `VITE_SAGATREE_HOST_AUTH_URL` | Browser → host |

Archived Supabase env template: `archive/supabase-legacy/.env.supabase.example` (not required for product).

## Frontend build for host

```bash
npm run build
# Serve `build/` via host static or your reverse proxy; API remains :8787
```

## HTTPS / VPS

Terminate TLS at a reverse proxy (Caddy/nginx). Set `SAGATREE_AUTH_BASE_URL` and
`SAGATREE_AUTH_TRUSTED_ORIGINS` to the public HTTPS origin. Keep SQLite + assets on a
persistent volume; use the backup mount documented in host ops.

## Related

- Host modular monolith: [`docs/architecture/host-modular-monolith.md`](docs/architecture/host-modular-monolith.md)
- Cutover epic: #1135 · CUT-22: #1157
- Legacy Supabase compose (archive only): `archive/supabase-legacy/docker-compose.supabase.yml`
