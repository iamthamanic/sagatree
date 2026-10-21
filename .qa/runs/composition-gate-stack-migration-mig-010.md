# Composition Gate — stack-migration-mig-010 (#789)

- HEAD_SHA: 7de86b9cfba1001942f88f87f196032a0cc37106
- BASE_SHA: cb6a7f7a2c241f8f951649447f17e7476e1a931e
- Date: 2026-10-21
- Verdict: CLEAR

## Event

Operator starts the local Node host in solo mode with `SAGATREE_DATA_DIR`; after listen succeeds the host exposes `/health` readiness and accepts a single `/v1/ping` mutation into the data directory; SIGTERM rejects further mutations while retaining confirmed identity/ping files.

## Hop chain

1. Producer: `server/src/bootstrap/main.ts` → `createHost` (config + identity/permissions/ops factories)
2. Use-case: `application/health` reads ops health projection (no secrets)
3. HTTP: `http/route-registry.ts` authorizes via permissions, serves `/health` and `/v1/ping`
4. Persistence stub: append-only `ping-log.jsonl` + `host-identity.json` under the configured data dir (no ORM yet)

Cardinality: one host process ↔ one data dir fingerprint; one solo actor id per data dir; one ping line per accepted POST.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | One solo actor per data dir; second process on same dir reuses identity fingerprint | `host-identity.json` rewritten only when missing; fingerprint is SHA of dataDir path | pass |
| Invalid/missing | Missing/unwritable data dir, bad port, or busy bind → process exit ≠ ready | `loadConfig` fail-closed; `listen` EADDRINUSE rejects start; health never reported ready | pass |
| Two consumers / crash | Shutdown rejects new pings; prior confirmed ping lines remain; second start does not invent a new data dir | `acceptMutations=false` before close; ping-log + identity retained on restart | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

GATE-02..05 and production cutover are not approved. Drizzle schema lands in successors under ADR-ST-05.
