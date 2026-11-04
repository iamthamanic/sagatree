# Acceptance — aiberto-companion

Epic acceptance skeleton. Child slices own detailed checklists; this file tracks epic-level exit criteria.

## Design

- `.qa/design/aiberto-companion.md`

## Release A (AIB-01…03)

- [ ] Deterministic Core rulebook index + pure shared search (T-001/T-002)
- [ ] EB pilot Doc↔Domain (T-010) for one claim
- [ ] Shell companion mounts once; editor/route preserved (SCN-001)
- [ ] Desktop dock+resize; Phone sheet; AU-CONTENT-WIDTH / 320px (SCN-002)
- [ ] Offline TOC/search/source without LLM/Host (SCN-004)
- [ ] Section shows stable ID, version/hash, normativity (SCN-005)
- [ ] ORC/license notice visible in Rulebook UI (Q-001)
- [ ] Composition gate + `npm run test-gate` for A slice(s)

## Release B (AIB-04…05)

- [ ] Text inference port in `modules/ai` (media catalog unchanged)
- [ ] `aiberto-ask`: evidence gate + citation validation (SCN-006/007)
- [ ] Better Auth / host session; no secrets in FE (SCN-009)
- [ ] Chat UI streaming; degradation; chat RAM-only (SCN-008/019)
- [ ] Chat tab only when capability enabled

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

## Deferred / Non-goals

- AI-GM, embeddings, free-float panel, FE `src/modules`

## Security Coverage (epic)

- Owner-scoped data stays owner-scoped
- Client cannot invent elevated origins or cross-owner FKs
- All severities including Low/Info recorded on each shipping PR
