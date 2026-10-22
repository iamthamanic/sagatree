# Composition Gate — gate-02-cookie-a-r01 (#785 R01 fix)

- HEAD_SHA: ff20eeba580ac9cb7a039fb1486ac7a82b1fb216
- BASE_SHA: d4b7ebf3df98b1ffd12448c86bd0f01e3e8db2e4
- Date: 2026-10-22
- Verdict: SKIPPED

## Event

PoC-only cookie-preferred GATE-02 A profile under `scripts/stack-migration-pocs/gate-02-03/`: disable Better Auth opaque bearer plugin, strip browser-facing session bearer fields / `set-auth-token`, preserve HttpOnly `Set-Cookie`, keep JWT issuance for Node Variant B. Evidence + ADR draft updated. No product `src/` / `server/` composition path changed. Architecture approval remains NOT APPROVED.

## Hop chain

N/A — isolated candidate fixture; no production auth/session composition hops in this change.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Chromium A-1-browser | Cookie-only isolation PASS | `node check.mjs --check` | pass |
| Mandatory A rows | All PASS; B/1 may NOT RUN | report criteria matrix | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Does not set `GATE-02: APPROVED`. Does not change product Better Auth / Colyseus wiring. Does not close HTTPS/Tauri/B-browser JWT gaps.
