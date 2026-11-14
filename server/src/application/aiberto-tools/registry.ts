/**
 * aiberto-tools registry — static Read/Nav catalog (AIB-06 / #1129).
 * Location: server/src/application/aiberto-tools/registry.ts
 *
 * Capabilities advertise tools; they are not authorization grants.
 */

export const AIBERTO_TOOL_IDS = [
  'rulebook.search',
  'rulebook.get_section',
  'character.list',
  'character.get',
  'inventory.list',
  'world.get',
  'session.get_state',
  'app.navigate',
] as const;

export type AibertoToolId = (typeof AIBERTO_TOOL_IDS)[number];

export type AibertoToolDef = {
  readonly id: AibertoToolId;
  readonly kind: 'read' | 'nav';
  readonly labelDe: string;
  readonly descriptionDe: string;
  readonly argsSchema: Readonly<Record<string, string>>;
};

export const AIBERTO_TOOL_REGISTRY: readonly AibertoToolDef[] = [
  {
    id: 'rulebook.search',
    kind: 'read',
    labelDe: 'Regelbuch suchen',
    descriptionDe: 'Suche im Core-Regelbuch (nur Lesen).',
    argsSchema: { query: 'string', limit: 'number?' },
  },
  {
    id: 'rulebook.get_section',
    kind: 'read',
    labelDe: 'Regelabschnitt laden',
    descriptionDe: 'Einen Abschnitt per stabiler Section-ID laden.',
    argsSchema: { sectionId: 'string' },
  },
  {
    id: 'character.list',
    kind: 'read',
    labelDe: 'Eigene Charaktere listen',
    descriptionDe: 'Nur Owned-Ports — keine Cross-Owner-Liste.',
    argsSchema: {},
  },
  {
    id: 'character.get',
    kind: 'read',
    labelDe: 'Eigenen Charakter laden',
    descriptionDe: 'Owned get; fremde IDs → DENY.',
    argsSchema: { characterId: 'string' },
  },
  {
    id: 'inventory.list',
    kind: 'read',
    labelDe: 'Inventar listen',
    descriptionDe: 'Owned Inventory des eigenen Charakters.',
    argsSchema: { characterId: 'string' },
  },
  {
    id: 'world.get',
    kind: 'read',
    labelDe: 'Welt lesen',
    descriptionDe: 'Policy world.read + öffentliche/ID-Ports.',
    argsSchema: { worldId: 'string?', publicId: 'string?' },
  },
  {
    id: 'session.get_state',
    kind: 'read',
    labelDe: 'Session-Status',
    descriptionDe: 'Mitgliedschaftsgeprüft; rollenspezifische Projektion (Server-Rolle).',
    argsSchema: { sessionId: 'string' },
  },
  {
    id: 'app.navigate',
    kind: 'nav',
    labelDe: 'Navigieren',
    descriptionDe: 'ClientAction nur für Allowlist-Routen.',
    argsSchema: { route: 'string' },
  },
] as const;

export function isAibertoToolId(value: string): value is AibertoToolId {
  return (AIBERTO_TOOL_IDS as readonly string[]).includes(value);
}

export function getAibertoToolDef(id: string): AibertoToolDef | null {
  if (!isAibertoToolId(id)) return null;
  return AIBERTO_TOOL_REGISTRY.find((t) => t.id === id) ?? null;
}

/** Public capabilities payload — not a permission grant. */
export function listAibertoToolCapabilities(): readonly {
  readonly id: AibertoToolId;
  readonly kind: 'read' | 'nav';
  readonly labelDe: string;
  readonly descriptionDe: string;
  readonly argsSchema: Readonly<Record<string, string>>;
}[] {
  return AIBERTO_TOOL_REGISTRY.map((t) => ({
    id: t.id,
    kind: t.kind,
    labelDe: t.labelDe,
    descriptionDe: t.descriptionDe,
    argsSchema: t.argsSchema,
  }));
}
