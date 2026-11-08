# Legacy Supabase Compose profiles (archived)

> **CUT-22 / #1157:** Product default is the Node host.  
> Use [`host-compose-profiles.md`](host-compose-profiles.md) and root  
> `docker compose --env-file deployment/.env.host up -d --build`.

The historical Supabase slim/full stack lives at:

`archive/supabase-legacy/docker-compose.supabase.yml`

It is **not** required for product, CI, or fresh clones. Keep this note only so
historical ops links do not 404; do not treat Supabase services as the runtime.

```bash
# Archived — not product
docker compose -f archive/supabase-legacy/docker-compose.supabase.yml \
  --env-file archive/supabase-legacy/.env.supabase.example config
```
