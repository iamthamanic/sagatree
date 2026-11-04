/**
 * App shell route table — pure pathname ↔ screen mapping (no React, no Supabase).
 * Location: src/app/shell/routing/routes.ts
 *
 * #133 History foundation + #276 Saga/Session public-id resource routes.
 */

import {
  isValidPublicResourceId,
  parsePublicResourceId,
} from '../../../domains/resource-id';

export type ShellViewId =
  | 'dashboard'
  | 'character-editor'
  | 'adventure-editor'
  | 'gamemaster'
  | 'marketplace'
  | 'library'
  | 'profile'
  | 'join'
  | 'session-join'
  | 'session-invite'
  | 'rulesets-test'
  | 'download'
  | 'item-create'
  | 'item-detail'
  | 'look-create'
  | 'look-edit'
  | 'npc-creature-create'
  | 'npc-creature-edit'
  | 'world-atlas'
  | 'saga-list'
  | 'saga-new'
  | 'saga-section'
  | 'saga-definition-create'
  | 'saga-definition-edit'
  | 'session-phase'
  | 'session-live'
  | 'character-public'
  | 'not-found';

export type SagaSectionId =
  | 'overview'
  | 'characters'
  | 'world'
  | 'map'
  | 'npc-creatures'
  | 'items'
  | 'quests'
  | 'lore'
  | 'sessions'
  | 'settings';

export type SessionPhaseId = 'prepare' | 'lobby' | 'live' | 'recap';

/** Neutral session URL resolves phase from persisted status in the app layer. */
export type SessionPhaseRouteId = SessionPhaseId | 'auto';

export type LiveViewId =
  | 'gamemaster'
  | 'player'
  | 'player-resolve'
  | 'display'
  | 'viewer'
  | 'director';

export type ResolvedRoute =
  | {
      kind: 'view';
      view: Exclude<
        ShellViewId,
        | 'item-detail'
        | 'item-create'
        | 'look-create'
        | 'look-edit'
        | 'npc-creature-create'
        | 'npc-creature-edit'
        | 'world-atlas'
        | 'saga-list'
        | 'saga-new'
        | 'saga-section'
        | 'saga-definition-create'
        | 'saga-definition-edit'
        | 'session-phase'
        | 'session-live'
        | 'character-public'
        | 'not-found'
      >;
    }
  | { kind: 'item-create'; typeSlug?: string }
  | { kind: 'item-detail'; itemId: string }
  | { kind: 'look-create' }
  | { kind: 'look-edit'; lookId: string }
  | { kind: 'npc-creature-create' }
  | { kind: 'npc-creature-edit'; definitionId: string }
  | { kind: 'world-atlas'; worldPublicId: string }
  | { kind: 'saga-list' }
  | { kind: 'saga-new' }
  | { kind: 'saga-section'; sagaPublicId: string; section: SagaSectionId }
  | { kind: 'saga-definition-create' }
  | { kind: 'saga-definition-edit'; sagaDefinitionId: string }
  | {
      kind: 'session-phase';
      sagaPublicId: string;
      sessionPublicId: string;
      phase: SessionPhaseRouteId;
    }
  | {
      kind: 'session-live';
      sagaPublicId: string;
      sessionPublicId: string;
      liveView: LiveViewId;
      characterPublicId?: string;
    }
  | {
      kind: 'character-public';
      characterPublicId: string;
      mode: 'view' | 'edit';
    }
  | { kind: 'not-found'; attemptedPath: string };

const VIEW_PATHS: Record<
  Exclude<
    ShellViewId,
    | 'item-detail'
    | 'item-create'
    | 'look-create'
    | 'look-edit'
    | 'npc-creature-create'
    | 'npc-creature-edit'
    | 'world-atlas'
    | 'saga-list'
    | 'saga-new'
    | 'saga-section'
    | 'saga-definition-create'
    | 'saga-definition-edit'
    | 'session-phase'
    | 'session-live'
    | 'character-public'
    | 'not-found'
  >,
  string
> = {
  dashboard: '/',
  library: '/library',
  'character-editor': '/character-editor',
  'adventure-editor': '/adventure-editor',
  gamemaster: '/gamemaster',
  marketplace: '/marketplace',
  /** Legacy bookmark; canonical entry is `/settings/profile` via pathForView. */
  profile: '/profile',
  join: '/join',
  'session-join': '/session-join',
  'session-invite': '/session-invite',
  'rulesets-test': '/rulesets-test',
  /** Public marketing page (also handled outside AuthGate). */
  download: '/download',
};

/** Legacy aliases still emitted by Dashboard / older callers. */
const VIEW_ALIASES: Record<
  string,
  keyof typeof VIEW_PATHS | 'item-create' | 'npc-creature-create' | 'saga-list'
> = {
  'project-join': 'join',
  'session-start': 'session-join',
  home: 'dashboard',
  sagas: 'saga-list',
  settings: 'profile',
  get: 'download',
};

const PATH_TO_VIEW = new Map<string, keyof typeof VIEW_PATHS>(
  Object.entries(VIEW_PATHS).map(([view, path]) => [path, view as keyof typeof VIEW_PATHS]),
);

const SAGA_SECTIONS = new Set<SagaSectionId>([
  'overview',
  'characters',
  'world',
  'map',
  'npc-creatures',
  'items',
  'quests',
  'lore',
  'sessions',
  'settings',
]);

function normalizePathname(pathname: string): string {
  const raw = pathname.trim() || '/';
  return raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function requireSagaPublicId(raw: string): string | null {
  const value = decodeSegment(raw).trim().toUpperCase();
  return isValidPublicResourceId(value, 'saga') ? value : null;
}

function requireSessionPublicId(raw: string): string | null {
  const value = decodeSegment(raw).trim().toUpperCase();
  return isValidPublicResourceId(value, 'session') ? value : null;
}

function requireCharacterPublicId(raw: string): string | null {
  const value = decodeSegment(raw).trim().toUpperCase();
  return isValidPublicResourceId(value, 'character') ? value : null;
}

export function normalizeViewId(raw: string): string {
  return VIEW_ALIASES[raw] ?? raw;
}

export function pathForView(viewId: string): string | null {
  const normalized = normalizeViewId(viewId);
  if (normalized === 'item-create') return '/items/create';
  if (normalized === 'look-create') return '/looks/create';
  if (normalized === 'npc-creature-create') return '/npc-creatures/create';
  if (normalized === 'saga-list') return '/sagas';
  // Shell "Bibliothek" lands on player-characters (slash router, not bare /library).
  if (normalized === 'library') return pathForLibraryTab('characters');
  // Account settings: tabbed surface under /settings/:tab (not bare /profile).
  if (normalized === 'profile') return pathForSettingsTab('profile');
  if (normalized in VIEW_PATHS) {
    return VIEW_PATHS[normalized as keyof typeof VIEW_PATHS];
  }
  return null;
}

export function pathForItemDetail(itemId: string): string {
  const safe = encodeURIComponent(itemId.trim());
  return `/items/${safe}`;
}

/** Typed create forge: `/items/create/new/waffe` */
export function pathForItemCreateType(typeSlug: string): string {
  const safe = encodeURIComponent(typeSlug.trim().toLowerCase());
  return `/items/create/new/${safe}`;
}

export function pathForLookCreate(): string {
  return '/looks/create';
}

export function pathForLookEdit(lookId: string): string {
  const safe = encodeURIComponent(lookId.trim());
  return `/looks/${safe}`;
}

export function pathForNpcCreatureCreate(): string {
  return '/npc-creatures/create';
}

export function pathForNpcCreatureEdit(definitionId: string): string {
  const safe = encodeURIComponent(definitionId.trim());
  return `/npc-creatures/${safe}`;
}

/** Library entity tabs — `adventures` is the Sagas tab in the UI. */
export type LibraryTabId =
  | 'characters'
  | 'npcs'
  | 'adventures'
  | 'worlds'
  | 'items'
  | 'looks';

/** Canonical slash segments under `/library/…` (History API router). */
export const LIBRARY_TAB_PATH_SEGMENTS: Record<LibraryTabId, string> = {
  characters: 'player-characters',
  npcs: 'npc-creatures',
  adventures: 'sagas',
  worlds: 'worlds',
  items: 'items',
  looks: 'looks',
};

/** Path segment + legacy query aliases (`?tab=` / old names). */
const LIBRARY_TAB_ALIASES: Record<string, LibraryTabId> = {
  characters: 'characters',
  charaktere: 'characters',
  'player-characters': 'characters',
  'player-character': 'characters',
  npcs: 'npcs',
  'npc-creatures': 'npcs',
  adventures: 'adventures',
  sagas: 'adventures',
  worlds: 'worlds',
  welten: 'worlds',
  items: 'items',
  looks: 'looks',
};

export function parseLibraryTabParam(raw: string | null | undefined): LibraryTabId | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  // Own-property only — avoid Object.prototype keys like `constructor`.
  if (!Object.prototype.hasOwnProperty.call(LIBRARY_TAB_ALIASES, key)) {
    return null;
  }
  return LIBRARY_TAB_ALIASES[key] ?? null;
}

/**
 * Resolve library tab from pathname (`/library`, `/library/sagas`, …).
 * Returns null when the path is not a library route.
 */
export function parseLibraryTabFromPathname(pathname: string): LibraryTabId | null {
  const path = normalizePathname(pathname);
  if (path === '/library') return 'characters';
  const match = path.match(/^\/library\/([^/]+)$/);
  if (!match) return null;
  return parseLibraryTabParam(match[1] ?? '');
}

/** Deep-link into Bibliothek tab via slash path (e.g. `/library/player-characters`). */
export function pathForLibraryTab(tab: LibraryTabId = 'characters'): string {
  return `/library/${LIBRARY_TAB_PATH_SEGMENTS[tab]}`;
}

/** Account settings tabs under `/settings/…` (shell profile view). */
export type SettingsTabId =
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'audio-video'
  | 'language'
  | 'ai'
  | 'danger';

/** Canonical slash segments under `/settings/…`. */
export const SETTINGS_TAB_PATH_SEGMENTS: Record<SettingsTabId, string> = {
  profile: 'profile',
  appearance: 'appearance',
  notifications: 'notifications',
  'audio-video': 'audio-video',
  language: 'language',
  ai: 'ai',
  danger: 'danger',
};

/** Path segment + legacy German tab ids / `/profile` aliases. */
const SETTINGS_TAB_ALIASES: Record<string, SettingsTabId> = {
  profile: 'profile',
  profil: 'profile',
  appearance: 'appearance',
  darstellung: 'appearance',
  notifications: 'notifications',
  benachrichtigungen: 'notifications',
  'audio-video': 'audio-video',
  language: 'language',
  sprache: 'language',
  ai: 'ai',
  danger: 'danger',
  gefahrenbereich: 'danger',
  'danger-zone': 'danger',
};

export function parseSettingsTabParam(raw: string | null | undefined): SettingsTabId | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SETTINGS_TAB_ALIASES, key)) {
    return null;
  }
  return SETTINGS_TAB_ALIASES[key] ?? null;
}

/**
 * Resolve settings tab from pathname (`/settings`, `/settings/ai`, `/profile`, …).
 * Returns null when the path is not an account-settings route.
 */
export function parseSettingsTabFromPathname(pathname: string): SettingsTabId | null {
  const path = normalizePathname(pathname);
  if (path === '/settings' || path === '/profile') return 'profile';
  const match = path.match(/^\/settings\/([^/]+)$/);
  if (!match) return null;
  return parseSettingsTabParam(match[1] ?? '');
}

/** Deep-link into account settings tab (e.g. `/settings/ai`). */
export function pathForSettingsTab(tab: SettingsTabId = 'profile'): string {
  return `/settings/${SETTINGS_TAB_PATH_SEGMENTS[tab]}`;
}

/**
 * "Alle Sagas" and other saga-list entry points open Bibliothek → Sagas tab.
 * Direct `/sagas` still resolves to SagaResourceScreen for bookmarked URLs.
 */
export function pathForSagaList(): string {
  return pathForLibraryTab('adventures');
}

export function pathForSagaNew(): string {
  return '/sagas/new';
}

/** Story definition editor (UUID of saga_definitions — not SA- public id). */
export function pathForSagaDefinitionCreate(): string {
  return '/story-definitions/new';
}

export function pathForSagaDefinitionEdit(sagaDefinitionId: string): string {
  const safe = encodeURIComponent(sagaDefinitionId.trim());
  return `/story-definitions/${safe}/edit`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export function pathForSagaSection(
  sagaPublicId: string,
  section: SagaSectionId = 'overview',
): string {
  const id = sagaPublicId.trim().toUpperCase();
  if (section === 'overview') return `/sagas/${encodeURIComponent(id)}/overview`;
  // Hard AC #702: Saga → Welt → Karte deep link
  if (section === 'map') return `/sagas/${encodeURIComponent(id)}/world/map`;
  return `/sagas/${encodeURIComponent(id)}/${section}`;
}

/** Library → Welten → Karte (#702). */
export function pathForWorldAtlas(worldPublicId: string): string {
  const id = encodeURIComponent(worldPublicId.trim().toUpperCase());
  return `/library/worlds/${id}/map`;
}

export function pathForSessionPhase(
  sagaPublicId: string,
  sessionPublicId: string,
  phase: SessionPhaseId,
): string {
  const saga = encodeURIComponent(sagaPublicId.trim().toUpperCase());
  const session = encodeURIComponent(sessionPublicId.trim().toUpperCase());
  return `/sagas/${saga}/sessions/${session}/${phase}`;
}

export function pathForSessionLive(
  sagaPublicId: string,
  sessionPublicId: string,
  liveView: Exclude<LiveViewId, 'player-resolve'>,
  characterPublicId?: string,
): string {
  const base = pathForSessionPhase(sagaPublicId, sessionPublicId, 'live');
  if (liveView === 'player') {
    if (!characterPublicId) return `${base}/player`;
    return `${base}/player/${encodeURIComponent(characterPublicId.trim().toUpperCase())}`;
  }
  return `${base}/${liveView}`;
}

export function pathForCharacterPublic(
  characterPublicId: string,
  mode: 'view' | 'edit' = 'view',
): string {
  const id = encodeURIComponent(characterPublicId.trim().toUpperCase());
  return mode === 'edit' ? `/characters/${id}/edit` : `/characters/${id}`;
}

function resolveStoryDefinitionRoutes(path: string): ResolvedRoute | null {
  if (path === '/story-definitions/new') return { kind: 'saga-definition-create' };
  const edit = path.match(/^\/story-definitions\/([^/]+)\/edit$/);
  if (edit) {
    const sagaDefinitionId = decodeSegment(edit[1] ?? '').trim();
    if (!sagaDefinitionId || !isUuid(sagaDefinitionId)) {
      return { kind: 'not-found', attemptedPath: path };
    }
    return { kind: 'saga-definition-edit', sagaDefinitionId };
  }
  return null;
}

function resolveSagaRoutes(path: string): ResolvedRoute | null {
  const story = resolveStoryDefinitionRoutes(path);
  if (story) return story;

  if (path === '/sagas') return { kind: 'saga-list' };
  if (path === '/sagas/new') return { kind: 'saga-new' };

  const sagaOnly = path.match(/^\/sagas\/([^/]+)$/);
  if (sagaOnly) {
    const sagaPublicId = requireSagaPublicId(sagaOnly[1] ?? '');
    if (!sagaPublicId) return { kind: 'not-found', attemptedPath: path };
    return { kind: 'saga-section', sagaPublicId, section: 'overview' };
  }

  const sagaWorldMap = path.match(/^\/sagas\/([^/]+)\/world\/map$/);
  if (sagaWorldMap) {
    const sagaPublicId = requireSagaPublicId(sagaWorldMap[1] ?? '');
    if (!sagaPublicId) return { kind: 'not-found', attemptedPath: path };
    return { kind: 'saga-section', sagaPublicId, section: 'map' };
  }

  const sagaSection = path.match(/^\/sagas\/([^/]+)\/([^/]+)$/);
  if (sagaSection) {
    const sagaPublicId = requireSagaPublicId(sagaSection[1] ?? '');
    const sectionRaw = sagaSection[2] ?? '';
    if (!sagaPublicId) return { kind: 'not-found', attemptedPath: path };
    if (sectionRaw === 'sessions') {
      return { kind: 'saga-section', sagaPublicId, section: 'sessions' };
    }
    if (sectionRaw === 'map') {
      return { kind: 'saga-section', sagaPublicId, section: 'map' };
    }
    if (SAGA_SECTIONS.has(sectionRaw as SagaSectionId)) {
      return {
        kind: 'saga-section',
        sagaPublicId,
        section: sectionRaw as SagaSectionId,
      };
    }
    return { kind: 'not-found', attemptedPath: path };
  }

  const sessionRoot = path.match(/^\/sagas\/([^/]+)\/sessions\/([^/]+)$/);
  if (sessionRoot) {
    const sagaPublicId = requireSagaPublicId(sessionRoot[1] ?? '');
    const sessionPublicId = requireSessionPublicId(sessionRoot[2] ?? '');
    if (!sagaPublicId || !sessionPublicId) {
      return { kind: 'not-found', attemptedPath: path };
    }
    // Neutral session route — app resolves phase from status.
    return {
      kind: 'session-phase',
      sagaPublicId,
      sessionPublicId,
      phase: 'auto',
    };
  }

  const sessionPhase = path.match(
    /^\/sagas\/([^/]+)\/sessions\/([^/]+)\/(prepare|lobby|live|recap)$/,
  );
  if (sessionPhase) {
    const sagaPublicId = requireSagaPublicId(sessionPhase[1] ?? '');
    const sessionPublicId = requireSessionPublicId(sessionPhase[2] ?? '');
    const phase = sessionPhase[3] as SessionPhaseId;
    if (!sagaPublicId || !sessionPublicId) {
      return { kind: 'not-found', attemptedPath: path };
    }
    return { kind: 'session-phase', sagaPublicId, sessionPublicId, phase };
  }

  const livePlayerChar = path.match(
    /^\/sagas\/([^/]+)\/sessions\/([^/]+)\/live\/player\/([^/]+)$/,
  );
  if (livePlayerChar) {
    const sagaPublicId = requireSagaPublicId(livePlayerChar[1] ?? '');
    const sessionPublicId = requireSessionPublicId(livePlayerChar[2] ?? '');
    const characterPublicId = requireCharacterPublicId(livePlayerChar[3] ?? '');
    if (!sagaPublicId || !sessionPublicId || !characterPublicId) {
      return { kind: 'not-found', attemptedPath: path };
    }
    return {
      kind: 'session-live',
      sagaPublicId,
      sessionPublicId,
      liveView: 'player',
      characterPublicId,
    };
  }

  const liveView = path.match(
    /^\/sagas\/([^/]+)\/sessions\/([^/]+)\/live\/(gamemaster|player|display|viewer|director)$/,
  );
  if (liveView) {
    const sagaPublicId = requireSagaPublicId(liveView[1] ?? '');
    const sessionPublicId = requireSessionPublicId(liveView[2] ?? '');
    const view = liveView[3] as 'gamemaster' | 'player' | 'display' | 'viewer' | 'director';
    if (!sagaPublicId || !sessionPublicId) {
      return { kind: 'not-found', attemptedPath: path };
    }
    return {
      kind: 'session-live',
      sagaPublicId,
      sessionPublicId,
      liveView: view === 'player' ? 'player-resolve' : view,
    };
  }

  if (path.startsWith('/sagas/')) {
    return { kind: 'not-found', attemptedPath: path };
  }

  return null;
}

function resolveCharacterRoutes(path: string): ResolvedRoute | null {
  const edit = path.match(/^\/characters\/([^/]+)\/edit$/);
  if (edit) {
    const characterPublicId = requireCharacterPublicId(edit[1] ?? '');
    if (!characterPublicId) return { kind: 'not-found', attemptedPath: path };
    return { kind: 'character-public', characterPublicId, mode: 'edit' };
  }

  const view = path.match(/^\/characters\/([^/]+)$/);
  if (view) {
    const characterPublicId = requireCharacterPublicId(view[1] ?? '');
    if (!characterPublicId) return { kind: 'not-found', attemptedPath: path };
    return { kind: 'character-public', characterPublicId, mode: 'view' };
  }

  if (path.startsWith('/characters/')) {
    return { kind: 'not-found', attemptedPath: path };
  }

  return null;
}

export function resolvePathname(pathname: string): ResolvedRoute {
  const path = normalizePathname(pathname);

  // Alias for marketing download landing (canonical `/download`).
  if (path === '/get') {
    return { kind: 'view', view: 'download' };
  }

  const sagaRoute = resolveSagaRoutes(path);
  if (sagaRoute) return sagaRoute;

  const characterRoute = resolveCharacterRoutes(path);
  if (characterRoute) return characterRoute;

  const createTypedMatch = path.match(/^\/items\/create\/new\/([^/]+)$/);
  if (createTypedMatch) {
    let typeSlug = createTypedMatch[1] ?? '';
    typeSlug = decodeSegment(typeSlug).trim().toLowerCase();
    if (!typeSlug) {
      return { kind: 'not-found', attemptedPath: path };
    }
    return { kind: 'item-create', typeSlug };
  }

  if (path === '/items/create') {
    return { kind: 'item-create' };
  }

  // Reject unknown /items/create/... so they don't fall through as item ids.
  if (path.startsWith('/items/create/')) {
    return { kind: 'not-found', attemptedPath: path };
  }

  const itemMatch = path.match(/^\/items\/([^/]+)$/);
  if (itemMatch) {
    let itemId = decodeSegment(itemMatch[1] ?? '').trim();
    // Prefer public IT- ids when present; legacy internal ids still accepted.
    const parsed = parsePublicResourceId(itemId);
    if (parsed?.kind === 'item') {
      itemId = parsed.value;
    }
    if (!itemId || itemId === 'create') {
      return { kind: 'not-found', attemptedPath: path };
    }
    return { kind: 'item-detail', itemId };
  }

  if (path === '/looks/create') {
    return { kind: 'look-create' };
  }

  if (path.startsWith('/looks/create/')) {
    return { kind: 'not-found', attemptedPath: path };
  }

  const lookMatch = path.match(/^\/looks\/([^/]+)$/);
  if (lookMatch) {
    const lookId = decodeSegment(lookMatch[1] ?? '').trim();
    if (!lookId || lookId === 'create') {
      return { kind: 'not-found', attemptedPath: path };
    }
    return { kind: 'look-edit', lookId };
  }

  if (path.startsWith('/looks/')) {
    return { kind: 'not-found', attemptedPath: path };
  }

  if (path === '/npc-creatures/create') {
    return { kind: 'npc-creature-create' };
  }

  if (path.startsWith('/npc-creatures/create/')) {
    return { kind: 'not-found', attemptedPath: path };
  }

  const npcMatch = path.match(/^\/npc-creatures\/([^/]+)$/);
  if (npcMatch) {
    let definitionId = decodeSegment(npcMatch[1] ?? '').trim();
    const parsed = parsePublicResourceId(definitionId);
    if (parsed?.kind === 'npcCreature') {
      definitionId = parsed.value;
    }
    if (!definitionId || definitionId === 'create') {
      return { kind: 'not-found', attemptedPath: path };
    }
    return { kind: 'npc-creature-edit', definitionId };
  }

  const libraryWorldMap = path.match(/^\/library\/worlds\/([^/]+)\/map$/);
  if (libraryWorldMap) {
    const worldPublicId = decodeSegment(libraryWorldMap[1] ?? '').trim().toUpperCase();
    const parsed = parsePublicResourceId(worldPublicId);
    if (!parsed || parsed.kind !== 'world') {
      return { kind: 'not-found', attemptedPath: path };
    }
    return { kind: 'world-atlas', worldPublicId: parsed.value };
  }

  const libraryTabMatch = path.match(/^\/library\/([^/]+)$/);
  if (libraryTabMatch) {
    if (parseLibraryTabParam(libraryTabMatch[1] ?? '')) {
      return { kind: 'view', view: 'library' };
    }
    return { kind: 'not-found', attemptedPath: path };
  }

  if (path === '/settings') {
    return { kind: 'view', view: 'profile' };
  }

  const settingsTabMatch = path.match(/^\/settings\/([^/]+)$/);
  if (settingsTabMatch) {
    if (parseSettingsTabParam(settingsTabMatch[1] ?? '')) {
      return { kind: 'view', view: 'profile' };
    }
    return { kind: 'not-found', attemptedPath: path };
  }

  if (path.startsWith('/settings/')) {
    return { kind: 'not-found', attemptedPath: path };
  }

  const view = PATH_TO_VIEW.get(path);
  if (view) {
    return { kind: 'view', view };
  }

  return { kind: 'not-found', attemptedPath: path };
}

export function routeToShellView(route: ResolvedRoute): ShellViewId {
  switch (route.kind) {
    case 'view':
      return route.view;
    case 'item-create':
      return 'item-create';
    case 'item-detail':
      return 'item-detail';
    case 'look-create':
      return 'look-create';
    case 'look-edit':
      return 'look-edit';
    case 'npc-creature-create':
      return 'npc-creature-create';
    case 'npc-creature-edit':
      return 'npc-creature-edit';
    case 'world-atlas':
      return 'world-atlas';
    case 'saga-list':
      return 'saga-list';
    case 'saga-new':
      return 'saga-new';
    case 'saga-section':
      return 'saga-section';
    case 'saga-definition-create':
      return 'saga-definition-create';
    case 'saga-definition-edit':
      return 'saga-definition-edit';
    case 'session-phase':
      return 'session-phase';
    case 'session-live':
      return 'session-live';
    case 'character-public':
      return 'character-public';
    case 'not-found':
      return 'not-found';
  }
}

export function knownViewIds(): string[] {
  return [
    ...Object.keys(VIEW_PATHS),
    'item-create',
    'item-detail',
    'look-create',
    'look-edit',
    'npc-creature-create',
    'npc-creature-edit',
    'world-atlas',
    'saga-list',
    'saga-new',
    'saga-section',
    'saga-definition-create',
    'saga-definition-edit',
    'session-phase',
    'session-live',
    'character-public',
  ];
}
