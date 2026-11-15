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
- [x] Budgets für echte Zielhardware mit verbindlichen Referenzgeräten; CI-Werte als Software-Rendering gekennzeichnet.
- [x] Frame-p95 auf Software-WebGL nur informativ (protokolliert, kein Fehlschlag); Hardware-Renderer behalten das harte Budget (V01 + Gate G, Self-Test-geprüft).
- [x] Nutzbar als Testorakel für R01B, Migration und R05.
- [x] Kein Three.js-Prototyp, keine GO/NO-GO-Entscheidung, keine Renderer-/Datenmodelländerung, null Escape Hatches (Runde 2: nur Golden-Daten + Qualitäts-Schalter, Datenmodell unverändert).

## Runde 2 — Entscheidungen Ben (2026-11-15)

- [x] **Golden-Daten ergänzt:** Dornhain-Heightfield (4 Hügel, kanonisch, nie unter Features), Krypta mit Türen und geschlossenen Räumen; G04-Fingerprints und `g04-city`/`g04-crypt`-Snapshots bewusst erneuert.
- [x] **Qualitäts-Schalter im Produkt:** Auswahl „Grafikqualität“ in der 3D-Ansicht (Hoch/Ausgewogen/Sparsam), Default `balanced`, pro Gerät gespeichert, keine Test-Hooks; Baselines für `high` und `lite` aufgenommen.
- [x] **Referenzgeräte verbindlich:** Desktop Iris Xe / Apple M1, Tablet iPad 9 / Galaxy Tab S6 Lite, Phone Mali-G52. Perf-Zahlen bleiben Software-Messungen bis zu echten Geräteläufen.
- [x] **Krypta = committete Dungeon-Forge-Krypta** (Seed 1425, Theme `ancient`) mit Fackel/Theme-Licht; Host-Seed gespiegelt und paritätsgeprüft.
- [x] Baselines deterministisch neu aufgenommen (36 Bilder), Wiederholungslauf pixelidentisch.
- [x] Stale-Matrix-Guard (Codex P2): self-test prüft Status gegen Evidenzregeln + Baseline-Digest; Browser-Lauf scheitert bei Drift gegen die committete Baseline.

## Nicht erfüllt / offen (bewusst)

- C-PERF-01 NOT_RUN (keine Geräteläufe), C-SEC-01 NOT_RUN (Player-Visual).
- C-PROF-01 PARTIAL: `lite` (Canvas2D-Fallback) mit Sortierfehlern in Diorama/Perspektive.
- K-LIT-01 PARTIAL: Fackel sichtbar, aber kein Punktlicht mit Abfall.
- K-GEO-01 PARTIAL: Korridor-Mittellinien (`dcorr-*`) als Wandbalken quer durch Räume.
- Bestehende Welten behalten die alte Krypta/kein Heightfield bis zum Welt-Reset.

## Prüfung

- `node scripts/atl3-v01-visual-contract.self-test.mjs` und `node scripts/atl3-v01-golden-krypta-forge.mjs` (beide im `npm run test-gate`)
- `e2e/atl3-v01-visual-contract.spec.ts` (Host-Browser, Chromium)
