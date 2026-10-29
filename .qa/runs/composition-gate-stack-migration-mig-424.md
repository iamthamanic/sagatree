# Composition Gate — stack-migration-mig-424 (#840)

- HEAD_SHA: fd5fcd4f0f5fd54a8791478263bd8e40e8b7ec68
- BASE_SHA: 15f0348e6c114188c4d577fec91e2e7a303a0886
- HOP_DIGEST: world-edge-quarantine-v1
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Host gains Edge `world` Map quarantine characterization while preserving external/host 404 for Edge worker paths. Public activation stays false; durable world_profiles/atlas/places APIs remain separate. No production cutover.

## Hop chain

1. Producer: Quarantine store (in-memory Map for worlds + nested locations/events/factions/time/weather)
2. Authorize: None in legacy worker — body fields are not authority; host routes stay 404
3. Persist: Process-local Map only (`WORLD_EDGE_MAP_IS_DURABLE=false`)
4. Consumer: Self-test fixtures; production clients must not call this worker

## Simulations

### N-actors
One store holds worlds; a second store starts empty (cross-process loss).

### Invalid/missing
All Edge `/world`, `/worlds`, and `/functions/v1/world` methods including settings/clock/weather → 404 on host route registry.

### Two consumers / crash
Durable world write/atlas stores do not import quarantine; activation remains false.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
