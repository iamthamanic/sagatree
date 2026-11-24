# Rotate / retire hosted anon JWTs (#672)

> **Historisch — beschreibt den stillgelegten früheren Backend-Stack, nicht den Produkt-Stack.** Produktbetrieb: [`host-compose-profiles.md`](host-compose-profiles.md) · [`../../README_SELFHOST.md`](../../README_SELFHOST.md). Diese Seite bleibt nur, solange archivgebundene Checks sie lesen, und wird mit der Archiv-Löschung (#1328, Phase 2) entfernt.

Hardcoded browser JWTs were removed from `src/utils/supabase/info.tsx` and `src/lib/devtrack.ts`.  
Configure self-host / env via `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Projects that held committed anon keys

| Project ref | Former use | Action for ops owner |
|-------------|------------|----------------------|
| `dnhotyjazjnhneqbqocq` | Legacy hosted Supabase fallback in `info.tsx` | If project still exists on supabase.com: **rotate anon + service_role JWT** (Settings → API → Generate new) or **pause/delete** the project if unused. |
| `vjpfbedynctazvwywlqj` | Figma Make DevTrack endpoint + anon bearer | Same: rotate keys or disable the project / Edge function `DevTrack-Logs`. DevTrack now requires `VITE_DEVTRACK_*` env and no-ops when unset. |

## Local / self-host

- Do **not** commit real JWTs. `.env` stays gitignored.
- Placeholders in `.env.example` remain non-secret strings.
- Local seed passwords (`admin`/`1234`) are DEV-only — see compose harden docs; never expose on internet-facing hosts.

## Verification

```bash
node scripts/no-committed-anon-jwt-check.mjs
rg 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' src --glob '*.ts*'
```
