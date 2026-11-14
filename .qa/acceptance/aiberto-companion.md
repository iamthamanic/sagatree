# Acceptance — aiberto-companion

Epic acceptance skeleton. Child slices own detailed checklists; this file tracks epic-level exit criteria.

## Design

- `.qa/design/aiberto-companion.md`

## Release A (AIB-01…03)

- [x] Deterministic Core rulebook index + pure shared search (T-001/T-002) — AIB-01
- [x] EB pilot Doc↔Domain (T-010) for one claim — AIB-01
- [x] Shell companion mounts once; editor/route preserved (SCN-001) — AIB-02
- [x] Desktop dock+resize; Phone sheet; AU-CONTENT-WIDTH / 320px (SCN-002) — AIB-02
- [x] Offline TOC/search/source without LLM/Host (SCN-004) — AIB-02
- [x] Section shows stable ID, version/hash, normativity (SCN-005) — AIB-02
- [x] ORC/license notice visible in Rulebook UI (Q-001) — AIB-02
- [x] Composition gate + `npm run test-gate` for A slice(s) — AIB-01/02/03
- [x] Phase-A Playwright + 320px + Live non-interference (T-005/T-011) — AIB-03
- [x] NFR-001 offline search latency budget gated — AIB-03

## Release B (AIB-04…05)

- [x] Text inference port in `modules/ai` (media catalog unchanged) — AIB-04
- [x] `aiberto-ask`: evidence gate + citation validation (SCN-006/007) — AIB-04
- [x] Better Auth / host session; no secrets in FE (SCN-009) — AIB-04
- [ ] Chat UI streaming; degradation; chat RAM-only (SCN-008/019) — AIB-05
- [ ] Chat tab only when capability enabled — AIB-05

## Release C1 (AIB-06)

- [ ] Static tool registry; unknown tools DENY
- [ ] Character tools use owned ports only
- [ ] Navigate allowlist only; Tool-Activity cards
- [ ] Negative AuthZ suite for cross-owner

## Release C2 (AIB-07)

- [ ] Q-003/Q-004 applied; Security review PASS (all severities listed)
- [ ] Preview → confirm → idempotent write (SCN-014–016)
- [ ] Write flag default off

## Release E (AIB-08)

- [ ] MCP uses same registry/policy; separate delegation

## Adaptive UI + Conductor (Live / CE) — epic-level hard gates

Shell-wide companion is classified Live/CE. Shipping slices must not green without these:

- [x] AU device bands (Phone/Tablet/Desktop) + AU-CONTENT-WIDTH (narrow main pane) — AIB-02/03
- [x] Safe areas respected; primary controls ≥44px touch targets — AIB-02/03
- [x] Keyboard focus order + visible Cyan focus ring; sheet/dock dismissible — AIB-02 (dock slider + sheet)
- [x] Loading / error / reconnecting states observable (no silent hang) — Phase A offline (no host hang path)
- [x] CE Performance Mode: companion does not steal focus from live stage; CE-* gates cited in child acceptance — AIB-03
- [x] Offline / degraded host: TOC+search still usable without LLM — AIB-02/03

## Deferred / Non-goals

- AI-GM, embeddings, free-float panel, FE `src/modules`

## Security Coverage (epic)

- Owner-scoped data stays owner-scoped
- Client cannot invent elevated origins or cross-owner FKs
- All severities including Low/Info recorded on each shipping PR
