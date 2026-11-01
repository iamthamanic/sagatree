# Desktop ops (MIG-703)

After **GATE-05 APPROVED** (ADR-ST-09), integrate Tauri + Node sidecar on the
finished browser host under `desktop/`.

## Rules

| Rule | Meaning |
| --- | --- |
| Unlock | `architecture-approvals.json` → `GATE-05.status === APPROVED` (+ evidence on disk) |
| Lifecycle | Per-platform start/stop, restart persistence, sidecar failure; others NOT RUN |
| Bridge | Allowlisted ops only; foreign origin / nonce mismatch → deny |
| Update/rollback | Host state + permissions markers restored from backup |
| Ship | Product/store RELEASE is a **separate** human decision |

## Local proof

```bash
node --experimental-strip-types scripts/mig-703-tauri-integration.self-test.mjs
```

## Non-claims

- Does not add Tauri to the product Vite `package.json` by silence.
- Does not claim linux/win32 packaging when the host only RAN darwin.
- Does not authorize store distribution.
