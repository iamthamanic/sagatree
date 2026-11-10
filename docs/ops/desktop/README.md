# Desktop ops (MIG-703 → product)

After **GATE-05 APPROVED** (ADR-ST-09) and **MIG-703** isolated contract, product
packaging lives at the app root (`src-tauri/`) under
`releases.DESKTOP-PRODUCT-STORE = APPROVED`.

## Rules

| Rule | Meaning |
| --- | --- |
| Unlock | `architecture-approvals.json` → `GATE-05.status === APPROVED` (+ evidence on disk) |
| Lifecycle | Per-platform start/stop, restart persistence, sidecar failure; others NOT RUN (`desktop/` fixture) |
| Bridge | Allowlisted ops only; foreign origin / nonce mismatch → deny (`desktop/src/bridge.ts`) |
| Update/rollback | Host state + permissions markers restored from backup |
| Ship | Product/store RELEASE authorized (`releases.DESKTOP-PRODUCT-STORE`) — binaries via Desktop Release CI |

## Local proof

```bash
# MIG-703 isolated contract (unchanged)
node --experimental-strip-types scripts/mig-703-tauri-integration.self-test.mjs

# Product packaging readiness + sidecar stand-in
npm run desktop:self-test
node scripts/desktop-release-readiness.mjs   # ready=true

# Dev shell (needs Rust toolchain)
npm run desktop:dev
```

## Product shell

| Path | Role |
| --- | --- |
| `src-tauri/` | Tauri 2 product package (SPA + sidecar spawn) |
| `src-tauri/resources/host-sidecar.mjs` | Prefers `server/` host; else loopback health stand-in |
| `desktop/` | MIG-703 contract fixtures (not the store binary) |

Unsigned draft installers: tag `v*` or Actions → Desktop Release (`dry_run=false`).
Signing / notarization secrets remain optional until public store trust is required.

## Product/Store RELEASE (2026-11-01 evening)

Owner recorded `releases.DESKTOP-PRODUCT-STORE = APPROVED` (explicitly **not**
implied by GATE-05 / MIG-703). Evidence:
`docs/architecture/migration-owner-release-2026-11-01-desktop-product-store.md`.

## Non-claims

- Does not claim signed / notarized / store-listed builds without secrets + store ops.
- Does not claim linux/win32 lifecycle PASS when only darwin RAN in MIG-703 fixtures.
- GATE-05 alone still does not authorize store distribution (use DESKTOP-PRODUCT-STORE).
