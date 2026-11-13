# Composition Gate — atl2-d04

- Issue: #1215
- Feature slug: atl2-d04
- HEAD_SHA: d92395f1273eee3c8391001b2b7dbc568064d28c
- BASE_SHA: bce74cab28e775dc3f99a5c73b6aa4a8e18ac6ea
- Date: 2026-11-13
- Verdict: SKIPPED

## Skip reason

Optional UnifiedCanvasDoc.heightfield field + view mesh — no new producer→consumer hop.

## Event

GM paints raise/lower/smooth heights on the same authoritative map document.

## Hop chain

(none)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | n/a | heightfield SoT | pass |
| Invalid/missing | drop field | legacy parse | pass |
| Two consumers / crash | 2D+WebGL same doc | bridge mirror | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
