# Composition Gate — stack-migration-mig-423 (#839)

- HEAD_SHA: cbf1a2ce98f4e3c2cd83bc1368bbe8ddb233f35c
- BASE_SHA: 3a74b497afa514497715eb46026ce41865070459
- HOP_DIGEST: spellbook-edge-quarantine-v1
- Date: 2026-10-29
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Host gains Edge `spellbook` Map quarantine characterization while preserving external/host 404 for Edge worker paths. Public activation stays false; no production cutover.

## Hop chain

1. Producer: Quarantine store (in-memory Maps for spells/spellbooks + SRD seed)
2. Authorize: None in legacy worker — path characterId / body fields are not authority; host routes stay 404
3. Persist: Process-local Maps only (`SPELLBOOK_EDGE_MAP_IS_DURABLE=false`)
4. Consumer: Self-test fixtures; production clients must not call this worker

## Simulations

### N-actors
SRD seed per store; custom spells and spellbooks do not cross stores (cross-process loss).

### Invalid/missing
All Edge `/spellbook`, `/spells`, and `/functions/v1/spellbook` methods → 404 on host route registry.

### Two consumers / crash
Character membership store sources do not import quarantine; activation remains false; cast burns slots without known/prepared checks (legacy parity).

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + ownership/class checks
