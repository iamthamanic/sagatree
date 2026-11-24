# Realtime restart checklist (#604)

> **Historisch — beschreibt den stillgelegten früheren Backend-Stack, nicht den Produkt-Stack.** Produktbetrieb: [`host-compose-profiles.md`](host-compose-profiles.md) · [`../../README_SELFHOST.md`](../../README_SELFHOST.md). Diese Seite bleibt nur, solange archivgebundene Checks sie lesen, und wird mit der Archiv-Löschung (#1328, Phase 2) entfernt.

**Never** delete Docker volumes (`docker compose down -v`, `volume rm`, DB wipe).

## Preconditions

1. `.env` contains (see `.env.example`):
   - `SECRET_KEY_BASE` — `openssl rand -base64 64`
   - `DB_ENC_KEY` — `openssl rand -hex 8`
   - `JWT_SECRET` / `API_JWT_SECRET` (same value locally is fine)
   - `FLY_APP_NAME` (default `sagatree`)
   - `REALTIME_SELF_HOST_TENANT` (default `realtime-dev`)
2. Kong declarative config proxies `/realtime/v1/` → `supabase-realtime:4000/socket` (`supabase/config/kong.yml`).
3. Nginx include keeps WebSocket upgrade (`supabase/config/nginx-proxy.template`).

## Recreate Realtime only (keeps DB/Storage volumes)

```bash
# From repo root — do NOT pass -v
docker compose up -d --no-deps --force-recreate supabase-realtime
docker compose up -d --no-deps --force-recreate supabase-kong
```

If an older compose project still owns the gateway network, set `REALTIME_CONTAINER` / `DB_CONTAINER` for the seed/check scripts, and ensure Kong can resolve the `supabase-realtime` network alias.

## Verify

```bash
docker logs sagatree-realtime --tail 40   # must NOT say SECRET_KEY_BASE is missing
# First boot: migrate + seed public.tenants (external_id=localhost for local Kong Host)
node scripts/minimal-proof/seed-realtime-tenant.mjs
# Optional live WS (set REALTIME_CHECK_USER_JWT + anon)
node scripts/realtime-compose-boot-check.mjs
```

`FLY_REGION` / CDC `region` must be a known Realtime region (e.g. `us-east-1`). `local` crashes `Nodes.region_nodes/1`.

## Rollback (still no volume delete)

```bash
# Restore previous compose/env values, then:
docker compose up -d --no-deps --force-recreate supabase-realtime supabase-kong
```
