# ATL2-D06 — Semi-realistic fantasy diorama look

## Decision

Productive 3D remains **custom WebGL**. Domain plan
`buildAtlasDioramaLookPlan` derives mesh recipes, material tokens, instance
batches, and light/fog profiles from the canonical `UnifiedCanvasDoc` plus the
active `AtlasGraphicsPresetId`. Runtime applies recipes in
`productPropInto` and light uniforms in `AtlasGL`.

## Contract

1. No invented buildings/trees — only stamps/paths already in the document.
2. Atmospheric vs canonical: recipes for object stamps are `canonical`; raster
   reference layers stay `atmospheric` and are not extruded into fake houses.
3. Quality presets drive detail (windows/facades), fog, shadow strength, and
   software fallback — not a second geometry store.
4. Instancing is proven via batch keys `(stamp, variant)` with instance counts;
   meshes still land in the existing product LOD mesh buckets.

## Non-goals

- Full physically based renderer / shadow maps
- Auto-kanonizing decorative fog into world facts
- Three.js SpatialViewport product chrome
