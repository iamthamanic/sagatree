# Acceptance — ATL3-V01 visueller Qualitätsvertrag (#1295)

**Slug:** `atl3-v01-visual-contract` · **Epic:** #1294 · **Design:** `.qa/design/atl3-procedural-fantasy-rendering.md`
**Vertrag:** `.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json`

## Kriterien

- [x] Spezifikation mit Art Direction, Material-/Geometriekriterien, funktionalen Grenzen und Priorisierung.
- [x] Golden-Fixtures aus gespeicherten Karten Dornhain und Krypta (Seeds + Daten-Fingerprints gepinnt, Browser prüft gespeicherte Daten).
- [x] Reproduzierbare Aufnahmen in Draufsicht (`ortho-topdown`), Diorama (`diorama-oblique`) und Perspektive (`perspective`) mit definierten Zoomstufen, Lichtprofilen und Kameraparametern; Wiederholungsaufnahme innerhalb Toleranz.
- [x] Dateinamen enthalten Atlas-Map-ID, Kamera, Zoomstufe, Build-SHA, Qualitätsprofil, Renderer, Viewport.
- [x] Gegenüberstellung mit ATL2-G04-Ausgangsbelegen ohne Umetikettierung.
- [x] Soll/Ist-Matrix mit beobachtbaren Metriken, Status und akzeptierten Ausnahmen (Dächer, Baumkronen, Relief, Materialübergänge, Schatten, LOD, Lesbarkeit, Profile, Performance).
- [x] Regeln canonical / suggestive / atmospheric; IV-01, IV-02, IV-07, IV-09, IV-14, IV-18; AU-01, AU-06 (Phone/Tablet/Desktop).
- [x] Budgets für echte Zielhardware; CI-Werte als Software-Rendering gekennzeichnet.
- [x] Nutzbar als Testorakel für R01B, Migration und R05.
- [x] Kein Three.js-Prototyp, keine GO/NO-GO-Entscheidung, keine Renderer-/Datenmodelländerung, null Escape Hatches.

## Nicht erfüllt / offen (bewusst)

- Profile `high`/`lite` nicht aufnehmbar (kein Produkt-Selektor) → C-PROF-01 NOT_RUN.
- Hardware-Messung → C-PERF-01 NOT_RUN; Player-Hidden-Info-Visual → C-SEC-01 NOT_RUN.
- Golden-Datenlücken (Krypta-Türen/-Wand, Dornhain-Heightfield) → Entscheidung Ben.

## Prüfung

- `node scripts/atl3-v01-visual-contract.self-test.mjs` (im `npm run test-gate`)
- `e2e/atl3-v01-visual-contract.spec.ts` (Host-Browser, Chromium)
