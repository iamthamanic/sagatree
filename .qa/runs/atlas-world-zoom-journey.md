# Atlas Shared World — Continuous Zoom & Focus Journey Report

**Verdict:** **`CHECKPOINT — Fachlich brauchbar, visuell nicht final`**

**Owner review 2026-11-26:** Der gemeinsame Weltraum, Dornhain-Fokus und die Rückkehr aus der Einzelbearbeitung funktionieren. Die Google-Maps-ähnliche Kameraführung und visuelle Qualität sind damit noch nicht erreicht. Dieser Stand ist ein Rückfallpunkt, keine finale Produktabnahme.

**Date:** 2026-11-26

**Branch:** `feat/atlas-spatial-containment`

**Base HEAD:** `c83c3416d52cb0d0acf9a4e71ee6bc55b61d5168` (this checkpoint was reviewed before committing; unrelated pre-existing working-tree edits remain excluded)
**Data Safety:** Live `.data/host.sqlite*` and reference staging dir `/tmp/sagatree-recovery-staging-solo-wo5cfnz/` were never modified; all staging probes ran against disposable temp copies that were deleted afterward. Verified zero unintended DB mutations (`dh-map-loc-tavern` stayed `rev 39`, `dh-map-place-dornhain` stayed `rev 3`).

---

## 1. Executive Summary

All 5 target user journeys for **„EINE Welt — durchgängige Zoom-Reise von der Welt bis zum Ort und Gebäude“** were reproduced before fixes, iteratively implemented across pure domain (`src/domains/world/atlas/`), Three.js renderer (`src/infrastructure/world/atlas-three/`), and Workstation UI (`src/app/world/atlas/`), and verified in real hardware-WebGL Chromium against both:
1. a disposable copy of the real staging world **`WO-5CFNZ`** (including user-edited `Taverne Zum Flüstern` rev 39, `Dornhain` rev 3, and unlocated `new type city`), and
2. reproducible ephemeral host E2E tests (`e2e/atlas-world-zoom-journey.spec.ts` and `e2e/scm-spatial-containment.spec.ts`), plus full `npm run test-gate`.

**Architecture & Invariants preserved:**
- **ONE Shared Chunked World Terrain:** `ownPerMapTerrainCount === 0` across every zoom step and focus transition.
- **Zero Scene-Graph Destructive Swaps:** `clearRootCount === 0` and `sameCanvas === true` across all in-world focus transitions (Welt → Westmark → Nordreich → Dornhain → Taverne Zum Flüstern → Schankraum).
- **#94 Layered Architecture:** `architecture-boundary-check` passed (`398` domain, `158` infrastructure, `406` app, `65` shared/ui; `84/84` legacy eradicated).
- **No modifications to `server/src/bootstrap/ensure-dornhain-default.ts`** (pre-existing working-tree change untouched).

---

## 2. Before vs. After Verification (All 5 Journeys on `WO-5CFNZ`)

Evidence directory: `.qa/evidence/atlas-world-zoom-journey/`

### Journey 1 — Layer Click on `Dornhain` in `Ebenen`
| Metric | Before (`before-02-click-dornhain.png`) | After (`after-02-click-dornhain.png`) |
|---|---|---|
| Same Canvas & Scene Graph | `sameCanvas: false` (switched into isolated single-map doc) | `sameCanvas: true`, `editMode: "world-focus"` |
| Active Map Chain | `[]` (multi-map unloaded) | `["dh-atlas-root", "dh-map-continent-westmark", "dh-map-country-westmark", "dh-map-place-dornhain"]` |
| Camera Target & Span | Local `(505, 477.5)`, `span: 263.25` | Real anchor world `(227.744, 376.88)`, `span: 3.485`, `yawRad: 0.42` preserved |
| Active Editor & Ebenen Highlight | Isolated local map | `activeEditorMapId: "dh-map-place-dornhain"`, `Ebenen` badge = `Dornhain` |
| Visual Inspection | Detached local island | Complete Dornhain village (cobblestone plaza, timber deck, stone courtyard, houses, tower, pine/oak/bush/flower perimeter) integrated on continuous shared world terrain |

### Journey 2 — Free `mouse.wheel` Zoom World → Dornhain
Trace file: `.qa/evidence/atlas-world-zoom-journey/zoom-trace.json` (22 wheel steps, `span 530 → 4.19`)
| Metric | Before (`before-03-wheel-span25.png`, `before-04-wheel-dornhain-close.png`) | After (`after-03-wheel-span25.png`, `after-04-wheel-dornhain-close.png`) |
|---|---|---|
| Dornhain Entry at `span ≈ 25` | `dornhainGroup: null` (excluded as `below-sse` until `span ≈ 12`) | Enters at step 13 (`span: 24.163`): `detailWeight: 0.422`, `opacity: 0.207`, `lodState: "active"` |
| Opacity Crossfade | Sudden late pop-in | Smooth damped ramp: Dornhain `0.21 → 0.56 → 0.82 → 0.96 → 0.99 → 1.0`, Nordreich coarse overlay `1.0 → 0.86 → 0.44 → 0.17 → 0.04 → 0.0` |
| Coarse Parent Artifacts | Giant pixelated Nordreich road & oversized trees lingering over Dornhain | Parent coarse overlay crossfades cleanly out as Dornhain fades in; `exclusionRects` clears parent scatter over child footprints |
| Shared Terrain & Root | `ownPerMapTerrainCount: 0`, `clearRootCount: 0` | `ownPerMapTerrainCount: 0`, `clearRootCount: 0`, `terrainMaxLod: 2 → 6` |

### Journey 3 — In-World Focus on Building (`Taverne Zum Flüstern`) & Room (`Schankraum`)
- **`Taverne Zum Flüstern`** (`after-05-focus-tavern.png`): Flies in-world to `(226.412, 377.151)`, `span: 0.2881`, `activeEditorMapId: "dh-map-loc-tavern"`, automatic settlement roof cutaway reveals the saved rev-39 user edits (green brush stroke `a3-2kepd8h1`, moved furniture, interior floor) directly on Dornhain's plaza.
- **`Schankraum`** (`after-06-focus-schankraum.png`): Flies in-world to `(226.375, 377.086)`, `span: 0.144`, `activeEditorMapId: "dh-map-room-taproom"`, full 6-level ancestor chain retained without snapping back to Westmark/Nordreich.

### Journey 4 — Explicit Focus vs. Edit Separation & Clean Return
- **Pre-edit world state:** `(227.744, 376.88)`, `span: 3.485`, `yawRad: 0.42`, `pitchRad: 0.68`, `activeEditorMapId: "dh-map-place-dornhain"`.
- **Single-map Edit mode** (`after-07-edit-dornhain.png`): Clicking `Bearbeiten` (`[data-atlas-open-edit-focused]` or per-node pencil `[data-atlas-edit-map]`) opens `dh-map-place-dornhain` cleanly framed on local contentBounds (`(390, 470)`, `span: 197.2`, `editMode: "document-edit"`).
- **Return via `Zurück zur Welt`** (`after-08-returned-world.png`): Restores exact world camera `(227.744, 376.88)`, `span: 3.485`, `yawRad: 0.42`, `pitchRad: 0.68`, `editMode: "world-focus"`, `activeEditorMapId: "dh-map-place-dornhain"`, with warm-cached `childMapVms` preventing any refetch delay or ocean flash. Zero DB writes (`tavernRev: 39`, `dornhainRev: 3`).

### Journey 5 — Negative Cases, Robustness & Adaptive UI (`AU-*`)
- **Unlocated map (`new type city`)** (`after-09-unlocated-notice.png`): Marked `Entwurf · Unverortet`; clicking displays honest German notice (`„new type city“ ist noch nicht auf der Weltkarte verortet. Zum Bearbeiten oder Verorten kannst du die Karte direkt öffnen.`) + explicit `Karte bearbeiten` button without faking coordinates or moving the camera.
- **Rapid Target Switch & Duplicate Click:** `Kontinent Ostmark` → 80ms → double-click `Dornhain` cancels stale flight via sequence token and lands cleanly on `(227.744, 376.88)`, `span: 3.485`, `activeEditorMapId: "dh-map-place-dornhain"`.
- **Keyboard Activation:** Focusing `Nordreich` and pressing `Enter` flies to `(237.6, 376.0)`, `span: 36.96`, `activeEditorMapId: "dh-map-country-westmark"`.
- **Phone (`390×844`, `after-10-phone.png`) & Tablet (`768×1024`, `after-10-tablet.png`):** `docOverflow: false`, zero clipped controls, open `Ebenen` drawer renders cleanly above the floating topbar (`z-[8] lg:z-[6]`), and all primary touch targets measure `>= 44×44 px` (`layers: 176×44`, `tools: 136×44`, `nav-root: 270×44`, `edit: 89×44`, `zoom-in: 44×44`, `zoom-out: 44×44`).

---

## 3. Executed Verification Commands & Results

| Command | Result | Details |
|---|---|---|
| `node /.../scratch/staging-journey-probe.mjs --phase=after` | **PASS** | All 5 journeys on disposable `WO-5CFNZ` copy; 11 screenshots + `after-probe.json` + `zoom-trace.json`; `tavernRev: 39`, `dornhainRev: 3` |
| `node scripts/atlas-world-focus.self-test.mjs` | **PASS (7/7)** | `resolveWorldFocusTarget`, `recommendedWorldCameraSpan`, unlocated rejection, foveated reveal at `span=25`, `focusTargetMapId` alignment, scatter `exclusionRects` |
| `node scripts/atlas-world-scene-plan.self-test.mjs` | **PASS (6/6)** | SSE LOD, 115 px hysteresis preserved, cutouts, `budget<=6`, unlocated/portal, unified camera |
| `node scripts/architecture-boundary-check.mjs` | **PASS** | 398 domain, 158 infrastructure, 406 app, 65 shared/ui; 84/84 legacy eradicated |
| `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/atlas-world-zoom-journey.spec.ts --project=chromium` | **PASS (1/1, 16.1s)** | Reproducible ephemeral host spec covering Journeys 1–5 + Phone/Tablet AU gates; 0 `pageerror`s |
| `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/scm-spatial-containment.spec.ts --project=chromium` | **PASS (4/4, 20.7s)** | Full SCM-01..08 + Continuous-LOD + Shared Chunked Terrain regression suite |
| `npm run test-gate` | **PASS** | `lint` (44 changed TS files), `typecheck` (44 changed TS files), `vite build` (5647 modules), all SWS/SCM/worldbuilder/host/security self-tests, secrets scan, dep audit |

---

## 4. Modified & Added Product/Test Files

- **Domain (pure, zero React/Three/Host):**
  - `src/domains/world/atlas/atlas-world-focus.ts` *(new)*
  - `src/domains/world/atlas/atlas-world-scene-plan.ts`
  - `src/domains/world/atlas/atlas-scene-scatter.ts`
  - `src/domains/world/atlas/index.ts`
- **Infrastructure (Three.js renderer):**
  - `src/infrastructure/world/atlas-three/atlas-three-scene.ts`
  - `src/infrastructure/world/atlas-three/atlas-three-multimap.ts`
  - `src/infrastructure/world/atlas-three/atlas-three-runtime.ts`
- **App (Workstation & Workbench):**
  - `src/app/world/atlas/WorldAtlasWorkbench.tsx`
  - `src/app/world/atlas/unified/UnifiedAtlasEditor.tsx`
  - `src/app/world/atlas/unified/AtlasNative3dEditor.tsx`
  - `src/app/world/atlas/unified/AtlasThreeWorkstation.tsx`
- **Tests, Contracts & Evidence:**
  - `scripts/atlas-world-focus.self-test.mjs` *(new, wired into `scripts/test-gate.mjs`)*
  - `e2e/atlas-world-zoom-journey.spec.ts` *(new, ephemeral host fixtures only)*
  - `.qa/intake/edge-infra-contracts/*` & `.qa/evidence/stack-migration-prep/completion/mig-002.json` *(refreshed contract hashes)*
  - `.qa/evidence/atlas-world-zoom-journey/*` *(before/after screenshots, probes, `zoom-trace.json`)*

---

## 5. Findings Table (All Severities — Mandatory Full Disclosure)

| Severity | Area | Finding & Status |
|---|---|---|
| **Critical** | — | None open. |
| **High** | — | None open. (Previously observed High defect — ocean flash on "Zurück zur Welt" caused by clearing `childMapVms` on child edit — was fixed and verified in `after-08-returned-world.png`.) |
| **Medium** | Frühere Topbar-Layoutfehler | Geschlossen. (Top-center pill wrapping on 1280px desktop and topbar overlapping open `Ebenen` drawer on Phone/Tablet were fixed and verified in `after-02`, `after-10-phone.png`, `after-10-tablet.png`.) |
| **Medium** | Ebenen-/Dokumentanzeige beim expliziten Edit-Wechsel | **Open — owner review on disposable `WO-5CFNZ` preview (2026-11-26).** After Dornhain focus → edit, the Ebenen badge was observed changing through `Whisper Road`, `Krypta unter dem Hügel` and `Marktplatz` while the Dornhain document stayed open. Root cause not yet isolated; stale element references prevented fully repeating the sequence. Must be reproduced and fixed before final visual/navigation acceptance. No map write or data loss observed. |
| **Medium** | Kamera, Maßstab & visuelle Übergänge | **Open — owner review with Google Maps reference video.** Functional focus is not yet a continuous spatial journey: cursor anchoring, pitch/framing, world-to-building scale and building→room presentation need a dedicated camera/visual pass. Existing green end-state assertions do not prove these intermediate visual transitions. |
| **Low** | Mobile Shell / Bottom Taskbar (`after-10-phone.png`) | On `390×844` Phone viewport, the floating atlas bottom zoom taskbar (`bottom-3`) sits visually in front of the outer SagaTree mobile bottom navigation bar (`Home` / `Bibliothek` / `Profil`). All zoom buttons remain `44×44 px` and unclipped (`docOverflow: false`), but raising the atlas taskbar to `bottom-16 sm:bottom-3` when the mobile shell bottom nav is active would avoid stacking two bottom bars. Pre-existing workstation positioning; non-blocking. |
| **Low** | Tablet (`768×1024`) Topbar with Open Drawer (`after-10-tablet.png`) | On `768×1024` Tablet when the `Ebenen` drawer is open, the drawer cleanly takes priority (`z-[8]`) so search and all hierarchy items are unobstructed, while the partially covered center topbar (`Bearbeiten`, `Draufsicht`, `Ausgewogen`) peeks out to the right of the drawer. Closing `Ebenen` exposes the full topbar cleanly; hiding or shifting the center topbar when `layersOpen` on `< lg` would make tablet presentation even tidier. Non-blocking. |
| **Low** | WebGL Console Warning (Metal / Three.js) | During Chromium hardware-WebGL runs, Three.js emits a pre-existing `WebGL: INVALID_OPERATION: texImage3D: FLIP_Y or PREMULTIPLY_ALPHA...` warning during environment/texture setup, and unauthenticated initial bootstrap logs one expected `401 (Unauthorized)` probe before login. Zero `pageerror`s and zero functional impact. |
| **Info** | Pre-existing Working-Tree Edits & Test-Gate Side-Effects | Before this run, `server/src/bootstrap/ensure-dornhain-default.ts` and `scripts/atl2-a03-cold-bootstrap.self-test.mjs` already contained uncommitted SWS Phase 1 heightfield-upgrade edits, which were left untouched. Running `npm run test-gate` also refreshed generated timestamps/artifacts in `.qa/fixtures/**`, `.qa/runs/**`, and `.qa/evidence/scm/**` / `.qa/evidence/continuous-lod/**` — review `git status` before selectively staging commits. |
| **Info** | Ephemeral vs. Staging Anchor Scale | In the live `WO-5CFNZ` world, Dornhain spans `7.74 × 9.68` world units (entering the scene plan by `span ≈ 24.2`), whereas in `buildCalibratedDefaultWorld()` (used by ephemeral E2E fixtures), Dornhain spans `4.0 × 4.0` world units (entering smoothly around `span ≈ 13.7` under the exact same SSE + 20% foveated focus formula). Both scales are explicitly covered by `scripts/atlas-world-focus.self-test.mjs` and `e2e/atlas-world-zoom-journey.spec.ts`. |
