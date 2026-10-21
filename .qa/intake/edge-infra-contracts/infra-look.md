# Infrastructure contract: look

**Status: SPEC; current branch source verified.** Implementation issue: **#803**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-look.json](source-contracts/infra-look.json) (SHA-256 `66770f2e8778c9c33e74177e262e0442b4aada04afbf4a9c9becceab93da2b8f`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Look profile repository stores serialized domain payload and public IDs; reference analysis is an Edge request; runtime material/shader adapters are browser-side behavior.

Look personal scope stays owner-only; storage refs accepted for vision must be caller-scoped. Runtime providers/config metadata never become private persisted credentials.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (2): `look_profile_versions`, `look_profiles`.

Storage buckets (0): none.

Edge invokes (1): `look-reference-analysis`.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 7.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `look-reference-analysis` | #828 |  |
| table | `look_profile_versions` | #791 | Policy #792 |
| table | `look_profiles` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `character` | #801 |  |

## Acceptance and negative tests (required, not executed)

- Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
- Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
- Local look runtime adapters remain unchanged by persistence transport replacement.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### edge: look-reference-analysis

`src/infrastructure/look/look-reference-analysis-service.ts:127` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke(
    'look-reference-analysis',
    {
      body: {
        action: 'analyze',
        displayNameHint: request.displayNameHint,
        references: request.references.map((ref) => ({
          id: ref.id,
          kind: ref.kind,
          mime: ref.mime,
          uri: ref.uri,
          weight: ref.weight,
          label: ref.label,
          contentBase64: ref.contentBase64,
          storagePath: ref.storagePath,
        })),
      },
    },
  )
```

Enclosing operation: `src/infrastructure/look/look-reference-analysis-service.ts:101`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/look/supabase-look.repository.ts:62` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:59`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profiles

`src/infrastructure/look/supabase-look.repository.ts:63` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(PROFILES).select(LOOK_PROFILE_COLUMNS)
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:59`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/look/supabase-look.repository.ts:85` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:84`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/look/supabase-look.repository.ts:90` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:89`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profiles

`src/infrastructure/look/supabase-look.repository.ts:97` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(PROFILES).insert({
        id: profileId,
        owner_user_id: userId,
        owner_scope: ownerScope,
        current_version: 1,
        status: 'active',
      })
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:89`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profile_versions

`src/infrastructure/look/supabase-look.repository.ts:113` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(VERSIONS).insert(versionInsert)
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:89`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/look/supabase-look.repository.ts:131` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:130`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profile_versions

`src/infrastructure/look/supabase-look.repository.ts:150` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(VERSIONS).insert(versionInsert)
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:130`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profiles

`src/infrastructure/look/supabase-look.repository.ts:164` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(PROFILES)
        .update({ current_version: nextVersion })
        .eq('id', profileId)
        .eq('owner_user_id', userId)
        .eq('current_version', existing.profile.currentVersion)
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:130`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/look/supabase-look.repository.ts:187` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:186`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profiles

`src/infrastructure/look/supabase-look.repository.ts:190` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(PROFILES)
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('owner_user_id', userId)
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:186`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/look/supabase-look.repository.ts:209` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:208`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/look/supabase-look.repository.ts:237` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:236`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profile_versions

`src/infrastructure/look/supabase-look.repository.ts:240` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(VERSIONS)
        .select(LOOK_PROFILE_VERSION_COLUMNS)
        .eq('profile_id', id)
        .order('version', { ascending: true })
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:236`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profiles

`src/infrastructure/look/supabase-look.repository.ts:258` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(PROFILES).select(LOOK_PROFILE_COLUMNS).eq('id', profileId).maybeSingle()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:256`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: look_profile_versions

`src/infrastructure/look/supabase-look.repository.ts:269` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(VERSIONS)
        .select(LOOK_PROFILE_VERSION_COLUMNS)
        .eq('profile_id', profileId)
        .eq('version', profileRow.current_version)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/look/supabase-look.repository.ts:256`; complete request/default/result/error logic is in the declarations below and the snapshot.

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

### src/infrastructure/look/look-reference-analysis-service.ts:16

```ts
export type LookReferenceAnalysisRequestImage = LookReferenceAnalysisImageInput & {
  /** Inline image for edge vision call. */
  readonly contentBase64?: string;
  /** Owner-scoped storage path alternative to contentBase64. */
  readonly storagePath?: string;
};
```

### src/infrastructure/look/look-reference-analysis-service.ts:23

```ts
export type LookReferenceAnalysisRequest = {
  readonly references: readonly LookReferenceAnalysisRequestImage[];
  readonly displayNameHint?: string;
};
```

### src/infrastructure/look/look-reference-analysis-service.ts:101

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

  const { data, error } = await supabase.functions.invoke(
    'look-reference-analysis',
    {
      body: {
        action: 'analyze',
        displayNameHint: request.displayNameHint,
        references: request.references.map((ref) => ({
          id: ref.id,
          kind: ref.kind,
          mime: ref.mime,
          uri: ref.uri,
          weight: ref.weight,
          label: ref.label,
          contentBase64: ref.contentBase64,
          storagePath: ref.storagePath,
        })),
      },
    },
  );

  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    return {
      ok: false,
      code: 'edge-error',
      messageDe:
        serverMessage ??
        'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }

  const edge = parseEdgeResponse(data);
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

### src/infrastructure/look/look-reference-analysis-service.ts:175

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

### src/infrastructure/look/look-service.ts:23

```ts
export async function listLookProfiles(options?: {
  includeArchived?: boolean;
}): Promise<LookProfileRecord[]> {
  return supabaseLookProfileRepository.listProfiles(options);
}
```

### src/infrastructure/look/look-service.ts:29

```ts
export async function getLookProfile(
  profileId: string,
): Promise<LookProfileRecord | null> {
  return supabaseLookProfileRepository.getProfileById(profileId);
}
```

### src/infrastructure/look/look-service.ts:35

```ts
export async function createLookProfile(
  input: CreateLookProfileInput,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.createProfile(input);
}
```

### src/infrastructure/look/look-service.ts:41

```ts
export async function appendLookProfileVersion(
  input: AppendLookProfileVersionInput,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.appendVersion(input);
}
```

### src/infrastructure/look/look-service.ts:47

```ts
export async function archiveLookProfile(
  profileId: string,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.archiveProfile(profileId);
}
```

### src/infrastructure/look/look-service.ts:53

```ts
export async function duplicateLookProfile(
  input: DuplicateLookProfileInput,
): Promise<LookProfileRecord> {
  return supabaseLookProfileRepository.duplicateProfile(input);
}
```

### src/infrastructure/look/look-service.ts:59

```ts
export async function listLookProfileVersions(
  profileId: string,
): Promise<LookProfileVersion[]> {
  return supabaseLookProfileRepository.listVersions(profileId);
}
```

### src/infrastructure/look/look-service.ts:66

```ts
export async function analyzeLookReferencesForDraft(
  request: LookReferenceAnalysisRequest,
): Promise<LookReferenceAnalysisOutcome> {
  return analyzeLookReferences(request);
}
```

### src/infrastructure/look/look-service.ts:76

```ts
export async function createLookProfileFromReferenceAnalysis(
  draft: LookReferenceAnalysisDraft,
): Promise<LookProfileRecord> {
  const writeDraft = buildLookProfileWriteDraftFromAnalysis(draft);
  if (writeDraft.source !== 'reference-analysis') {
    throw new Error('Look analysis draft rejected: invalid source');
  }
  return supabaseLookProfileRepository.createProfile({ draft: writeDraft });
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

### src/infrastructure/look/supabase-look.repository.ts:58

```ts
export class SupabaseLookProfileRepository implements LookProfileRepository {
  async listProfiles(options?: {
    includeArchived?: boolean;
  }): Promise<LookProfileRecord[]> {
    await getAuthenticatedUserId();
    let query = supabase.from(PROFILES).select(LOOK_PROFILE_COLUMNS);
    if (!options?.includeArchived) {
      query = query.eq('status', 'active');
    }
    const { data, error } = await raceWithTimeoutReject(
      query.order('updated_at', { ascending: false }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'LookProfiles konnten nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`LookProfiles konnten nicht geladen werden: ${error.message}`);
    }
    const rows = (data ?? []) as LookProfileDto[];
    const out: LookProfileRecord[] = [];
    for (const row of rows) {
      const record = await this.loadRecord(row.id);
      if (record) out.push(record);
    }
    return out;
  }

  async getProfileById(profileId: string): Promise<LookProfileRecord | null> {
    await getAuthenticatedUserId();
    return this.loadRecord(assertProfileId(profileId));
  }

  async createProfile(input: CreateLookProfileInput): Promise<LookProfileRecord> {
    const userId = await getAuthenticatedUserId();
    const draft = requireDraft(input.draft);
    const profileId = newLookProfileId();
    const ownerScope = resolveOwnerScope(draft);
    const createdAt = new Date().toISOString();

    const { error: profileError } = await raceWithTimeoutReject(
      supabase.from(PROFILES).insert({
        id: profileId,
        owner_user_id: userId,
        owner_scope: ownerScope,
        current_version: 1,
        status: 'active',
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'LookProfile konnte nicht angelegt werden (Zeitüberschreitung).',
    );
    if (profileError) {
      throw new Error(`LookProfile konnte nicht angelegt werden: ${profileError.message}`);
    }

    const versionInsert = toPersistedVersionInsert(profileId, 1, draft, createdAt);
    const { error: versionError } = await raceWithTimeoutReject(
      supabase.from(VERSIONS).insert(versionInsert),
      SUPABASE_QUERY_TIMEOUT_MS,
      'LookProfile-Version konnte nicht angelegt werden (Zeitüberschreitung).',
    );
    if (versionError) {
      throw new Error(
        `LookProfile-Version konnte nicht angelegt werden: ${versionError.message}`,
      );
    }

    const record = await this.loadRecord(profileId);
    if (!record) {
      throw new Error('LookProfile nach Create nicht lesbar.');
    }
    return record;
  }

  async appendVersion(input: AppendLookProfileVersionInput): Promise<LookProfileRecord> {
    const userId = await getAuthenticatedUserId();
    const profileId = assertProfileId(input.profileId);
    const draft = requireDraft(input.draft);
    const existing = await this.loadRecord(profileId);
    if (!existing) {
      throw new Error('LookProfile nicht gefunden.');
    }
    if (existing.profile.ownerId !== userId) {
      throw new Error('Keine Berechtigung für dieses LookProfile.');
    }
    if (existing.status === 'archived') {
      throw new Error('Archivierte Looks können nicht versioniert werden. Bitte duplizieren.');
    }

    const nextVersion = existing.profile.currentVersion + 1;
    const createdAt = new Date().toISOString();
    const versionInsert = toPersistedVersionInsert(profileId, nextVersion, draft, createdAt);

    const { error: versionError } = await raceWithTimeoutReject(
      supabase.from(VERSIONS).insert(versionInsert),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Neue Look-Version konnte nicht geschrieben werden (Zeitüberschreitung).',
    );
    if (versionError) {
      if (/duplicate|unique|conflict/i.test(versionError.message)) {
        throw new Error(
          'Konflikt: diese Look-Version existiert bereits (gleichzeitiges Update). Bitte erneut versuchen.',
        );
      }
      throw new Error(`Neue Look-Version fehlgeschlagen: ${versionError.message}`);
    }

    const { error: bumpError } = await raceWithTimeoutReject(
      supabase
        .from(PROFILES)
        .update({ current_version: nextVersion })
        .eq('id', profileId)
        .eq('owner_user_id', userId)
        .eq('current_version', existing.profile.currentVersion),
      SUPABASE_QUERY_TIMEOUT_MS,
      'LookProfile-Versionzeiger konnte nicht aktualisiert werden (Zeitüberschreitung).',
    );
    if (bumpError) {
      throw new Error(`LookProfile-Versionzeiger fehlgeschlagen: ${bumpError.message}`);
    }

    const record = await this.loadRecord(profileId);
    if (!record || record.profile.currentVersion !== nextVersion) {
      throw new Error(
        'Konflikt: LookProfile wurde parallel aktualisiert. Bitte erneut versuchen.',
      );
    }
    return record;
  }

  async archiveProfile(profileId: string): Promise<LookProfileRecord> {
    const userId = await getAuthenticatedUserId();
    const id = assertProfileId(profileId);
    const { error } = await raceWithTimeoutReject(
      supabase
        .from(PROFILES)
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('owner_user_id', userId),
      SUPABASE_QUERY_TIMEOUT_MS,
      'LookProfile konnte nicht archiviert werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`LookProfile konnte nicht archiviert werden: ${error.message}`);
    }
    const record = await this.loadRecord(id);
    if (!record) {
      throw new Error('LookProfile nach Archivierung nicht lesbar.');
    }
    return record;
  }

  async duplicateProfile(input: DuplicateLookProfileInput): Promise<LookProfileRecord> {
    const userId = await getAuthenticatedUserId();
    const sourceId = assertProfileId(input.sourceProfileId);
    const source = await this.loadRecord(sourceId);
    if (!source) {
      throw new Error('Quell-LookProfile nicht gefunden.');
    }
    if (source.profile.ownerId !== userId) {
      throw new Error('Keine Berechtigung zum Duplizieren dieses Looks.');
    }

    const displayName =
      typeof input.displayName === 'string' && input.displayName.trim().length > 0
        ? input.displayName.trim()
        : `${source.current.displayName} (Kopie)`;

    return this.createProfile({
      draft: {
        displayName,
        source: source.current.source,
        references: source.current.references,
        capabilities: source.current.capabilities,
        executionModes: source.current.executionModes,
        ownerScope: source.profile.ownerScope,
      },
    });
  }

  async listVersions(profileId: string): Promise<LookProfileVersion[]> {
    await getAuthenticatedUserId();
    const id = assertProfileId(profileId);
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(VERSIONS)
        .select(LOOK_PROFILE_VERSION_COLUMNS)
        .eq('profile_id', id)
        .order('version', { ascending: true }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Look-Versionen konnten nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Look-Versionen konnten nicht geladen werden: ${error.message}`);
    }
    return ((data ?? []) as LookProfileVersionDto[])
      .map(mapLookProfileVersionRow)
      .filter((row): row is LookProfileVersion => row !== null);
  }

  private async loadRecord(profileId: string): Promise<LookProfileRecord | null> {
    const { data: profileData, error: profileError } = await raceWithTimeoutReject(
      supabase.from(PROFILES).select(LOOK_PROFILE_COLUMNS).eq('id', profileId).maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'LookProfile konnte nicht geladen werden (Zeitüberschreitung).',
    );
    if (profileError) {
      throw new Error(`LookProfile konnte nicht geladen werden: ${profileError.message}`);
    }
    if (!profileData) return null;
    const profileRow = profileData as LookProfileDto;

    const { data: versionData, error: versionError } = await raceWithTimeoutReject(
      supabase
        .from(VERSIONS)
        .select(LOOK_PROFILE_VERSION_COLUMNS)
        .eq('profile_id', profileId)
        .eq('version', profileRow.current_version)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'LookProfile-Version konnte nicht geladen werden (Zeitüberschreitung).',
    );
    if (versionError) {
      throw new Error(
        `LookProfile-Version konnte nicht geladen werden: ${versionError.message}`,
      );
    }
    if (!versionData) return null;
    return mapLookProfileRecord(profileRow, versionData as LookProfileVersionDto);
  }
}
```

### src/infrastructure/look/supabase-look.repository.ts:288

```ts
export const supabaseLookProfileRepository = new SupabaseLookProfileRepository();
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

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
| `src/infrastructure/look/adapters/host-mtoon-look-adapter.ts` | `19b2f7008ffa27b5bd6c951019a55bde20d82f195ff9f798aa91b4d0a729e3a5` |
| `src/infrastructure/look/adapters/toonlab-look-adapter.ts` | `4edeab261bda3b114a4a9c9d7dcdb16a1cc73c24df0db23539480aa3a0834acb` |
| `src/infrastructure/look/index.ts` | `eadd350c8c0e50352b4c1d40eae7581a05bd43ec32fb9c3a311235cf8a57140d` |
| `src/infrastructure/look/look-material-roles.ts` | `2e8161b18a046bb073664a586bb645dc1428c5796d04ade0b625c9339f8cfcdb` |
| `src/infrastructure/look/look-reference-analysis-service.ts` | `a032b123fff9a4fe81429f04cc3113fb776d296f069952f147293f350ebf50a3` |
| `src/infrastructure/look/look-runtime-types.ts` | `c31d27eaf600ed47e69f16120e584b06a985f29618923118a4c08570f276b2c6` |
| `src/infrastructure/look/look-runtime.ts` | `64487d02f2831514e86b721d41b0964ac8e99b37faf1a33b8771b4fa7b955d23` |
| `src/infrastructure/look/look-service.ts` | `343b0633794f4aaa3fddc22bf97c0c6a24f4d70210460cf2d0a9d1779f79b10e` |
| `src/infrastructure/look/look.persistence.ts` | `ed0a97cba6560930610fc032bd7679b5a7e4b49f837e401cd5a872974598f482` |
| `src/infrastructure/look/supabase-look.repository.ts` | `4dc795897a12bf3319998860b855b0b9b55425e2be7e4c9b0844e7b2ec647121` |
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

