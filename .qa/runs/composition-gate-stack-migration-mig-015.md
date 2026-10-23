# Composition Gate — stack-migration-mig-015 (#794)

- HEAD_SHA: (filled at PR tip)
- BASE_SHA: b139fed9af37a7da450844d276dc1a5aaeacd4e3
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Solo/loopback host identity is persisted in `dataDir/host-identity.json` and remains a separate trust domain from Better Auth remote sessions. Forged `x-solo-user` / `localIdentity` claims never authorize remote HTTP/WS. Solo→remote ownership reuse requires an explicit durable account-link; missing link yields `ACCOUNT_LINK_REQUIRED` (not silent full access). Explicit solo mode cannot bind non-loopback (`SOLO_REQUIRES_LOOPBACK`).

## Hop chain

1. Producer: Host bootstrap → `ensureSoloIdentityFile` (stable `solo-<uuid>` per dataDir)
2. Solo loopback routes (`/health`, `/v1/ping`) → `resolveSoloActor` only (never remote elevation)
3. Remote-facing entry (`/api/whoami`, `/api/world-touch`, `/api/project-touch`, `/v1/session-ws`) → `detectForgedSoloIdentityClaims` then cookie session resolve
4. Consumer A: Policy `world.edit` with optional `linkedSoloActorIds` from durable link store
5. Consumer B: `POST /api/solo/link-account` (cookie session + confirm + matching host solo id) writes link store; subsequent world-touch may mutate

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors / restart | Same solo actorId + world ownership after restart | mig-015 self-test Fall 1 | pass |
| Invalid/missing | Forged headers/body; solo+0.0.0.0; unlink remote world-touch | SOLO_IDENTITY_FORBIDDEN / SOLO_REQUIRES_LOOPBACK / ACCOUNT_LINK_REQUIRED; no mutation | pass |
| Two consumers / crash | Link store + policy both required for ownership transfer | world-touch deny until link; allow after explicit link; identity file unchanged | pass |
| Foreign link | Claimed soloActorId ≠ host identity | ACCOUNT_LINK_MISMATCH; no link write privilege | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Production cutover / Supabase Auth shutdown NOT approved. Full Colyseus product rooms and HTTPS platform Secure-cookie proofs remain later tickets. Ambient CI reds (Atlas E2E, PG baseline security) are out of scope for this freigabe.
