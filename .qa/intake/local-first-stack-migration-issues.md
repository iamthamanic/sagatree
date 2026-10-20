# Local-first stack migration — Issue drafts

> **NOT published to GitHub.** Count=72. Baseline `4bc40a314281`.

## Coverage

```json
{
  "legacyMigrations": 106,
  "legacyEdgeFunctions": 24,
  "legacyFrontendRpcs": 55,
  "infraAreas": 13,
  "issuesTotal": 72,
  "issuesReady": 2,
  "issuesBlockedOrNeedsDesign": 70,
  "gateIssues": 5,
  "openArchitectureDecisions": 5
}
```

## Waves

- `migration-wave-0-evidence`
- `migration-wave-1-host-auth`
- `migration-wave-2-api-realtime`
- `migration-wave-3-domain-ports`
- `migration-wave-4-edge-ai-media`
- `migration-wave-5-storage-export`
- `migration-wave-6-security-ops`
- `migration-wave-7-cutover-tauri`

## Issues (compact)

| ID | Title | Priority | Wave | Status | Depends |
|---|---|---|---|---|---|
| MIG-001 | Evidence lock: freeze main baseline + golden fixture contract | P0 | migration-wave-0-evidence | ready | — |
| MIG-002 | Complete legacy inventory matrix (SQL/RLS/RPC/Edge/Storage/Realtime/Infra) | P0 | migration-wave-0-evidence | ready | MIG-001 |
| GATE-01 | PoC: Drizzle+PolicyService vs ZenStack 3 for SQLite authz | P0 | migration-wave-0-evidence | needs-design | MIG-001, MIG-002 |
| GATE-02 | PoC: Better Auth session model + Colyseus auth handshake | P0 | migration-wave-0-evidence | needs-design | MIG-001, MIG-002 |
| GATE-03 | PoC: Colyseus HTTP routes vs separate Hono API layer | P0 | migration-wave-0-evidence | needs-design | MIG-001, MIG-002 |
| GATE-04 | PoC: Preserve revision/transaction/idempotency guarantees under SQLite writer model | P0 | migration-wave-0-evidence | needs-design | MIG-001, MIG-002 |
| GATE-05 | Desktop packaging PoC (Tauri+sidecar vs Electron) — deferred until browser host parity | P2 | migration-wave-8-tauri-cutover | needs-design | MIG-001, MIG-002 |
| MIG-010 | Node host skeleton (health, config, data dir) | P0 | migration-wave-1-host-auth | blocked | MIG-001, MIG-002, GATE-01 |
| MIG-011 | SQLite schema bootstrap + migration runner | P0 | migration-wave-1-host-auth | blocked | MIG-001, MIG-002, GATE-01 |
| MIG-012 | Repository port pattern + first world read adapter | P0 | migration-wave-1-host-auth | blocked | MIG-001, MIG-002, GATE-01 |
| MIG-013 | SagaTree Policy Service core (deny-by-default) | P0 | migration-wave-1-host-auth | blocked | MIG-001, MIG-002, GATE-01 |
| MIG-014 | Better Auth host accounts (remote-reachable mode) | P0 | migration-wave-1-host-auth | blocked | MIG-001, MIG-002, GATE-02 |
| MIG-015 | Solo local identity without privilege transfer | P0 | migration-wave-1-host-auth | blocked | MIG-001, MIG-002, GATE-02 |
| MIG-020 | HTTP command/query transport layer | P0 | migration-wave-2-api-realtime | blocked | MIG-010, MIG-013, MIG-014, GATE-03 |
| MIG-021 | Realtime session rooms + snapshot/resync | P0 | migration-wave-2-api-realtime | blocked | MIG-010, MIG-013, MIG-014, GATE-03 |
| MIG-022 | SessionRuntimeState port (revision+idempotency) | P0 | migration-wave-2-api-realtime | blocked | MIG-010, MIG-013, MIG-014, GATE-04 |
| MIG-023 | Invite/join codes without privilege escalation | P0 | migration-wave-2-api-realtime | blocked | MIG-010, MIG-013, MIG-014, GATE-02 |
| MIG-024 | Player/GM/spectator projections filter | P0 | migration-wave-2-api-realtime | blocked | MIG-010, MIG-013, MIG-014, GATE-01 |
| MIG-301 | Port infrastructure/ai adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-302 | Port infrastructure/character adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-303 | Port infrastructure/inventory adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-304 | Port infrastructure/look adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-305 | Port infrastructure/marketplace adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-306 | Port infrastructure/media adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-307 | Port infrastructure/npc-creature adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-308 | Port infrastructure/project adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-309 | Port infrastructure/rulesets adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-310 | Port infrastructure/saga adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-311 | Port infrastructure/session adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-312 | Port infrastructure/user-profile adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-313 | Port infrastructure/world adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | MIG-012, MIG-013, MIG-020 |
| MIG-350 | Replace Postgres RPC cluster: world/atlas RPCs | P1 | migration-wave-3-domain-ports | blocked | MIG-022, MIG-013 |
| MIG-351 | Replace Postgres RPC cluster: session/runtime RPCs | P1 | migration-wave-3-domain-ports | blocked | MIG-022, MIG-013 |
| MIG-352 | Replace Postgres RPC cluster: saga/project RPCs | P1 | migration-wave-3-domain-ports | blocked | MIG-022, MIG-013 |
| MIG-353 | Replace Postgres RPC cluster: remaining RPCs | P1 | migration-wave-3-domain-ports | blocked | MIG-022, MIG-013 |
| MIG-401 | Port Edge Function `ai-gm` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-402 | Port Edge Function `ai-provider-credentials` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-403 | Port Edge Function `bestiary` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-404 | Port Edge Function `character-avatar-meshy` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-405 | Port Edge Function `character-lore` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-406 | Port Edge Function `characters` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-407 | Port Edge Function `dm-tools` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-408 | Port Edge Function `export` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-409 | Port Edge Function `item-model3d` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-410 | Port Edge Function `item-thumbnail` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-411 | Port Edge Function `items` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-412 | Port Edge Function `look-reference-analysis` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-413 | Port Edge Function `lorekeeper` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-414 | Port Edge Function `main` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-415 | Port Edge Function `marketplace` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-416 | Port Edge Function `media` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-417 | Port Edge Function `npcs` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-418 | Port Edge Function `quests` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-419 | Port Edge Function `rulesets` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-420 | Port Edge Function `session-media-token` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-421 | Port Edge Function `session-recap` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-422 | Port Edge Function `sessions` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-423 | Port Edge Function `spellbook` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-424 | Port Edge Function `world` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | MIG-020, MIG-013, MIG-014 |
| MIG-500 | Local protected asset service (replace Storage buckets) | P1 | migration-wave-5-storage-export | blocked | MIG-013, MIG-011 |
| MIG-501 | Optional tus for large uploads | P1 | migration-wave-5-storage-export | blocked | MIG-013, MIG-011 |
| MIG-502 | Export/import versioned bundles + restore drills | P1 | migration-wave-5-storage-export | blocked | MIG-013, MIG-011 |
| MIG-503 | Postgres→SQLite data migration dry-run tooling | P1 | migration-wave-5-storage-export | blocked | MIG-013, MIG-011 |
| MIG-600 | Negative authz suite parity on host | P1 | migration-wave-6-security-ops | blocked | MIG-024, MIG-500 |
| MIG-601 | Docker Compose simplification for host+optional AI/media | P1 | migration-wave-6-security-ops | blocked | MIG-024, MIG-500 |
| MIG-602 | CI Quality Gates for host unit/integration/e2e | P1 | migration-wave-6-security-ops | blocked | MIG-024, MIG-500 |
| MIG-603 | Ops: backup/restore/update/rollback runbooks | P1 | migration-wave-6-security-ops | blocked | MIG-024, MIG-500 |
| MIG-700 | Controlled cutover per world/saga with freeze+delta | P2 | migration-wave-7-cutover-tauri | blocked | MIG-503, MIG-600 |
| MIG-701 | Supabase dual-run parity window | P2 | migration-wave-7-cutover-tauri | blocked | MIG-700 |
| MIG-702 | Supabase shutdown only after parity+restore proof | P2 | migration-wave-7-cutover-tauri | blocked | MIG-701 |
| MIG-703 | Tauri integration before external desktop test phase | P2 | migration-wave-7-cutover-tauri | blocked | GATE-05, MIG-602 |
| ATLAS-LIVE-E2E | Mandatory Atlas live E2E on isolated test DB (GitHub #770) | P0 | migration-wave-0-evidence | blocked | — |

## Full contracts

Machine-readable A–E contracts: [`local-first-stack-migration-issues.json`](../intake/local-first-stack-migration-issues.json).

Each issue includes `before`, `after`, `behavior`, `scope`, `acceptance` (≤5 ACs).

