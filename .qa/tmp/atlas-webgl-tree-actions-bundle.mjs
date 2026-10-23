// src/domains/world/atlas/map-frame.ts
function isGroundedLinkAnchor(anchor) {
  if (!anchor) return false;
  const x = Number(anchor.x);
  const y = Number(anchor.y);
  return Number.isFinite(x) && Number.isFinite(y);
}

// src/domains/world/places/parse-world-place.ts
function pickPrimaryMapIdForPlace(placeId, links) {
  const forPlace = links.filter((l) => l.placeId === placeId);
  const order = [
    "primary",
    "interior",
    "dungeon",
    "footprint",
    "entrance",
    "battlemap",
    "overview"
  ];
  for (const usage of order) {
    const hit = forPlace.find((l) => l.usage === usage);
    if (hit) return hit.mapId;
  }
  return forPlace[0]?.mapId ?? null;
}

// src/domains/world/places/atlas-webgl-nav-tree.ts
var DEMO_NAV_IDS = [
  "westmark",
  "nordreich",
  "asteria",
  "city",
  "dungeon",
  "room",
  "kontinent"
];
function isDemoNavPlaceId(id) {
  return DEMO_NAV_IDS.includes(id);
}
function webglNavKindFromPlaceKind(kind) {
  if (kind === "continent") return "kontinent";
  if (kind === "country" || kind === "realm") return "land";
  if (kind === "place" || kind === "settlement" || kind === "region" || kind === "area" || kind === "district") {
    return "ort";
  }
  if (kind === "building" || kind === "site" || kind === "dungeon") return "gebaeude";
  if (kind === "room" || kind === "interior") return "raum";
  return "ort";
}
function worldNodeKindFromWebglNavUiKind(uiKind) {
  if (uiKind === "kontinent") return "continent";
  if (uiKind === "land") return "country";
  if (uiKind === "ort") return "place";
  if (uiKind === "gebaeude") return "building";
  if (uiKind === "raum") return "room";
  return null;
}
function subLabelForPlace(place, uiKind) {
  if (place.status === "placeholder") return "Platzhalter";
  if (place.status === "draft") return "Entwurf";
  const labels = {
    world: "Welt",
    kontinent: "Kontinent",
    land: "Land",
    ort: "Ort",
    gebaeude: "Geb\xE4ude",
    raum: "Raum"
  };
  return labels[uiKind];
}
function sortPlaces(a, b) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, "de");
}
function buildAtlasWebglNavTree(input) {
  const worldId = `world:${input.worldProfileId}`;
  const status = input.status ?? "ready";
  if (status === "loading" || status === "error") {
    return {
      worldId,
      worldLabel: input.worldLabel.trim() || "Welt",
      worldSub: "Welt",
      worldPrimaryMapId: input.worldPrimaryMapId ?? null,
      nodes: [],
      childrenByParentId: { [worldId]: [] },
      status,
      errorMessage: input.errorMessage
    };
  }
  const active = input.places.filter((p) => p.status !== "archived");
  const nodes = active.map((place) => {
    const kind = webglNavKindFromPlaceKind(place.kind);
    const placeLinks = input.links.filter((l) => l.placeId === place.id);
    const located = placeLinks.some((l) => isGroundedLinkAnchor(l.anchor));
    return {
      id: place.id,
      parentId: place.parentPlaceId,
      label: place.name,
      sub: subLabelForPlace(place, kind),
      kind,
      primaryMapId: pickPrimaryMapIdForPlace(place.id, input.links),
      placeKind: place.kind,
      status: place.status,
      located
    };
  });
  const byParent = /* @__PURE__ */ new Map();
  const ensure = (key) => {
    const list = byParent.get(key);
    if (list) return list;
    const next = [];
    byParent.set(key, next);
    return next;
  };
  ensure(worldId);
  const sorted = [...active].sort(sortPlaces);
  for (const place of sorted) {
    const parentKey = place.parentPlaceId ?? worldId;
    ensure(parentKey).push(place.id);
    ensure(place.id);
  }
  const childrenByParentId = {};
  for (const [key, ids] of byParent) {
    childrenByParentId[key] = ids;
  }
  return {
    worldId,
    worldLabel: input.worldLabel.trim() || "Welt",
    worldSub: "Welt",
    worldPrimaryMapId: input.worldPrimaryMapId ?? null,
    nodes,
    childrenByParentId,
    status: nodes.length === 0 ? "empty" : "ready"
  };
}
export {
  buildAtlasWebglNavTree,
  isDemoNavPlaceId,
  webglNavKindFromPlaceKind,
  worldNodeKindFromWebglNavUiKind
};
