# Migration Dependency Graph (acyclic)

Source of truth: `.qa/intake/local-first-stack-migration-issues.json` → `topoOrder`.

```text
MIG-001 Evidence lock
  └─ MIG-002 Legacy inventory
       ├─ GATE-01 Drizzle vs ZenStack          ─┐
       ├─ GATE-02 Better Auth + Colyseus auth  ─┼─ must APPROVE before wave-1 ready
       ├─ GATE-03 Colyseus HTTP vs Hono        ─┤
       ├─ GATE-04 Revision/idempotency SQLite  ─┘
       └─ ATLAS-LIVE-E2E (#770) [parallel honesty gap]

Wave-1 (blocked on GATEs):
  MIG-010 Host skeleton
  MIG-011 SQLite bootstrap          ← GATE-01
  MIG-012 World read adapter        ← GATE-01
  MIG-013 Policy Service            ← GATE-01
  MIG-014 Better Auth               ← GATE-02
  MIG-015 Solo identity             ← GATE-02

Wave-2 (blocked on wave-1 + GATEs):
  MIG-020 HTTP transport            ← GATE-03
  MIG-021 Realtime rooms            ← GATE-03
  MIG-022 SessionRuntimeState       ← GATE-04
  MIG-023 Invites
  MIG-024 Projections

Wave-3:
  MIG-301..313 infra area ports
  MIG-350..353 RPC clusters

Wave-4:
  MIG-4xx one issue per Edge Function

Wave-5:
  MIG-500..503 storage / tus / export / pg→sqlite dry-run

Wave-6:
  MIG-600..603 security / docker / CI / ops

Wave-7:
  MIG-700 cutover ← **ALL** wave-0..6 MIG-* + GATE-01..04 + ATLAS-LIVE-E2E (#770)
    → MIG-701 dual-run → MIG-702 supabase off
  MIG-703 Tauri ← GATE-05
```

**Cutover safety (#774 / Codex P1):** `MIG-700` must not become eligible from `MIG-503`+`MIG-600` alone. See `local-first-stack-migration-issues.json` `dependsOn` and PREP-07 (#780) for automated enforcement.

## Runner rules

- Never mark GATE-dependent issues `agent-ready` while GATE status is `needs-design`.  
- Labels: `P0|P1|P2`, `migration-wave-*`, `migration-order-*`, `needs-design`.  
- After GitHub publish (freigabe only): add `Depends on #N` links.  
