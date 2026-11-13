# ATL2-R01 Renderer Hybrid Decision

- Issue: #1266
- HEAD: `04f49230ba7e1aa7076554f6fb9737d3d02334df`
- Verdict: **NO-GO**
- Productive 3D owner: `custom-webgl-prototype-runtime`
- Date: 2026-11-13

## Checks

- inventory
- adr-no-go
- single-product-mount
- browser-measure
- typed-strict

## Comparison (summary)

| Metric | Custom-WebGL | Three inventory |
|----------|-------------|-----------------|
| frame p50 ms | 16.7 | 16.7 |
| frame p95 ms | 48 | 17.1 |
| JS heap MB | 9.54 | 9.54 |

## Decision

**NO-GO** for R02–R05 Three product backend. Follow-ons #1267–#1270 must not auto-start.
See `.qa/design/atl2-r01-renderer-decision.md`.
