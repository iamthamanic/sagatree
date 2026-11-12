# ATL2-A01 — Atlas Ist/Soll- und Duplikat-Matrix

**Issue:** [#1197](https://github.com/iamthamanic/sagatree/issues/1197)  
**Epic:** [#1196](https://github.com/iamthamanic/sagatree/issues/1196)  
**Date:** 2026-11-11  
**Audited tips:**  
- `main` @ `70073829d`  
- PR [#1194](https://github.com/iamthamanic/sagatree/pull/1194) `feat/dornhain-golden-atlas-v4` @ `fe727a441`  
- PR [#1195](https://github.com/iamthamanic/sagatree/pull/1195) `feat/atlas-3d-product-terrain` @ `f4120655e` (stacked on #1194)  

**Normative contracts:** `.qa/design/atlas-worldbuilder-contract.md`, `docs/concepts/imagination-first-visualization-contract.md`, `AGENTS.md`  
**Prior gap notes:** `.qa/runs/atlas-golden-steps-gap-audit.md`

---

## 1. Branch / PR stack status

| Ref | Role | vs `main` | CI / review blockers (as of audit) |
|-----|------|-----------|-------------------------------------|
| `main` | Integration base | — | Healthy tip (docs merge #1193) |
| #1194 Golden v4 | Must merge **before** #1195 | Diverged (ahead of main) | Kodus: **PASS (`kodus-skipped-credits`)** — not the sole merge blocker; remaining ECC = unresolved Codex + required CI (Test Gate / fingerprints / Browser E2E / GATE-02/03 as of audit tip) |
| #1195 Steps 1–6 | Stacked product work | Ancestor = #1194 tip | Re-check Kodus after each tip push; Codex **P2×3** (concave fill, room delete, elevation) + stack-migration fingerprints historically failing — not “Kodus-only” |

**Stack rule (binding):** Merge order `#1194 → #1195 → main`. No competing PRs for the same functions. **No merges without explicit human approval.**

---

## 2. Runtime / renderer inventory (duplicates)

| Path | Role today | Product? | Decision | Follow-up |
|------|------------|----------|----------|-----------|
| `UnifiedAtlasEditor.tsx` + Canvas2D Draufsicht | Primary 2D authoring surface | **Yes** | **Keep** — V2 primary editor | #1206–#1211 |
| `AtlasNative3dEditor.tsx` → `atlas-prototype-runtime.mjs` | **Product custom WebGL** (`AtlasGL` / raw `webgl2` shaders — **not** Three.js) for `demoSeed:false` | **Yes** | **Keep / harden** — sole productive 3D engine today; do **not** swap renderers in this audit | #1212–#1218 |
| `webgl-runtime-bridge.ts` | 2D↔3D canvas sync — **mesh `type` alone is lossy** (`stuhl`/`fass`/`teppich` → `crate`); Golden tips preserve doc stamp via `props[].stamp` for round-trip | **Yes** | **Keep / harden** stamp round-trip; do not call mesh-only sync “lossless” | #1201–#1205 |
| `AtlasSpatialViewport.tsx` | **Three.js** viewport (`import * as THREE`) — Perspective, object pick/edit | Parallel / unused as product chrome | Inventory only here; **how** we converge to exactly one productive Three.js (or keep custom WebGL) is **#1212** — preserve functions/data; no rushed swap | #1212 → #1234 |
| `WorldAtlasLeafletMap.tsx` + Geoman | Orphan Leaflet/Geoman module — **not imported** by product chrome | Dead / unused | **Do not treat as active path**; `legacy_tiles` uses `WorldMapEditorScreen` instead. Retire after confirming no dynamic entry | #1234 |
| Eldoria `demoSeed:true` art inside `UnifiedAtlasEditor` | Demo LOD continents | Demo only | **Keep isolated**; never on product maps (#752) | — |
| Azgaar import path | External `.map` storage | Optional | **Keep** as import; not second SoT | #1238 optional |

**Rule (Ist):** Exactly **one** productive 3D path today = custom WebGL `atlas-prototype-runtime.mjs` (via `AtlasNative3dEditor`). `AtlasSpatialViewport` (Three.js) must not become a second product path.

**Rule (Soll / #1212):** Renderer-audit decides how to reach **exactly one** productive Three.js renderer (or explicitly keep custom WebGL) **without** dropping existing functions or cartography data. This ATL2-A01 ticket only corrects the inventory — it does **not** perform a renderer exchange.

---

## 3. Persistence / data-model inventory (duplicates)

| Store | Location | Used by | Decision |
|-------|----------|---------|----------|
| `generator_meta.unifiedCanvas` | `world_atlas_maps` | Product 2D/3D, Golden seeds | **Canonical cartography document** — Keep |
| `generator_meta.webglRuntimeV3` | same | Camera/runtime chrome | Keep (presentation; must not invent geography) |
| `generator_meta.dungeon` / dungeon meta | same | Dungeon Forge | Keep; integrate in #1224–#1228 |
| `generator_meta.mapStatus` + `mapFrame.parentAnchor` | `map-frame.ts` | LOD / locate | Keep; finish 6-level seed in #1199 |
| `layers` GeoJSON FeatureCollection | `world_atlas_maps.layers` | Party projection + legacy map screens (`WorldMapEditorScreen`); not via orphan `WorldAtlasLeafletMap` | **Compatibility**; do not invent parallel SoT; migration plan in #1201–#1205 |
| `world_places` + `world_place_map_links` | Host SQLite | Hierarchy + pins | Keep; expand Golden hierarchy seed_keys |
| Host `ensure-dornhain-default.ts` | Bootstrap | Golden root seed | Keep; **extend** for full 6-level cold bootstrap (#1199) |

**Conflict risk:** Player projection redacts GeoJSON `layers` but can ship `unifiedCanvas` wholesale (Codex P1 on #1194). Secrecy must apply to unified canvas (#1229 / Gate G).

---

## 4. Feature Ist / Soll matrix

Legend: **I** = implemented on #1195 tip · **P** = partial · **M** = missing · **T** = tested (unit/self-test and/or browser)

| # | Capability (V2 Soll) | Ist (#1195 tip) | I/P/M | T | Decision | Ticket |
|---|----------------------|-----------------|-------|---|----------|--------|
| 1 | Single shared canvas doc 2D↔3D | `unifiedCanvas` + bridge (stamp field on Golden tips; mesh-type alone lossy) | I/P | T unit + browser paint | Keep / harden stamp RT | #1201 |
| 2 | Product map shows saved terrain (not demo) | Step 1 product paint | I | T browser | Keep | shipped #1195 |
| 3 | Place pins + fly-to | `atlas-map-pins` | I | T browser | Keep | shipped |
| 4 | Coast polygons + Fläche tool | `points` + `area` | I | T self-test + browser chrome | Keep; fix concave triangulation | #1198 |
| 5 | Locate / parentAnchor UI | locate session Draufsicht | I | T browser locate | Keep | shipped |
| 6 | Hierarchy create (6 levels) | CreateWorldNodeDialog + host create | I | T create path | Keep | #1219+ |
| 7 | Golden root seed v4 + reset dialog | #1194 | I | T partial | Keep; fix Codex P1 guards | #1198 |
| 8 | Golden child maps + reset chain | domain + `resetToGolden` | P | unit only; **browser E2E hang** | Fix | #1199 |
| 9 | Cold bootstrap full 6-level tree | host still mostly root + flat places | M/P | — | Implement | #1199 |
| 10 | Drill Welt→…→Raum with content | pins + locate; not full Golden chain E2E | P | partial | Finish | #1199 / #1200 |
| 11 | Room/object delete parity 2D/3D | erase paths differ; Codex P2 room delete | P | — | Fix | #1198 |
| 12 | Persisted elevation → 3D height | field exists; runtime may ignore | P | — | Fix | #1198 / #1215 |
| 13 | Semi-realistic terrain materials | prototype materials / demo look | P | — | Upgrade | #1213–#1217 |
| 14 | Ortho / diorama / optional perspective cameras | runtime camera modes limited | P/M | — | Implement | #1214–#1216 |
| 15 | Dungeon Forge in product path | `dungeon-generator.ts` exists | P | domain tests | Integrate UI + seed | #1224–#1228 |
| 16 | GM/player secrecy on unifiedCanvas | projection incomplete (Codex P1) | P | — | Fix | #1198 / #1229 |
| 17 | Adaptive AU-* / IV-* acceptance on UI tickets | often missing on Golden tickets | M | — | Enforce | every UI PR |
| 18 | Orphan Leaflet Geoman (`WorldAtlasLeafletMap`) | present as file; **no product import**; `legacy_tiles` → `WorldMapEditorScreen` | I dead | — | Inventory only; retire orphan | #1234 |
| 19 | Parallel Three.js (`AtlasSpatialViewport`) vs product custom WebGL runtime | both present; product = WebGL | I unused Three.js | — | Inventory fix; converge decision in #1212 | #1212 / #1234 |
| 20 | Session wipe on reset `everything` | honest DE note only | P | unit | Host API later | optional / Gate G |

---

## 5. Keep / Migrate / Remove decisions (overlapping functions)

| Function class | Keep | Migrate | Remove (after parity) |
|----------------|------|---------|------------------------|
| Product 3D | custom WebGL `atlas-prototype-runtime.mjs` (Ist) | → single productive Three.js **only if #1212 decides** (preserve data/functions) | `AtlasSpatialViewport` as second product path |
| Product 2D | Canvas Draufsicht in `UnifiedAtlasEditor` | GeoJSON `layers` / `WorldMapEditorScreen` → canvas where needed | Orphan `WorldAtlasLeafletMap` / Geoman-as-default |
| Document SoT | `unifiedCanvas` | GeoJSON layers → projected/compat only | Dual-write inventing facts |
| Hierarchy | WorldNode + primary maps + parentAnchor | Flat Golden places → 6-level seed | Demo LOD inventing continents on product |
| Tools | `atlas-tool-registry` + area/brush/… | Align 3D erase/select with 2D ops | Ad-hoc runtime-only tools without registry |
| Golden | v4 seed + reset modes | Cold bootstrap = same as reset target | Silent session wipe |

---

## 6. Explicit blockers from PR #1194 / #1195

### 6.1 Process / gates (block merge until fixed or human-waived)

| PR | Blocker | Severity | Owner ticket |
|----|---------|----------|--------------|
| #1194 | Kodus authorized **`kodus-skipped-credits`** → gate reports **Kodus PASS**; remaining ECC = Codex threads + other required checks | Process / triage | #1198 |
| #1194 | ECC Merge Gate FAIL while Codex unresolved and/or required CI red | Process High | #1198 |
| #1194 | Browser E2E FAIL; GATE-02/03 FAIL (as of audit tip — re-verify on current HEAD) | High | #1198 |
| #1195 | Re-verify Kodus on **current** tip after pushes; do not assume credits-skip from #1194 | Process | #1198 / ops |
| Both | No merge without explicit approval; order 1194→1195 | Policy | human |

### 6.2 Codex / product defects (confirmed or strongly evidenced)

| ID | Finding | PR | Severity | Disposition |
|----|---------|-----|----------|-------------|
| C1194-1 | Golden reset not scoped to Dornhain **root** map | #1194 | P1 | Fix on #1194 branch → #1198 |
| C1194-2 | GM player preview still editable → can overwrite with redacted layers | #1194 | P1 | Fix → #1198 |
| C1194-3 | Secret crypt in `unifiedCanvas` not redacted for players | #1194 | P1 | Fix → #1198 / secrecy |
| C1194-4 | Blank-v3 upgrade can wipe authored `layers` | #1194 | P1 | Fix → #1198 |
| C1194-5 | Acceptance missing AU-*/IV-* gates | #1194 | P1 (process) | Amend acceptance → #1198 |
| C1194-6 | Player preview without saga clears map | #1194 | P2 | Fix → #1198 |
| C1194-7 | v3→v4 bootstrap `INSERT OR IGNORE` skips anchor/parent updates | #1194 | P2 | Fix → #1199 |
| C1195-1 | Concave polygons need triangulation before fill | #1195 | P2 | Fix → #1198 |
| C1195-2 | Room delete incomplete for selected rooms | #1195 | P2 | Fix → #1198 |
| C1195-3 | Persisted elevation not applied in 3D | #1195 | P2 | Fix → #1198 |
| G-RESET | Browser Golden hierarchy reset E2E not green | #1195 | High | #1199 |
| G-BOOT | Cold bootstrap ≠ full Golden hierarchy | host | High | #1199 |

---

## 7. Six-level navigation Soll (for later gates)

Contract chain: `world → continent → country → place → building → room`.

| Level | Golden Soll (names) | Ist seed | Gap |
|-------|---------------------|----------|-----|
| World | Donalu | Root unified v4 | OK |
| Continent | Westmark (+ Nordreich later) | Domain map seed on #1195; not reliable cold boot | #1199 |
| Country | Land Westmark | Domain seed | #1199 |
| Place | Dornhain (+ Marktplatz, Whisper Road) | Places exist; primary child maps partial | #1199 |
| Building | Taverne / Krypta | Places + min canvases | #1199 / #1224 |
| Room | Schankraum / Gruftkammer | Missing as first-class Golden nodes | #1199 / #1223 |

---

## 8. Acceptance mapping for #1197

| Criterion | Evidence |
|-----------|----------|
| Repo-wide Ist/Soll matrix with paths | this file §§2–4 |
| Keep/Migrate/Remove for overlapping runtimes | §5 |
| Open blockers #1194/#1195 linked | §6 |
| No new modules invented for existing functions | Decisions point at existing paths |

**Composition:** SKIPPED — documentation-only audit (no new hop).

---

## 9. Recommended next execution (Phase A)

1. **#1198** on existing branches only: fix P1/P2 listed above; re-run gates; **do not merge** without approval.  
2. **#1199**: cold bootstrap + reset E2E for six levels; Nordreich as second continent if required by Gate A journey.  
3. **#1200 Gate A**: host/browser Golden journey protocol — only then open Phase B (#1201+).

---

## 10. What this audit explicitly does **not** do

- No deletion of orphan Leaflet module / SpatialViewport in this ticket  

- No new renderer and **no** product WebGL→Three.js swap (that decision lives in #1212)  
- No claim that the cartography editor is finished  
- No merge of #1194/#1195  
