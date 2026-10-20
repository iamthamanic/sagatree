# Issue #747 — atlas-followup-webgl-db-tree

## Phases
- setup: seeded acceptance, branched from main@f7eea5e6
- implement: buildAtlasWebglNavTree + product externalNav bridge
- verify: test-gate PASS; webgl-db-tree-check PASS (Playwright mount/select/empty)
- composition-gate: CLEAR
- review: ACCEPT
- ecc-check: READY (test-gate + composition + typed-strict)

## Notes
Product 3D `#nav` driven by DB WorldNodes; demo NAV_CHILDREN only when externalNav absent.
