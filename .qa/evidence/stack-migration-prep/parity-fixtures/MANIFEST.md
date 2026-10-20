# Parity fixture manifest (PREP-08 #781)

## Pack: `dornhain-donalu`

Status: **SPEC** — seed scripts not executed in this prep PR.

### Required entities

- users: gm, p1, p2 (synthetic ids)  
- project/saga binding + membership roles  
- world nodes: atlas root, Donalu place, child structures  
- NPCs: 1 public, 1 `gm_only` secret  
- maps/assets: 1 public, 1 secret  
- characters + inventory for p1/p2  
- session + runtime revision + combat + dice sample  
- invite code (non-escalating) for negative join tests  

### Seed rules

- No production data  
- Deterministic IDs in fixture JSON  
- Reloadable: wipe schema → seed → PAR-* suite  

### Regression canary

File `canary-permission-flip.md` documents the single toggle used by PAR-10.
