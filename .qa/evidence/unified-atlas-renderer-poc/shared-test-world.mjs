/**
 * Shared editable world model for renderer PoC A/B (identical test case).
 * Mirrors SagaTree UnifiedCanvasDoc + map-edit-ops semantics.
 */

export function emptyDoc() {
  return {
    format: 'sagatree-unified-atlas-v1',
    layers: {
      terrain: true,
      roads: true,
      region: true,
      city: true,
      interior: true,
      drawings: true,
      objects: true,
      grid: false,
    },
    strokes: [],
    objects: [],
    rooms: [],
    walls: [],
    demoSeed: false,
  };
}

export function sampleWorld() {
  const doc = emptyDoc();
  doc.rooms.push(
    { id: 'region-1', x: 0, y: 0, w: 40, h: 30, material: 'gras' },
    { id: 'city-1', x: 12, y: 10, w: 16, h: 12, material: 'pflaster' },
    { id: 'building-footprint', x: 16, y: 13, w: 6, h: 5, material: 'holz' },
    { id: 'interior-1', x: 16.5, y: 13.5, w: 5, h: 4, material: 'holz' },
    { id: 'dungeon-room-a', x: 18, y: 20, w: 4, h: 3, material: 'stein' },
    { id: 'dungeon-room-b', x: 24, y: 20, w: 4, h: 3, material: 'stein' },
  );
  doc.walls.push(
    { id: 'wall-int-1', x1: 16.5, y1: 13.5, x2: 21.5, y2: 13.5, width: 0.25 },
    { id: 'wall-dun-a', x1: 18, y1: 20, x2: 22, y2: 20, width: 0.3 },
    { id: 'wall-dun-b', x1: 24, y1: 20, x2: 28, y2: 20, width: 0.3 },
  );
  doc.objects.push({
    id: 'building-1',
    type: 'haus',
    x: 19,
    y: 15.5,
    size: 4,
    angle: 0,
    height: 3.2,
    z: 0,
  });
  return doc;
}

export function applyEdit(doc, edit) {
  const next = structuredClone(doc);
  switch (edit.op) {
    case 'add_object':
      next.objects.push(edit.object);
      break;
    case 'move_object': {
      const o = next.objects.find((x) => x.id === edit.id);
      if (o) {
        o.x = edit.x;
        o.y = edit.y;
        if (Number.isFinite(edit.z)) o.z = edit.z;
      }
      break;
    }
    case 'resize_room': {
      const r = next.rooms.find((x) => x.id === edit.id);
      if (r) {
        r.w = edit.w;
        r.h = edit.h;
      }
      break;
    }
    case 'move_wall': {
      const w = next.walls.find((x) => x.id === edit.id);
      if (w) {
        w.x1 = edit.x1;
        w.y1 = edit.y1;
        w.x2 = edit.x2;
        w.y2 = edit.y2;
      }
      break;
    }
    case 'add_wall':
      next.walls.push(edit.wall);
      break;
    default:
      break;
  }
  return next;
}

/** Identical 10-step product test case for both variants. */
export function runLogicalTestCase(applyFn = applyEdit) {
  const steps = [];
  let doc = sampleWorld();
  const t0 = performance.now();

  // 1 place building in 2D (already present — re-place)
  doc = applyFn(doc, {
    op: 'move_object',
    id: 'building-1',
    x: 19,
    y: 15.5,
  });
  steps.push({ step: 1, ok: doc.objects[0].x === 19 && doc.objects[0].y === 15.5 });

  // 2 view in 3D — logical: height present
  steps.push({ step: 2, ok: Number(doc.objects[0].height) > 0 });

  // 3 move building in 3D
  doc = applyFn(doc, { op: 'move_object', id: 'building-1', x: 21, y: 16.2, z: 0 });
  steps.push({ step: 3, ok: doc.objects[0].x === 21 && doc.objects[0].y === 16.2 });

  // 4 change footprint in 2D
  doc = applyFn(doc, { op: 'resize_room', id: 'building-footprint', w: 7, h: 5.5 });
  const fp = doc.rooms.find((r) => r.id === 'building-footprint');
  steps.push({ step: 4, ok: fp && fp.w === 7 && fp.h === 5.5 });

  // 5 open dungeon (presence)
  steps.push({
    step: 5,
    ok: doc.rooms.some((r) => r.id === 'dungeon-room-a'),
  });

  // 6 change wall in top-down
  doc = applyFn(doc, {
    op: 'move_wall',
    id: 'wall-dun-a',
    x1: 18,
    y1: 20,
    x2: 22.5,
    y2: 20.4,
  });
  const wall = doc.walls.find((w) => w.id === 'wall-dun-a');
  steps.push({ step: 6, ok: wall && wall.x2 === 22.5 && wall.y2 === 20.4 });

  // 7 same result in 3D — same doc reference fields
  steps.push({ step: 7, ok: wall && wall.x2 === 22.5 });

  // 8 add object in 3D
  doc = applyFn(doc, {
    op: 'add_object',
    object: {
      id: 'prop-barrel',
      type: 'fass',
      x: 19.5,
      y: 21,
      size: 1,
      height: 1.1,
      angle: 0,
      z: 0,
    },
  });
  steps.push({ step: 8, ok: doc.objects.some((o) => o.id === 'prop-barrel') });

  // 9 verify in 2D
  steps.push({
    step: 9,
    ok: doc.objects.find((o) => o.id === 'prop-barrel')?.x === 19.5,
  });

  // 10 serialize / restore
  const json = JSON.stringify(doc);
  const restored = JSON.parse(json);
  steps.push({
    step: 10,
    ok:
      restored.objects.find((o) => o.id === 'building-1')?.x === 21 &&
      restored.objects.find((o) => o.id === 'prop-barrel')?.type === 'fass' &&
      restored.walls.find((w) => w.id === 'wall-dun-a')?.x2 === 22.5,
  });

  const ms = performance.now() - t0;
  return {
    ok: steps.every((s) => s.ok),
    steps,
    ms,
    byteLength: new TextEncoder().encode(json).length,
    objectCount: restored.objects.length,
    roomCount: restored.rooms.length,
    wallCount: restored.walls.length,
    doc: restored,
  };
}
