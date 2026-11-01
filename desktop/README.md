# Desktop package (MIG-703)

Tauri + Node sidecar **integration scaffold** after GATE-05 `APPROVED`.

| In | Out |
| --- | --- |
| Bridge allowlist + lifecycle fixtures | Product store ship |
| Host data update/rollback drill | Adding Tauri to product `package.json` without RELEASE |
| Platform RUN / NOT RUN matrix | Silent Electron default |

Entry proof: `node --experimental-strip-types scripts/mig-703-tauri-integration.self-test.mjs`

Ops: `docs/ops/desktop/`
