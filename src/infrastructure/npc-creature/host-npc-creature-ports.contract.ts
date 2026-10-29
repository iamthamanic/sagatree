/**
 * Host-aligned NpcCreature ports contract (MIG-307 / #806).
 * Location: src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/npc-creature` ports.
 * Supabase facades remain live until cutover; this documents the host shape
 * for parity checks without importing the Node host package.
 */

export type HostNpcCreatureResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type HostNpcDefinitionRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly scope: 'personal' | 'world' | 'core' | 'builtin';
  readonly worldProfileId: string | null;
  readonly ownerUserId: string | null;
  readonly status: 'active' | 'archived';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type HostNpcInstanceRow = {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly definitionId: string;
  readonly displayName: string;
  readonly instanceKind: string;
  readonly sequenceNumber: number;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly runtime: Readonly<Record<string, unknown>>;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type HostNpcControllerAssignmentRow = {
  readonly projectId: string;
  readonly definitionId: string;
  readonly controllerUserId: string | null;
  readonly assignedBy: string;
  readonly updatedAt: string;
};

/**
 * Actor id is the verified host actor — never a client-claimed owner.
 * Ports mirror host createNpcCreaturePorts surface (no HTTP in this slice).
 */
export type HostNpcCreaturePorts = {
  readonly listDefinitions: (
    actorId: string,
    options?: {
      readonly scope?: 'personal' | 'world' | 'core' | 'builtin';
      readonly worldProfileId?: string | null;
      readonly includeArchived?: boolean;
    },
  ) => Promise<HostNpcCreatureResult<readonly HostNpcDefinitionRecord[]>>;
  readonly getDefinition: (
    actorId: string,
    definitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord | null>>;
  readonly createDefinition: (
    actorId: string,
    input: {
      readonly scope: 'personal' | 'world';
      readonly worldProfileId?: string | null;
      readonly draft: unknown;
    },
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly updateDefinition: (
    actorId: string,
    definitionId: string,
    draft: unknown,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly archiveDefinition: (
    actorId: string,
    definitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly restoreDefinition: (
    actorId: string,
    definitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly duplicateDefinition: (
    actorId: string,
    sourceDefinitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly assignController: (
    actorId: string,
    projectId: string,
    definitionId: string,
    controllerUserId: string | null,
  ) => Promise<HostNpcCreatureResult<HostNpcControllerAssignmentRow>>;
  readonly spawnInstance: (
    actorId: string,
    input: {
      readonly projectId: string;
      readonly definitionId: string;
      readonly instanceKind: string;
      readonly snapshot: unknown;
      readonly runtime: unknown;
      readonly displayName: string;
      readonly sequenceNumber: number;
      readonly sessionId?: string | null;
    },
  ) => Promise<HostNpcCreatureResult<HostNpcInstanceRow>>;
  readonly updateRuntime: (
    actorId: string,
    instanceId: string,
    runtime: unknown,
  ) => Promise<HostNpcCreatureResult<HostNpcInstanceRow>>;
  readonly removeInstance: (
    actorId: string,
    instanceId: string,
  ) => Promise<HostNpcCreatureResult<{ readonly id: string }>>;
  readonly clearTempControllersForSession: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostNpcCreatureResult<{ readonly cleared: number }>>;
};

/** Stable operation names for composition / future HTTP cutover documentation. */
export const HOST_NPC_CREATURE_OPS = [
  'listDefinitions',
  'getDefinition',
  'createDefinition',
  'updateDefinition',
  'archiveDefinition',
  'restoreDefinition',
  'duplicateDefinition',
  'assignController',
  'spawnInstance',
  'updateRuntime',
  'removeInstance',
  'clearTempControllersForSession',
] as const;

export type HostNpcCreatureOp = (typeof HOST_NPC_CREATURE_OPS)[number];
