# Public download pages

SagaTree has two download surfaces; **GitHub Pages is the primary marketing hub**.

## 1. GitHub Pages (canonical for Non-Tech Users)

| URL | Notes |
| --- | --- |
| `https://iamthamanic.github.io/sagatree/download/` | After Pages + Actions deploy |
| Source | `site/download/` |
| Deploy | `.github/workflows/github-pages.yml` |

Enable once: repo **Settings → Pages → Source: GitHub Actions**.

## 2. In-app route (optional)

| URL | Notes |
| --- | --- |
| `/download` (+ `/get`) | Same discovery UX inside the Vite app, no login |
| Login CTA | „Desktop herunterladen“ |

## Behavior (both)

1. Fetch GitHub `releases/latest` for `iamthamanic/sagatree`.
2. Classify `.dmg` / `.msi` / `.AppImage` (etc.).
3. No assets yet → **Bald verfügbar** + link to Releases.
4. Real buttons light up after Desktop Release + MIG-703 publish installers.
