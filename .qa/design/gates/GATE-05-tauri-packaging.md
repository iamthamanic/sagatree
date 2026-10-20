# GATE-05 — Tauri + sidecar vs Electron (deferred)

> **Status:** SPEC only — not APPROVED; deferred until browser host parity  
> **GitHub:** #852 / GATE issue #788 · Prep criteria: #776  
> **Blocks:** MIG-703 only — **not** wave-1..6

## Variants

| ID | Approach |
| --- | --- |
| A | **Tauri** shell + Node/sidecar host process (same `server/` binary as Docker) |
| B | **Electron** with embedded or sibling host |

## Reproducible setup (when executed)

1. Package host that serves health + one authenticated read.  
2. Platforms: macOS + Linux minimum; Windows noted.  
3. Measure: cold start, update path, code signing story (notes), SQLite path locations.

## Metrics / PASS criteria

| # | Test | PASS |
| --- | --- | --- |
| 1 | Same host binary as Docker VPS profile | No second backend |
| 2 | Solo mode without network | Works |
| 3 | Secrets not in renderer | Audit |
| 4 | Auto-update threat model documented | Notes |
| 5 | Does not regress browser-dev workflow | AGENTS.md still Vite-first |

## Negative tests

- Renderer process cannot read host DB path or service-role secrets  
- Packaged app cannot silently talk to production URLs by default  
- Update channel mismatch fails closed  

## Decision criteria

Human APPROVED only after wave-6 host+CI green. Prefer A if sidecar reuse is clean.

## On APPROVED

ADR-ST-09; unblock MIG-703.

## Explicit non-decision / timing

**Do not run this PoC during normal browser migration waves.** No Tauri dependency in product `package.json` until APPROVED.
