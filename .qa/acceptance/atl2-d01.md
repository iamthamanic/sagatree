# Feature: ATL2-D01 — Renderer comparison & 3D target decision (#1212)

<!-- atlas-v2-epic: #1196; slice: D01; slug: atl2-d01 -->

## Intent

Compare product custom WebGL runtime, parallel Three.js SpatialViewport, and
historical Unified-Three PoC on Golden cartography; lock **one** productive 3D
target + rollback + degradable graphics presets before Phase D hardening.

## Preconditions

- #1205 Gate B CLEAR; #1211 Gate C CLEAR.

## Happy Path

- [ ] Golden Dornhain canvas ↔ WebGL runtime bridge parity measured
- [ ] Product chrome uses Native3d + prototype-runtime only (no SpatialViewport mount)
- [ ] Decision record in domain + `.qa/design/atl2-d01-renderer-decision.md`
- [ ] Graphics presets high/balanced/lite documented and tested
- [ ] Gate report `.qa/runs/atl2-d01-renderer-decision.md` CLEAR
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] WebGL unavailable → AtlasLite3D software path remains in target runtime
- [ ] Parallel Three viewport stays inventory-only (no product chrome import)

## Security Coverage

- No new auth surface; 3D persist remains host upsert / owner policy

## Composition Gate

SKIPPED — decision/evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-d01.md`)

## Implementation Notes

- Domain: `atlas-renderer-target.ts`
- Self-test: `scripts/atl2-d01-renderer-decision.self-test.mjs`
- Historical PoC: `.qa/research/unified-atlas-renderer-comparison.md`
