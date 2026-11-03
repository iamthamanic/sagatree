<!-- migration-contract:v2 localId=FE-HOST-09 -->
# FE-HOST-09: Default host-only runtime + remove Supabase client from product paths

## Type

feature

## Intent

Host-first Runtime als Default: Produktpfade ohne Supabase Client/GoTrue/PostgREST; tote Dual-Path-Flags und Edge-Aufrufe entfernen oder hart deaktivieren, sodass Solo/Browser nur noch den neuen Stack braucht.

## Goal

Host-first Runtime als Default: Produktpfade ohne Supabase Client/GoTrue/PostgREST; tote Dual-Path-Flags und Edge-Aufrufe entfernen oder hart deaktivieren, sodass Solo/Browser nur noch den neuen Stack braucht.

## Non-Goals

- Deleting historical `supabase/migrations` SQL archive without owner sign-off (may keep as archive)
- GATE-05 desktop packaging
- Production cloud project deletion beyond already executed Dornhain live shutdown tooling

## Context

- Epic: Browser Host Cutover
- Predecessors FE-HOST-01..08 must be CLOSED
- After this slice, `npm run test-gate` must not require a live Supabase for product smoke

## Scope

In:
- Default env / flag semantics: host library on for solo DEV
- Remove or quarantine remaining FE `supabase.from/rpc/storage/functions` product calls
- Document residual archive-only paths
- CI/docs pointers for host-only boot

Out:
- Rewriting entire historical migration SQL
- Tauri packaging

## User Journey

1. Fresh clone + host boot + Vite boots Library without Supabase URL.
2. Core journeys (Library, Editor save, World/Atlas, Session) work host-only.
3. Accidental Supabase import in product path fails architecture/test-gate checks where enforceable.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | Host-only |
| VPS / Remote Browser | Host-only + Better Auth |
| Desktop (später) | GATE-05 |

## Security & Data

- No silent fallback to anon Supabase.
- List all severities including Low/Info for residual surfaces.

## Edge Cases

### Fall 1

- Gegeben: Empty/missing `VITE_SUPABASE_*`
- Wenn: App boots with host flags
- Dann: Covered product journeys work

### Fall 2

- Gegeben: Code path still calling Supabase product API
- Wenn: test-gate / architecture check
- Dann: FAIL or documented allowlist with owner note

### Fall 3

- Gegeben: Legacy bookmark expecting GoTrue reconnect
- Wenn: Host mode
- Dann: No blocking „API verbinden“ for covered journeys

## Required Tests

1. Host-only boot smoke for Library + one write + one session/atlas path covered by predecessors.
2. No required live Supabase for `npm run test-gate` product checks touched here.
3. Residual Supabase usage is allowlisted or removed.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Host-only boot smoke for Library + one write + one session/atlas path covered by predecessors.
- [ ] No required live Supabase for `npm run test-gate` product checks touched here.
- [ ] Residual Supabase usage is allowlisted or removed.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Product runtime host-only for cutover milestone |
| **Acceptance tier** | `feature-e2e` |
| **Deferred integration** | GATE-05 desktop |
| **FEATURE VERIFIED** | Browser host parity proof |
| **RELEASE APPROVED** | Explicit human approval only |

## Blockers

- Depends on #1099 (FE-HOST-07)
- Depends on #1100 (FE-HOST-08)

Status: **open**

## Runner

- Feature slug: `browser-host-FE-HOST-09`
- Design: `.qa/design/browser-host-cutover/FE-HOST-09.md`
- Labels: `P1`, `agent-ready`, `feature`, `architecture migration`
- Milestone: Browser Host Cutover
- Checks: `npm run test-gate`
