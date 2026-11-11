# Docs consolidate — active runtime evidence

**Branch:** `docs/consolidate-active-runtime-docs`  
**Base HEAD checked:** `origin/main` @ CUT-21 (#1183) / CUT-22 (#1188) / CUT-23 (#1189) already merged.

## Inventory (status)

| Area | Status | Evidence |
| --- | --- | --- |
| Product runtime / deploy | **AKTIV** Node/Hono host + host compose | `docker-compose.yml` include → `deployment/docker-compose.host.yml`; `server/src/bootstrap/main.ts`; `README_SELFHOST.md` |
| Auth / permissions | **AKTIV** Better Auth + Policy Service | `src/lib/auth-context.tsx`, `src/lib/hostAuthBridge.ts`; host modules `identity`/`permissions` |
| DB / assets / realtime | **AKTIV** SQLite + local assets; host realtime where wired | Compose `SAGATREE_DATA_DIR`; `docs/ops/host/backup-restore.md` |
| Frontend layers | **AKTIV** #94 + host HTTP adapters | `src/infrastructure/host/*`; architecture-boundary-check |
| AI / media | **OPTIONAL** | host-compose profiles `ai` / `media` |
| Desktop / Tauri | **GEPLANT** — no `src-tauri/` on main; release skeleton exists | `docs/ops/desktop-release.md`; open PR ≠ product |
| Tests / gates | **AKTIV** | cut-20..23 self-tests in `test-gate`; new `docs-runtime-drift-check` |
| Supabase / Deno / GoTrue product path | **HISTORISCH** | `archive/supabase-legacy/` |

## Contradiction → fix

| Old claim | Canonical now | Evidence |
| --- | --- | --- |
| README Tech Stack = Supabase/GoTrue/… | Node/Hono/Better Auth/SQLite | `README.md` Tech Stack; compose host |
| AGENTS Integration = supabase-js + Edge invoke | Host HTTP + Better Auth bridge | `AGENTS.md`; `hostAuthBridge.ts` |
| ARCHITECTURE “Supabase-Backend-Stack” | Node/Hono framing + #94 tables | `src/ARCHITECTURE.md` |
| architektur-sqlite-based “nicht implementiert” as current | Historical banner + links to host entry | status block dated 19.10.2026 |
| host-modular-monolith “no Supabase shutdown claim” | Updated status / §10 after CUT-21+ | CUT PRs on main |
| INTEGRATION / AUTH_SETUP / SUPABASE_SETUP as live setup | HISTORISCH banners | files kept, not rewritten |
| Cursor rule stack = Supabase | Host stack | `.cursor/rules/sagatree.mdc` |

## Historical left unchanged (body)

- `docs/architektur-sqlite-based.md` body (decision rationale)
- `archive/supabase-legacy/**`
- INTEGRATION/AUTH/SUPABASE setup bodies (banner only)
- ADRs under `docs/architecture/`

## Commands run

```text
node scripts/docs-runtime-drift-check.mjs --self-test   # PASS
node scripts/docs-runtime-drift-check.mjs               # PASS
node scripts/cut-22-host-runtime-contracts.self-test.mjs # PASS
```
