# Composition Gate — stack-migration-mig-601 (#846)

- HEAD_SHA: a0a2a9c4ae4b1896945f834094ec658fa7c5f259
- BASE_SHA: ecc509e45da2a49193fdf162a51b128bcf2fac02
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Ops deliverable: reproducible Node-host Compose under `deployment/` with host-only default and optional `ai` / `media` profiles. Health is green only after SQLite bootstrap + listen. Optional provider credentials stay out of the image; missing keys yield explicit capability errors while core host remains usable. Runbook pins ports, data volume, and backup mount.

## Hop chain

1. Producer: operator `docker compose -f deployment/docker-compose.host.yml up`
2. Bootstrap: `createHost` opens SQLite under `/data` (volume `host-data`)
3. Ready: `/health` → 200 only when `ops.getHealth().ready` after listen
4. Optional: `--profile ai` (ollama) / `--profile media` (marker); env-injected keys
5. Consumer: runbook + self-test parity with native `SAGATREE_DATA_DIR`

## Simulations

### N-actors
N/A (ops surface). Solo/remote identity unchanged from MIG-014/015.

### Invalid/missing
Missing Better Auth secret → Compose env interpolation fails closed. Missing AI encryption / media codecs → `not-configured` / `unsupported`.

### Two consumers / crash
Restart without `-v` keeps `host-data`; fingerprint stable (self-test).

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: live Docker-in-CI → MIG-602/#847; backup drills → MIG-603/#848
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
