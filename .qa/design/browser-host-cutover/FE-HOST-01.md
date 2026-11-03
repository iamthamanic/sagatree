<!-- migration-contract:v2 localId=FE-HOST-01 -->
# FE-HOST-01: Ship Library host dual-path (characters/worlds/looks + Dornhain seed)

## Type

feature

## Intent

Produkt-HTTP und FE-Facades für Bibliothek Charaktere/Welten/Looks inkl. Solo-Dornhain-Seed verdrahten; bestehende WIP-Cutover-Arbeit shippen.

## Goal

Produkt-HTTP und FE-Facades für Bibliothek Charaktere/Welten/Looks inkl. Solo-Dornhain-Seed verdrahten; bestehende WIP-Cutover-Arbeit shippen.

## Non-Goals

- Desktop / Tauri packaging (GATE-05 / #788)
- Unapproved framework substitution
- Production wipe of unrelated tenant data without owner sign-off

## Context

- Epic: Browser Host Cutover (product FE→Host HTTP after MIG ports DONE).
- Architecture: `docs/architecture/host-modular-monolith.md`, `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Dual-path flag: `VITE_SAGATREE_HOST_LIBRARY=1` + `VITE_SAGATREE_HOST_AUTH_URL`.
- Host ports already exist under `server/src/modules/**` / `server/src/application/**`; this slice mounts product HTTP and flips FE facades.
- Predecessor MIG ports/drills are CLOSED; this series is the missing publicActivation/FE cutover.

## Scope

In:
- `server/src/api/library-routes.ts` character/world/look CRUD
- `server/src/bootstrap/ensure-dornhain-default.ts`
- FE: `character-service`, `world-profile-service`, `look-service`, `host-library-http`
- Flag `VITE_SAGATREE_HOST_LIBRARY=1`

Out:
- production data migration tooling rewrite
- unrelated product UX redesign
- GATE-05 desktop packaging

## User Journey

1. Local Admin / solo host boots with Dornhain seeded SQLite.
2. Browser uses host HTTP (credentials cookie / solo loopback actor) for this slice's reads and writes.
3. Same UI journeys work without GoTrue/PostgREST for the covered paths.
4. Foreign/unauthenticated callers get documented DENY (no owner elevation from client claims).

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | Node host + SQLite; Vite on :3004 |
| VPS / Remote Browser | Same host; cookie sessions |
| Desktop (später) | Deferred to GATE-05 |

## Security & Data

- Actor from session / solo loopback only — never client-supplied owner ids.
- Owner-scoped data stays owner-scoped; list all severities including Low/Info.
- CSRF/origin rules for mutations remain fail-closed outside solo loopback allowlist.

## Edge Cases

### Fall 1

- Gegeben: Solo host with Dornhain seed and `VITE_SAGATREE_HOST_LIBRARY=1`
- Wenn: Library list/create/update/delete characters and worlds; create/archive looks
- Dann: Success path returns typed DTOs; no Supabase network calls for covered ops.

### Fall 2

- Gegeben: Request without valid session on remote mode / forged identity headers
- Wenn: Mutation with forged Origin/actor
- Dann: DENY with stable error code; no cross-owner leakage.

### Fall 3

- Gegeben: Empty / missing resource
- Wenn: Fresh solo DB without prior seed is auto-seeded with Dornhain on boot
- Dann: Documented empty list or not-found; UI shows German error/empty state without timeout spinner forever.

## Required Tests

1. Covered happy-path ops succeed against host SQLite without Supabase.
2. Unauthorized / forged identity is DENY.
3. Empty/missing resource produces stable empty/not-found UX.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).
5. `npm run test-gate` green for touched architecture boundaries.

## Acceptance

- [ ] Covered happy-path ops succeed against host SQLite without Supabase.
- [ ] Unauthorized / forged identity is DENY.
- [ ] Empty/missing resource produces stable empty/not-found UX.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [ ] `npm run test-gate` green for touched architecture boundaries.

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Product HTTP + FE dual-path for this slice PASS under host flag. |
| **Acceptance tier** | `feature-integration` |
| **Deferred integration** | Full Supabase removal in FE-HOST-09 |
| **FEATURE VERIFIED** | Browser Library + this slice smoke without Supabase |
| **RELEASE APPROVED** | Explicit human approval only |

## Blockers

- none

Status: **open**

## Runner

- Feature slug: `browser-host-FE-HOST-01`
- Design: `.qa/design/browser-host-cutover/FE-HOST-01.md`
- Labels: `P1`, `agent-ready`, `feature`, `architecture migration`
- Milestone: Browser Host Cutover
- Checks: `npm run test-gate`
