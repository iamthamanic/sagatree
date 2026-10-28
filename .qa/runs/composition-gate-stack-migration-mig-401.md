# Composition Gate — stack-migration-mig-401 (#817)

- HEAD_SHA: b8215161d367fa8cc701903a25783a1da255913f
- BASE_SHA: 6e04f27bb14675a4498945aadc37f480904acaf8
- HOP_DIGEST: 2519cb470e649d1cfa5943ba4fe5dee8c07fe342bd19cbca06877ff19634146a
- Date: 2026-10-28
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Legacy Edge `ai-gm` remains dispatcher-unmounted. Host quarantine pins 404, activation deny, action/quota/membership ordering (12/60s window reset + expired-entry prune), NDJSON stream framing (chunk-boundary + non-stream metadata), and failed durable state-write without mounting a public route or cutting over production.

## Hop chain

1. Producer: Isolated self-test / future reviewed successor (not mounted)
2. Authorize: Dispatcher deny + `AI_GM_PUBLIC_ACTIVATION_AUTHORIZED === false`; membership before quota/LLM when invoked in fixture
3. Persist: No durable AI-GM host write path in this slice (quota characterization in-memory with window reset + expired-entry prune; state writes fail closed)
4. Consumer: Host notFound 404; production clients still see Edge dispatcher 404 until RELEASE APPROVED

## Simulations

### N-actors
Host probes for /ai-gm and /functions/v1/ai-gm return 404 with or without Authorization; allowlist excludes ai-gm.

### Invalid/missing
Action >5000 rejected; membership deny precedes rate-limit stage; 13th default quota consume denies; after 60s window the same user is allowed again.

### Two consumers / crash
No public worker; activation flag remains false; NDJSON multi-chunk + line-buffer framing helpers stable; durable state-write attempts return activation-denied.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host AI-GM + MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
