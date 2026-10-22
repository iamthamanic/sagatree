# Feature: Starttemplate editor UX (picker icons, Vorlage badge, tab hints)

## Intent
Improve create/editor discoverability for SagaTree starttemplates and presets:
icons + playstyle tooltips in the picker, Vorlage badge in the sticky card header,
and pulsing incomplete-tab hints with hover copy for open validation gaps.

## Happy Path
- [x] Catalog `summaryDe` + Phosphor icon per starttemplate key
- [x] Picker rows show icon + CircleHelp tooltip (no accidental select)
- [x] Editor tracks `appliedVorlage` after starting-template / preset bootstrap
- [x] CardHeader badge with template icon or Bookmark for user presets
- [x] Main/sub tabs with open gaps show pulsing `IncompleteTabHint`
- [x] Presets regression assertions updated
- [x] test-gate PASS

## Composition Gate
- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-starting-template-editor-ux.md`
