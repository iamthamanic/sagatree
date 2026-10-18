# Debug Report — saga-karte-orte-tab-styleguide

**Date:** 2026-10-17  
**Project:** sagatree  
**Shell:** web  
**Repro grade:** full  

---

## Summary

Atlas prototype `SHELL_CSS` injected unlayered global `button { color: inherit }` (and `html,body` color), so SagaTree `TabsTrigger` text utilities could not paint `primary-foreground` on active Welt/Karte/Orte tabs while the map was mounted.  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Active tabs use cyan fill + dark text (`text-primary-foreground` in `.dark`) per THEME_GUIDE |
| **Actual** | On Welt → Karte/Orte, active tab labels stayed light/white; icons sometimes dark (SVG nested utility still applied) |
| **Steps** | 1. Open `/sagas/SA-E979J/world/map` 2. Observe active Welt + Karte tabs |

---

## Reproduction

- **Command / URL:** `http://localhost:3004/sagas/SA-E979J/world/map`
- **Playwright spec:** n/a (browser MCP + CDP)
- **Result:** reproduced
- **Hard path:** no

---

## Evidence

### Console

No app exceptions required for root cause.

### CDP (before fix)

- Active `[data-saga-nav=world]` / `[data-saga-world-sub=map]`: `color: rgb(241, 245, 249)` (foreground)
- SVG on same triggers: `color: rgb(15, 23, 42)` (nested utility worked)
- Unlayered rule present: `button { cursor: pointer; color: inherit; }` from `data-atlas-prototype-style`
- Source: `atlas-prototype-runtime.mjs` `SHELL_CSS` (also in `public/atlas-prototype-3d.html` standalone)

### CDP (after fix)

- Active Welt / Karte: `color: rgb(15, 23, 42)`, `background: rgb(6, 182, 212)`
- Inactive tabs: `color: rgb(148, 163, 184)` (muted)
- Atlas style uses `@scope (#atlas3d)`; no unlayered global `button` color rule

---

## Prior art

- [x] Repo grep: `atlas-prototype-runtime.mjs` SHELL_CSS; `src/shared/ui/tabs.tsx`
- [x] THEME_GUIDE Tabs: `bg-primary text-primary-foreground`
- [ ] GitHub issue/PR: n/a
- [ ] LightRAG: n/a

---

## Root cause

Embed path mounts prototype CSS into the document. Unlayered `button { color: inherit }` beats `@layer utilities` tab text classes (cascade layers). That only surfaces when Karte/Orte mount the atlas — matching the reported surfaces.

**Fix attempts this bug:** 1  

---

## Suggested fix (applied)

1. `scopeShellCssForEmbed()` + `prefixSelectorsWithAtlasRoot()` — all prototype selectors under `#atlas3d`; strips `button{color:inherit}` and `html,body` resets (no `@scope` dependency).
2. Unlayered `!important` tab rules in `globals.css` (trigger + span + svg + `-webkit-text-fill-color`).
3. `tabs.tsx`: `data-[state=active]:!text-primary-foreground`.
4. Atlas skin: hex tokens via `var(--*)` (not invalid `hsl(var(--hex))`); hide prototype disclaimer.
5. Regression: `scripts/atlas-prototype-3d-embed.self-test.mjs`.

**Verify (2026-10-17 retest):** Orte/Welt active → `color: rgb(15, 23, 42)` on `rgb(6, 182, 212)`; poison gone; evidence `.qa/tmp/atlas-tabs-dark-text-verified.png`.

**Next step:** hard-refresh browser if cache serves old CSS

---

## Notes

- Standalone `public/atlas-prototype-3d.html` keeps global resets (full-page prototype).
- Vision screenshot captions may misread dark-on-cyan as white; trust computed styles.
