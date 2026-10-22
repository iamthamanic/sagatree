export type Actor = Readonly<{ userId: string }> | undefined;
export type ViewContext = Readonly<{ actor: Actor; sagaId: string | undefined }>;
export type MapView = Readonly<{
  id: string;
  worldId: string;
  title: string;
  revision: number;
  gmOnly: boolean;
  body: string;
  layers: string;
  gmNotes: string | null;
}>;
export type MapUpdate = Readonly<{
  mapId: string;
  title: string;
  expectedRevision: number;
  idempotencyKey: string;
  owner_user_id?: string;
  world_id?: string;
}>;
export type MapUpdateResult = Readonly<{ id: string; title: string; revision: number }>;
export type SessionView = Readonly<{ id: string; projectId: string; status: string; revision: number }>;
export interface ApplicationPort {
  listMaps(context: ViewContext): Promise<ReadonlyArray<MapView>>;
  getMap(mapId: string, context: ViewContext): Promise<MapView | null>;
  updateMapTitle(request: MapUpdate, actor: Actor): Promise<MapUpdateResult>;
  setSessionStatus(sessionId: string, status: string, context: ViewContext): Promise<SessionView>;
}
export interface AdapterHandle {
  app: ApplicationPort;
  close(): Promise<void>;
}
export class CommandError extends Error {
  constructor(public readonly code: 'DENIED' | 'CONFLICT' | 'INVALID_INPUT' | 'IDEMPOTENCY_MISMATCH' | 'INJECTED_FAILURE') {
    super(code);
    this.name = 'CommandError';
  }
}
export type FaultHook = (phase: 'after-map-update') => void;

export function validateUpdate(request: MapUpdate): void {
  if (!request.title.trim() || request.title.length > 160 ||
      !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0 ||
      !request.idempotencyKey || request.idempotencyKey.length > 80) {
    throw new CommandError('INVALID_INPUT');
  }
}
export function validateStatus(status: string): void {
  if (!['waiting', 'active', 'completed'].includes(status)) throw new CommandError('INVALID_INPUT');
}
