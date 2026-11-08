# Infrastructure contract: look

**Status: SPEC; current branch source verified.** Implementation issue: **#803**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-look.json](source-contracts/infra-look.json) (SHA-256 `925a76a3f68a866e5921032ab9d952fa837cca47926d44d40eed2461e7ede56e`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Look profile repository stores serialized domain payload and public IDs; reference analysis is an Edge request; runtime material/shader adapters are browser-side behavior.

Look personal scope stays owner-only; storage refs accepted for vision must be caller-scoped. Runtime providers/config metadata never become private persisted credentials.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 1. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| infra | `character` | #801 |  |

## Acceptance and negative tests (required, not executed)

- Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
- Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
- Local look runtime adapters remain unchanged by persistence transport replacement.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### fetch: requestUrl

`src/infrastructure/look/look-reference-analysis-service.ts:130` — dynamic-expression.

Exact call/query chain:
```ts
fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
```

Enclosing operation: `src/infrastructure/look/look-reference-analysis-service.ts:114`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/look/adapters/host-mtoon-look-adapter.ts:78

```ts
export function createHostMtoonLookAdapter(): LookStyleAdapter {
  const profile = createSagaTreeMToonProfileV1();

  return {
    id: 'host-mtoon',
    isAvailable: () => true,
    unavailableReasonDe: null,
    restoreBaseline: (target) => {
      restoreSnapshots(target);
      const scene = asScene(target.scene);
      const lights = asLights(target.styleLights);
      if (scene && lights) {
        applyNeutralPreviewLights(scene, lights);
      }
      return {
        status: 'restored',
        providerId: 'host-mtoon',
        profileId: null,
        version: null,
        executionMode: null,
        capabilities: [],
        noticeDe: null,
      };
    },
    apply: ({ version, target, executionMode }) => {
      restoreSnapshots(target);
      const root = asObject3D(target.root);
      const scene = asScene(target.scene);
      const lights = asLights(target.styleLights);
      const applied = new Set<LookCapability>();

      if (!root || !scene || !lights) {
        return {
          status: 'unsupported',
          providerId: 'host-mtoon',
          profileId: version.profileId,
          version: version.version,
          executionMode,
          capabilities: capabilityResults(version, applied),
          noticeDe: 'Look-Ziel (Root/Scene/Lights) fehlt.',
        };
      }

      if (version.capabilities.includes('lighting')) {
        applyMtoonProfileToScene(scene, lights, profile);
        applied.add('lighting');
      } else {
        applyNeutralPreviewLights(scene, lights);
      }

      if (version.capabilities.includes('character')) {
        applyMtoonProfileToModel({
          root,
          profile,
          isImportModel: target.isImportModel,
          colors: {
            skin: target.colors.skin,
            hair: target.colors.hair,
            clothing: target.colors.clothing,
            eyes: target.colors.eyes,
          },
        });
        applied.add('character');
      }

      if (version.capabilities.includes('postFx')) {
        applied.add('postFx');
      }

      const caps = capabilityResults(version, applied);
      const anyApplied = caps.some((c) => c.status === 'applied' || c.status === 'partial');
      return {
        status: anyApplied ? (caps.every((c) => c.status === 'applied') ? 'applied' : 'partial') : 'unsupported',
        providerId: 'host-mtoon',
        profileId: version.profileId,
        version: version.version,
        executionMode,
        capabilities: caps,
        noticeDe: null,
      };
    },
  };
}
```

### src/infrastructure/look/adapters/toonlab-look-adapter.ts:26

```ts
export function createToonLabLookAdapter(): LookStyleAdapter {
  const decision = evaluateToonLabCompatibilitySpike();
  const available = decision.verdict === 'GO';

  return {
    id: 'toonlab',
    isAvailable: () => available,
    unavailableReasonDe: available ? null : BLOCKED_DE,
    apply: ({ version }) => blockedResult(version.profileId, version.version),
    restoreBaseline: () => blockedResult(null, null),
  };
}
```

### src/infrastructure/look/host-look-adapter.ts:12

```ts
export type HostLookAdapter = HostLookProfilePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_LOOK_PROFILE_OPS;
};
```

### src/infrastructure/look/host-look-adapter.ts:21

```ts
export function createHostLookAdapter(ports: HostLookProfilePorts): HostLookAdapter {
  return {
    transport: 'host',
    ops: HOST_LOOK_PROFILE_OPS,
    listProfiles: (actorId, options) => ports.listProfiles(actorId, options),
    getProfileById: (actorId, profileId) => ports.getProfileById(actorId, profileId),
    createProfile: (actorId, draft) => ports.createProfile(actorId, draft),
    appendVersion: (actorId, profileId, draft) =>
      ports.appendVersion(actorId, profileId, draft),
    archiveProfile: (actorId, profileId) => ports.archiveProfile(actorId, profileId),
    duplicateProfile: (actorId, sourceProfileId, displayName) =>
      ports.duplicateProfile(actorId, sourceProfileId, displayName),
    listVersions: (actorId, profileId) => ports.listVersions(actorId, profileId),
  };
}
```

### src/infrastructure/look/host-look-ports.contract.ts:10

```ts
export type HostLookProfileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/look/host-look-ports.contract.ts:14

```ts
export type HostLookReference = {
  readonly id: string;
  readonly kind: 'style' | 'content';
  readonly uri: string;
  readonly label?: string;
  readonly weight?: number;
};
```

### src/infrastructure/look/host-look-ports.contract.ts:22

```ts
export type HostLookProfileVersion = {
  readonly profileId: string;
  readonly version: number;
  readonly source: string;
  readonly displayName: string;
  readonly references: readonly HostLookReference[];
  readonly capabilities: readonly string[];
  readonly executionModes: readonly string[];
  readonly createdAtIso: string;
};
```

### src/infrastructure/look/host-look-ports.contract.ts:33

```ts
export type HostLookProfileIdentity = {
  readonly id: string;
  readonly publicId: string;
  readonly currentVersion: number;
  readonly ownerScope: string;
  readonly ownerId: string;
};
```

### src/infrastructure/look/host-look-ports.contract.ts:41

```ts
export type HostLookProfileRecord = {
  readonly profile: HostLookProfileIdentity;
  readonly status: 'active' | 'archived';
  readonly current: HostLookProfileVersion;
};
```

### src/infrastructure/look/host-look-ports.contract.ts:51

```ts
export type HostLookProfilePorts = {
  readonly listProfiles: (
    actorId: string,
    options?: { readonly includeArchived?: boolean },
  ) => Promise<HostLookProfileResult<readonly HostLookProfileRecord[]>>;
  readonly getProfileById: (
    actorId: string,
    profileId: string,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord | null>>;
  readonly createProfile: (
    actorId: string,
    draft: unknown,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly appendVersion: (
    actorId: string,
    profileId: string,
    draft: unknown,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly archiveProfile: (
    actorId: string,
    profileId: string,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly duplicateProfile: (
    actorId: string,
    sourceProfileId: string,
    displayName?: string,
  ) => Promise<HostLookProfileResult<HostLookProfileRecord>>;
  readonly listVersions: (
    actorId: string,
    profileId: string,
  ) => Promise<HostLookProfileResult<readonly HostLookProfileVersion[]>>;
};
```

### src/infrastructure/look/host-look-ports.contract.ts:85

```ts
export const HOST_LOOK_PROFILE_OPS = [
  'listProfiles',
  'getProfileById',
  'createProfile',
  'appendVersion',
  'archiveProfile',
  'duplicateProfile',
  'listVersions',
] as const;
```

### src/infrastructure/look/host-look-ports.contract.ts:95

```ts
export type HostLookProfileOp = (typeof HOST_LOOK_PROFILE_OPS)[number];
```

### src/infrastructure/look/look-material-roles.ts:26

```ts
export function classifyLookMaterialRole(materialOrMeshName: string): LookMaterialRole {
  const normalized = materialOrMeshName.trim().toLowerCase();
  if (!normalized) return 'unclassified';
  for (const entry of ROLE_HINTS) {
    if (entry.hints.some((hint) => normalized.includes(hint))) {
      return entry.role;
    }
  }
  return 'unclassified';
}
```

### src/infrastructure/look/look-material-roles.ts:37

```ts
export function isTintableLookMaterialRole(role: LookMaterialRole): boolean {
  return role !== 'unclassified';
}
```

### src/infrastructure/look/look-reference-analysis-service.ts:17

```ts
export type LookReferenceAnalysisRequestImage = LookReferenceAnalysisImageInput & {
  /** Inline image for vision call. */
  readonly contentBase64?: string;
  /** Owner-scoped storage path alternative to contentBase64. */
  readonly storagePath?: string;
};
```

### src/infrastructure/look/look-reference-analysis-service.ts:24

```ts
export type LookReferenceAnalysisRequest = {
  readonly references: readonly LookReferenceAnalysisRequestImage[];
  readonly displayNameHint?: string;
};
```

### src/infrastructure/look/look-reference-analysis-service.ts:159

```ts
export async function analyzeLookReferences(
  request: LookReferenceAnalysisRequest,
): Promise<LookReferenceAnalysisOutcome> {
  const aggregateBytes = request.references.reduce(
    (sum, ref) => sum + estimateBase64Bytes(ref.contentBase64),
    0,
  );
  if (aggregateBytes > LOOK_REFERENCE_AGGREGATE_MAX_BYTES) {
    return {
      ok: false,
      code: 'edge-error',
      messageDe: `Gesamtgröße der Referenzbilder überschreitet ${(LOOK_REFERENCE_AGGREGATE_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
    };
  }

  const domainInputs: LookReferenceAnalysisImageInput[] = request.references.map(
    (ref) => ({
      id: ref.id,
      kind: ref.kind,
      mime: ref.mime,
      uri: ref.uri,
      weight: ref.weight,
      label: ref.label,
    }),
  );

  const body = buildRequestBody(request);

  const edge = await invokeHostLookReferenceAnalysis(body);
  if (edge.status !== 'ok') {
    return {
      ok: false,
      code: edge.status,
      messageDe: edge.message,
    };
  }
  return normalizeLookReferenceAnalysisPayload(edge.payload, {
    references: domainInputs,
    displayNameHint: request.displayNameHint,
    analyzedAtIso: edge.analyzedAtIso,
  });
}
```

### src/infrastructure/look/look-reference-analysis-service.ts:203

```ts
export function createEdgeLookReferenceAnalyzer(): LookReferenceAnalyzer {
  return {
    async analyze(input) {
      return analyzeLookReferences({
        references: input.references,
        displayNameHint: input.displayNameHint,
      });
    },
  };
}
```

### src/infrastructure/look/look-runtime-types.ts:14

```ts
export type LookRuntimeBaselineMode = 'pbr-neutral';
```

### src/infrastructure/look/look-runtime-types.ts:16

```ts
export type LookStyleProviderId = 'host-mtoon' | 'toonlab' | 'none';
```

### src/infrastructure/look/look-runtime-types.ts:18

```ts
export type LookMaterialRole =
  | 'skin'
  | 'hair'
  | 'eyes'
  | 'cloth'
  | 'leather'
  | 'metal'
  | 'cybernetic'
  | 'unclassified';
```

### src/infrastructure/look/look-runtime-types.ts:28

```ts
export type LookRuntimeApplyStatus =
  | 'applied'
  | 'partial'
  | 'restored'
  | 'unsupported'
  | 'blocked';
```

### src/infrastructure/look/look-runtime-types.ts:35

```ts
export type LookCapabilityApplyResult = {
  readonly capability: LookCapability;
  readonly status: LookRuntimeApplyStatus;
  readonly noticeDe: string | null;
};
```

### src/infrastructure/look/look-runtime-types.ts:41

```ts
export type LookRuntimeApplyResult = {
  readonly status: LookRuntimeApplyStatus;
  readonly providerId: LookStyleProviderId;
  readonly profileId: string | null;
  readonly version: number | null;
  readonly executionMode: LookExecutionMode | null;
  readonly capabilities: readonly LookCapabilityApplyResult[];
  readonly noticeDe: string | null;
};
```

### src/infrastructure/look/look-runtime-types.ts:51

```ts
export type LookRuntimeTarget = {
  readonly root: unknown;
  readonly scene: unknown;
  readonly styleLights: unknown;
  /** Load-time material snapshots — restore before every apply. */
  readonly materialSnapshots: unknown;
  readonly isImportModel: boolean;
  readonly colors: {
    readonly skin?: string;
    readonly hair?: string;
    readonly clothing?: string;
    readonly eyes?: string;
  };
};
```

### src/infrastructure/look/look-runtime-types.ts:66

```ts
export type LookStyleAdapter = {
  readonly id: LookStyleProviderId;
  readonly isAvailable: () => boolean;
  readonly unavailableReasonDe: string | null;
  readonly apply: (input: {
    readonly version: LookProfileVersion;
    readonly target: LookRuntimeTarget;
    readonly executionMode: LookExecutionMode;
  }) => LookRuntimeApplyResult;
  readonly restoreBaseline: (target: LookRuntimeTarget) => LookRuntimeApplyResult;
};
```

### src/infrastructure/look/look-runtime.ts:18

```ts
export type LookRuntimeOptions = {
  readonly preferProvider?: LookStyleProviderId;
  readonly hostAdapter?: LookStyleAdapter;
  readonly toonLabAdapter?: LookStyleAdapter;
};
```

### src/infrastructure/look/look-runtime.ts:24

```ts
export class LookRuntime {
  private readonly host: LookStyleAdapter;
  private readonly toonLab: LookStyleAdapter;
  private readonly preferProvider: LookStyleProviderId;
  private lastResult: LookRuntimeApplyResult | null = null;

  constructor(options: LookRuntimeOptions = {}) {
    this.host = options.hostAdapter ?? createHostMtoonLookAdapter();
    this.toonLab = options.toonLabAdapter ?? createToonLabLookAdapter();
    this.preferProvider = options.preferProvider ?? 'host-mtoon';
  }

  getLastResult(): LookRuntimeApplyResult | null {
    return this.lastResult;
  }

  selectAdapter(executionMode: LookExecutionMode): LookStyleAdapter {
    if (
      this.preferProvider === 'toonlab' &&
      this.toonLab.isAvailable() &&
      executionMode === 'rendered'
    ) {
      return this.toonLab;
    }
    // Realtime avatar preview stays on host WebGL/MToon until spike GO.
    if (this.toonLab.isAvailable() && this.preferProvider === 'toonlab') {
      return this.toonLab;
    }
    return this.host;
  }

  restorePbrNeutral(target: LookRuntimeTarget): LookRuntimeApplyResult {
    const result = this.host.restoreBaseline(target);
    this.lastResult = result;
    return result;
  }

  applyLookProfile(
    version: LookProfileVersion,
    target: LookRuntimeTarget,
    executionMode: LookExecutionMode = 'realtime',
  ): LookRuntimeApplyResult {
    const mode =
      version.executionModes.includes(executionMode)
        ? executionMode
        : (version.executionModes[0] ?? 'realtime');
    const adapter = this.selectAdapter(mode);
    if (!adapter.isAvailable()) {
      // Fail soft to host so preview still works when ToonLab is preferred but blocked.
      const fallback = this.host.apply({ version, target, executionMode: mode });
      this.lastResult = {
        ...fallback,
        noticeDe:
          adapter.unavailableReasonDe ??
          'Bevorzugter Look-Provider nicht verfügbar — Host-MToon verwendet.',
        status: fallback.status === 'applied' ? 'partial' : fallback.status,
      };
      return this.lastResult;
    }
    const result = adapter.apply({ version, target, executionMode: mode });
    this.lastResult = result;
    return result;
  }
}
```

### src/infrastructure/look/look-runtime.ts:89

```ts
export function createLookRuntime(options?: LookRuntimeOptions): LookRuntime {
  return new LookRuntime(options);
}
```

### src/infrastructure/look/look-service.ts:43

```ts
export async function listLookProfiles(options?: {
  includeArchived?: boolean;
}): Promise<LookProfileRecord[]> {
  assertHost();
  const rows = await fetchHostLibraryLooks();
  return rows
    .map(asLookRecord)
    .filter((row): row is LookProfileRecord => row !== null)
    .filter((row) => options?.includeArchived === true || row.status === 'active');
}
```

### src/infrastructure/look/look-service.ts:54

```ts
export async function getLookProfile(
  profileId: string,
): Promise<LookProfileRecord | null> {
  assertHost();
  const rows = await listLookProfiles({ includeArchived: true });
  return rows.find((row) => row.profile.id === profileId) ?? null;
}
```

### src/infrastructure/look/look-service.ts:62

```ts
export async function createLookProfile(
  input: CreateLookProfileInput,
): Promise<LookProfileRecord> {
  assertHost();
  const created = await createHostLibraryLook(input.draft);
  const record = asLookRecord(created);
  if (!record) throw new Error('Host-Look anlegen: ungültige Antwort');
  return record;
}
```

### src/infrastructure/look/look-service.ts:72

```ts
export async function appendLookProfileVersion(
  input: AppendLookProfileVersionInput,
): Promise<LookProfileRecord> {
  assertHost();
  const appended = await appendHostLibraryLookVersion(input.profileId, input.draft);
  const record = asLookRecord(appended);
  if (!record) throw new Error('Host-Look-Version anhängen: ungültige Antwort');
  return record;
}
```

### src/infrastructure/look/look-service.ts:82

```ts
export async function archiveLookProfile(
  profileId: string,
): Promise<LookProfileRecord> {
  assertHost();
  const archived = await archiveHostLibraryLook(profileId);
  const record = asLookRecord(archived);
  if (!record) throw new Error('Host-Look archivieren: ungültige Antwort');
  return record;
}
```

### src/infrastructure/look/look-service.ts:92

```ts
export async function duplicateLookProfile(
  input: DuplicateLookProfileInput,
): Promise<LookProfileRecord> {
  assertHost();
  const duplicated = await duplicateHostLibraryLook(
    input.sourceProfileId,
    input.displayName,
  );
  const record = asLookRecord(duplicated);
  if (!record) throw new Error('Host-Look duplizieren: ungültige Antwort');
  return record;
}
```

### src/infrastructure/look/look-service.ts:119

```ts
export async function listLookProfileVersions(
  profileId: string,
): Promise<LookProfileVersion[]> {
  assertHost();
  const rows = await fetchHostLibraryLookVersions(profileId);
  return rows
    .map(asLookVersion)
    .filter((row): row is LookProfileVersion => row !== null)
    .sort((a, b) => a.version - b.version);
}
```

### src/infrastructure/look/look-service.ts:131

```ts
export async function analyzeLookReferencesForDraft(
  request: LookReferenceAnalysisRequest,
): Promise<LookReferenceAnalysisOutcome> {
  return analyzeLookReferences(request);
}
```

### src/infrastructure/look/look-service.ts:141

```ts
export async function createLookProfileFromReferenceAnalysis(
  draft: LookReferenceAnalysisDraft,
): Promise<LookProfileRecord> {
  const writeDraft = buildLookProfileWriteDraftFromAnalysis(draft);
  if (writeDraft.source !== 'reference-analysis') {
    throw new Error('Look analysis draft rejected: invalid source');
  }
  return createLookProfile({ draft: writeDraft });
}
```

### src/infrastructure/look/look.persistence.ts:20

```ts
export const LOOK_PROFILE_COLUMNS =
  'id, public_id, owner_user_id, owner_scope, current_version, status, created_at, updated_at' as const;
```

### src/infrastructure/look/look.persistence.ts:23

```ts
export const LOOK_PROFILE_VERSION_COLUMNS =
  'profile_id, version, source, display_name, capabilities, execution_modes, look_references, created_at' as const;
```

### src/infrastructure/look/look.persistence.ts:26

```ts
export type LookProfileDto = {
  id: string;
  public_id?: string | null;
  owner_user_id: string;
  owner_scope: string;
  current_version: number;
  status: string;
  created_at: string;
  updated_at: string;
};
```

### src/infrastructure/look/look.persistence.ts:37

```ts
export type LookProfileVersionDto = {
  profile_id: string;
  version: number;
  source: string;
  display_name: string;
  capabilities: unknown;
  execution_modes: unknown;
  look_references: unknown;
  created_at: string;
};
```

### src/infrastructure/look/look.persistence.ts:48

```ts
export function mapLookProfileVersionRow(
  row: LookProfileVersionDto,
): LookProfileVersion | null {
  return parseLookProfileVersion({
    profileId: row.profile_id,
    version: row.version,
    source: row.source,
    displayName: row.display_name,
    capabilities: row.capabilities,
    executionModes: row.execution_modes,
    references: row.look_references,
    createdAtIso: row.created_at,
  });
}
```

### src/infrastructure/look/look.persistence.ts:63

```ts
export function mapLookProfileRecord(
  profileRow: LookProfileDto,
  versionRow: LookProfileVersionDto,
): LookProfileRecord | null {
  const profile = parseLookProfile({
    id: profileRow.id,
    publicId:
      typeof profileRow.public_id === 'string' && profileRow.public_id.trim()
        ? profileRow.public_id.trim().toUpperCase()
        : undefined,
    currentVersion: profileRow.current_version,
    ownerScope: profileRow.owner_scope,
    ownerId: profileRow.owner_user_id,
  });
  if (profile === null) return null;
  if (profileRow.status !== 'active' && profileRow.status !== 'archived') {
    return null;
  }
  const current = mapLookProfileVersionRow(versionRow);
  if (current === null) return null;
  if (current.version !== profile.currentVersion) return null;
  return {
    profile,
    status: profileRow.status as LookProfileStatus,
    current,
  };
}
```

### src/infrastructure/look/look.persistence.ts:91

```ts
export function toPersistedVersionInsert(
  profileId: string,
  version: number,
  draft: LookProfileWriteDraft,
  createdAtIso: string,
): {
  profile_id: string;
  version: number;
  source: string;
  display_name: string;
  capabilities: LookProfileWriteDraft['capabilities'];
  execution_modes: LookProfileWriteDraft['executionModes'];
  look_references: LookProfileWriteDraft['references'];
  created_at: string;
} {
  return {
    profile_id: profileId,
    version,
    source: draft.source,
    display_name: draft.displayName,
    capabilities: draft.capabilities,
    execution_modes: draft.executionModes,
    look_references: draft.references,
    created_at: createdAtIso,
  };
}
```

### src/infrastructure/look/look.persistence.ts:118

```ts
export function resolveOwnerScope(draft: LookProfileWriteDraft): LookScope {
  const scope = draft.ownerScope ?? 'player-character';
  const parsed = parseLookScope(scope);
  return parsed ?? 'player-character';
}
```

### src/infrastructure/look/look.persistence.ts:125

```ts
export function extractReferenceUris(version: LookProfileVersion): string[] {
  return version.references.map((ref) => ref.uri);
}
```

### src/infrastructure/look/look.persistence.ts:129

```ts
export function assertParsedCapabilities(value: unknown): string[] {
  return parseLookCapabilities(value);
}
```

### src/infrastructure/look/look.persistence.ts:133

```ts
export function assertParsedExecutionModes(value: unknown): string[] {
  return parseLookExecutionModes(value);
}
```

### src/infrastructure/look/look.persistence.ts:137

```ts
export function assertParsedReferences(value: unknown) {
  return parseLookReferences(value);
}
```


## Remaining backend helper operations

### src/infrastructure/look/look-reference-analysis-service.ts:114

```ts
async function invokeHostLookReferenceAnalysis(
  body: Record<string, unknown>,
): Promise<EdgeOk | EdgeFail> {
  const base = getHostAuthBaseUrl();
  if (base === null) {
    return {
      status: 'error',
      message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }
  const requestUrl =
    base === ''
      ? '/api/v1/ai/look-reference-analysis'
      : `${base}/api/v1/ai/look-reference-analysis`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      status: 'error',
      message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      status: 'error',
      message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }
  return parseEdgeResponse(data);
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/character/avatar/mtoon-profile.ts` | `26ee5c67078a58d989167c19a36ddf2dca8d79ed840e0e30879a9b5c563b0cb7` |
| `src/domains/look/advanced-adaption.ts` | `c90df8e1dea1b4f641677cab0beec580b0904c3bdb272e7f6fa4cf42730770d5` |
| `src/domains/look/advanced-look-capability-status.ts` | `8812db0fc1121ffec2e1985650d4968e0c82e201d2db20363e6e248c1ea1c9dd` |
| `src/domains/look/advanced-look-provider-registry.ts` | `915dc569d7dac9a4fa0e79a8b5a5e4738e6a7ac90db9d41f4c9d6bd344277529` |
| `src/domains/look/capability-metadata.ts` | `2f0902e0e4f29931f8fc066251c234326af7d7b9e553713507f3adf7ba85dad2` |
| `src/domains/look/index.ts` | `e667f9f85e3f658bd33b596e73fbdb75bda168eadec2ffdd1c778d173337bc59` |
| `src/domains/look/invariants.ts` | `52acc9213f3b5a65b6e9cc76fadd47368b2f8d6d7e0d5ae73ccfa4d460df8a9d` |
| `src/domains/look/library-query.ts` | `ac9712635bf88db68a6b849454b5f18657ebc21f7e56140377f697e30cb23ac3` |
| `src/domains/look/parse.ts` | `087a08665705c6d82c92ddee83e40b19a7243c4f08d1a08d8744c2e0c5cc1306` |
| `src/domains/look/persistence-contracts.ts` | `fce690cdfa0bded2ae00b62f9db2043ae3b01fb0d9db7b489bc82e22c62dc97c` |
| `src/domains/look/personal-look-override.ts` | `c3d95da0d51245da6df9ae735297e025213d806a648f1ca6d822c2955b77df32` |
| `src/domains/look/reference-analysis.ts` | `e1157c73b47a86cf3d5115aff751807775cd6056e7f254b2b5fbf7278ced1e51` |
| `src/domains/look/resolve.ts` | `80e29915c579fbc187741192cc38e6f67154246ae1b97ee666b6e0d610baa584` |
| `src/domains/look/system-default.ts` | `eca9aacce5aa2f3e879ededa648b8c41eea133be4da9f37d0fbf8399c201fc19` |
| `src/domains/look/types.ts` | `50f245351c3f2168038a45831a0cb0c35ed5c15488aeacb3aff7f9ccc3d87262` |
| `src/domains/look/write-draft.ts` | `7c8b04b229269b73a26b64d68f0656dc5ada2048e75cd29d5a53887fc6f29e58` |
| `src/infrastructure/character/avatar/mtoon-style-applier.ts` | `1c9fc4fdb30546c0b34ccb222035c74d78251985e575f8a79da86f3f6cd762be` |
| `src/infrastructure/character/avatar/toonlab-compatibility-spike.ts` | `e896927b2a2fa4c4ad74550b0909a681596d41bdc356980a31afd42b493f5d30` |
| `src/infrastructure/host/host-library-http.ts` | `1d41f3b1eb3e71a3a8b12306993b605f2d05f2f41cd35f73b9c362b12f9c1cb6` |
| `src/infrastructure/look/adapters/host-mtoon-look-adapter.ts` | `19b2f7008ffa27b5bd6c951019a55bde20d82f195ff9f798aa91b4d0a729e3a5` |
| `src/infrastructure/look/adapters/toonlab-look-adapter.ts` | `4edeab261bda3b114a4a9c9d7dcdb16a1cc73c24df0db23539480aa3a0834acb` |
| `src/infrastructure/look/host-look-adapter.ts` | `f1c8129f9ff83fb5e586da01b59cf26e3d6e54385f20e631ee353d0802c409c1` |
| `src/infrastructure/look/host-look-ports.contract.ts` | `f815bac34628b904e1c813d4929872b688d6dc140bebdf2a17a586c11556cf0f` |
| `src/infrastructure/look/index.ts` | `9459251bdf2ae00dab0a11fdd0d77cc113264577367b61273e3a04c658aec47f` |
| `src/infrastructure/look/look-material-roles.ts` | `2e8161b18a046bb073664a586bb645dc1428c5796d04ade0b625c9339f8cfcdb` |
| `src/infrastructure/look/look-reference-analysis-service.ts` | `2642af08c083b7ee828d620e50aca15cb41917ec9676729f60bb7e2f2be08281` |
| `src/infrastructure/look/look-runtime-types.ts` | `c31d27eaf600ed47e69f16120e584b06a985f29618923118a4c08570f276b2c6` |
| `src/infrastructure/look/look-runtime.ts` | `64487d02f2831514e86b721d41b0964ac8e99b37faf1a33b8771b4fa7b955d23` |
| `src/infrastructure/look/look-service.ts` | `3cfd97ccbc21d072865088cf1a0fe5f61e0a43e574f895d869ac80451cc25188` |
| `src/infrastructure/look/look.persistence.ts` | `ed0a97cba6560930610fc032bd7679b5a7e4b49f837e401cd5a872974598f482` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `src/lib/supabase.ts` | `a385b96048d1e73f8dd1a78ee00a5c1a4e6cbb5f50e1f705ae527e2493f9f373` |

