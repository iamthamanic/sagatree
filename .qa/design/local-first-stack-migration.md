# Local-first Stack Migration — Design Lock (Prep)

> **Status:** PREP / NOT STARTED  
> **Baseline SHA:** `4bc40a3142811f23f528b17698abc6d674d2ee75`  
> **Authority:** [`docs/architektur-sqlite-based.md`](../../docs/architektur-sqlite-based.md), `AGENTS.md`, `src/ARCHITECTURE.md`  
> **Hard stop:** Do **not** publish GitHub migration issues or start the migration runner without explicit freigabe.

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

0. Evidence lock, architecture, PoCs (GATE-*)  
1. Node host, SQLite, auth, permissions  
2. API, realtime, session persistence  
3. Characters, inventory, world atlas, game systems  
4. Storage, media, functions, AI  
5. Export/import/restore  
6. Security, quality, install, Docker  
7. Tauri, controlled cutover, Supabase shutdown  

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

Contract mocks / skipped live tests are **not** release proof. CI enablement waits on ATLAS-CI-* freigabe in the atlas gate doc.

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
