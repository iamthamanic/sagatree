# Compose harden defaults (#605)

> **Historisch — beschreibt den stillgelegten früheren Backend-Stack, nicht den Produkt-Stack.** Produktbetrieb: [`host-compose-profiles.md`](host-compose-profiles.md) · [`../../README_SELFHOST.md`](../../README_SELFHOST.md). Diese Seite bleibt nur, solange archivgebundene Checks sie lesen, und wird mit der Archiv-Löschung (#1328, Phase 2) entfernt.

Never delete volumes (`docker compose down -v`).


## Defaults

| Setting | Default | Override |
|---------|---------|----------|
| `KONG_NGINX_WORKER_PROCESSES` | `1` | `=2` then `docker compose up -d --force-recreate supabase-kong` |
| `VERIFY_JWT` | `true` | `VERIFY_JWT=false` for local Edge debugging only |
| Postgres publish | `127.0.0.1:5432` | override file may use `127.0.0.1:54325` |
| Edge publish | `127.0.0.1:9998` | clients use Kong `/functions/v1` |

## Local Admin / weak seeds

Migrations `011_seed_local_admin.sql` and `074_seed_local_player.sql` (`admin`/`player` + `1234`) are **DEV conveniences**. Do not run them on internet-facing hosts; Local Admin UI shortcut is Vite **DEV-only** (`isLocalAdminEnabled` / #607). Edge JWT gate: see `docs/ops/negative-authz-suite.md`.

## Kong routes

Declarative `supabase/config/kong.yml` uses CORS only on Auth/REST/Storage/Realtime/Functions — **no** blanket `key-auth` on all routes (Supabase-JS + Realtime compatible).

## Recreate (no volume wipe)

```bash
docker compose up -d --force-recreate supabase-kong supabase-edge
# DB bind change only (keeps volume):
docker compose up -d --force-recreate --no-deps supabase-db
```
