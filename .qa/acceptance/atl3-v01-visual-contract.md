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
- [x] Kein Three.js-Prototyp, keine GO/NO-GO-Entscheidung, keine Renderer-/Datenmodelländerung, null Escape Hatches (Runde 2: nur Golden-Daten + Qualitäts-Schalter, Datenmodell unverändert; Runde 3: gezielte Renderer-/Forge-Fixes auf Bens Entscheidung, Datenmodell unverändert).

## Runde 2 — Entscheidungen Ben (2026-11-15)

- [x] **Golden-Daten ergänzt:** Dornhain-Heightfield (4 Hügel, kanonisch, nie unter Features), Krypta mit Türen und geschlossenen Räumen; G04-Fingerprints und `g04-city`/`g04-crypt`-Snapshots bewusst erneuert.
- [x] **Qualitäts-Schalter im Produkt:** Auswahl „Grafikqualität“ in der 3D-Ansicht (Hoch/Ausgewogen/Sparsam), Default `balanced`, pro Gerät gespeichert, keine Test-Hooks; Baselines für `high` und `lite` aufgenommen.
- [x] **Referenzgeräte verbindlich:** Desktop Iris Xe / Apple M1, Tablet iPad 9 / Galaxy Tab S6 Lite, Phone Mali-G52. Perf-Zahlen bleiben Software-Messungen bis zu echten Geräteläufen.
- [x] **Krypta = committete Dungeon-Forge-Krypta** (Seed 1425, Theme `ancient`) mit Fackel/Theme-Licht; Host-Seed gespiegelt und paritätsgeprüft.
- [x] Baselines deterministisch neu aufgenommen (36 Bilder), Wiederholungslauf pixelidentisch.
- [x] Stale-Matrix-Guard (Codex P2): self-test prüft Status gegen Evidenzregeln + Baseline-Digest; Browser-Lauf scheitert bei Drift gegen die committete Baseline.

## Runde 3 — offene visuelle Punkte (Entscheidung Ben, 2026-11-15)

- [x] **Bestehende Welten:** idempotentes Golden-Upgrade beim `ensure-starter` (`dornhain-golden-content-upgrade.ts`): unberührte Alt-Krypta (vor V01 / Runde 2) → Forge-Krypta, Dornhain ohne Heightfield → mit Heightfield; Nutzeränderungen werden nie überschrieben (Signaturvergleich), zweiter Lauf ändert nichts (DB-self-test).
- [x] **Prop-Realgröße:** `dungeonPropStampSize` — Fackel 1,2 Zellen, Kiste 0,9 Zellen, unabhängig von `unitScale` (self-test über unitScale 1…40).
- [x] **Korridore:** Bodenflächen `dcorr-*` aus dem Zellraster, Wände nur entlang der Kanten, keine Mittellinien-Wandbalken (K-GEO-01 MET).
- [x] **Fackel-Abfall:** Punktlicht mit Distanzabfall je Profil (high/balanced per Pixel, lite pro Fläche); balanced Z2 ≈ 1,8× Boden-Luma nahe Fackel (K-LIT-01 MET).
- [x] **lite-Tiefensortierung:** BBox-Culling, Unterteilung, Boden-Pass vor stehender Geometrie (C-PROF-01 MET).
- [x] Baseline bewusst neu aufgenommen (36 Bilder), Wiederholungslauf gegen die neue Baseline drift-frei (Diff 0); Matrix neu bewertet (MET 11 · PARTIAL 5 · GAP 6 · NOT_RUN 2), Digest `9445e6985f67f707`.
- [x] G04 `crypt` Fingerprints + Snapshot `g04-crypt-desktop-chromium.png` bewusst erneuert.
- [x] Screenshots: `/workspace/sagatree/artifacts/v01/round3/` (4 Standardansichten + Korridor/Fackel-Abfall balanced + lite).

## Nicht erfüllt / offen (bewusst)

- C-PERF-01 NOT_RUN (keine Geräteläufe), C-SEC-01 NOT_RUN (Player-Visual).
- ~~K-ART-01 PARTIAL: Perspektive (WebGL) Böden in Z1 durch Distanznebel fast in Nebelfarbe; Z2 Z-Fighting-Streifen auf einer koplanaren Grundfläche außerhalb der Krypta.~~ Behoben in ATL3-R01B (#1296): K-ART-01 MET, D-ART-01 MET.
- ~~D-GEO-03: Dornhain balanced — Unterwasser-Geländedreieck schneidet in die Plaza.~~ Behoben in ATL3-R01B (#1296) (Ozean/Plaza-Z-Fighting); D-GEO-03 bleibt PARTIAL nur wegen facettierter Relief-Schattierung.
- Nach R01B: Matrix MET 13 · PARTIAL 4 · GAP 5 · NOT_RUN 2, Digest `8c2a66b4a3e91bf7`.
- Welten mit nutzerbearbeiteter Alt-Krypta/Alt-Dornhain bleiben bewusst unverändert (nur Reset bringt die neuen Golden-Daten).

## Prüfung

- `node scripts/atl3-v01-visual-contract.self-test.mjs`, `node scripts/atl3-v01-round3-visual-fixes.self-test.mjs` und `node scripts/atl3-v01-golden-krypta-forge.mjs` (alle im `npm run test-gate`)
- `e2e/atl3-v01-visual-contract.spec.ts` (Host-Browser, Chromium)
