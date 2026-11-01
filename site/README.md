# SagaTree public download site (GitHub Pages)

Static Artcraft-style installer hub. No app login, no Vite build.

## Local preview

```bash
npx --yes serve site
# open http://localhost:3000/download/
```

## Production URL (after Pages is enabled)

`https://iamthamanic.github.io/sagatree/download/`

Root `site/index.html` redirects to `/download/`.

## Deploy

Workflow: `.github/workflows/github-pages.yml`

- Pushes to `main` that touch `site/**` deploy automatically.
- Manual: Actions → **GitHub Pages** → Run workflow.

First-time setup (once, repo admin): Settings → Pages → **Source: GitHub Actions**.

Installer binaries still come from GitHub Releases (Desktop Release pipeline / MIG-703).
