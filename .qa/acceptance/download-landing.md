# Acceptance — Public desktop download landing

## Intent

Ship a public Journey page at `/download` (alias `/get`) where non-technical
users can get Mac / Windows / Linux installers. The page must work **without
login**, degrade honestly when no GitHub Release assets exist yet, and stay
usable on Phone/Tablet/Desktop (AU Journey gates). Parallel to MIG-703 / signed
auto-update — does not require product Tauri to merge.

## Surface class

Journey · bands Phone / Tablet / Desktop · AU-01, AU-02, AU-03, AU-07, AU-09,
AU-CONTENT-WIDTH.

## Happy path

- [x] `/download` and `/get` render without AuthGate login.
- [x] Three platform rows (macOS, Windows, Linux) with ≥44px primary actions.
- [x] When GitHub `releases/latest` has classified assets → Download links enabled.
- [x] When no release / empty assets → disabled „Bald verfügbar“ + GitHub Releases link.
- [x] Login screen links to `/download`.
- [x] Domain classifier + parse helper covered by `scripts/desktop-release-assets.self-test.mjs`.

## Edge cases

- [x] Updater sidecars (`.json` / `.sig`) are not offered as installers.
- [x] Network/API failure → unavailable copy, GitHub link still works.
- [x] Mobile copy states Store apps are later; browser play against a host.

## Regression

- [ ] Auth flows for `/` unchanged.
- [ ] `npm run test-gate` includes desktop-release asset self-test.
- [ ] Architecture boundary: download area uses shell public barrel only.

## Assumptions

- Installer binaries come from GitHub Releases (`VITE_DESKTOP_RELEASES_REPO`, default `iamthamanic/sagatree`).
- First real assets appear after Desktop Release pipeline + MIG-703 product Tauri.

## GitHub Pages hub

- [x] Static site under `site/download/` with Mac/Windows/Linux rows.
- [x] Workflow `.github/workflows/github-pages.yml` deploys `site/` via Actions.
- [ ] Repo Settings → Pages → Source GitHub Actions (human, once).
