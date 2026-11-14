# Composition Gate — atl2-g05

- Issue: #1233
- Feature slug: atl2-g05
- HEAD_SHA: cab551356120cd76efd955009ffc7a64afc149a6
- BASE_SHA: 9009014e3881249ec295cc8dc265108f08c13d04
- Date: 2026-11-14
- Verdict: SKIPPED

## Skip reason

Acceptance protocol / evidence lock for Phase G (Security / Performance /
Adaptive UX / Visual quality) — no new producer→consumer hop; documents
G01–G04 stack CLEAR. The only runtime change in this PR (ATL2-G05 context-restore
fix: `activate3D` drops the client-side product geometry / ocean caches so a new
WebGL engine re-uploads meshes) is renderer-local and adds no backend,
persistence or service hop.

## Event

Gate G CLEAR evidence that owner/player policy, perf/memory budgets, adaptive
workstation states, and golden visual regression integrate for release.

## Hop chain

(none)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM + Player | host party projection | pass |
| Invalid/missing | stranger write / missing PNG | 42501 / E2E FAIL | pass |
| Two consumers / crash | domain + self-test + e2e | agree | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
