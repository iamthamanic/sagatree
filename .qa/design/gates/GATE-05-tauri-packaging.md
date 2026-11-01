# GATE-05 — Tauri + sidecar vs Electron (deferred)

> **Status:** Tauri+Node sidecar selected; `APPROVED_TO_EXECUTE` PoC fixture PASS (2026-11-01); platform qualification / ship still NOT APPROVED  
> **GitHub:** #852 / GATE issue #788 · Prep criteria: #776  
> **Blocks:** MIG-703 only — **not** wave-1..6  
> **Evidence:** `.qa/evidence/stack-migration-prep/pocs/gate-05` · entry `scripts/stack-migration-pocs/gate-05/check.mjs`

## Variants

| ID | Approach |
| --- | --- |
| A | **Tauri** shell + Node/sidecar host process (same `server/` binary as Docker) |
| B | **Electron** with embedded or sibling host |

## Reproducible setup (when executed)

1. Package host that serves health + one authenticated read.  
2. Platforms: **macOS, Windows and Linux required** for release; no invented pass if untested.  
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

Owner selected Variant A Tauri+Node sidecar on 2026-10-23. After wave-6 host+CI green, execute real three-OS PoC; Electron is fallback only on documented mandatory-criterion failure; release still requires explicit evidence and approval.

## On APPROVED

ADR-ST-09; unblock MIG-703.

## Owner source / timing

[Owner target selection #788](https://github.com/iamthamanic/sagatree/issues/788#issuecomment-6364773974) is implementation direction only, not a verified platform acceptance.

## Explicit non-decision / timing

**Do not run this PoC during normal browser migration waves.** No Tauri dependency in product `package.json` until APPROVED.
