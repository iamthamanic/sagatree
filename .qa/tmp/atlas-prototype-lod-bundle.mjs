// src/domains/world/atlas/dornhain-unified-starter.ts
var DORNHAIN_WORLD_ANCHOR = { x: 360, y: 510 };
var DORNHAIN_SETTLEMENT_FOCUS = {
  x: 280,
  y: 430,
  width: 160,
  height: 160
};

// src/domains/world/atlas/atlas-prototype-lod.ts
var ATLAS_PROTOTYPE_LEVELS = [
  {
    id: "world",
    label: "Welt",
    sub: "Welt",
    tag: "WELT",
    glyph: "\u25CE",
    x: 500,
    y: 500,
    span: 520
  },
  {
    id: "region",
    label: "Donalu",
    sub: "L\xE4nder & Regionen",
    tag: "REGION",
    glyph: "\u25C7",
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y - 20,
    span: 160
  },
  {
    id: "city",
    label: "Dornhain",
    sub: "Ort",
    tag: "STADT",
    glyph: "\u2302",
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y,
    span: 90
  },
  {
    id: "dungeon",
    label: "Krypta",
    sub: "Gew\xF6lbe & Dungeon",
    tag: "DUNGEON",
    glyph: "\u265C",
    x: DORNHAIN_SETTLEMENT_FOCUS.x + DORNHAIN_SETTLEMENT_FOCUS.width * 0.72,
    y: DORNHAIN_SETTLEMENT_FOCUS.y + DORNHAIN_SETTLEMENT_FOCUS.height * 0.22,
    span: 28
  },
  {
    id: "room",
    label: "Kryptaraum",
    sub: "R\xE4ume & Objekte",
    tag: "RAUM",
    glyph: "\u25A7",
    x: DORNHAIN_SETTLEMENT_FOCUS.x + DORNHAIN_SETTLEMENT_FOCUS.width * 0.72,
    y: DORNHAIN_SETTLEMENT_FOCUS.y + DORNHAIN_SETTLEMENT_FOCUS.height * 0.22,
    span: 10
  }
];
var ATLAS_PROTOTYPE_LAYER_LABELS = [
  { id: "world", label: "Weltkarte", canvasLayer: "terrain" },
  { id: "region", label: "Regionen", canvasLayer: "region" },
  { id: "city", label: "Stadt & D\xE4cher", canvasLayer: "city" },
  { id: "dungeon", label: "Dungeon", canvasLayer: "interior" },
  { id: "stamps", label: "3D-Objekte", canvasLayer: "objects" },
  { id: "grid", label: "Kampfgrid", canvasLayer: "grid" }
];
function inside(x, y, cx, cy, w, h) {
  return Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2;
}
function atlasSpanFromScale(pixelsPerUnit, viewportHeight) {
  if (!(pixelsPerUnit > 0) || !(viewportHeight > 0)) return 520;
  return viewportHeight / (2 * pixelsPerUnit);
}
function atlasPrototypeLevelRect(level) {
  const h = level.span * 2;
  const w = h * 1.35;
  return {
    x: level.x - w / 2,
    y: level.y - h / 2,
    width: w,
    height: h
  };
}
function atlasPrototypeLevelFromView(center, pixelsPerUnit, viewportHeight) {
  const s = atlasSpanFromScale(pixelsPerUnit, viewportHeight);
  const { x, y } = center;
  const dungeon = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === "dungeon");
  const city = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === "city");
  const region = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === "region");
  if (s < 12 && inside(x, y, dungeon.x, dungeon.y, 40, 32)) return "room";
  if (s < 40 && inside(x, y, dungeon.x, dungeon.y, 48, 40)) return "dungeon";
  if (s < 120 && inside(x, y, city.x, city.y, 160, 140)) return "city";
  if (s < 280 && inside(x, y, region.x, region.y, 320, 260)) return "region";
  return "world";
}
function atlasPrototypeApplyLod(pixelsPerUnit, viewportHeight, layers) {
  const s = atlasSpanFromScale(pixelsPerUnit, viewportHeight);
  const on = (key, fallback = true) => layers[key] !== void 0 ? Boolean(layers[key]) : fallback;
  return {
    mapWorld: on("terrain") && s >= 40,
    mapRegion: on("region") && s < 280 && s >= 40,
    mapCity: on("city") && s < 140 && s >= 40,
    mapDungeon: on("interior") && s < 45,
    stampsWorld: on("objects") && s > 160,
    stampsRegion: on("objects") && s < 280 && s > 70,
    stampsCity: on("objects") && s < 140 && s > 35,
    stampsDungeon: on("objects") && s < 50,
    stampsRoom: on("objects") && s < 18,
    grid: on("grid") && s < 30
  };
}
function atlasPrototypeBrushSize(level, brushUi = 35) {
  const base = {
    world: 28,
    region: 9,
    city: 1.6,
    dungeon: 0.35,
    room: 0.16
  };
  return (base[level] ?? 9) * (brushUi / 35);
}
function atlasPrototypeStampSize(level, objectSize = 1) {
  const base = {
    world: 25,
    region: 11,
    city: 3,
    dungeon: 0.8,
    room: 0.35
  };
  return (base[level] ?? 5) * objectSize;
}
function atlasPrototypeNextLevel(current) {
  const idx = ATLAS_PROTOTYPE_LEVELS.findIndex((l) => l.id === current);
  if (idx < 0 || idx >= ATLAS_PROTOTYPE_LEVELS.length - 1) return current;
  return ATLAS_PROTOTYPE_LEVELS[idx + 1].id;
}
var ATLAS_PROTOTYPE_HOTSPOTS = [
  {
    id: "region",
    targetLevel: "region",
    label: "\u25C6 Donalu",
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y - 20,
    spanMax: 400,
    spanMin: 140
  },
  {
    id: "city",
    targetLevel: "city",
    label: "\u25C6 Dornhain",
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y,
    spanMax: 160,
    spanMin: 50
  },
  {
    id: "dungeon",
    targetLevel: "dungeon",
    label: "\u25C6 Krypta",
    x: DORNHAIN_SETTLEMENT_FOCUS.x + DORNHAIN_SETTLEMENT_FOCUS.width * 0.72,
    y: DORNHAIN_SETTLEMENT_FOCUS.y + DORNHAIN_SETTLEMENT_FOCUS.height * 0.22,
    spanMax: 70,
    spanMin: 16
  }
];
function atlasPrototypeHotspotVisible(hotspot, pixelsPerUnit, viewportHeight) {
  const s = atlasSpanFromScale(pixelsPerUnit, viewportHeight);
  return s < hotspot.spanMax && s > hotspot.spanMin;
}
function atlasPrototypeContentVisible(id, lod) {
  if (id.startsWith("s.")) return lod.mapCity || lod.mapDungeon;
  if (id.startsWith("d.") || id.startsWith("room.")) return lod.mapDungeon;
  if (id.startsWith("w.")) return lod.mapWorld || lod.mapRegion;
  return true;
}
export {
  ATLAS_PROTOTYPE_HOTSPOTS,
  ATLAS_PROTOTYPE_LAYER_LABELS,
  ATLAS_PROTOTYPE_LEVELS,
  atlasPrototypeApplyLod,
  atlasPrototypeBrushSize,
  atlasPrototypeContentVisible,
  atlasPrototypeHotspotVisible,
  atlasPrototypeLevelFromView,
  atlasPrototypeLevelRect,
  atlasPrototypeNextLevel,
  atlasPrototypeStampSize,
  atlasSpanFromScale
};
