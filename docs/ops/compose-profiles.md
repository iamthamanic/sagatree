# Compose profiles (slim self-host)

Never delete volumes (`docker compose down -v`).

## Default = core

```bash
docker compose up -d
```

Starts only product-critical services:

| Service | Role |
|---------|------|
| `supabase-db` | Postgres |
| `supabase-auth` | GoTrue |
| `supabase-rest` | PostgREST |
| `supabase-realtime` | Realtime |
| `supabase-storage` | Storage |
| `supabase-kong` | API gateway |
| `supabase-edge` | Edge Functions |
| `redis` | DM-tools / session cache |

Target: **~8 GB VPS** (e.g. Hostinger KVM 2) when LLM runs in the cloud (no local Ollama).

## Optional profiles

| Profile | Services | When |
|---------|----------|------|
| `ai-local` | `ollama` | Local LLM on a machine with spare RAM/GPU |
| `graph` | `neo4j` | Lorekeeper knowledge graph |
| `dev-tools` | `supabase-meta`, `supabase-studio` | Local Studio dashboard |
| `full` | all of the above | Fat local / large host |

```bash
# Core only (KVM 2 / cloud LLM)
docker compose up -d

# Core + Neo4j
docker compose --profile graph up -d

# Core + Studio
docker compose --profile dev-tools up -d

# Local Ollama (needs RAM; avoid on 8 GB with full stack)
docker compose --profile ai-local up -d

# Everything
docker compose --profile full up -d
```

## Cloud / remote LLM (recommended on small VPS)

Do **not** enable `ai-local`. Configure Edge via `.env` — the same vars feed **ai-gm**, character-lore, and session-recap:

```bash
# OpenAI-compatible cloud (preferred on ~8 GB hosts)
CHARACTER_AI_PROVIDER=openai-compatible
CHARACTER_AI_BASE_URL=https://your-provider.example/v1
CHARACTER_AI_API_KEY=…
CHARACTER_AI_MODEL=your-model

# Or remote Ollama API (no local container) — ai-gm uses /api/generate
# CHARACTER_AI_PROVIDER=ollama
# OLLAMA_HOST=https://your-ollama-host
# CHARACTER_AI_BASE_URL=https://your-ollama-host
# OLLAMA_MODEL=llama3.2
```

Then recreate Edge:

```bash
docker compose up -d --force-recreate --no-deps supabase-edge
```

Without `ai-local` and without a reachable `OLLAMA_HOST` / openai-compatible credentials, GM narrative calls fail.

## Memory knobs (optional)

| Env | Default | Notes |
|-----|---------|--------|
| `NEO4J_HEAP_INITIAL` / `NEO4J_HEAP_MAX` | `256m` / `512m` | Raise on larger hosts |
| `NEO4J_MEM_LIMIT` | `768m` | Container cap |
| `OLLAMA_MEM_LIMIT` | `4g` | Only with `ai-local` |
| `STUDIO_MEM_LIMIT` / `META_MEM_LIMIT` | `512m` / `256m` | `dev-tools` |
| `REDIS_MEM_LIMIT` / `REDIS_MAXMEMORY` | `128m` / `96mb` | Always on |

## Related

- Harden defaults: [`compose-harden-defaults.md`](compose-harden-defaults.md)
- Node host Compose (MIG-601): [`host-compose-profiles.md`](host-compose-profiles.md) (`deployment/docker-compose.host.yml`)
- Self-host overview: [`README_SELFHOST.md`](../../README_SELFHOST.md)
