# Composition Gate — stack-migration-mig-401 (#817)

- HEAD_SHA: PLACEHOLDER_HEAD
- BASE_SHA: PLACEHOLDER_BASE
- HOP_DIGEST: PLACEHOLDER_DIGEST
- Date: 2026-10-28
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Legacy Edge `ai-gm` remains dispatcher-unmounted. Host quarantine pins 404, activation deny, action/quota/membership ordering, and NDJSON stream framing without mounting a public route or cutting over production.

## Hop chain

1. Producer: Isolated self-test / future reviewed successor (not mounted)
2. Authorize: Dispatcher deny + `AI_GM_PUBLIC_ACTIVATION_AUTHORIZED === false`; membership before quota/LLM when invoked in fixture
3. Persist: No durable AI-GM host write path in this slice (quota characterization in-memory only)
4. Consumer: Host notFound 404; production clients still see Edge dispatcher 404 until RELEASE APPROVED

## Simulations

### N-actors
Host probes for /ai-gm and /functions/v1/ai-gm return 404 with or without Authorization; allowlist excludes ai-gm.

### Invalid/missing
Action >5000 rejected; membership deny precedes rate-limit stage; 13th default quota consume denies.

### Two consumers / crash
No public worker; activation flag remains false; NDJSON framing helpers stable.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host AI-GM + MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
