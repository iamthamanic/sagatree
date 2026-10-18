#!/usr/bin/env node
/**
 * Self-test for atlas place nav anchors + LOD (mirrors atlas-place-nav.ts).
 * Location: scripts/atlas-place-nav.self-test.mjs
 */
import process from 'node:process';

function assert(cond, msg) {
  if (!cond) {
    console.error(`atlas-place-nav self-test failed: ${msg}`);
    process.exit(1);
  }
}

function num(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function anchorPointFromLink(link) {
  const x = num(link.anchor.x);
  const y = num(link.anchor.y);
  if (x == null || y == null) return null;
  return { x, y };
}

function spanForKind(kind) {
  if (kind === 'realm' || kind === 'continent') return 180;
  if (kind === 'region' || kind === 'area') return 90;
  if (kind === 'settlement' || kind === 'district') return 36;
  if (kind === 'building' || kind === 'site') return 14;
  if (kind === 'interior' || kind === 'dungeon') return 8;
  return 40;
}

function buildAtlasPlaceNav(places, links) {
  const byPlace = new Map();
  for (const link of links) {
    const list = byPlace.get(link.placeId) ?? [];
    list.push(link);
    byPlace.set(link.placeId, list);
  }
  const items = [];
  for (const place of places) {
    const placeLinks = byPlace.get(place.id) ?? [];
    const preferred =
      placeLinks.find((l) => l.usage === 'overview' && anchorPointFromLink(l)) ??
      placeLinks.find((l) => l.usage === 'footprint' && anchorPointFromLink(l)) ??
      placeLinks.find((l) => anchorPointFromLink(l));
    if (!preferred) continue;
    const pt = anchorPointFromLink(preferred);
    if (!pt) continue;
    const span = spanForKind(place.kind);
    items.push({
      placeId: place.id,
      name: place.name,
      kind: place.kind,
      mapId: preferred.mapId,
      x: pt.x,
      y: pt.y,
      focusRect: {
        x: pt.x - span / 2,
        y: pt.y - span / 2,
        width: span,
        height: span,
      },
    });
  }
  return items;
}

function resolveAtlasLodFromPlaces(center, pixelsPerUnit, nav) {
  if (nav.length === 0) return null;
  const ranked = [...nav].sort((a, b) => a.focusRect.width - b.focusRect.width);
  for (const item of ranked) {
    const r = item.focusRect;
    if (center.x < r.x || center.x > r.x + r.width || center.y < r.y || center.y > r.y + r.height) {
      continue;
    }
    if (pixelsPerUnit * r.width < 260) continue;
    return { level: item.kind === 'settlement' ? 'ORT' : 'LAND', crumb: item.name };
  }
  return { level: 'WELT', crumb: 'Weltkarte' };
}

const places = [{ id: 'p1', name: 'Dornhain', kind: 'settlement' }];
const links = [
  {
    placeId: 'p1',
    mapId: 'm1',
    usage: 'overview',
    anchor: { x: 100, y: 200 },
  },
];
const nav = buildAtlasPlaceNav(places, links);
assert(nav.length === 1, 'one nav item');
assert(nav[0].focusRect.x === 100 - 18, 'focus x');
assert(nav[0].focusRect.width === 36, 'focus w');

const lodHit = resolveAtlasLodFromPlaces({ x: 100, y: 200 }, 10, nav);
assert(lodHit && lodHit.level === 'ORT', 'LOD ORT when zoomed into settlement');
assert(lodHit.crumb === 'Dornhain', 'LOD crumb');

const lodWorld = resolveAtlasLodFromPlaces({ x: 100, y: 200 }, 1, nav);
assert(lodWorld && lodWorld.level === 'WELT', 'LOD WELT when zoomed out');

console.log('atlas-place-nav self-test: PASS');
