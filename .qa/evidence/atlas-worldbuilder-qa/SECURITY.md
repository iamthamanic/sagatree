# Security review — Atlas Worldbuilder Epic #712 (#724)

All severities listed (AGENTS.md). Non-blocking items remain visible.

Severity: High — cross-owner / player discovery (mitigated).  
Severity: Medium — conflict CAS / RPC overload / localStorage SoT (mitigated).  
Severity: Low — migration gate / prototype residuals.  
Severity: Info — scale labeling / prod migrate ops / CI babysit.

| Severity | Finding | Status / mitigation |
|---|---|---|
| High | Cross-owner map/place read via forged client world id | Mitigated by RLS + JWT RPC owner/membership checks (#717 projection) |
| High | Player discovery of draft/placeholder maps via list or Storage | Mitigated by player-safe list/get + Storage policy (#717); force-redaction path (#102/#105) |
| Medium | Revision conflict silent overwrite on concurrent GM save | Mitigated by `expectedRevision` CAS on upsert (#721 path) |
| Medium | Ambiguous `get_world_atlas_map` overload broke saves / could confuse clients | Fixed by migration 106 (drop 2-arg wrapper) |
| Medium | localStorage as world SoT on product path | Mitigated: controlled WebGL mount (#721); legacy key read-once only |
| Low | Migration apply without gate could create placeholders on wrong world | Gate table defaults `enabled=false` (#723); dry-run required |
| Low | Prototype NAV_CHILDREN still seed geometry cameras | Residual tech debt — tracked; not player authz |
| Low | WebGL tool chrome not fully driven by `ATLAS_TOOL_REGISTRY` | Residual; Canvas path registry-gated (#720) |
| Info | Abstract 0…1000 coords labeled as % not m/km | Intentional until calibration (#722) |
| Info | Prod migrations 103–107 not auto-applied by this epic | Operator must apply on deploy targets; no auto production deploy |
| Info | Browser E2E CI occasionally long-running | Merge relied on Test Gate + Composition; local Playwright matrix attached |

## Negative expectations (must fail closed)

- Non-editor must not receive unredacted generator_meta / draft maps
- Cross-owner upsert/get must 42501 / empty
- Unlocated maps must not invent political geography for LOD drill
