# ATL2-R01 Renderer Hybrid Decision

- Issue: #1266
- HEAD: `8cb99e7a153080a784284b2ecd8538ce1151ebd9`
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
| frame p50 ms | 16.9 | 16.7 |
| frame p95 ms | 41.8 | 18.5 |
| JS heap MB | 9.54 | 9.54 |

## Decision

**NO-GO** for R02–R05 Three product backend. Follow-ons #1267–#1270 must not auto-start.
See `.qa/design/atl2-r01-renderer-decision.md`.
