# Unified Atlas 3D runtime (native)

Editable SagaTree port of `sagatree_unified_atlas_3d_v3.html`.

- `atlas-prototype-runtime.mjs` — WebGL + software-3D + LOD/tools (`mountAtlasPrototype3d`)
- Host UI: `../AtlasNative3dEditor.tsx` (SagaTree tokens; no iframe)
- Reference HTML (research only, not shipped): `.qa/research/atlas-prototype-3d-reference.html` (moved out of `public/` in ATL2-H01 #1234)

To regenerate the runtime from an updated HTML file, re-run the extraction script used in agent history (or ask an agent to refresh from Downloads / `.qa/research/atlas-prototype-3d-reference.html`).

Productive owner per ADR-ST-10 (Custom WebGL: `AtlasGL` + `AtlasLite3D`). Do not remove without a superseding GO-ADR (#1296) and R05 #1270 + #1300 CLEAR.
