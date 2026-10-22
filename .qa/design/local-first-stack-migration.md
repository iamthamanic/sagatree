# Local-first Stack Migration — Design Lock (Prep)

> **Status:** PREP / NOT STARTED  
> **Baseline SHA:** `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`  
> **Authority:** [`docs/architektur-sqlite-based.md`](../../docs/architektur-sqlite-based.md), `AGENTS.md`, `src/ARCHITECTURE.md`  
> **Authorization:** The migration contracts are published and their remediation is authorized. This authorizes source verification, isolated test infrastructure, issue synchronization and PoC evidence. The unrestricted migration runner, human architecture decisions and production cutover remain separate gates.

## 1. Product invariant

SagaTree uses **one shared host runtime** for local machine and VPS. No second independently maintained desktop backend. No mandatory cloud for solo/LAN.

## 2. Target stack (approved product direction vs open PoCs)

| Area | Direction | Decision status |
| --- | --- | --- |
| React / Vite / Three.js | Keep | APPROVED (product) |
| PostgreSQL (Supabase) → SQLite | Target | APPROVED (product) |
| Datenzugriff ORM | Drizzle as **standard candidate** | PROPOSED — **GATE-01** |
| RLS → Policy Service | Central SagaTree Policy Service | APPROVED (product); implementation shape via GATE-01 |
| Auth | Better Auth | PROPOSED — **GATE-02** |
| Realtime | Colyseus preferred candidate | PROPOSED — **GATE-03** |
| Storage | Protected local asset service; optional tus | APPROVED (product) |
| Edge Functions | Node.js/TS services | APPROVED (product) |
| SQL RPCs | TS domain commands + transactions | APPROVED (product); semantics via **GATE-04** |
| AI | Swappable provider adapters | APPROVED (product) |
| LiveKit | Keep | APPROVED (product) |
| Docker Compose | Keep, simplify | APPROVED (product) |
| Tauri | Only before external desktop test phase | PROPOSED — **GATE-05** |

### Architecture Decision Register

| ID | Question | Status | Notes |
| --- | --- | --- | --- |
| ADR-ST-01 | Shared host runtime local+VPS | APPROVED | Product requirement |
| ADR-ST-02 | Domains remain free of React/DB/network | APPROVED | #94 |
| ADR-ST-03 | Authoritative commands on host; one writer per dataset | APPROVED | |
| ADR-ST-04 | GM secrets filtered before HTTP/WS/Storage/AI | APPROVED | |
| ADR-ST-05 | Drizzle+Policy vs ZenStack 3 | BLOCKED | GATE-01 PoC |
| ADR-ST-06 | Better Auth + Colyseus auth | BLOCKED | GATE-02 PoC |
| ADR-ST-07 | Colyseus HTTP vs Hono API | BLOCKED | GATE-03 PoC |
| ADR-ST-08 | Revision/idempotency under SQLite | BLOCKED | GATE-04 PoC |
| ADR-ST-09 | Tauri vs Electron packaging | BLOCKED | GATE-05; deferred |

Until GATE issues are human-APPROVED, dependent issues remain `needs-design` / `blocked` — never `agent-ready`.

## 3. Layer boundaries (must hold)

- `src/domains/**` — pure; no React, DB, network
- Third-party via adapters only
- Authoritative game commands validated on host
- Exactly one write authority per dataset
- No precautionary microservices
- No Tauri during normal browser development

## 4. Wave plan

0. Evidence lock, source inventory, isolated baseline and GATE-01–04 PoCs  
1. Node host, SQLite, auth, permissions and protected asset foundation  
2. API, realtime, session persistence, 18 RPC ports and migration dry-run tooling  
3. Edge/AI/media service contracts and allowlisted dispatcher  
4. The 13 infrastructure adapter ports, after their real RPC/Edge/storage dependencies  
5. Export/import/restore  
6. Security, quality, install, Docker  
7. Controlled cutover/observation/shutdown; deferred desktop GATE-05 after browser-host CI and ops, then MIG-703  

Details: `.qa/intake/local-first-stack-migration-issues.json`.

## 5. Atlas acceptance gap (blocking cutover)

Epic #746/#755 closed with optional live E2E. That is **insufficient** for migration cutover.

| Item | Value |
| --- | --- |
| GitHub | **#770** (single issue — do not duplicate) |
| Local draft id | `ATLAS-LIVE-E2E` |
| Spec | [`.qa/design/atlas-live-e2e-cutover-gate.md`](atlas-live-e2e-cutover-gate.md) |
| Prep wiring | PREP-02 **#775** |
| Cutover lock | `MIG-700` / `MIG-702` `dependsOn` includes `ATLAS-LIVE-E2E` |

Contract mocks / skipped live tests are **not** release proof. The isolated CI implementation is authorized. Acceptance still requires the real browser/persistence/negative paths and a failing regression canary; no production credentials or skipped substitute qualify.

## 5b. Prep contract packs (specification only)

| Pack | Issue | Artifact |
| --- | --- | --- |
| GATE PoC criteria | PREP-03 **#776** | [`.qa/design/gates/`](gates/) |
| Per-RPC contracts | PREP-04 **#777** | [`.qa/intake/rpc-contracts/`](../intake/rpc-contracts/) |
| Edge + infra contracts | PREP-05 **#778** | [`.qa/intake/edge-infra-contracts/`](../intake/edge-infra-contracts/) |

These packs do **not** APPROVE technology choices. Implementation successors stay blocked until human GATE APPROVED + issue-contract completeness (#779).

## 6. Non-goals of prep workstreams

- Starting stack migration host implementation  
- Enabling Atlas live CI with production credentials  
- Selecting libraries without GATE PoC results + human APPROVED  
- Removing Supabase before #770 CLOSED green  

## 7. Verified inventory and readiness

The current plan contains 90 issues: 71 original migration issues, Atlas #770 and 18 RPC children #861–#878. The AST inventory contains 57 frontend RPC names (including two typed dynamic outcome-promotion calls), 24 Edge directories (8 allowlisted workers, 15 unmounted workers, 1 dispatcher) and 13 infrastructure areas.

Source verification, isolated PostgreSQL execution, successor implementation acceptance and human architecture approval are distinct. The isolated legacy database has reproduced permission and runtime defects; these are blockers, not behavior to silently preserve. The four original RPC cluster issues coordinate exclusive child ownership and no longer duplicate implementation.

All migration tickets remain locked for automatic execution. The approval review rejected applying agent-ready because it could activate the runner; authorized preparation and isolated tests proceed without that label. Successors require completed transitive predecessors and evidence. Cyclic adapter imports are recorded as integration peers with frozen ports and a joint MIG-600 gate, rather than mutually impossible start conditions.
