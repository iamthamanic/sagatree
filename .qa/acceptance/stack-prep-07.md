# Feature: ST-MIG PREP-07 — Dependency graph + runner blockers (#780)

## Intent

Enforce acyclic topo order with `migration-wave-*` / `migration-order-*` labels, sync `Depends on #N`, and apply `agent-blocked` (runner-respected) wherever GATE/design decisions remain open. `needs-design` alone is insufficient.

## Happy Path

- [x] Dependency enforcement plan covers all 72 intake issues
- [x] Wave + order labels applied on GitHub issues
- [x] `Depends on #N` synced; MIG-700/702 include #770
- [x] `agent-blocked` on GATE-dependent / blocked implementation issues
- [x] Prep-check validates enforcement plan + cutover deps

## Composition Gate

- Proof: `.qa/runs/composition-gate-stack-prep-07.md`
