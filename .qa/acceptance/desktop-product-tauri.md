# Acceptance — Desktop product Tauri (unsigned ship path)

## Intent

Activate **product** Tauri packaging at the app root (`src-tauri/` + `@tauri-apps/*`)
so Desktop Release readiness flips `ready=true` and unsigned draft installers can
build under `DESKTOP-PRODUCT-STORE` APPROVED. GATE-05 PoC / MIG-703 `desktop/`
contracts stay; this is the product shell that wraps the Vite SPA and boots a
Node host sidecar on loopback.

## Preconditions

- GATE-05 APPROVED; MIG-703 DONE (`desktop/` isolated contract).
- `releases.DESKTOP-PRODUCT-STORE.status === APPROVED`.
- Host cutover (#1135) complete — product sidecar targets `server/` bootstrap.
- Signing / notarization secrets still optional (unsigned internal drafts OK).

## Happy path

- [ ] `src-tauri/` exists with `tauri.conf.json`, Cargo crate, icons, capabilities.
- [ ] Root `package.json` includes `@tauri-apps/cli` and/or `@tauri-apps/api`.
- [ ] `node scripts/desktop-release-readiness.mjs` reports `ready=true` and version from `package.json`.
- [ ] App loads Vite `build/` (`frontendDist`) / `devUrl` on port 3004 in tauri-dev.
- [ ] On launch, Rust spawns the product host sidecar on `127.0.0.1` (real `server/` when present; health stand-in otherwise) and tears it down on exit.
- [ ] Docs (`docs/ops/desktop-release.md`, `docs/ops/desktop/README.md`) describe product packaging + unsigned draft path.
- [ ] Composition tip-pin CLEAR for this HEAD; `npm run test-gate` green.

## Edge cases

- [ ] Packaged app without bundled `server/` → sidecar stand-in listens locally; no crash; no secret leak endpoint.
- [ ] Sidecar boot failure → app still opens SPA; failure logged (does not invent elevated origins).
- [ ] Desktop Release `v*` tag while ready → matrix may run; signing secrets remain optional.
- [ ] GATE-05 PoC under `.qa/evidence/.../gate-05` and MIG-703 `desktop/` remain unchanged contracts.

## Regression

- [ ] Browser / VPS host path unchanged (`npm run host:dev`).
- [ ] No second runtime / no Supabase reintroduction.
- [ ] Architecture boundary check still passes (`src-tauri` is product packaging, not a forbidden frontend dump).
- [ ] Prior Desktop Release fail-closed behavior preserved when readiness would be false (probe still honest).

## Security Coverage

- Owner-scoped host data stays on loopback; sidecar must not expose host secrets to the renderer (`/secrets-leak-probe` → 404).
- Client/webview must not invent elevated origins or cross-owner FKs.
- All severities listed in review (Low/Info included); unsigned builds are not claimed as store-trusted.

## Assumptions

- First ship is **unsigned draft** installers; Apple/Windows signing is follow-up secrets work.
- Full Node runtime + `server/` binary packaging into `externalBin` can land in a follow-up once three-OS host artifacts exist; this PR unlocks readiness and the shell+sidecar contract.
- Version remains `package.json` `0.1.0` until an explicit tag cut.

## Implementation Notes

- Added product `src-tauri/` (Tauri 2 shell, icons from `public/favicon.png`, capabilities).
- Root deps: `@tauri-apps/api`, `@tauri-apps/cli`; scripts `desktop:dev` / `desktop:build` / `desktop:self-test`.
- `resources/host-sidecar.mjs` prefers `server/` host; else loopback stand-in with `/health` + secrets probe 404.
- Rust `lib.rs` spawns/kills the sidecar; SPA continues if spawn fails.
- `scripts/desktop-product-tauri.self-test.mjs` wired into `test-gate` after MIG-703.
- Docs updated for ready=true / unsigned draft path. Signing + full `externalBin` host packaging deferred.
