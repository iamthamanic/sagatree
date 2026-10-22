# Acceptance — stack-migration-mig-012 (#791)

## Intent

Establish a transport-free world repository read port on the host: policy-checked actor context before projection; SQLite-backed adapter; no HTTP/ORM types in `src/domains`; no cross-module private imports.

## Acceptance

- [ ] Authorized world reads preserve id / null / sort / domain errors vs host baseline; no HTTP/ORM types leak into `src/domains`.
- [ ] Non-owner (X) querying O’s world id gets neither the world nor private attributes; empty filter does not widen owner bounds.
- [ ] After persist + host reopen, reads return durable SQLite state (not memory-only stubs).
- [ ] Session/character consumers use the public world read port only — no `world/internal` or `world/persistence` imports; joins via DTOs.
- [ ] Touched files: zero type escape hatches (typed-strict).

## Composition Gate

Proof: `.qa/runs/composition-gate-stack-migration-mig-012.md`
