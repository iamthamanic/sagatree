/**
 * world-edge-quarantine — characterize unmounted Edge `world` Map worker (MIG-424/#840).
 * Location: server/src/modules/world/internal/world-edge-quarantine.ts
 *
 * Public activation stays false. Durable world_profiles / atlas / places APIs are
 * separate and must not call this quarantine.
 */

export const WORLD_EDGE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;
export const WORLD_EDGE_MAP_IS_DURABLE = false as const;

export type QuarantineWorldSettings = {
  ruleset: string;
  technology: 'ancient' | 'medieval' | 'renaissance' | 'modern' | 'future' | 'custom';
  magic: 'none' | 'low' | 'medium' | 'high' | 'ubiquitous';
  tone: 'serious' | 'lighthearted' | 'dark' | 'heroic';
  startingLevel: number;
  maxLevel: number;
};

export type QuarantineLocation = {
  id: string;
  name: string;
  type: 'city' | 'town' | 'village' | 'dungeon' | 'wilderness' | 'building' | 'room';
  parentId?: string;
  description?: string;
  coordinates?: { x: number; y: number };
  connections: string[];
  npcs: string[];
  items: string[];
  discovered: boolean;
};

export type QuarantineWorldEvent = {
  id: string;
  name: string;
  description?: string;
  type: 'plot' | 'random' | 'scheduled';
  timestamp: string;
  location?: string;
  participants: string[];
  consequences: string[];
};

export type QuarantineFaction = {
  id: string;
  name: string;
  type: 'kingdom' | 'guild' | 'cult' | 'tribe' | 'organization';
  description?: string;
  leader?: string;
  members: string[];
  relationships: Record<string, 'allied' | 'neutral' | 'hostile'>;
  goals: string[];
};

export type QuarantineWorldTime = {
  current: number;
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
  epoch: string;
  calendar: string;
};

export type QuarantineWeather = {
  current: string;
  temperature: number;
  wind: 'calm' | 'light' | 'moderate' | 'strong' | 'storm';
  precipitation: 'none' | 'light' | 'moderate' | 'heavy';
  special?: string;
};

export type QuarantineWorld = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  settings: QuarantineWorldSettings;
  locations: QuarantineLocation[];
  events: QuarantineWorldEvent[];
  factions: QuarantineFaction[];
  quests: string[];
  time: QuarantineWorldTime;
  weather: QuarantineWeather;
  createdAt: string;
  updatedAt: string;
};

export type WorldEdgeQuarantineStore = {
  readonly worlds: Map<string, QuarantineWorld>;
  idSeq: number;
};

export function createWorldEdgeQuarantineStore(): WorldEdgeQuarantineStore {
  return { worlds: new Map(), idSeq: 0 };
}

/** Edge parity: `crypto.randomUUID()`. Optional seq bump for fixture observability. */
function nextGeneratedId(store: WorldEdgeQuarantineStore): string {
  store.idSeq += 1;
  return crypto.randomUUID();
}

export function createQuarantineWorld(
  store: WorldEdgeQuarantineStore,
  data: {
    projectId: string;
    name: string;
    description?: string;
    settings?: Partial<QuarantineWorldSettings>;
  },
  nowIso: string,
  id?: string,
): QuarantineWorld {
  const worldId = id ?? nextGeneratedId(store);
  if (store.worlds.has(worldId)) {
    throw new Error('World already exists');
  }
  const world: QuarantineWorld = {
    id: worldId,
    projectId: data.projectId,
    name: data.name,
    description: data.description,
    settings: {
      ruleset: 'dnd5e',
      technology: 'medieval',
      magic: 'medium',
      tone: 'serious',
      startingLevel: 1,
      maxLevel: 20,
      ...data.settings,
    },
    locations: [],
    events: [],
    factions: [],
    quests: [],
    time: {
      current: 0,
      day: 1,
      month: 1,
      year: 1,
      hour: 8,
      minute: 0,
      epoch: 'Common Era',
      calendar: 'Gregorian',
    },
    weather: {
      current: 'clear',
      temperature: 20,
      wind: 'calm',
      precipitation: 'none',
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.worlds.set(worldId, world);
  return world;
}

export function getQuarantineWorld(
  store: WorldEdgeQuarantineStore,
  worldId: string,
): QuarantineWorld | null {
  return store.worlds.get(worldId) ?? null;
}

export function getQuarantineWorldByProject(
  store: WorldEdgeQuarantineStore,
  projectId: string,
): QuarantineWorld | null {
  for (const world of store.worlds.values()) {
    if (world.projectId === projectId) return world;
  }
  return null;
}

/**
 * Edge parity: shallow merge of Partial World without owner/auth checks.
 * Caller-supplied `id` is ignored (path id wins).
 */
export function updateQuarantineWorld(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  data: Partial<QuarantineWorld>,
  nowIso: string,
): QuarantineWorld {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const updated: QuarantineWorld = {
    ...world,
    ...data,
    id: worldId,
    updatedAt: nowIso,
  };
  store.worlds.set(worldId, updated);
  return updated;
}

export function addQuarantineLocation(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  data: Omit<QuarantineLocation, 'id'> & { discovered?: boolean },
  nowIso: string,
  id?: string,
): QuarantineLocation {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const location: QuarantineLocation = {
    id: id ?? nextGeneratedId(store),
    name: data.name,
    type: data.type,
    parentId: data.parentId,
    description: data.description,
    coordinates: data.coordinates ? { ...data.coordinates } : undefined,
    connections: [...(data.connections ?? [])],
    npcs: [...(data.npcs ?? [])],
    items: [...(data.items ?? [])],
    discovered: data.discovered ?? false,
  };
  const updated: QuarantineWorld = {
    ...world,
    locations: [...world.locations, location],
    updatedAt: nowIso,
  };
  store.worlds.set(worldId, updated);
  return location;
}

export function updateQuarantineLocation(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  locationId: string,
  data: Partial<QuarantineLocation>,
  nowIso: string,
): QuarantineLocation {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const index = world.locations.findIndex((l) => l.id === locationId);
  if (index === -1) throw new Error('Location not found');
  const locations = world.locations.map((loc, i) =>
    i === index
      ? {
          ...loc,
          ...data,
          connections: data.connections ? [...data.connections] : loc.connections,
          npcs: data.npcs ? [...data.npcs] : loc.npcs,
          items: data.items ? [...data.items] : loc.items,
          coordinates: data.coordinates ? { ...data.coordinates } : loc.coordinates,
        }
      : loc,
  );
  const updatedLoc = locations[index]!;
  store.worlds.set(worldId, { ...world, locations, updatedAt: nowIso });
  return updatedLoc;
}

export function discoverQuarantineLocation(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  locationId: string,
  nowIso: string,
): QuarantineLocation {
  return updateQuarantineLocation(store, worldId, locationId, { discovered: true }, nowIso);
}

export function addQuarantineEvent(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  data: Omit<QuarantineWorldEvent, 'id'>,
  nowIso: string,
  id?: string,
): QuarantineWorldEvent {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const event: QuarantineWorldEvent = {
    id: id ?? nextGeneratedId(store),
    name: data.name,
    description: data.description,
    type: data.type,
    timestamp: data.timestamp,
    location: data.location,
    participants: [...(data.participants ?? [])],
    consequences: [...(data.consequences ?? [])],
  };
  store.worlds.set(worldId, {
    ...world,
    events: [...world.events, event],
    updatedAt: nowIso,
  });
  return event;
}

export function getQuarantineEvents(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  type?: QuarantineWorldEvent['type'],
): QuarantineWorldEvent[] {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  if (type) return world.events.filter((e) => e.type === type);
  return [...world.events];
}

export function addQuarantineFaction(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  data: Omit<QuarantineFaction, 'id'>,
  nowIso: string,
  id?: string,
): QuarantineFaction {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const faction: QuarantineFaction = {
    id: id ?? nextGeneratedId(store),
    name: data.name,
    type: data.type,
    description: data.description,
    leader: data.leader,
    members: [...(data.members ?? [])],
    relationships: { ...(data.relationships ?? {}) },
    goals: [...(data.goals ?? [])],
  };
  store.worlds.set(worldId, {
    ...world,
    factions: [...world.factions, faction],
    updatedAt: nowIso,
  });
  return faction;
}

export function updateQuarantineFactionRelationship(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  factionId: string,
  targetId: string,
  status: 'allied' | 'neutral' | 'hostile',
  nowIso: string,
): QuarantineFaction {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const faction = world.factions.find((f) => f.id === factionId);
  if (!faction) throw new Error('Faction not found');
  const nextFaction: QuarantineFaction = {
    ...faction,
    relationships: { ...faction.relationships, [targetId]: status },
  };
  const factions = world.factions.map((f) => (f.id === factionId ? nextFaction : f));
  store.worlds.set(worldId, { ...world, factions, updatedAt: nowIso });
  return nextFaction;
}

/**
 * Edge parity: 30-day months labeled Gregorian; `hours` uses `hours || 1` default
 * (falsy → 1). Negative/nonfinite hours are intentionally unbounded here —
 * replacements must bound them independently before activation.
 */
export function advanceQuarantineTime(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  hours: number | undefined,
  nowIso: string,
): QuarantineWorldTime {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const delta = hours || 1;
  const time: QuarantineWorldTime = { ...world.time };
  time.current += delta;
  time.hour += delta;
  while (time.hour >= 24) {
    time.hour -= 24;
    time.day += 1;
    if (time.day > 30) {
      time.day = 1;
      time.month += 1;
      if (time.month > 12) {
        time.month = 1;
        time.year += 1;
      }
    }
  }
  store.worlds.set(worldId, { ...world, time, updatedAt: nowIso });
  return { ...time };
}

export function setQuarantineWeather(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  weather: Partial<QuarantineWeather>,
  nowIso: string,
): QuarantineWeather {
  const world = store.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  const next: QuarantineWeather = { ...world.weather, ...weather };
  store.worlds.set(worldId, { ...world, weather: next, updatedAt: nowIso });
  return { ...next };
}

/** Edge parity: Math.random temperature floor(random*40)-10 → -10..29. */
export function randomQuarantineWeather(
  store: WorldEdgeQuarantineStore,
  worldId: string,
  nowIso: string,
  rng: () => number = Math.random,
): QuarantineWeather {
  const weathers = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'];
  const winds: QuarantineWeather['wind'][] = ['calm', 'light', 'moderate', 'strong', 'storm'];
  const precipitations: QuarantineWeather['precipitation'][] = [
    'none',
    'light',
    'moderate',
    'heavy',
  ];
  const weather: QuarantineWeather = {
    current: weathers[Math.floor(rng() * weathers.length)]!,
    temperature: Math.floor(rng() * 40) - 10,
    wind: winds[Math.floor(rng() * winds.length)]!,
    precipitation: precipitations[Math.floor(rng() * precipitations.length)]!,
  };
  return setQuarantineWeather(store, worldId, weather, nowIso);
}

export function bodyFieldsAreNotAuthority(): readonly string[] {
  return [
    'projectId / settings / weather body fields are not ownership or GM authority',
    'No authentication or project ownership on Edge world Maps',
    'Arbitrary shallow Partial<World> updates overwrite nested references without deep merge',
  ];
}

export function describeWorldEdgeLegacyDefects(): readonly string[] {
  return [
    'No authentication or project ownership; arbitrary shallow updates allowed',
    'Clock labels Gregorian but uses 30-day months and lacks numeric bounds on advance hours',
    'Process-local Map is not durable across host restarts (WORLD_EDGE_MAP_IS_DURABLE=false)',
    'Negative/nonfinite/huge hours are not bounded in legacy advanceTime',
  ];
}
