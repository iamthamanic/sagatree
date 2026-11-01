# Public download page (`/download`)

Artcraft-style installer landing inside the web app (no login required).

| URL | Behavior |
| --- | --- |
| `/download` | Canonical marketing page |
| `/get` | Alias → same page |

## Behavior

1. Page fetches GitHub `releases/latest` for `VITE_DESKTOP_RELEASES_REPO` (default `iamthamanic/sagatree`).
2. Assets are classified into macOS / Windows / Linux (`.dmg` / `.msi` / `.AppImage`, …).
3. If no release or no installers yet → buttons show **Bald verfügbar**; GitHub Releases link still works.
4. Login screen offers **Desktop herunterladen**.

## Parallel work

This page can ship **before** MIG-703 / signed auto-update. Real Download buttons light up when the Desktop Release workflow publishes the first tagged installers.

See also: Desktop Release pipeline (`docs/ops/desktop-release.md` when that PR is merged).
