# Acceptance — MIG-014/015 security hardening (follow-up to #909 / #911)

## Scope

Follow-up hardening for Codex P1/P2 findings merged with PR #909 (MIG-014) and #911 (MIG-015). No architecture change.

## Acceptance criteria

- [x] Wildcard bind (`0.0.0.0` / `::`) requires explicit `SAGATREE_AUTH_BASE_URL` (no silent loopback auth URL).
- [x] Trusted origins are normalized to `URL.origin` (no trailing slash); cross-origin frontends in the allowlist succeed.
- [x] Credentialed CORS: preflight + exact `Access-Control-Allow-Origin` + `Credentials=true`; never `*`.
- [x] Better Auth handler promise is awaited at the request boundary (no discarded rejections).
- [x] WebSocket probe sends a protocol close frame (opcode 0x8) before TCP end.
- [x] Remote-mode `POST /v1/ping` requires cookie session; unauthenticated / forged solo claims do not mutate.
- [x] Solo account-link store persists via temp → fsync → rename.
- [x] Regression coverage in `scripts/mig-014-better-auth-host.self-test.mjs` and `scripts/mig-015-solo-local-identity.self-test.mjs`.

## Composition Gate

See `.qa/runs/composition-gate-mig-014-015-security-hardening.md`.
