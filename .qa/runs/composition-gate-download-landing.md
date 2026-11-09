# Composition Gate — download-landing

- HEAD_SHA: 37de58566cce6e4f8686d2e1552db4d92cc37d4a
- BASE_SHA: 320551b1db5b989dd9342b25ba837fbf75e7f0b3
- Date: 2026-11-09
- Verdict: CLEAR
- Acceptance tier: product

## Event

Public Journey `/download` (+ `/get`) lists Mac/Windows/Linux installers from
GitHub Releases without login, and Login links into that Journey.

## Hop chain

1. **Producer:** GitHub Releases adapter → classified installer assets
2. **Gate:** domain desktop-release parse/classify (no updater sidecars)
3. **Consumer:** DownloadScreen Journey + Login CTA + optional Pages hub

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | no release assets | disabled „Bald verfügbar“ + GitHub link | pass |
| Invalid/missing | API failure | unavailable copy; GitHub link works | pass |
| Two consumers / crash | Login + /download | both use public domain barrel | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
