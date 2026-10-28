# Dependency Maintenance — tailwindcss 4.1.12 → 4.3.3

- PR: #981
- Kind: minor (4.1.x → 4.3.3)
- Also aligned: `@tailwindcss/vite` 4.1.12 → 4.3.3 (plugin pins matching `tailwindcss` / `@tailwindcss/node` / `@tailwindcss/oxide`)
- Consumers: Vite CSS pipeline (`@tailwindcss/vite`), product UI under `src/` via Tailwind utilities

## Compatibility notes

- Same major (v4); release notes are fix/polish oriented (watch/poll, Preflight iframe focus, theme()/shadow opacity, nesting).
- `@tailwindcss/vite@4.3.3` declares dependency on `tailwindcss@4.3.3` — leaving the plugin on 4.1.12 would desync oxide/node.
- Kodus ignores `package.json` / `package-lock.json`; this evidence file is the reviewable surface for upgrade rationale and verification.
- No product refactor required for this minor; CSS build succeeded locally with generated stylesheet.

## Verification

- [x] `npm install` (0 vulnerabilities; tree: tailwindcss / @tailwindcss/vite / node / oxide all 4.3.3)
- [x] `npm run build` (Vite build OK; `index-*.css` emitted)
- [x] `npm run typecheck` (skipped — no changed TypeScript files)
- [ ] PR CI: Test Gate / Composition Gate / Browser E2E
- [ ] ECC Merge Gate after Kodus Complete or APPROVED-on-HEAD fallback

## Non-claims

No major Tailwind rewrite, no `--legacy-peer-deps` / `--force`, no disabled tests, no production cutover.
