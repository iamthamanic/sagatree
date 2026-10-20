# Local-first stack migration — Issue drafts

> **NOT published to GitHub from this file alone.** Count=72. Baseline `4bc40a314281`.

GitHub Epic #773 already lists child issues #774–#852; this JSON remains the machine contract.

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

## Review remediation

```json
{
  "pr771CodexP1_cutoverDeps": "MIG-700 dependsOn expanded to all wave MIG-* + GATEs + ATLAS-LIVE-E2E",
  "pr771CodexP2_storageDistinctACs": true,
  "pr771CodexP2_opsDistinctACs": true,
  "deferredToGithub": {
    "775": "Atlas #770 prerequisite wiring",
    "776": "GATE-02..05 measurable criteria docs",
    "777": "Per-RPC individual contracts",
    "778": "Per-Edge/infra individual contracts",
    "779": "Canonical GitHub contract quality enforcement",
    "780": "Shutdown dependency enforcement automation",
    "781": "Parity harness implementation"
  }
}
```

## Issues (compact)

| ID | Title | Priority | Wave | Status | Depends (n) |
|---|---|---|---|---|---|
| MIG-001 | Evidence lock: freeze main baseline + golden fixture contract | P0 | migration-wave-0-evidence | ready | 0 |
| MIG-002 | Complete legacy inventory matrix (SQL/RLS/RPC/Edge/Storage/Realtime/Infra) | P0 | migration-wave-0-evidence | ready | 1 |
| GATE-01 | PoC: Drizzle+PolicyService vs ZenStack 3 for SQLite authz | P0 | migration-wave-0-evidence | needs-design | 2 |
| GATE-02 | PoC: Better Auth session model + Colyseus auth handshake | P0 | migration-wave-0-evidence | needs-design | 2 |
| GATE-03 | PoC: Colyseus HTTP routes vs separate Hono API layer | P0 | migration-wave-0-evidence | needs-design | 2 |
| GATE-04 | PoC: Preserve revision/transaction/idempotency guarantees under SQLite writer model | P0 | migration-wave-0-evidence | needs-design | 2 |
| GATE-05 | Desktop packaging PoC (Tauri+sidecar vs Electron) — deferred until browser host parity | P2 | migration-wave-8-tauri-cutover | needs-design | 2 |
| MIG-010 | Node host skeleton (health, config, data dir) | P0 | migration-wave-1-host-auth | blocked | 3 |
| MIG-011 | SQLite schema bootstrap + migration runner | P0 | migration-wave-1-host-auth | blocked | 3 |
| MIG-012 | Repository port pattern + first world read adapter | P0 | migration-wave-1-host-auth | blocked | 3 |
| MIG-013 | SagaTree Policy Service core (deny-by-default) | P0 | migration-wave-1-host-auth | blocked | 3 |
| MIG-014 | Better Auth host accounts (remote-reachable mode) | P0 | migration-wave-1-host-auth | blocked | 3 |
| MIG-015 | Solo local identity without privilege transfer | P0 | migration-wave-1-host-auth | blocked | 3 |
| MIG-020 | HTTP command/query transport layer | P0 | migration-wave-2-api-realtime | blocked | 4 |
| MIG-021 | Realtime session rooms + snapshot/resync | P0 | migration-wave-2-api-realtime | blocked | 4 |
| MIG-022 | SessionRuntimeState port (revision+idempotency) | P0 | migration-wave-2-api-realtime | blocked | 4 |
| MIG-023 | Invite/join codes without privilege escalation | P0 | migration-wave-2-api-realtime | blocked | 4 |
| MIG-024 | Player/GM/spectator projections filter | P0 | migration-wave-2-api-realtime | blocked | 4 |
| MIG-301 | Port infrastructure/ai adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-302 | Port infrastructure/character adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-303 | Port infrastructure/inventory adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-304 | Port infrastructure/look adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-305 | Port infrastructure/marketplace adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-306 | Port infrastructure/media adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-307 | Port infrastructure/npc-creature adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-308 | Port infrastructure/project adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-309 | Port infrastructure/rulesets adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-310 | Port infrastructure/saga adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-311 | Port infrastructure/session adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-312 | Port infrastructure/user-profile adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-313 | Port infrastructure/world adapters from Supabase to host repositories | P1 | migration-wave-3-domain-ports | blocked | 3 |
| MIG-350 | Replace Postgres RPC cluster: world/atlas RPCs | P1 | migration-wave-3-domain-ports | blocked | 2 |
| MIG-351 | Replace Postgres RPC cluster: session/runtime RPCs | P1 | migration-wave-3-domain-ports | blocked | 2 |
| MIG-352 | Replace Postgres RPC cluster: saga/project RPCs | P1 | migration-wave-3-domain-ports | blocked | 2 |
| MIG-353 | Replace Postgres RPC cluster: remaining RPCs | P1 | migration-wave-3-domain-ports | blocked | 2 |
| MIG-401 | Port Edge Function `ai-gm` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-402 | Port Edge Function `ai-provider-credentials` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-403 | Port Edge Function `bestiary` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-404 | Port Edge Function `character-avatar-meshy` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-405 | Port Edge Function `character-lore` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-406 | Port Edge Function `characters` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-407 | Port Edge Function `dm-tools` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-408 | Port Edge Function `export` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-409 | Port Edge Function `item-model3d` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-410 | Port Edge Function `item-thumbnail` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-411 | Port Edge Function `items` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-412 | Port Edge Function `look-reference-analysis` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-413 | Port Edge Function `lorekeeper` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-414 | Port Edge Function `main` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-415 | Port Edge Function `marketplace` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-416 | Port Edge Function `media` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-417 | Port Edge Function `npcs` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-418 | Port Edge Function `quests` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-419 | Port Edge Function `rulesets` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-420 | Port Edge Function `session-media-token` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-421 | Port Edge Function `session-recap` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-422 | Port Edge Function `sessions` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-423 | Port Edge Function `spellbook` to Node host service/adapter | P2 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-424 | Port Edge Function `world` to Node host service/adapter | P1 | migration-wave-4-edge-ai-media | blocked | 3 |
| MIG-500 | Local protected asset service (replace Storage buckets) | P1 | migration-wave-5-storage-export | blocked | 2 |
| MIG-501 | Optional tus for large uploads | P1 | migration-wave-5-storage-export | blocked | 1 |
| MIG-502 | Export/import versioned bundles + restore drills | P1 | migration-wave-5-storage-export | blocked | 2 |
| MIG-503 | Postgres→SQLite data migration dry-run tooling | P1 | migration-wave-5-storage-export | blocked | 2 |
| MIG-600 | Negative authz suite parity on host | P1 | migration-wave-6-security-ops | blocked | 2 |
| MIG-601 | Docker Compose simplification for host+optional AI/media | P1 | migration-wave-6-security-ops | blocked | 2 |
| MIG-602 | CI Quality Gates for host unit/integration/e2e | P1 | migration-wave-6-security-ops | blocked | 2 |
| MIG-603 | Ops: backup/restore/update/rollback runbooks | P1 | migration-wave-6-security-ops | blocked | 2 |
| MIG-700 | Controlled cutover per world/saga with freeze+delta | P2 | migration-wave-7-cutover-tauri | blocked | 67 |
| MIG-701 | Supabase dual-run parity window | P2 | migration-wave-7-cutover-tauri | blocked | 1 |
| MIG-702 | Supabase shutdown only after parity+restore proof | P2 | migration-wave-7-cutover-tauri | blocked | 2 |
| MIG-703 | Tauri integration before external desktop test phase | P2 | migration-wave-7-cutover-tauri | blocked | 2 |
| ATLAS-LIVE-E2E | Mandatory Atlas live E2E on isolated test DB (GitHub #770) | P0 | migration-wave-0-evidence | blocked | 0 |

## GitHub mapping (PREP-06)

All 72 localIds mapped to GitHub issues (see `.qa/evidence/stack-migration-prep/github-issue-map.json`). Contract quality enforced by `scripts/stack-migration-prep-check.mjs`.
