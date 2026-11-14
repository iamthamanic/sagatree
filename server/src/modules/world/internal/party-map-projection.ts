/**
 * party-map-projection — GM/player atlas payload redaction (ATL2-G01 / #1229).
 * Location: server/src/modules/world/internal/party-map-projection.ts
 *
 * Pure domain: strips GM-only secrets from layers + generator_meta for party view.
 * Host stores must call these helpers — never rely on client CSS hiding.
 */

/** Golden crypt ids + any entity flagged `secret: true`. */
export const UNIFIED_SECRET_IDS: ReadonlySet<string> = new Set(['s.crypt', 's.obj.crypt']);

/**
 * Parity with PostgreSQL `(json->>'flag')::boolean` + COALESCE defaults used in
 * get/list_world_atlas_map player redaction (094/102/105).
 */
export function coercePgBoolean(value: unknown, whenNull: boolean): boolean {
  if (value === undefined || value === null) return whenNull;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return whenNull;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return whenNull;
    if (['true', 't', 'yes', 'y', 'on', '1'].includes(normalized)) return true;
    if (['false', 'f', 'no', 'n', 'off', '0'].includes(normalized)) return false;
    return whenNull;
  }
  return whenNull;
}

export function featureIsSecret(props: Record<string, unknown>): boolean {
  return coercePgBoolean(props.secret, false) === true;
}

export function featureDiscovered(props: Record<string, unknown>): boolean {
  return coercePgBoolean(props.discovered, true) === true;
}

export function entityIsSecret(row: Record<string, unknown>): boolean {
  if (coercePgBoolean(row.secret, false) === true) return true;
  return typeof row.id === 'string' && UNIFIED_SECRET_IDS.has(row.id);
}

/** GeoJSON FeatureCollection → party-visible features only. */
export function filterPartyLayers(layers: Record<string, unknown>): Record<string, unknown> {
  const features = Array.isArray(layers.features) ? layers.features : [];
  const visible = features.filter((feat) => {
    if (!feat || typeof feat !== 'object' || Array.isArray(feat)) return false;
    const props = (feat as { properties?: unknown }).properties;
    if (!props || typeof props !== 'object' || Array.isArray(props)) return true;
    const p = props as Record<string, unknown>;
    if (featureIsSecret(p)) return false;
    return featureDiscovered(p);
  });
  return { type: 'FeatureCollection', features: visible };
}

export function redactUnifiedCanvasForParty(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const doc = raw as Record<string, unknown>;
  const filterList = (key: string): unknown => {
    const list = doc[key];
    if (!Array.isArray(list)) return list;
    return list.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
      return !entityIsSecret(item as Record<string, unknown>);
    });
  };
  return {
    ...doc,
    objects: filterList('objects'),
    rooms: filterList('rooms'),
    strokes: filterList('strokes'),
    walls: filterList('walls'),
    doors: filterList('doors'),
  };
}

/**
 * Party / player_view dungeon meta: atmospheric theme only.
 * Seed, confirmed, manualDirty, roomCount, and forge internals stay GM-only.
 */
export function redactDungeonMetaForParty(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  const themeRaw = typeof row.themeKey === 'string' ? row.themeKey.trim() : '';
  if (!themeRaw) return undefined;
  return { themeKey: themeRaw };
}

/**
 * Party generator_meta projection: unified canvas secrecy + dungeon allowlist.
 * Presentation keys (webglRuntime / mapFrame) stay; GM-only bags are dropped.
 */
export function redactPartyGeneratorMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    engine: typeof meta.engine === 'string' ? meta.engine : 'unified_canvas',
  };
  if (meta.unifiedCanvas !== undefined) {
    out.unifiedCanvas = redactUnifiedCanvasForParty(meta.unifiedCanvas);
  }
  if (meta.webglRuntime !== undefined) out.webglRuntime = meta.webglRuntime;
  if (meta.mapFrame !== undefined) out.mapFrame = meta.mapFrame;
  if (meta.dungeon !== undefined) {
    const dungeon = redactDungeonMetaForParty(meta.dungeon);
    if (dungeon) out.dungeon = dungeon;
  }
  return out;
}

/** True when any GM-secret entity remains in a party-projected canvas/layers payload. */
export function partyPayloadLeaksSecrets(payload: {
  readonly layers?: unknown;
  readonly generatorMeta?: unknown;
}): boolean {
  const layers = payload.layers;
  if (layers && typeof layers === 'object' && !Array.isArray(layers)) {
    const features = Array.isArray((layers as { features?: unknown }).features)
      ? ((layers as { features: unknown[] }).features)
      : [];
    for (const feat of features) {
      if (!feat || typeof feat !== 'object' || Array.isArray(feat)) continue;
      const props = (feat as { properties?: unknown }).properties;
      if (!props || typeof props !== 'object' || Array.isArray(props)) continue;
      const p = props as Record<string, unknown>;
      if (featureIsSecret(p) || featureDiscovered(p) === false) return true;
    }
  }
  const meta = payload.generatorMeta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const m = meta as Record<string, unknown>;
  const canvas = m.unifiedCanvas;
  if (canvas && typeof canvas === 'object' && !Array.isArray(canvas)) {
    for (const key of ['objects', 'rooms', 'strokes', 'walls', 'doors'] as const) {
      const list = (canvas as Record<string, unknown>)[key];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        if (entityIsSecret(item as Record<string, unknown>)) return true;
      }
    }
  }
  const dungeon = m.dungeon;
  if (dungeon && typeof dungeon === 'object' && !Array.isArray(dungeon)) {
    // Party may keep themeKey only — seed / forge / geometry bags are leaks.
    for (const key of Object.keys(dungeon as Record<string, unknown>)) {
      if (key !== 'themeKey') return true;
    }
  }
  return false;
}
