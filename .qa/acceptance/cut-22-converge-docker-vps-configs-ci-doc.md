# Acceptance — cut-22-converge-docker-vps-configs-ci-doc (#1157)

## Intent
Fresh clone / Docker / VPS runs one Node host (SQLite + assets + optional AI/LiveKit).
Authoritative docs and root Compose no longer mandate Supabase services/env.

## Happy Path
- [x] Root `docker-compose.yml` includes `deployment/docker-compose.host.yml` only
- [x] Legacy Supabase Compose archived under `archive/supabase-legacy/`
- [x] `.env.example` is host-first (no required `SUPABASE_*`)
- [x] `README_SELFHOST.md` / `AGENTS.md` / README backend describe the host stack
- [x] `docker compose config --services` lists `sagatree-host` and no `supabase-*`
- [x] `lib.supabase-client-invoke` matrix row HOST_VERIFIED (SDK-free stub)
- [x] `scripts/cut-22-host-runtime-contracts.self-test.mjs` wired into test-gate

## Composition Gate
See `.qa/runs/composition-gate-cut-22-converge-docker-vps-configs-ci-doc.md`

## Evidence
- `scripts/cut-22-host-runtime-contracts.self-test.mjs`
