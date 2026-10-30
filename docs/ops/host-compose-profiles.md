# Host Compose profiles (MIG-601)

Node-host Compose lives under `deployment/` — separate from the legacy Supabase
stack in the repo-root `docker-compose.yml`. Never delete volumes
(`docker compose down -v`).

## Paths (reproducible)

| Axis | Value |
|------|--------|
| Compose file | `deployment/docker-compose.host.yml` |
| Image | `deployment/Dockerfile.host` |
| Env example | `deployment/.env.host.example` → copy to `deployment/.env.host` |
| HTTP | `127.0.0.1:8787` (`SAGATREE_PORT` inside container; override publish via `SAGATREE_HOST_PUBLISH` + matching `SAGATREE_HOST_PORT`) |
| Auth origin | Compose default `SAGATREE_AUTH_BASE_URL=http://127.0.0.1:${SAGATREE_HOST_PORT:-8787}` (loopback only — never derived from publish bind). Leave unset in `.env.host` so the default applies; set explicitly for LAN/non-loopback. Misaligned Host/origin → `HOST_DENIED` |
| Data volume | named volume `host-data` → `/data` (`SAGATREE_DATA_DIR`) |
| Backup mount | `${SAGATREE_BACKUP_MOUNT:-./backups}` → `/backups` |
| Ollama (profile `ai`) | `127.0.0.1:11434` — image pinned to `ollama/ollama:0.40.13` (digest in Compose; bump deliberately) |
| Health | `GET /health` — **200 only after** SQLite bootstrap + listen |

Native host and container share the same `createHost` / `SAGATREE_DATA_DIR` /
`SAGATREE_PORT` contract: copy a fixture data dir between them for parity checks.

## Profiles

| Invocation | Services | Notes |
|------------|----------|--------|
| Host-only (default) | `sagatree-host` | No cloud secrets required in the image |
| `--profile ai` | + `ollama` | Set `OLLAMA_HOST=http://ollama:11434` (Compose default) |
| `--profile media` | + `media-capability` marker | Credentials stay external; media capability API explains gaps |
| both profiles | host + ollama + marker | Core host stays up if AI/Meshy keys are missing |

```bash
cd deployment
cp .env.host.example .env.host   # set SAGATREE_BETTER_AUTH_SECRET (≥32 chars)

# Host-only
docker compose --env-file .env.host -f docker-compose.host.yml up -d --build

# Host + local Ollama
SAGATREE_COMPOSE_PROFILE_AI=1 docker compose --env-file .env.host \
  -f docker-compose.host.yml --profile ai up -d --build

# Host + media profile marker
SAGATREE_COMPOSE_PROFILE_MEDIA=1 docker compose --env-file .env.host \
  -f docker-compose.host.yml --profile media up -d --build
```

## Health + restart

1. Fresh volume: container health stays failing until `/health` returns 200
   (`ready: true` after DB open + listen).
2. Write world/session (or any durable host data) under `/data`.
3. `docker compose … restart sagatree-host` (or recreate **without** `-v`):
   data in `host-data` survives; fingerprint / identity stable.

## Missing optional credentials

- Host core (`/health`, solo/remote identity, SQLite reads) stays usable.
- AI BYOK without `CREDENTIALS_ENCRYPTION_KEY` → explicit `not-configured`.
- Media kinds without local codecs / external keys → `capability(…).status === 'unsupported'`
  with a German explanation string (no silent success).

Do **not** bake `CHARACTER_AI_API_KEY`, `MESHY_API_KEY`, or
`SAGATREE_BETTER_AUTH_SECRET` into `Dockerfile.host`.

## Related

- Legacy Supabase slim profiles: [`compose-profiles.md`](compose-profiles.md)
- Harden defaults (Kong / Edge): [`compose-harden-defaults.md`](compose-harden-defaults.md)
