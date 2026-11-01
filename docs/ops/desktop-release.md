# Desktop release (Mac / Windows / Linux)

How SagaTree ships **installers** after product Tauri exists (MIG-703).  
This is **separate** from Quality Gates (`verify.yml`) and from VPS/host deploys.

## Mental model

| Path | What users get |
| --- | --- |
| Develop / PR | Browser (Vite) + `verify.yml` — no installers |
| Merge to `main` | Code is integrated — desktop users **do not** auto-get it yet |
| **Desktop Release** | Tag `vX.Y.Z` → CI builds `.dmg` / `.msi` / AppImage → GitHub Release |
| Later | In-app auto-update (Tauri updater + signing) |

Browser/VPS users follow host deploy docs. Desktop downloaders follow this page.

## Pipeline

Workflow: [`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml)  
Readiness probe: [`scripts/desktop-release-readiness.mjs`](../../scripts/desktop-release-readiness.mjs)

```text
feature/fix → PR → verify + ECC → merge main
                         │
                         ▼
              tag v1.2.3  (or Actions → Run workflow)
                         │
                         ▼
              Desktop Release
                readiness → test-gate → matrix build → GitHub Release assets
```

### Until MIG-703 (current)

- Product `src-tauri/` is **absent** (GATE-05 was PoC-only).
- `workflow_dispatch` with default `dry_run=true` → readiness + deferred **succeeds** (pipeline wired).
- Pushing a `v*` tag → **fail-closed** (no fake empty release).

### After product Tauri

1. Bump `package.json` / Tauri version as needed.
2. Ensure `main` is green.
3. Tag and push:

```bash
git checkout main && git pull
git tag -a v0.2.0 -m "SagaTree v0.2.0"
git push origin v0.2.0
```

4. Watch **Desktop Release** on GitHub Actions.
5. Confirm assets on the GitHub Release page.

Or: Actions → **Desktop Release** → Run workflow → `dry_run=false` (draft-oriented; prefer tags for real ships).

## Bugfix / feature → users

1. Fix or feature lands on `main` via normal PR.
2. When desktop users should receive it: cut a **patch** (`v1.2.4`) or **minor** (`v1.3.0`) tag.
3. CI attaches new installers; new downloads get that version.
4. Once updater + signing secrets are configured, installed apps pull the same release automatically.

Do **not** release on every merge unless you explicitly want that velocity.

## Secrets (later)

Configure when public signed builds are required (see Tauri signing docs):

- Apple notarization: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- Updater: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Windows Authenticode as applicable

Unsigned internal drafts can ship before certificates exist; store / SmartScreen trust needs signing.

## Related

- Host update/rollback (server binary): [`host/update-rollback.md`](host/update-rollback.md)
- GATE-05 PoC: `.qa/design/gates/GATE-05-tauri-packaging.md`
- Product unlock: MIG-703
