# Infrastructure contract: character

**Status: SPEC; current branch source verified.** Implementation issue: **#801**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-character.json](source-contracts/infra-character.json) (SHA-256 `4e4159a6dbd30aab5a571659d832f530d0095b21d7aca6e5c828af0c0b0cfae2`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Character CRUD/presets/adventure arcs plus lore generation, portraits and owner avatar job/artifact flows; local rendering/VRM/media analysis modules stay client-side.

Current authenticated owner filters and table RLS are authoritative; no actorId/owner field promotion from client. Storage bucket paths and model artifacts remain owner-bound.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (9): `character_adventure_arcs`, `character_avatar_artifacts`, `character_avatar_export_assets`, `character_avatar_import_assets`, `character_presets`, `characters`, `project_members`, `projects`, `sessions`.

Storage buckets (2): `character-avatars`, `character-portraits`.

Edge invokes (2): `character-avatar-meshy`, `character-lore`.

Realtime call sites: 0. Direct fetch sites: 3. Explicit auth/helper sites: 32.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `character-avatar-meshy` | #820 |  |
| edge | `character-lore` | #821 |  |
| table | `character_adventure_arcs` | #791 | Policy #792 |
| table | `character_avatar_artifacts` | #791 | Policy #792 |
| table | `character_avatar_export_assets` | #791 | Policy #792 |
| table | `character_avatar_import_assets` | #791 | Policy #792 |
| table | `character_presets` | #791 | Policy #792 |
| table | `characters` | #791 | Policy #792 |
| table | `project_members` | #791 | Policy #792 |
| table | `projects` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |
| storage | `character-avatars` | #841 |  |
| storage | `character-portraits` | #841 |  |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `inventory` | #802 |  |
| infra | `look` | #803 |  |
| infra | `media` | #805 |  |
| infra | `project` | #807 |  |
| infra | `session` | #810 |  |

## Acceptance and negative tests (required, not executed)

- Create/read/edit/delete own complete/draft character and reload; foreign owner and cross-owner FK writes denied.
- Portrait/avatar upload, generation,poll/export and lore draft retain full shapes; creator rendering utilities are not moved to server merely because under infrastructure.
- Presets/public catalog reads are preserved with current RLS; generated artifacts cannot resolve a foreign owner path.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### auth: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:50` — dynamic-expression.

Exact call/query chain:
```ts
supabase.auth.getUser()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:49`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:117` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:114`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_artifacts

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:133` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .from('character_avatar_artifacts')
    .insert(artifactToInsert(artifact))
    .select('*')
    .single()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:114`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:157` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:154`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_artifacts

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:158` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('id', artifactId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .maybeSingle()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:154`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_artifacts

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:177` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('idempotency_key', idempotencyKey)
    .is('deleted_at', null)
    .maybeSingle()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:173`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:195` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:192`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_artifacts

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:196` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:192`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:223` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:220`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_artifacts

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:232` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('character_avatar_artifacts')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', current.characterId)
      .eq('is_active', true)
      .is('deleted_at', null)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:220`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_artifacts

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:247` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .from('character_avatar_artifacts')
    .update({ is_active: true })
    .eq('id', artifactId)
    .eq('owner_user_id', ownerUserId)
    .eq('materialization_status', 'materialized')
    .neq('analysis_status', 'failed')
    .is('deleted_at', null)
    .select('*')
    .maybeSingle()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:220`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:275` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:269`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:295` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:289`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:315` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:309`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:340` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:333`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_artifacts

`src/infrastructure/character/avatar/character-avatar-artifact-service.ts:352` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .from('character_avatar_artifacts')
    .update({
      analysis_status: analysisStatus,
      analysis_result: input.result,
    })
    .eq('id', input.artifactId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-artifact-service.ts:333`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth: session identity

`src/infrastructure/character/avatar/character-avatar-export-service.ts:27` — dynamic-expression.

Exact call/query chain:
```ts
supabase.auth.getUser()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:26`; complete request/default/result/error logic is in the declarations below and the snapshot.
### fetch: url

`src/infrastructure/character/avatar/character-avatar-export-service.ts:43` — dynamic-expression.

Exact call/query chain:
```ts
fetch(url)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:40`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-export-service.ts:92` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-avatars

`src/infrastructure/character/avatar/character-avatar-export-service.ts:97` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: 'model/gltf-binary',
    upsert: false,
  })
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_export_assets

`src/infrastructure/character/avatar/character-avatar-export-service.ts:110` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('character_avatar_export_assets')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', input.characterId)
      .eq('is_active', true)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_export_assets

`src/infrastructure/character/avatar/character-avatar-export-service.ts:118` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('character_avatar_export_assets').insert({
    id: artifactId,
    owner_user_id: ownerUserId,
    character_id: input.characterId ?? null,
    format: 'glb',
    mime: 'model/gltf-binary',
    byte_size: bytes.byteLength,
    storage_path: storagePath,
    export_contract_version: AVATAR_SAVE_EXPORT_VERSION,
    morph_contract_version: MORPH_CONTRACT_VERSION,
    embeds_source_mesh: embedsSourceMesh,
    is_active: true,
  })
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-avatars

`src/infrastructure/character/avatar/character-avatar-export-service.ts:132` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(BUCKET).remove([storagePath])
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-avatars

`src/infrastructure/character/avatar/character-avatar-export-service.ts:137` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_export_assets

`src/infrastructure/character/avatar/character-avatar-export-service.ts:142` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('character_avatar_export_assets')
      .update({ is_active: false })
      .eq('id', artifactId)
      .eq('owner_user_id', ownerUserId)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-export-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth: session identity

`src/infrastructure/character/avatar/character-avatar-import-service.ts:34` — dynamic-expression.

Exact call/query chain:
```ts
supabase.auth.getUser()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:33`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-import-service.ts:109` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:69`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-avatars

`src/infrastructure/character/avatar/character-avatar-import-service.ts:118` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: mime,
    upsert: false,
  })
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:69`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_import_assets

`src/infrastructure/character/avatar/character-avatar-import-service.ts:128` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('character_avatar_import_assets').insert({
    id: importAssetId,
    owner_user_id: ownerUserId,
    character_id: options.characterId ?? null,
    format,
    mime,
    byte_size: bytes.byteLength,
    storage_path: storagePath,
    rig_analysis_status: 'pending',
    is_active: false,
  })
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:69`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-avatars

`src/infrastructure/character/avatar/character-avatar-import-service.ts:140` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(BUCKET).remove([storagePath])
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:69`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-avatars

`src/infrastructure/character/avatar/character-avatar-import-service.ts:164` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:69`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/avatar/character-avatar-import-service.ts:242` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:234`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_import_assets

`src/infrastructure/character/avatar/character-avatar-import-service.ts:245` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('character_avatar_import_assets')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', input.characterId)
      .eq('is_active', true)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:234`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_avatar_import_assets

`src/infrastructure/character/avatar/character-avatar-import-service.ts:253` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .from('character_avatar_import_assets')
    .update({ is_active: true })
    .eq('id', input.draft.importAssetId)
    .eq('owner_user_id', ownerUserId)
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-import-service.ts:234`; complete request/default/result/error logic is in the declarations below and the snapshot.
### edge: character-avatar-meshy

`src/infrastructure/character/avatar/character-avatar-meshy-service.ts:90` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('character-avatar-meshy', { body })
```

Enclosing operation: `src/infrastructure/character/avatar/character-avatar-meshy-service.ts:89`; complete request/default/result/error logic is in the declarations below and the snapshot.
### fetch: safeUrl

`src/infrastructure/character/avatar/character-studio-manifest.ts:113` — dynamic-expression.

Exact call/query chain:
```ts
fetch(safeUrl, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
```

Enclosing operation: `src/infrastructure/character/avatar/character-studio-manifest.ts:109`; complete request/default/result/error logic is in the declarations below and the snapshot.
### fetch: manifestUrl

`src/infrastructure/character/avatar/character-studio-runtime.ts:1365` — dynamic-expression.

Exact call/query chain:
```ts
fetch(manifestUrl)
```

Enclosing operation: `src/infrastructure/character/avatar/character-studio-runtime.ts:1347`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/character/character-adventure-arc-service.ts:88` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('project_members')
      .select('project_id, joined_at, status')
      .eq('character_id', trimmedId)
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:84`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_adventure_arcs

`src/infrastructure/character/character-adventure-arc-service.ts:99` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .select('*')
      .eq('character_id', trimmedId)
      .order('started_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:84`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_adventure_arcs

`src/infrastructure/character/character-adventure-arc-service.ts:117` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(TABLE)
        .insert({
          character_id: trimmedId,
          project_id: projectId,
          status: 'active',
          started_at: membership.joined_at ?? new Date().toISOString(),
          developments: [],
        })
        .select('*')
        .single()
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:84`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_adventure_arcs

`src/infrastructure/character/character-adventure-arc-service.ts:138` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .select('*')
      .eq('character_id', trimmedId)
      .order('started_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:84`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/character/character-adventure-arc-service.ts:154` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('projects').select('id, name, status').in('id', projectIds)
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:84`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/character/character-adventure-arc-service.ts:155` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('sessions').select('project_id').in('project_id', projectIds)
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:84`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_adventure_arcs

`src/infrastructure/character/character-adventure-arc-service.ts:200` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .select('*')
      .eq('id', arcId)
      .single()
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:192`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_adventure_arcs

`src/infrastructure/character/character-adventure-arc-service.ts:224` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .update({ developments: nextDevelopments })
      .eq('id', arcId)
      .select('*')
      .single()
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:192`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/character/character-adventure-arc-service.ts:235` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('projects')
      .select('name, status')
      .eq('id', (updated as CharacterAdventureArcDto).project_id)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:192`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/character/character-adventure-arc-service.ts:241` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', (updated as CharacterAdventureArcDto).project_id)
```

Enclosing operation: `src/infrastructure/character/character-adventure-arc-service.ts:192`; complete request/default/result/error logic is in the declarations below and the snapshot.
### edge: character-lore

`src/infrastructure/character/character-lore-service.ts:77` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('character-lore', {
      body: {
        action: 'generate-background',
        context: request.context,
        currentBackgroundStory: request.currentBackgroundStory,
      },
    })
```

Enclosing operation: `src/infrastructure/character/character-lore-service.ts:74`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-preset-service.ts:199` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:198`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:201` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(TABLE)
        .select('*')
        .eq('owner_user_id', userId)
        .eq('origin', 'user')
        .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:198`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/character-preset-service.ts:216` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from('characters')
        .select('id')
        .eq('owner_user_id', userId)
        .in('id', sourceIds)
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:198`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-preset-service.ts:237` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:236`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:238` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .select('*')
      .eq('owner_user_id', userId)
      .eq('source_character_id', characterId)
      .eq('origin', 'user')
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:236`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-preset-service.ts:251` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:250`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:268` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .insert({
        owner_user_id: userId,
        display_name: input.displayName.trim() || `${snapshot.name.trim()} Preset`,
        ruleset_key: 'sagatree-core',
        origin: 'user',
        source_character_id: input.sourceCharacterId,
        published: false,
        versions: [version],
      })
      .select()
      .single()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:250`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-preset-service.ts:286` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:285`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:290` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .select('*')
      .eq('id', input.presetId)
      .eq('owner_user_id', userId)
      .single()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:285`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:315` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .update({ versions: nextVersions, published: false, updated_at: new Date().toISOString() })
      .eq('id', input.presetId)
      .eq('owner_user_id', userId)
      .select()
      .single()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:285`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-preset-service.ts:327` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:326`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:330` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .update({ display_name: trimmed, published: false, updated_at: new Date().toISOString() })
      .eq('id', presetId)
      .eq('owner_user_id', userId)
      .select()
      .single()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:326`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-preset-service.ts:342` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:341`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:343` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .select('*')
      .eq('id', presetId)
      .eq('owner_user_id', userId)
      .single()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:341`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:354` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .insert({
        owner_user_id: userId,
        display_name: `${dto.display_name} (Kopie)`,
        ruleset_key: dto.ruleset_key,
        origin: 'user',
        source_character_id: null,
        published: false,
        versions,
      })
      .select()
      .single()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:341`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-preset-service.ts:372` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:371`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: character_presets

`src/infrastructure/character/character-preset-service.ts:373` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(TABLE).delete().eq('id', presetId).eq('owner_user_id', userId)
```

Enclosing operation: `src/infrastructure/character/character-preset-service.ts:371`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/character-service.ts:148` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/character-service.ts:144`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:112` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:111`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:114` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(this.tableName)
        .select('id, public_id, name, class, race, level, portrait_url, sheet_status')
        .eq('owner_user_id', userId)
        .eq('character_type', 'pc')
        .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:111`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:137` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:136`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:139` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.tableName).select('*').eq('owner_user_id', userId).eq('character_type', 'pc').order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:136`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:148` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:147`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:149` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.tableName).select('*').eq('id', id).eq('owner_user_id', userId).single()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:147`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:162` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:159`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:164` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(this.tableName)
        .select('id, public_id, name, portrait_url, level, class, race, sagatree_profile')
        .eq('owner_user_id', userId)
        .in('id', unique)
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:159`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:202` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:201`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:203` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select('*')
      .eq('public_id', publicId.trim().toUpperCase())
      .eq('owner_user_id', userId)
      .single()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:201`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:215` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:214`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:263` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.tableName).insert(characterData).select().single()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:214`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:269` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:268`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:333` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.tableName).update(updatePayload).eq('id', id).eq('owner_user_id', userId).select().single()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:268`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:339` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:338`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:340` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.tableName).delete().eq('id', id).eq('owner_user_id', userId)
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:338`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:345` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:344`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/character/supabase-character.repository.ts:346` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.tableName).select('*').eq('owner_user_id', userId).eq('character_type', 'pc').ilike('name', `%${query}%`).order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:344`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/character/supabase-character.repository.ts:352` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:351`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-portraits

`src/infrastructure/character/supabase-character.repository.ts:363` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(CHARACTER_PORTRAIT_BUCKET).upload(filePath, file, {
      contentType: sniffed,
      upsert: false,
    })
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:351`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: character-portraits

`src/infrastructure/character/supabase-character.repository.ts:368` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage
      .from(CHARACTER_PORTRAIT_BUCKET)
      .createSignedUrl(filePath, CHARACTER_PORTRAIT_SIGNED_SECONDS)
```

Enclosing operation: `src/infrastructure/character/supabase-character.repository.ts:351`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/character/avatar/avatar-animation-runtime.ts:25

```ts
export interface AvatarAnimationRuntimeState {
  support: AvatarAnimationSupportResult;
  activeAction: AvatarAnimationActionId | null;
  message: string;
}
```

### src/infrastructure/character/avatar/avatar-animation-runtime.ts:132

```ts
export class AvatarAnimationRuntime {
  private mixer?: THREE.AnimationMixer;
  private actions = new Map<AvatarAnimationActionId, THREE.AnimationAction>();
  private activeAction: AvatarAnimationActionId | null = null;
  private attachment?: THREE.Mesh;
  private attachmentParent?: THREE.Object3D;
  private root?: THREE.Object3D;
  private analysis?: AvatarRigAnalysisResult;
  private support: AvatarAnimationSupportResult = resolveAvatarAnimationSupport({
    capabilityFlags: [],
    mappedBones: {},
  });
  private prefersReducedMotion = false;
  private disposed = false;
  private suspended = false;
  private resumeAction: AvatarAnimationActionId | null = null;

  constructor(private readonly onStateChange?: AnimationStateListener) {}

  setPrefersReducedMotion(value: boolean): void {
    this.prefersReducedMotion = value;
  }

  /**
   * While suspended the mixer writes no bones: stopped actions restore the rest pose, so an
   * external driver (LiveAct head) is not overwritten by procedural clips every frame.
   */
  setSuspended(suspended: boolean): void {
    if (this.suspended === suspended) return;
    this.suspended = suspended;
    if (suspended) {
      this.resumeAction = this.activeAction;
      for (const action of this.actions.values()) {
        action.stop();
      }
      this.activeAction = null;
      this.emit('Animation pausiert — LiveAct steuert den Charakter.');
      return;
    }
    const remembered = this.resumeAction;
    this.resumeAction = null;
    // Only resume what was playing before LiveAct — never auto-start idle after tracking ends.
    if (remembered && getAnimationCatalogEntry(remembered)?.loop) {
      this.play(remembered);
    } else {
      this.emit('AnimationRuntime bereit.');
    }
  }

  isSuspended(): boolean {
    return this.suspended;
  }

  /**
   * Bind to a loaded avatar root + rig analysis. Disposes prior mixer/actions.
   */
  bind(root: THREE.Object3D, analysis: AvatarRigAnalysisResult): void {
    this.disposeMixer();
    this.root = root;
    this.analysis = analysis;
    this.resumeAction = null;
    this.support = resolveAvatarAnimationSupport({
      capabilityFlags: analysis.capabilities.flags,
      mappedBones: analysis.rig.bones,
    });

    this.mixer = new THREE.AnimationMixer(root);
    this.actions.clear();
    this.activeAction = null;

    for (const entry of AVATAR_ANIMATION_CATALOG) {
      if (!this.support.supported.includes(entry.actionId)) continue;
      const clip = buildProceduralClip(entry.actionId, analysis.rig.bones);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.setLoop(entry.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      if (!entry.loop) action.clampWhenFinished = true;
      this.actions.set(entry.actionId, action);
    }

    this.ensureAttachmentFixture(analysis);
    this.emit('AnimationRuntime bereit.');
  }

  getSupport(): AvatarAnimationSupportResult {
    return this.support;
  }

  getActiveAction(): AvatarAnimationActionId | null {
    return this.activeAction;
  }

  play(actionId: AvatarAnimationActionId): boolean {
    if (this.disposed || !this.mixer) return false;
    if (!this.support.supported.includes(actionId)) {
      this.emit(this.support.unsupportedReasons[actionId] ?? 'Aktion nicht unterstützt.');
      return false;
    }
    const next = this.actions.get(actionId);
    if (!next) {
      this.emit('Clip fehlt im Katalog.');
      return false;
    }
    if (this.suspended) {
      this.resumeAction = actionId;
      this.emit('Animation pausiert, solange LiveAct läuft.');
      return false;
    }

    const fade = resolveAnimationCrossfadeSeconds(this.prefersReducedMotion);
    const previous = this.activeAction ? this.actions.get(this.activeAction) : undefined;
    if (previous && previous !== next) {
      previous.fadeOut(fade);
    }
    next.reset().fadeIn(fade).play();
    this.activeAction = actionId;

    const entry = getAnimationCatalogEntry(actionId);
    if (entry && this.analysis) {
      this.rebindAttachment(entry.attachmentAnchor);
    }
    this.emit(`Spielt ${entry?.labelDe ?? actionId}.`);
    return true;
  }

  update(delta: number): void {
    if (this.disposed || this.suspended) return;
    this.mixer?.update(delta);
  }

  stopAll(): void {
    for (const action of this.actions.values()) {
      action.stop();
    }
    this.activeAction = null;
    this.emit('Animation gestoppt.');
  }

  dispose(): void {
    this.disposed = true;
    this.disposeMixer();
    this.root = undefined;
    this.analysis = undefined;
  }

  private disposeMixer(): void {
    this.stopAll();
    this.detachAttachment();
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = undefined;
    }
    this.actions.clear();
  }

  private ensureAttachmentFixture(analysis: AvatarRigAnalysisResult): void {
    this.detachAttachment();
    if (!this.root) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.18),
      new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.45, metalness: 0.2 }),
    );
    mesh.name = 'SagaTreeAnimationAttachmentFixture';
    this.attachment = mesh;
    const defaultAnchor =
      getAnimationCatalogEntry(this.support.defaultAction ?? 'idle')?.attachmentAnchor ?? 'hips';
    this.rebindAttachment(defaultAnchor, analysis);
  }

  private rebindAttachment(
    anchorId: import('../../../domains/character/avatar/rig-contract').SagaTreeHumanoidAnchorId,
    analysis: AvatarRigAnalysisResult | undefined = this.analysis,
  ): void {
    if (!this.attachment || !this.root || !analysis) return;
    const sourceName = analysis.rig.anchors[anchorId] ?? analysis.rig.bones[anchorId as SagaTreeHumanoidBoneId];
    const parent = findBoneObject(this.root, sourceName);
    if (!parent) return;
    if (this.attachmentParent === parent) return;
    this.attachmentParent?.remove(this.attachment);
    parent.add(this.attachment);
    this.attachment.position.set(0.05, 0.02, 0);
    this.attachmentParent = parent;
  }

  private detachAttachment(): void {
    if (this.attachment) {
      this.attachmentParent?.remove(this.attachment);
      this.attachment.geometry.dispose();
      if (Array.isArray(this.attachment.material)) {
        this.attachment.material.forEach((m) => m.dispose());
      } else {
        (this.attachment.material as THREE.Material).dispose();
      }
    }
    this.attachment = undefined;
    this.attachmentParent = undefined;
  }

  private emit(message: string): void {
    this.onStateChange?.({
      support: this.support,
      activeAction: this.activeAction,
      message,
    });
  }
}
```

### src/infrastructure/character/avatar/avatar-asset-manifests.ts:10

```ts
export type AvatarAssetRepresentation =
  | { kind: 'species-specific' }
  | { kind: 'neutral-fallback'; reason: string };
```

### src/infrastructure/character/avatar/avatar-asset-manifests.ts:14

```ts
export interface AvatarAssetProvenance {
  sourceRepository: string;
  sourceOwner: string;
  sourceCommit: string;
  assetPath: string;
  licenseSpdx: 'CC0-1.0';
  licenseUrl: string;
  allowedUse: 'commercial-and-noncommercial';
}
```

### src/infrastructure/character/avatar/avatar-asset-manifests.ts:24

```ts
export interface AvatarAssetManifest {
  id: string;
  format: CharacterAvatarFormat;
  selfHostedPath: string;
  fallbackUrl: string;
  displayName: string;
  modelScale: number;
  representation: AvatarAssetRepresentation;
  provenance: AvatarAssetProvenance;
  materialHints: {
    skin: readonly string[];
    hair: readonly string[];
    clothing: readonly string[];
  };
}
```

### src/infrastructure/character/avatar/avatar-asset-manifests.ts:76

```ts
export const avatarAssetManifests: Readonly<Record<string, AvatarAssetManifest>> = {
  'humanoid-neutral': {
    id: 'humanoid-neutral',
    format: 'vrm',
    selfHostedPath: 'neutral.vrm',
    ...catalogAsset('skinnie1_5.vrm'),
    displayName: 'Neutral Humanoid',
    modelScale: 1,
    representation: {
      kind: 'neutral-fallback',
      reason: 'Allgemeiner CC0-Humanoid als sicherer Fallback für unbekannte oder noch nicht spezialisierte Spezies.',
    },
    materialHints: sharedMaterialHints,
  },
  'fantasy-human': {
    id: 'fantasy-human',
    format: 'vrm',
    selfHostedPath: 'human.vrm',
    ...catalogAsset('skinnie1_5.vrm'),
    displayName: 'Human',
    modelScale: 1,
    representation: {
      kind: 'neutral-fallback',
      reason: 'Der geprüfte Quellkatalog weist dieses Modell als Humanoid, nicht ausdrücklich als Mensch aus.',
    },
    materialHints: sharedMaterialHints,
  },
  'fantasy-elf': {
    id: 'fantasy-elf',
    format: 'vrm',
    selfHostedPath: 'elf.vrm',
    ...catalogAsset('skinnie3_1.vrm'),
    displayName: 'Elf',
    modelScale: 1.02,
    representation: {
      kind: 'neutral-fallback',
      reason: 'Noch kein lizenzgeprüftes Elf-Spezialasset im kuratierten Katalog; verwendet einen CC0-Humanoid.',
    },
    materialHints: sharedMaterialHints,
  },
  'fantasy-dwarf': {
    id: 'fantasy-dwarf',
    format: 'vrm',
    selfHostedPath: 'dwarf.vrm',
    ...catalogAsset('skinnie4.vrm'),
    displayName: 'Dwarf',
    modelScale: 0.94,
    representation: {
      kind: 'neutral-fallback',
      reason: 'Noch kein lizenzgeprüftes Zwerg-Spezialasset im kuratierten Katalog; verwendet einen CC0-Humanoid.',
    },
    materialHints: sharedMaterialHints,
  },
  'fantasy-halfling': {
    id: 'fantasy-halfling',
    format: 'vrm',
    selfHostedPath: 'halfling.vrm',
    ...catalogAsset('skinnie4.vrm'),
    displayName: 'Halfling',
    modelScale: 0.88,
    representation: {
      kind: 'neutral-fallback',
      reason: 'Noch kein lizenzgeprüftes Halbling-Spezialasset im kuratierten Katalog; verwendet einen CC0-Humanoid.',
    },
    materialHints: sharedMaterialHints,
  },
  'fantasy-orc': {
    id: 'fantasy-orc',
    format: 'vrm',
    selfHostedPath: 'orc.vrm',
    ...catalogAsset('fantasy´/orcs/Orc 1.vrm'),
    displayName: 'Orc',
    modelScale: 1.04,
    representation: { kind: 'species-specific' },
    materialHints: sharedMaterialHints,
  },
  'scifi-cyborg': {
    id: 'scifi-cyborg',
    format: 'vrm',
    selfHostedPath: 'cyborg.vrm',
    ...catalogAsset('skinnie3_1.vrm'),
    displayName: 'Cyborg',
    modelScale: 1,
    representation: {
      kind: 'neutral-fallback',
      reason: 'Noch kein lizenzgeprüftes Cyborg-Spezialasset mit direkter .vrm/.glb-Quelle; verwendet einen CC0-Humanoid.',
    },
    materialHints: sharedMaterialHints,
  },
  'scifi-alien': {
    id: 'scifi-alien',
    format: 'vrm',
    selfHostedPath: 'alien.vrm',
    ...catalogAsset('skinnie1_5.vrm'),
    displayName: 'Alien',
    modelScale: 1.03,
    representation: {
      kind: 'neutral-fallback',
      reason: 'Noch kein lizenzgeprüftes Alien-Spezialasset mit direkter .vrm/.glb-Quelle; verwendet einen CC0-Humanoid.',
    },
    materialHints: sharedMaterialHints,
  },
};
```

### src/infrastructure/character/avatar/avatar-asset-manifests.ts:195

```ts
export function getAvatarAssetManifest(preset: string): AvatarAssetManifest {
  return avatarAssetManifests[preset] ?? avatarAssetManifests['humanoid-neutral'];
}
```

### src/infrastructure/character/avatar/avatar-asset-manifests.ts:199

```ts
export function resolveAvatarModelUrl(avatar: CharacterAvatarDto): string | undefined {
  const explicitModelUrl = normalizeAvatarModelUrl(avatar.model_url ?? '');
  if (explicitModelUrl) return explicitModelUrl;

  // Avatar V2 template path: prefer canonical body family when no external model.
  if (isCanonicalBodyFamilyId(avatar.body_family)) {
    const familyUrl = resolveBaseBodyModelUrl(undefined, avatar.body_family);
    const normalizedFamily = normalizeAvatarModelUrl(familyUrl ?? '');
    if (normalizedFamily) return normalizedFamily;
  }

  const manifest = getAvatarAssetManifest(avatar.preset);
  const selfHostedBase = import.meta.env.VITE_AVATAR_ASSET_BASE_URL as string | undefined;
  if (selfHostedBase) {
    const selfHostedUrl = joinAssetUrl(selfHostedBase, manifest.selfHostedPath);
    const normalizedSelfHostedUrl = normalizeAvatarModelUrl(selfHostedUrl ?? '');
    if (normalizedSelfHostedUrl) return normalizedSelfHostedUrl;
  }

  return normalizeAvatarModelUrl(manifest.fallbackUrl);
}
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:40

```ts
export interface FaceTrackingRuntimeState {
  status: FaceTrackingStatus;
  message: string;
  drive: FaceTrackingDrive | null;
  fpsCap: number;
  qualityProfileId: FaceTrackingQualityProfile['id'];
  qualityProfileLabelDe: string;
}
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:49

```ts
export type FaceTrackingStateListener = (state: FaceTrackingRuntimeState) => void;
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:52

```ts
export interface FaceTrackingDetector {
  detect(video: HTMLVideoElement, timestampMs: number): FaceTrackingSample[];
  dispose(): void;
}
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:57

```ts
export type FaceTrackingDetectorFactory = (
  profile: FaceTrackingQualityProfile,
) => Promise<FaceTrackingDetector>;
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:61

```ts
export interface FaceTrackingApplyTarget {
  applyFaceTrackingDrive(drive: FaceTrackingDrive): void;
  resetFaceTrackingPose(): void;
}
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:74

```ts
export function getActiveFaceTrackingRuntime(): AvatarFaceTrackingRuntime | null {
  return activeFaceTrackingRuntime;
}
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:82

```ts
export function samplesFromBlendshapeFaces(
  faces: readonly {
    presence?: number;
    headYaw?: number;
    headPitch?: number;
    headRoll?: number;
    eyeLookX?: number;
    eyeLookY?: number;
    blinkLeft?: number;
    blinkRight?: number;
    smile?: number;
    browDown?: number;
    jawOpen?: number;
  }[],
): FaceTrackingSample[] {
  return faces.map((face, index) => ({
    presence: face.presence ?? 0,
    headYaw: face.headYaw ?? 0,
    headPitch: face.headPitch ?? 0,
    headRoll: face.headRoll ?? 0,
    eyeLookX: face.eyeLookX ?? 0,
    eyeLookY: face.eyeLookY ?? 0,
    blinkLeft: face.blinkLeft ?? 0,
    blinkRight: face.blinkRight ?? 0,
    smile: face.smile ?? 0,
    browDown: face.browDown ?? 0,
    jawOpen: face.jawOpen ?? 0,
    faceIndex: index,
    faceCount: faces.length,
  }));
}
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:118

```ts
export async function createMediaPipeFaceTrackingDetector(
  profile: FaceTrackingQualityProfile = resolveFaceTrackingQualityProfile({}),
): Promise<FaceTrackingDetector | null> {
  if (typeof window === 'undefined') return null;
  try {
    // Dynamic import of pinned dependency — only after explicit user start.
    const mod = await import('@mediapipe/tasks-vision');
    const fileset = await mod.FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_PATH);
    const landmarker = await mod.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: profile.outputFaceBlendshapes,
      outputFacialTransformationMatrixes: profile.outputFacialTransformationMatrixes,
    });

    const scoreOf = (
      categories: Array<{ categoryName: string; score: number }> | undefined,
      name: string,
    ): number => {
      if (!categories) return 0;
      const hit = categories.find((c) => c.categoryName === name);
      return hit?.score ?? 0;
    };

    return {
      detect(video, timestampMs) {
        const result = landmarker.detectForVideo(video, timestampMs);
        const shapes = result.faceBlendshapes ?? [];
        if (shapes.length === 0) return [];
        const faces = shapes.map((shape, index) => {
          const cats = shape.categories;
          const head = profile.enableHeadPose
            ? liveActHeadPoseFromFacialTransform(result.facialTransformationMatrixes?.[index]?.data)
            : null;
          return {
            presence: 1,
            headYaw: head?.yaw ?? 0,
            headPitch: head?.pitch ?? 0,
            headRoll: head?.roll ?? 0,
            // Toward the user's left = left eye out, right eye in (In/Out are nose-relative).
            eyeLookX:
              scoreOf(cats, 'eyeLookOutLeft') -
              scoreOf(cats, 'eyeLookInLeft') +
              (scoreOf(cats, 'eyeLookInRight') - scoreOf(cats, 'eyeLookOutRight')),
            eyeLookY:
              scoreOf(cats, 'eyeLookUpLeft') +
              scoreOf(cats, 'eyeLookUpRight') -
              (scoreOf(cats, 'eyeLookDownLeft') + scoreOf(cats, 'eyeLookDownRight')),
            blinkLeft: scoreOf(cats, 'eyeBlinkLeft'),
            blinkRight: scoreOf(cats, 'eyeBlinkRight'),
            smile: Math.max(scoreOf(cats, 'mouthSmileLeft'), scoreOf(cats, 'mouthSmileRight')),
            browDown: Math.max(scoreOf(cats, 'browDownLeft'), scoreOf(cats, 'browDownRight')),
            jawOpen: scoreOf(cats, 'jawOpen'),
          };
        });
        return samplesFromBlendshapeFaces(faces);
      },
      dispose() {
        try {
          landmarker.close?.();
        } catch {
          // ignore
        }
      },
    };
  } catch (error) {
    console.warn('[face-tracking] MediaPipe unavailable', error);
    return null;
  }
}
```

### src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts:193

```ts
export class AvatarFaceTrackingRuntime {
  private status: FaceTrackingStatus = 'idle';
  private message = faceTrackingStatusLabelDe('idle');
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private detector: FaceTrackingDetector | null = null;
  private raf = 0;
  private lastFrameAt = 0;
  private drive: FaceTrackingDrive | null = null;
  private disposed = false;
  private visibilityHandler: (() => void) | null = null;
  private readonly limits: FaceTrackingLimits;
  private readonly qualityProfile: FaceTrackingQualityProfile;
  private readonly fpsCap: number;
  private target: FaceTrackingApplyTarget | null = null;

  constructor(
    private readonly onStateChange?: FaceTrackingStateListener,
    private readonly detectorFactory: FaceTrackingDetectorFactory = async (profile) => {
      const detector = await createMediaPipeFaceTrackingDetector(profile);
      if (!detector) {
        throw new Error('unsupported');
      }
      return detector;
    },
    limits: FaceTrackingLimits = DEFAULT_FACE_TRACKING_LIMITS,
  ) {
    this.limits = limits;
    this.qualityProfile = resolveFaceTrackingQualityProfile({
      isMobile: isMobileHint(),
      maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
      limits,
    });
    this.fpsCap = this.qualityProfile.fpsCap;
    this.emit();
  }

  bindTarget(target: FaceTrackingApplyTarget | null): void {
    this.target = target;
  }

  getState(): FaceTrackingRuntimeState {
    return {
      status: this.status,
      message: this.message,
      drive: this.drive,
      fpsCap: this.fpsCap,
      qualityProfileId: this.qualityProfile.id,
      qualityProfileLabelDe: this.qualityProfile.labelDe,
    };
  }

  getQualityProfile(): FaceTrackingQualityProfile {
    return this.qualityProfile;
  }

  /** Explicit user action only — never auto-start on construct/reload. */
  async start(): Promise<void> {
    if (this.disposed) return;
    if (this.status === 'active' || this.status === 'starting') return;

    // Fail-closed singleton: stop the other surface before claiming the camera (#244 / #329).
    if (activeFaceTrackingRuntime && activeFaceTrackingRuntime !== this) {
      activeFaceTrackingRuntime.stop();
    }
    claimLiveActCamera(this);
    activeFaceTrackingRuntime = this;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.setStatus('unsupported', faceTrackingStatusLabelDe('unsupported'));
      this.releaseActiveClaim();
      return;
    }

    this.setStatus('starting', faceTrackingStatusLabelDe('starting'));

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: this.fpsCap, max: this.fpsCap },
        },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.setStatus('denied', faceTrackingStatusLabelDe('denied'));
        this.releaseActiveClaim();
        return;
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        this.setStatus('unsupported', 'Keine Kamera gefunden.');
        this.releaseActiveClaim();
        return;
      }
      this.setStatus('error', faceTrackingStatusLabelDe('error'));
      this.releaseActiveClaim();
      return;
    }

    if (this.disposed || activeFaceTrackingRuntime !== this) {
      this.cleanupMedia();
      return;
    }

    try {
      this.detector = await this.detectorFactory(this.qualityProfile);
    } catch {
      this.cleanupMedia();
      this.setStatus('unsupported', faceTrackingStatusLabelDe('unsupported'));
      this.releaseActiveClaim();
      return;
    }

    if (this.disposed || activeFaceTrackingRuntime !== this) {
      this.cleanupMedia();
      return;
    }

    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => undefined);

    this.visibilityHandler = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        if (this.status === 'active') {
          this.setStatus('paused', faceTrackingStatusLabelDe('paused'));
        }
      } else if (this.status === 'paused') {
        this.setStatus('active', faceTrackingStatusLabelDe('active'));
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.setStatus('active', faceTrackingStatusLabelDe('active'));
    this.lastFrameAt = 0;
    this.loop();
  }

  stop(): void {
    if (this.disposed) return;
    this.cancelLoop();
    this.cleanupMedia();
    this.drive = null;
    this.target?.resetFaceTrackingPose();
    this.releaseActiveClaim();
    this.setStatus('stopped', faceTrackingStatusLabelDe('stopped'));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelLoop();
    this.cleanupMedia();
    this.drive = null;
    this.target = null;
    this.releaseActiveClaim();
    this.setStatus('idle', faceTrackingStatusLabelDe('idle'));
  }

  /** Test/helper: push one sample through the same map/smooth path. */
  ingestSampleForTests(sample: FaceTrackingSample): FaceTrackingDrive {
    const mapped = mapFaceTrackingSample(sample, this.limits);
    this.drive = smoothFaceTrackingDrive(this.drive, mapped, this.limits.smooth);
    assertFaceTrackingDriveLocalOnly(this.drive);
    this.target?.applyFaceTrackingDrive(this.drive);
    if (mapped.trackingLost) {
      this.setStatus('lost', faceTrackingStatusLabelDe('lost'));
    } else if (this.status === 'lost' || this.status === 'active') {
      this.setStatus('active', faceTrackingStatusLabelDe('active'));
    }
    return this.drive;
  }

  private releaseActiveClaim(): void {
    if (activeFaceTrackingRuntime === this) {
      activeFaceTrackingRuntime = null;
    }
    releaseLiveActCamera(this);
  }

  private loop = (): void => {
    if (this.disposed || this.status === 'stopped' || this.status === 'idle') return;
    this.raf = requestAnimationFrame(this.loop);

    if (this.status === 'paused') return;
    const video = this.video;
    const detector = this.detector;
    if (!video || !detector || video.readyState < 2) return;

    const now = performance.now();
    const minDelta = 1000 / Math.max(1, this.fpsCap);
    if (now - this.lastFrameAt < minDelta) return;
    this.lastFrameAt = now;

    let faces: FaceTrackingSample[] = [];
    try {
      faces = detector.detect(video, now);
    } catch (error) {
      console.warn('[face-tracking] detect failed', error);
      this.setStatus('error', faceTrackingStatusLabelDe('error'));
      this.stop();
      return;
    }

    const primary = selectPrimaryFaceIndex(faces);
    const sample =
      primary >= 0
        ? { ...faces[primary], faceIndex: primary, faceCount: faces.length }
        : createEmptyFaceTrackingSample();

    const mapped = mapFaceTrackingSample(sample, this.limits);
    this.drive = smoothFaceTrackingDrive(this.drive, mapped, this.limits.smooth);
    assertFaceTrackingDriveLocalOnly(this.drive);
    this.target?.applyFaceTrackingDrive(this.drive);

    if (mapped.trackingLost) {
      if (this.status !== 'lost') this.setStatus('lost', faceTrackingStatusLabelDe('lost'));
    } else if (this.status === 'lost') {
      this.setStatus('active', faceTrackingStatusLabelDe('active'));
    } else {
      this.emit();
    }
  };

  private cancelLoop(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private cleanupMedia(): void {
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    try {
      this.detector?.dispose();
    } catch {
      // ignore
    }
    this.detector = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }

  private setStatus(status: FaceTrackingStatus, message: string): void {
    this.status = status;
    this.message = message;
    this.emit();
  }

  private emit(): void {
    this.onStateChange?.(this.getState());
  }
}
```

### src/infrastructure/character/avatar/avatar-facial-runtime.ts:20

```ts
export interface AvatarFacialRuntimeState {
  availability: FacialAvailability;
  weights: Readonly<Partial<Record<FacialCanonicalKey, number>>>;
  message: string;
}
```

### src/infrastructure/character/avatar/avatar-facial-runtime.ts:49

```ts
export class AvatarFacialRuntime {
  private vrm?: VRM;
  private availability: FacialAvailability = resolveFacialAvailability([]);
  private weights: Partial<Record<FacialCanonicalKey, number>> = createNeutralFacialWeights();
  private disposed = false;

  constructor(private readonly onStateChange?: FacialStateListener) {}

  bind(vrm: VRM | undefined): void {
    this.resetInternal(false);
    this.vrm = vrm;
    const present = listVrmExpressionNames(vrm);
    // Also accept preset names that setValue can resolve even if map keys differ in casing.
    const expanded = new Set(present);
    if (vrm?.expressionManager) {
      for (const key of FACIAL_CANONICAL_KEYS) {
        for (const alias of [
          key,
          key.charAt(0).toUpperCase() + key.slice(1),
          key.toUpperCase(),
        ]) {
          try {
            const expr = vrm.expressionManager.getExpression?.(alias);
            if (expr) expanded.add(alias);
          } catch {
            // ignore unknown
          }
        }
      }
      // Known VRM presets often registered even when expressionMap iteration differs.
      for (const alias of [
        'blink',
        'neutral',
        'happy',
        'angry',
        'sad',
        'aa',
        'ih',
        'ou',
        'ee',
        'oh',
        'joy',
        'anger',
        'sorrow',
        'A',
        'I',
        'U',
        'E',
        'O',
      ]) {
        try {
          if (vrm.expressionManager.getExpression?.(alias)) expanded.add(alias);
        } catch {
          // ignore
        }
      }
    }
    this.availability = resolveFacialAvailability([...expanded]);
    this.weights = createNeutralFacialWeights();
    this.applyAllWeights();
    this.emit(
      this.availability.available.length > 0
        ? `Facial bereit (${this.availability.available.length} Expressions).`
        : 'Keine VRM-Expressions erkannt — Facial fail-soft.',
    );
  }

  getAvailability(): FacialAvailability {
    return this.availability;
  }

  getWeights(): Readonly<Partial<Record<FacialCanonicalKey, number>>> {
    return this.weights;
  }

  setWeight(key: FacialCanonicalKey, weight: number): boolean {
    if (this.disposed) return false;
    if (!this.availability.available.includes(key)) {
      this.emit(this.availability.missingReasons[key] ?? 'Expression nicht verfügbar.');
      return false;
    }
    this.weights = applyFacialLayerUpdate(this.weights, key, weight);
    this.applyAllWeights();
    this.emit(`Facial: ${key}=${clampFacialWeight(weight).toFixed(2)}`);
    return true;
  }

  /**
   * LiveAct / performance capture — merge multiple weights without exclusive sibling nulling.
   * Manual preview controls keep using setWeight + applyFacialLayerUpdate.
   */
  applyWeightsBatch(updates: Readonly<Partial<Record<FacialCanonicalKey, number>>>): void {
    if (this.disposed) return;
    const next: Partial<Record<FacialCanonicalKey, number>> = { ...this.weights };
    for (const key of FACIAL_CANONICAL_KEYS) {
      const raw = updates[key];
      if (typeof raw !== 'number') continue;
      if (!this.availability.available.includes(key)) continue;
      next[key] = clampFacialWeight(raw);
    }
    this.weights = next;
    this.applyAllWeights();
    this.emit('Facial: LiveAct-Batch angewendet.');
  }

  /** Reset to Neutral; clears blink + visemes; no stuck weights. */
  resetToNeutral(): void {
    this.weights = createNeutralFacialWeights();
    this.vrm?.expressionManager?.resetValues?.();
    this.applyAllWeights();
    this.emit('Facial: Neutral');
  }

  dispose(): void {
    this.disposed = true;
    this.resetInternal(true);
    this.vrm = undefined;
  }

  private resetInternal(emit: boolean): void {
    this.vrm?.expressionManager?.resetValues?.();
    this.weights = createNeutralFacialWeights();
    this.availability = resolveFacialAvailability([]);
    if (emit) this.emit('Facial zurückgesetzt.');
  }

  private applyAllWeights(): void {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;
    for (const key of FACIAL_CANONICAL_KEYS) {
      const name = this.availability.resolvedNames[key];
      if (!name) continue;
      const weight = clampFacialWeight(this.weights[key] ?? 0);
      try {
        manager.setValue(name, weight);
      } catch {
        // fail-soft per missing runtime binding
      }
    }
  }

  private emit(message: string): void {
    this.onStateChange?.({
      availability: this.availability,
      weights: this.weights,
      message,
    });
  }
}
```

### src/infrastructure/character/avatar/avatar-rigid-equipment-runtime.ts:23

```ts
export type ResolveRigidEquipmentUrl = (assetKey: string) => string | null | Promise<string | null>;
```

### src/infrastructure/character/avatar/avatar-rigid-equipment-runtime.ts:32

```ts
export class AvatarRigidEquipmentRuntime {
  private readonly group = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private readonly attached = new Map<string, AttachedEntry>();
  private readonly cache = new Map<string, THREE.Object3D>();
  private readonly loadTokens = new Map<string, number>();
  private generation = 0;
  private avatarRoot: THREE.Object3D | null = null;
  private analysis: AvatarRigAnalysisResult | null = null;
  private resolveUrl: ResolveRigidEquipmentUrl;
  private disposed = false;

  constructor(resolveUrl: ResolveRigidEquipmentUrl = () => null) {
    this.group.name = 'saga-rigid-equipment';
    this.resolveUrl = resolveUrl;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Temporarily hide attached rigid equipment and reveal hideTargets for MediaPipe capture.
   * Returns restore() — call in finally. Does not mutate visuals/traits/inventory.
   */
  beginFaceMappingBaseFaceCapture(): () => void {
    const hide: THREE.Object3D[] = [this.group];
    const reveal: THREE.Object3D[] = [];
    for (const entry of this.attached.values()) {
      hide.push(entry.root);
      for (const target of entry.hideTargets) {
        reveal.push(target);
      }
    }
    return beginFaceMappingBaseFaceCaptureVisibility({ hide, reveal });
  }

  /**
   * Test seam (#421): register a synthetic attached root without GLTF load.
   * Production Auto Mapping never calls this.
   */
  attachSyntheticForFaceMappingCaptureTest(params: {
    readonly instanceId: string;
    readonly root: THREE.Object3D;
    readonly hideTargets?: readonly THREE.Object3D[];
  }): void {
    this.detach(params.instanceId);
    this.attached.set(params.instanceId, {
      instanceId: params.instanceId,
      root: params.root,
      hideTargets: [...(params.hideTargets ?? [])],
      generation: this.generation,
    });
  }

  setUrlResolver(resolveUrl: ResolveRigidEquipmentUrl): void {
    this.resolveUrl = resolveUrl;
  }

  bindAvatar(root: THREE.Object3D | null, analysis: AvatarRigAnalysisResult | null): void {
    this.clearAll(true);
    this.avatarRoot = root;
    this.analysis = analysis;
    if (root) {
      root.add(this.group);
    }
  }

  /**
   * Apply #158 visuals — only rigid+ready. Missing/incompatible skip silently.
   */
  async applyVisuals(visuals: readonly AvatarEquipmentVisual[]): Promise<void> {
    if (this.disposed) return;
    this.generation += 1;
    const generation = this.generation;

    const available = this.listAvailableAnchors();
    const previous = [...this.attached.keys()];
    const plan = planRigidEquipmentAttaches({
      visuals,
      previousInstanceIds: previous,
      generation,
      availableAnchors: available,
    });

    for (const instanceId of plan.detachInstanceIds) {
      this.detach(instanceId);
    }

    await Promise.all(plan.attach.map((op) => this.attachOp(op, generation)));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearAll(true);
    this.cache.clear();
    this.group.removeFromParent();
  }

  private listAvailableAnchors(): Set<SagaTreeHumanoidAnchorId> {
    const set = new Set<SagaTreeHumanoidAnchorId>();
    const anchors = this.analysis?.rig.anchors;
    if (!anchors) return set;
    for (const [key, name] of Object.entries(anchors)) {
      if (name) set.add(key as SagaTreeHumanoidAnchorId);
    }
    return set;
  }

  private findAnchorObject(anchor: SagaTreeHumanoidAnchorId): THREE.Object3D | null {
    if (!this.avatarRoot || !this.analysis) return null;
    const sourceName = this.analysis.rig.anchors[anchor];
    if (!sourceName) return null;
    let found: THREE.Object3D | null = null;
    this.avatarRoot.traverse((obj) => {
      if (found) return;
      if (obj.name === sourceName) found = obj;
    });
    return found;
  }

  private async attachOp(op: RigidEquipmentAttachOp, generation: number): Promise<void> {
    if (this.disposed || generation !== this.generation) return;
    if (!parseItemModel3dAssetKey(op.assetKey)) return;

    const token = (this.loadTokens.get(op.instanceId) ?? 0) + 1;
    this.loadTokens.set(op.instanceId, token);

    const anchorObj = this.findAnchorObject(op.anchor);
    if (!anchorObj) return;

    let template = this.cache.get(op.assetKey);
    if (!template) {
      const url = await this.resolveUrl(op.assetKey);
      const safe = url ? normalizeSafeUrl(url) : undefined;
      if (!safe) return;
      try {
        const gltf = await this.loader.loadAsync(safe);
        if (this.disposed || generation !== this.generation || this.loadTokens.get(op.instanceId) !== token) {
          return;
        }
        template = gltf.scene;
        this.cache.set(op.assetKey, template);
        while (this.cache.size > MAX_CACHED_GLBS) {
          const first = this.cache.keys().next().value;
          if (!first) break;
          this.cache.delete(first);
        }
      } catch {
        return;
      }
    }

    if (this.disposed || generation !== this.generation || this.loadTokens.get(op.instanceId) !== token) {
      return;
    }

    this.detach(op.instanceId);

    const clone = template.clone(true);
    clone.name = `rigid-${op.instanceId}`;
    clone.position.set(op.position[0], op.position[1], op.position[2]);
    clone.rotation.set(op.rotationEuler[0], op.rotationEuler[1], op.rotationEuler[2]);
    clone.scale.set(op.scale[0], op.scale[1], op.scale[2]);
    anchorObj.add(clone);

    const hideTargets = this.applyHideRegions(op.hideRegions);
    this.attached.set(op.instanceId, {
      instanceId: op.instanceId,
      root: clone,
      hideTargets,
      generation,
    });
  }

  private applyHideRegions(regions: readonly string[]): THREE.Object3D[] {
    if (!this.avatarRoot) return [];
    const targets: THREE.Object3D[] = [];
    const hints = regions.filter((r) => r !== 'none').map((r) => r.toLowerCase());
    if (hints.length === 0) return targets;

    this.avatarRoot.traverse((obj) => {
      const name = obj.name.toLowerCase();
      if (!hints.some((hint) => name.includes(hint))) return;
      if (!obj.visible) return;
      obj.visible = false;
      targets.push(obj);
    });
    return targets;
  }

  private detach(instanceId: string): void {
    const entry = this.attached.get(instanceId);
    if (!entry) return;
    for (const target of entry.hideTargets) {
      target.visible = true;
    }
    entry.root.removeFromParent();
    entry.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) mat.dispose();
      }
    });
    this.attached.delete(instanceId);
  }

  private clearAll(restoreHide: boolean): void {
    for (const id of [...this.attached.keys()]) {
      if (!restoreHide) {
        const entry = this.attached.get(id);
        if (entry) entry.hideTargets = [];
      }
      this.detach(id);
    }
  }
}
```

### src/infrastructure/character/avatar/avatar-skinned-wearable-runtime.ts:28

```ts
export type ResolveSkinnedWearableUrl = (assetKey: string) => string | null | Promise<string | null>;
```

### src/infrastructure/character/avatar/avatar-skinned-wearable-runtime.ts:37

```ts
export class AvatarSkinnedWearableRuntime {
  private readonly group = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private readonly attached = new Map<string, Attached>();
  private readonly cache = new Map<string, THREE.Object3D>();
  private readonly loadTokens = new Map<string, number>();
  private readonly regionMask = new BodyRegionMaskRegistry();
  private generation = 0;
  private avatarRoot: THREE.Object3D | null = null;
  private analysis: AvatarRigAnalysisResult | null = null;
  private bodyFamily: CanonicalBodyFamilyId | null = null;
  private resolveUrl: ResolveSkinnedWearableUrl;
  private disposed = false;

  constructor(resolveUrl: ResolveSkinnedWearableUrl = () => null) {
    this.group.name = 'saga-skinned-wearables';
    this.resolveUrl = resolveUrl;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Temporarily hide attached skinned wearables and reveal masked base regions for MediaPipe capture.
   * Returns restore() — call in finally. Does not mutate visuals/traits/inventory.
   */
  beginFaceMappingBaseFaceCapture(): () => void {
    const hide: THREE.Object3D[] = [this.group];
    for (const entry of this.attached.values()) {
      hide.push(entry.root);
    }
    const reveal = this.collectMaskedBaseSurfacesForCapture();
    return beginFaceMappingBaseFaceCaptureVisibility({ hide, reveal });
  }

  /**
   * Test seam (#421): register a synthetic skinned root + region mask without GLTF load.
   * Production Auto Mapping never calls this.
   */
  attachSyntheticForFaceMappingCaptureTest(params: {
    readonly instanceId: string;
    readonly root: THREE.Object3D;
    readonly maskRegions: readonly string[];
  }): void {
    this.detach(params.instanceId);
    this.applyMask(params.maskRegions);
    this.attached.set(params.instanceId, {
      instanceId: params.instanceId,
      root: params.root,
      maskRegions: params.maskRegions,
      generation: this.generation,
    });
  }

  setUrlResolver(resolveUrl: ResolveSkinnedWearableUrl): void {
    this.resolveUrl = resolveUrl;
  }

  setBodyFamily(bodyFamily: CanonicalBodyFamilyId | null): void {
    this.bodyFamily = bodyFamily;
  }

  getRegionMaskSnapshot() {
    return this.regionMask.snapshot();
  }

  bindAvatar(root: THREE.Object3D | null, analysis: AvatarRigAnalysisResult | null): void {
    this.clearAll();
    this.avatarRoot = root;
    this.analysis = analysis;
    if (root) root.add(this.group);
  }

  async applyVisuals(visuals: readonly AvatarEquipmentVisual[]): Promise<void> {
    if (this.disposed) return;
    this.generation += 1;
    const generation = this.generation;
    const flags = this.analysis?.capabilities.flags ?? [];
    const plan = planSkinnedWearableAttaches({
      visuals,
      capabilityFlags: flags,
      previousInstanceIds: [...this.attached.keys()],
      generation,
      bodyFamily: this.bodyFamily,
    });

    for (const id of plan.detachInstanceIds) this.detach(id);
    await Promise.all(plan.attach.map((op) => this.attachOp(op, generation)));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearAll();
    this.cache.clear();
    this.group.removeFromParent();
  }

  private async attachOp(op: SkinnedWearableAttachOp, generation: number): Promise<void> {
    if (this.disposed || generation !== this.generation) return;
    // Legacy model3d keys still allowed; wardrobe keys may omit model3d: prefix.
    const hasModelKey = Boolean(parseItemModel3dAssetKey(op.assetKey));
    const hasFamilyPath = Boolean(op.familyAssetPath);
    if ((!hasModelKey && !hasFamilyPath) || !this.avatarRoot) return;

    const token = (this.loadTokens.get(op.instanceId) ?? 0) + 1;
    this.loadTokens.set(op.instanceId, token);

    const cacheKey = op.familyAssetPath
      ? `family:${op.familyAssetPath}`
      : op.assetKey;

    let template = this.cache.get(cacheKey);
    if (!template) {
      const url = await this.resolveUrl(
        op.familyAssetPath ? `wearable-path:${op.familyAssetPath}` : op.assetKey,
      );
      const safe = url ? normalizeSafeUrl(url) : undefined;
      if (!safe) return;
      try {
        const gltf = await this.loader.loadAsync(safe);
        if (
          this.disposed ||
          generation !== this.generation ||
          this.loadTokens.get(op.instanceId) !== token
        ) {
          return;
        }
        let hasSkin = false;
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.SkinnedMesh) hasSkin = true;
        });
        if (!hasSkin) return;
        template = gltf.scene;
        this.cache.set(cacheKey, template);
        while (this.cache.size > MAX_CACHED) {
          const first = this.cache.keys().next().value;
          if (!first) break;
          this.cache.delete(first);
        }
      } catch {
        return;
      }
    }

    if (
      this.disposed ||
      generation !== this.generation ||
      this.loadTokens.get(op.instanceId) !== token
    ) {
      return;
    }

    this.detach(op.instanceId);

    // SkeletonUtils.clone preserves skinning graph; then rebind to host skeleton.
    const clone = SkeletonUtils.clone(template) as THREE.Object3D;
    clone.name = `skinned-${op.instanceId}`;

    const rebound = this.rebindToAvatarSkeleton(clone);
    if (!rebound) {
      // Rig/family mismatch — fail closed, do not attach orphan skeleton.
      return;
    }

    this.avatarRoot.add(clone);
    this.applyMask(op.bodyMaskRegions.length > 0 ? op.bodyMaskRegions : op.hideRegions);
    this.attached.set(op.instanceId, {
      instanceId: op.instanceId,
      root: clone,
      maskRegions: op.bodyMaskRegions.length > 0 ? op.bodyMaskRegions : op.hideRegions,
      generation,
    });
  }

  /**
   * Rebind wearable SkinnedMeshes onto the avatar host skeleton by bone name.
   * Returns false when host skeleton or required bones are missing.
   */
  private rebindToAvatarSkeleton(wearableRoot: THREE.Object3D): boolean {
    if (!this.avatarRoot) return false;

    const hostSkeleton = this.findHostSkeleton(this.avatarRoot);
    if (!hostSkeleton) return false;

    const hostByName = new Map<string, THREE.Bone>();
    for (const bone of hostSkeleton.bones) {
      hostByName.set(bone.name, bone);
    }

    // Also index analysis-mapped canonical → source names.
    const mapped = this.analysis?.rig.bones ?? {};
    for (const sourceName of Object.values(mapped)) {
      if (!sourceName || hostByName.has(sourceName)) continue;
      this.avatarRoot.traverse((obj) => {
        if (obj instanceof THREE.Bone && obj.name === sourceName) {
          hostByName.set(sourceName, obj);
        }
      });
    }

    let reboundAny = false;
    let failed = false;
    wearableRoot.traverse((obj) => {
      if (!(obj instanceof THREE.SkinnedMesh)) return;
      const nextBones: THREE.Bone[] = [];
      for (const bone of obj.skeleton.bones) {
        const hostBone = hostByName.get(bone.name);
        if (!hostBone) {
          failed = true;
          return;
        }
        nextBones.push(hostBone);
      }
      const skeleton = new THREE.Skeleton(nextBones, obj.skeleton.boneInverses.slice());
      obj.bind(skeleton, obj.bindMatrix);
      obj.skeleton = skeleton;
      reboundAny = true;
    });

    return reboundAny && !failed;
  }

  private findHostSkeleton(root: THREE.Object3D): THREE.Skeleton | null {
    let found: THREE.Skeleton | null = null;
    root.traverse((obj) => {
      if (found) return;
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton?.bones?.length) {
        found = obj.skeleton;
      }
    });
    return found;
  }

  /** Base meshes currently hidden by active body-region masks (for capture reveal). */
  private collectMaskedBaseSurfacesForCapture(): THREE.Object3D[] {
    if (!this.avatarRoot) return [];
    const counts = this.regionMask.snapshot().counts;
    const wanted = new Set(
      Object.entries(counts)
        .filter(([, count]) => (count ?? 0) > 0)
        .map(([region]) => region.toLowerCase()),
    );
    if (wanted.size === 0) return [];
    const out: THREE.Object3D[] = [];
    this.avatarRoot.traverse((obj) => {
      if (obj === this.group || obj.parent === this.group) return;
      if (obj.name.startsWith('skinned-') || obj.name === 'saga-skinned-wearables') return;
      if (obj.name.startsWith('rigid-') || obj.name === 'saga-rigid-equipment') return;
      const tagged =
        typeof obj.userData.sdBodyRegion === 'string'
          ? String(obj.userData.sdBodyRegion).toLowerCase()
          : null;
      const name = obj.name.toLowerCase();
      const match =
        (tagged && wanted.has(tagged)) ||
        [...wanted].some((h) => h !== 'none' && name.includes(h));
      if (!match) return;
      out.push(obj);
    });
    return out;
  }

  private applyMask(regions: readonly string[]): void {
    const delta = this.regionMask.apply(regions);
    this.setRegionVisibility(delta.newlyHidden, false);
  }

  private releaseMask(regions: readonly string[]): void {
    const delta = this.regionMask.release(regions);
    this.setRegionVisibility(delta.newlyRestored, true);
  }

  /**
   * Apply visibility by V2 region contract: prefer userData.sdBodyRegion,
   * fallback to name substring (legacy meshes without region tags).
   */
  private setRegionVisibility(
    regions: readonly string[],
    visible: boolean,
  ): void {
    if (!this.avatarRoot || regions.length === 0) return;
    const wanted = new Set(regions.map((r) => r.toLowerCase()));
    this.avatarRoot.traverse((obj) => {
      if (obj === this.group || obj.parent === this.group) return;
      if (obj.name.startsWith('skinned-') || obj.name === 'saga-skinned-wearables') return;

      const tagged =
        typeof obj.userData.sdBodyRegion === 'string'
          ? String(obj.userData.sdBodyRegion).toLowerCase()
          : null;
      const name = obj.name.toLowerCase();
      const match =
        (tagged && wanted.has(tagged)) ||
        [...wanted].some((h) => h !== 'none' && name.includes(h));
      if (!match) return;
      obj.visible = visible;
    });
  }

  private detach(instanceId: string): void {
    const entry = this.attached.get(instanceId);
    if (!entry) return;
    this.releaseMask(entry.maskRegions);
    entry.root.removeFromParent();
    entry.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    this.attached.delete(instanceId);
  }

  private clearAll(): void {
    for (const id of [...this.attached.keys()]) this.detach(id);
    const leftover = this.regionMask.clear();
    this.setRegionVisibility(leftover.newlyRestored, true);
  }
}
```

### src/infrastructure/character/avatar/avatar-structure-scanner.ts:43

```ts
export async function extractAvatarStructureEvidenceFromBytes(
  bytes: Uint8Array,
): Promise<AvatarStructureEvidence> {
  const byteSize = bytes.byteLength;
  if (byteSize <= 0) {
    return emptyEvidence({ parseError: 'Leeres Asset.', byteSize });
  }
  if (byteSize > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxBytes) {
    return emptyEvidence({
      byteSize,
      truncated: true,
      parseError: 'Asset zu groß für Analyse.',
    });
  }

  // Reject obvious external URI hints in ASCII window before parse.
  const probeLen = Math.min(bytes.byteLength, 256 * 1024);
  let ascii = '';
  for (let i = 0; i < probeLen; i += 1) {
    const c = bytes[i];
    ascii += c >= 32 && c < 127 ? String.fromCharCode(c) : ' ';
  }
  const lower = ascii.toLowerCase();
  if (
    lower.includes('http://') ||
    lower.includes('https://') ||
    lower.includes('file://') ||
    /"uri"\s*:\s*"https?:/i.test(ascii)
  ) {
    return emptyEvidence({
      byteSize,
      rejectedRemoteUri: true,
      parseError: 'Remote-URI in glTF erkannt — Analyse abgelehnt.',
    });
  }

  try {
    const io = new NodeIO();
    // Do not register remote fetch — NodeIO without fetch stays local buffers only.
    const document = await io.readBinary(bytes);
    const root = document.getRoot();

    const nodes: AvatarStructureNodeEvidence[] = [];
    const meshes: AvatarStructureMeshEvidence[] = [];
    const humanoidBones: Partial<Record<SagaTreeHumanoidBoneId, string>> = {};
    let truncated = false;
    let boneCount = 0;
    let morphTargetCount = 0;
    let skinnedMeshCount = 0;

    const glNodes = root.listNodes();
    const glMeshes = root.listMeshes();
    const glSkins = root.listSkins();

    if (glNodes.length > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxNodes) {
      truncated = true;
    }
    if (glMeshes.length > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxMeshes) {
      truncated = true;
    }
    if (glSkins.length > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxSkeletons) {
      truncated = true;
    }

    const nodeLimit = Math.min(glNodes.length, AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxNodes);
    for (let i = 0; i < nodeLimit; i += 1) {
      const node = glNodes[i];
      const mesh = node.getMesh();
      const skin = node.getSkin();
      const extrasRoot = node.getExtras();

      nodes.push({
        name: node.getName() || undefined,
        extras: extrasRoot ?? undefined,
        meshIndex: mesh ? glMeshes.indexOf(mesh) : undefined,
        skinIndex: skin ? glSkins.indexOf(skin) : undefined,
      });
    }

    const meshLimit = Math.min(glMeshes.length, AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxMeshes);
    for (let i = 0; i < meshLimit; i += 1) {
      const mesh = glMeshes[i];
      const primitives = mesh.listPrimitives();
      let meshMorphs = 0;
      let isSkinned = false;
      for (const prim of primitives) {
        const targets = prim.listTargets();
        meshMorphs += targets.length;
        // Skinned if WEIGHTS_0 / JOINTS_0 present
        if (prim.getAttribute('JOINTS_0') || prim.getAttribute('WEIGHTS_0')) {
          isSkinned = true;
        }
      }
      if (isSkinned) skinnedMeshCount += 1;
      morphTargetCount += meshMorphs;
      if (morphTargetCount > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxMorphTargets) {
        truncated = true;
      }
      if (skinnedMeshCount > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxSkinnedMeshes) {
        truncated = true;
      }
      meshes.push({
        name: mesh.getName() || undefined,
        primitiveCount: primitives.length,
        morphTargetCount: meshMorphs,
        isSkinned,
      });
    }

    const skinLimit = Math.min(glSkins.length, AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxSkeletons);
    for (let i = 0; i < skinLimit; i += 1) {
      const joints = glSkins[i].listJoints();
      for (const joint of joints) {
        boneCount += 1;
        if (boneCount > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxBones) {
          truncated = true;
          break;
        }
        const name = joint.getName();
        const canonical = resolveCanonicalBoneId(name);
        if (canonical && !humanoidBones[canonical]) {
          humanoidBones[canonical] = name;
        }
      }
      if (truncated) break;
    }

    return {
      byteSize,
      nodeCount: glNodes.length,
      meshCount: glMeshes.length,
      skinnedMeshCount,
      skeletonCount: glSkins.length,
      boneCount,
      morphTargetCount,
      humanoidBones,
      nodes,
      meshes,
      truncated,
      rejectedRemoteUri: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Parse-Fehler';
    return emptyEvidence({ byteSize, parseError: message });
  }
}
```

### src/infrastructure/character/avatar/avatar-structure-scanner.ts:190

```ts
export async function analyzeAvatarGlbBytesAuthoritative(
  bytes: Uint8Array,
): Promise<AvatarStructureAnalysisResultV2> {
  const evidence = await extractAvatarStructureEvidenceFromBytes(bytes);
  return authoritativeAnalyzeAvatarStructure(evidence);
}
```

### src/infrastructure/character/avatar/avatar-structure-scanner.ts:198

```ts
export async function previewAnalyzeAvatarGlbBytes(
  bytes: Uint8Array,
): Promise<AvatarStructureAnalysisResultV2> {
  const evidence = await extractAvatarStructureEvidenceFromBytes(bytes);
  return previewAnalyzeAvatarStructure(evidence);
}
```

### src/infrastructure/character/avatar/base-body-catalog.ts:26

```ts
export function getSagaTreeBaseBodyManifest(
  familyId: CanonicalBodyFamilyId = 'standard',
): SagaTreeBaseBodyManifestV1 {
  return toSagaTreeBaseBodyManifest(createCanonicalBodyFamilyManifest(familyId));
}
```

### src/infrastructure/character/avatar/base-body-catalog.ts:33

```ts
export function getLegacySagaTreeBaseBodyManifest(): SagaTreeBaseBodyManifestV1 {
  return createSagaTreeBaseBodyManifestV1();
}
```

### src/infrastructure/character/avatar/base-body-catalog.ts:37

```ts
export function isAllowlistedBaseBodyPath(path: string): boolean {
  const normalized = path.replace(/^\.\//, '').replace(/^\//, '');
  return ALLOWLISTED_BASE_BODY_PATHS.has(normalized);
}
```

### src/infrastructure/character/avatar/base-body-catalog.ts:42

```ts
export function resolveBaseBodyFamilyFromPath(path: string): CanonicalBodyFamilyId | null {
  const normalized = path.replace(/^\.\//, '').replace(/^\//, '').replace(/\.vrm$/i, '');
  return resolveCanonicalBodyFamilyId(normalized);
}
```

### src/infrastructure/character/avatar/base-body-catalog.ts:51

```ts
export function resolveBaseBodyModelUrl(
  assetBaseUrl: string | undefined = import.meta.env.VITE_AVATAR_ASSET_BASE_URL as
    | string
    | undefined,
  familyId: CanonicalBodyFamilyId = 'standard',
): string | undefined {
  const manifest = getSagaTreeBaseBodyManifest(familyId);
  if (!isAllowlistedBaseBodyPath(manifest.selfHostedPath)) return undefined;
  if (!assetBaseUrl) return undefined;

  const base = normalizeSafeUrl(assetBaseUrl);
  if (!base) return undefined;

  if (base.startsWith('/')) {
    return `${base.replace(/\/$/, '')}/${manifest.selfHostedPath}`;
  }

  try {
    return new URL(manifest.selfHostedPath, base.endsWith('/') ? base : `${base}/`).toString();
  } catch {
    return undefined;
  }
}
```

### src/infrastructure/character/avatar/base-body-catalog.ts:75

```ts
export function evaluateBaseBodyMorphReadiness(
  presentMorphTargetNames: readonly string[],
  familyId: CanonicalBodyFamilyId = 'standard',
): BaseBodyMorphCapabilityReport {
  return resolveBaseBodyMorphCapabilities({
    manifest: getSagaTreeBaseBodyManifest(familyId),
    presentMorphTargetNames,
  });
}
```

### src/infrastructure/character/avatar/base-body-catalog.ts:86

```ts
export function simulateCompleteMorphTargetEvidence(
  familyId: CanonicalBodyFamilyId = 'standard',
): readonly string[] {
  return listRequiredMorphTargetNames(getSagaTreeBaseBodyManifest(familyId).morphTargets);
}
```

### src/infrastructure/character/avatar/body-profile-metrics.ts:24

```ts
export function estimateHumanoidMetricsFromStructureAnalysis(
  analysis: AvatarStructureAnalysisResultV2,
): HumanoidMetricLengthsV1 | null {
  if (analysis.anatomy !== 'humanoid') return null;
  if (analysis.humanoidBoneCount < 8) return null;

  // Canonical adult height in meters; limb ratios vary by bone coverage proxy.
  const height = 1.7;
  const coverage = Math.min(1, analysis.humanoidBoneCount / 17);
  const skinnedBoost = analysis.evidence.skinnedMeshCount > 0 ? 1 : 0.9;

  return {
    height,
    shoulderWidth: 0.44 * coverage * skinnedBoost,
    hipWidth: 0.34 * coverage,
    torsoLength: 0.51 * coverage,
    legLength: 0.82 * coverage,
    armLength: 0.75 * coverage,
    headHeight: 0.22,
  };
}
```

### src/infrastructure/character/avatar/body-profile-metrics.ts:46

```ts
export function resolveFamilyCompatibilityFromAnalysis(
  analysis: AvatarStructureAnalysisResultV2,
  metricsOverride?: HumanoidMetricLengthsV1,
): { profile: BodyProfileV1; compatibility: FamilyCompatibilityResultV1 } {
  const metrics =
    metricsOverride ?? estimateHumanoidMetricsFromStructureAnalysis(analysis);

  if (!metrics) {
    const profile = bodyProfileFromMetricLengths({
      height: 0,
      shoulderWidth: 0,
      hipWidth: 0,
      torsoLength: 0,
      legLength: 0,
      armLength: 0,
      headHeight: 0,
    });
    return {
      profile,
      compatibility: resolveFamilyCompatibility({
        profile,
        anatomy: analysis.anatomy,
      }),
    };
  }

  const profile = bodyProfileFromMetricLengths(metrics);
  return {
    profile,
    compatibility: resolveFamilyCompatibility({
      profile,
      anatomy: analysis.anatomy,
    }),
  };
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:114

```ts
export async function createAvatarArtifact(
  artifact: AvatarArtifactV2,
): Promise<AvatarArtifactV2> {
  const ownerUserId = await getAuthenticatedUserId();
  if (artifact.ownerUserId !== ownerUserId) {
    throw new Error('Artefakt-Owner stimmt nicht mit der Session überein.');
  }
  if (artifact.isActive) {
    throw new Error('Neues Artefakt darf nicht direkt aktiv sein — activate verwenden.');
  }

  if (artifact.idempotencyKey) {
    const existing = await findAvatarArtifactByIdempotencyKey(
      ownerUserId,
      artifact.idempotencyKey,
    );
    if (existing) return existing;
  }

  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .insert(artifactToInsert(artifact))
    .select('*')
    .single();

  if (error) {
    // Unique idempotency race — re-read.
    if (artifact.idempotencyKey && /duplicate|unique/i.test(error.message)) {
      const again = await findAvatarArtifactByIdempotencyKey(
        ownerUserId,
        artifact.idempotencyKey,
      );
      if (again) return again;
    }
    throw new Error(`Avatar-Artefakt konnte nicht gespeichert werden: ${error.message}`);
  }

  return rowToArtifact(data as ArtifactRow);
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:154

```ts
export async function getAvatarArtifactById(
  artifactId: string,
): Promise<AvatarArtifactV2 | null> {
  const ownerUserId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('id', artifactId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Avatar-Artefakt lesen fehlgeschlagen: ${error.message}`);
  }
  if (!data) return null;
  return rowToArtifact(data as ArtifactRow);
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:173

```ts
export async function findAvatarArtifactByIdempotencyKey(
  ownerUserId: string,
  idempotencyKey: string,
): Promise<AvatarArtifactV2 | null> {
  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('idempotency_key', idempotencyKey)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Idempotency-Lookup fehlgeschlagen: ${error.message}`);
  }
  if (!data) return null;
  return rowToArtifact(data as ArtifactRow);
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:192

```ts
export async function listAvatarArtifacts(options: {
  characterId?: string | null;
} = {}): Promise<readonly AvatarArtifactV2[]> {
  const ownerUserId = await getAuthenticatedUserId();
  let query = supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options.characterId !== undefined) {
    query =
      options.characterId === null
        ? query.is('character_id', null)
        : query.eq('character_id', options.characterId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Avatar-Artefakte listen fehlgeschlagen: ${error.message}`);
  }
  return (data as ArtifactRow[]).map(rowToArtifact);
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:220

```ts
export async function activateAvatarArtifact(
  artifactId: string,
): Promise<AvatarArtifactActivateResult> {
  const ownerUserId = await getAuthenticatedUserId();
  const current = await getAvatarArtifactById(artifactId);
  if (!current) {
    return { ok: false, reasonDe: 'Artefakt nicht gefunden oder fremder Owner.' };
  }
  const gate = assertCanActivateAvatarArtifact(current);
  if (!gate.ok) return gate;

  if (current.characterId) {
    const { error: deactivateError } = await supabase
      .from('character_avatar_artifacts')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', current.characterId)
      .eq('is_active', true)
      .is('deleted_at', null);
    if (deactivateError) {
      return {
        ok: false,
        reasonDe: `Vorheriges Artefakt konnte nicht deaktiviert werden: ${deactivateError.message}`,
      };
    }
  }

  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .update({ is_active: true })
    .eq('id', artifactId)
    .eq('owner_user_id', ownerUserId)
    .eq('materialization_status', 'materialized')
    .neq('analysis_status', 'failed')
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      reasonDe: error?.message ?? 'Aktivierung fehlgeschlagen.',
    };
  }

  return { ok: true, artifact: rowToArtifact(data as ArtifactRow) };
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:269

```ts
export async function materializeArtifactFromImportAsset(input: {
  importAssetId: string;
  characterId?: string | null;
  storagePath: string;
  format: 'vrm' | 'glb';
}): Promise<AvatarArtifactV2> {
  const ownerUserId = await getAuthenticatedUserId();
  const draft = materializeAvatarArtifact(
    mapImportAssetToArtifactInput({
      importAssetId: input.importAssetId,
      ownerUserId,
      characterId: input.characterId,
      storagePath: input.storagePath,
      format: input.format,
    }),
  );
  return createAvatarArtifact(draft);
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:289

```ts
export async function materializeArtifactFromGenerateJob(input: {
  generateJobId: string;
  characterId?: string | null;
  storagePath: string;
  providerId?: string;
}): Promise<AvatarArtifactV2> {
  const ownerUserId = await getAuthenticatedUserId();
  const draft = materializeAvatarArtifact(
    mapGenerateJobToArtifactInput({
      generateJobId: input.generateJobId,
      ownerUserId,
      characterId: input.characterId,
      storagePath: input.storagePath,
      providerId: input.providerId,
    }),
  );
  return createAvatarArtifact(draft);
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:309

```ts
export async function materializeArtifactFromTemplate(input: {
  artifactId: string;
  templateId: string;
  characterId?: string | null;
  storagePath: string;
}): Promise<AvatarArtifactV2> {
  const ownerUserId = await getAuthenticatedUserId();
  const draft = materializeAvatarArtifact(
    mapTemplateToArtifactInput({
      artifactId: input.artifactId,
      ownerUserId,
      characterId: input.characterId,
      templateId: input.templateId,
      storagePath: input.storagePath,
    }),
  );
  return createAvatarArtifact(draft);
}
```

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:333

```ts
export async function persistAuthoritativeArtifactAnalysis(input: {
  artifactId: string;
  result: AvatarStructureAnalysisResultV2;
}): Promise<void> {
  if (!input.result.authoritative) {
    throw new Error('Nur autoritative Analyse-Ergebnisse dürfen persistiert werden.');
  }
  const ownerUserId = await getAuthenticatedUserId();
  const analysisStatus =
    input.result.status === 'ready'
      ? 'ready'
      : input.result.status === 'limited'
        ? 'limited'
        : input.result.status === 'unsupported'
          ? 'unsupported'
          : 'failed';

  // Client RLS blocks trusted status writes — this path is intended for
  // Edge/service_role callers. Authenticated clients will fail closed here.
  const { error } = await supabase
    .from('character_avatar_artifacts')
    .update({
      analysis_status: analysisStatus,
      analysis_result: input.result,
    })
    .eq('id', input.artifactId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Analyse-Persistenz fehlgeschlagen: ${error.message}`);
  }
}
```

### src/infrastructure/character/avatar/character-avatar-export-service.ts:34

```ts
export interface AvatarSaveExportProgress {
  status: AvatarSaveExportUiStatus;
  message: string;
  artifact?: AvatarSaveExportArtifact;
}
```

### src/infrastructure/character/avatar/character-avatar-export-service.ts:56

```ts
export async function materializeAvatarSaveExport(
  input: {
    avatar: CharacterAvatarDto;
    characterId?: string | null;
    runtimeOverlays?: readonly RuntimeTraitOverlay[];
    sourceModelUrl?: string;
    onProgress?: (progress: AvatarSaveExportProgress) => void;
  },
): Promise<AvatarSaveExportArtifact> {
  const report = (
    status: AvatarSaveExportUiStatus,
    message: string,
    artifact?: AvatarSaveExportArtifact,
  ) => {
    input.onProgress?.({ status, message, artifact });
  };

  report('preparing', 'Avatar-Export wird vorbereitet …');

  const sourceUrl = input.sourceModelUrl ?? input.avatar.model_url ?? resolveBaseBodyModelUrl();
  const sourceBytes = await tryFetchSourceMeshBytes(sourceUrl);
  const embedsSourceMesh = Boolean(sourceBytes && sourceBytes.byteLength > 12);

  const payload = buildAvatarSaveExportPayload({
    avatar: input.avatar,
    runtimeOverlays: input.runtimeOverlays,
    embedsSourceMesh,
    catalogBasePath: embedsSourceMesh ? undefined : 'sagatree-base-humanoid-v1.vrm',
  });

  const bytes = encodeAvatarExportGlb({
    payload,
    sourceMeshBytes: sourceBytes,
  });

  report('uploading', 'Avatar-Artefakt wird gespeichert …');
  const ownerUserId = await getAuthenticatedUserId();
  const artifactId = crypto.randomUUID();
  const storagePath = buildAvatarExportStoragePath({ ownerUserId, artifactId });

  const blob = new Blob([new Uint8Array(bytes)], { type: 'model/gltf-binary' });
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: 'model/gltf-binary',
    upsert: false,
  });
  if (uploadError) {
    report('error', 'Avatar-Export fehlgeschlagen. Bitte erneut speichern.');
    throw new Error(`Avatar-Export-Upload fehlgeschlagen: ${uploadError.message}`);
  }

  report('activating', 'Export wird aktiviert …');

  // Deactivate previous active export for this character (exactly-one active).
  if (input.characterId) {
    await supabase
      .from('character_avatar_export_assets')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', input.characterId)
      .eq('is_active', true);
  }

  const { error: insertError } = await supabase.from('character_avatar_export_assets').insert({
    id: artifactId,
    owner_user_id: ownerUserId,
    character_id: input.characterId ?? null,
    format: 'glb',
    mime: 'model/gltf-binary',
    byte_size: bytes.byteLength,
    storage_path: storagePath,
    export_contract_version: AVATAR_SAVE_EXPORT_VERSION,
    morph_contract_version: MORPH_CONTRACT_VERSION,
    embeds_source_mesh: embedsSourceMesh,
    is_active: true,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    report('error', 'Avatar-Export konnte nicht bestätigt werden.');
    throw new Error(`Avatar-Export-Artefakt konnte nicht gespeichert werden: ${insertError.message}`);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    // Roll back active flag so previous artifact remains the only active one.
    await supabase
      .from('character_avatar_export_assets')
      .update({ is_active: false })
      .eq('id', artifactId)
      .eq('owner_user_id', ownerUserId);
    report('error', 'Export-URL konnte nicht erzeugt werden.');
    throw new Error(signedError?.message ?? 'Signed URL fehlt');
  }

  const artifact: AvatarSaveExportArtifact = {
    artifactId,
    storagePath,
    modelUrl: signed.signedUrl,
    byteSize: bytes.byteLength,
    format: 'glb',
    payload,
  };

  report('success', 'Avatar-Export materialisiert.', artifact);
  return artifact;
}
```

### src/infrastructure/character/avatar/character-avatar-import-service.ts:46

```ts
export interface AvatarImportProgress {
  status: AvatarImportUiStatus;
  message: string;
  artifact?: AvatarImportArtifact;
  summary?: ImportAnalysisSummaryV1;
}
```

### src/infrastructure/character/avatar/character-avatar-import-service.ts:53

```ts
export interface AvatarImportDraftV2 {
  importAssetId: string;
  artifactId: string;
  format: AvatarImportArtifact['format'];
  byteSize: number;
  storagePath: string;
  modelUrl: string;
  /** Non-authoritative preview analysis for UX — never escalate capabilities. */
  summary: ImportAnalysisSummaryV1;
  keepSeed: ImportOriginalKeepSeedV1;
}
```

### src/infrastructure/character/avatar/character-avatar-import-service.ts:69

```ts
export async function uploadAndAnalyzeCharacterAvatarModel(
  file: File,
  options: {
    characterId?: string | null;
    onProgress?: (progress: AvatarImportProgress) => void;
  } = {},
): Promise<AvatarImportDraftV2> {
  const report = (
    status: AvatarImportUiStatus,
    message: string,
    extra?: { artifact?: AvatarImportArtifact; summary?: ImportAnalysisSummaryV1 },
  ) => {
    options.onProgress?.({ status, message, artifact: extra?.artifact, summary: extra?.summary });
  };

  report('validating', 'Datei wird geprüft …');
  const early = earlyCheckAvatarImportFile({ fileName: file.name, byteSize: file.size });
  if (!early.ok) {
    report('failed', early.message ?? 'Datei ungültig.');
    throw new Error(early.message ?? 'Datei ungültig.');
  }

  const bytes = await readFileBytes(file);
  let format: AvatarImportArtifact['format'];
  let mime: string;
  try {
    const validated = validateAvatarImportBytes({
      bytes,
      fileName: file.name,
      claimedMime: file.type,
    });
    format = validated.format;
    mime = validated.mime;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validierung fehlgeschlagen.';
    report('failed', message);
    throw new Error(message);
  }

  report('uploading', 'Modell wird hochgeladen …');
  const ownerUserId = await getAuthenticatedUserId();
  const importAssetId = crypto.randomUUID();
  const storagePath = buildAvatarImportStoragePath({
    ownerUserId,
    artifactId: importAssetId,
    format,
  });

  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) {
    report('failed', 'Upload fehlgeschlagen. Bitte erneut versuchen.');
    throw new Error(`Avatar-Upload fehlgeschlagen: ${uploadError.message}`);
  }

  // Draft row — inactive so a failed analysis never replaces the active avatar.
  const { error: insertError } = await supabase.from('character_avatar_import_assets').insert({
    id: importAssetId,
    owner_user_id: ownerUserId,
    character_id: options.characterId ?? null,
    format,
    mime,
    byte_size: bytes.byteLength,
    storage_path: storagePath,
    rig_analysis_status: 'pending',
    is_active: false,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    report('failed', 'Import konnte nicht bestätigt werden.');
    throw new Error(`Avatar-Artefakt konnte nicht gespeichert werden: ${insertError.message}`);
  }

  let v2ArtifactId: string = importAssetId;
  try {
    const artifact = await materializeArtifactFromImportAsset({
      importAssetId,
      characterId: options.characterId,
      storagePath,
      format,
    });
    v2ArtifactId = artifact.artifactId;
  } catch (error) {
    // Artifact table may be unavailable in older envs — keep import draft usable.
    console.warn(
      '[avatar-import] V2 artifact materialize skipped:',
      error instanceof Error ? error.message : error,
    );
  }

  report('analyzing', 'Modell wird analysiert …');

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    report('failed', 'Vorschau-URL konnte nicht erzeugt werden.');
    throw new Error(signedError?.message ?? 'Signed URL fehlt');
  }

  let summary: ImportAnalysisSummaryV1;
  try {
    const analysis = await previewAnalyzeAvatarGlbBytes(bytes);
    const { compatibility } = resolveFamilyCompatibilityFromAnalysis(analysis);
    summary = buildImportAnalysisSummary({ analysis, compatibility });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Analyse fehlgeschlagen. Bitte erneut versuchen.';
    report('failed', message);
    throw new Error(message);
  }

  const keepSeed = buildImportOriginalKeepSeed({
    modelUrl: signed.signedUrl,
    artifactId: v2ArtifactId,
    importAssetId,
    analysis: {
      anatomy: summary.anatomy,
      modularity: summary.modularity,
    },
    compatibility: {
      recommendedFamily: summary.recommendedFamily,
      status:
        summary.flowStatus === 'ready-humanoid' ? 'family-compatible' : 'custom',
    },
  });

  const legacyArtifact: AvatarImportArtifact = {
    artifactId: importAssetId,
    format,
    byteSize: bytes.byteLength,
    storagePath,
    modelUrl: signed.signedUrl,
    rigAnalysisStatus: 'pending',
  };

  const uiStatus: AvatarImportUiStatus =
    summary.flowStatus === 'ready-humanoid' ||
    summary.flowStatus === 'ready-custom' ||
    summary.flowStatus === 'limited' ||
    summary.flowStatus === 'failed'
      ? summary.flowStatus
      : 'analyzing';

  report(uiStatus, summary.headlineDe, { artifact: legacyArtifact, summary });

  return {
    importAssetId,
    artifactId: v2ArtifactId,
    format,
    byteSize: bytes.byteLength,
    storagePath,
    modelUrl: signed.signedUrl,
    summary,
    keepSeed,
  };
}
```

### src/infrastructure/character/avatar/character-avatar-import-service.ts:234

```ts
export async function keepOriginalImportedAvatar(input: {
  draft: AvatarImportDraftV2;
  characterId?: string | null;
}): Promise<ImportOriginalKeepSeedV1> {
  if (!input.draft.summary.canKeepOriginal || input.draft.summary.flowStatus === 'failed') {
    throw new Error('Original behalten ist für dieses Analyseergebnis nicht verfügbar.');
  }

  const ownerUserId = await getAuthenticatedUserId();

  if (input.characterId) {
    await supabase
      .from('character_avatar_import_assets')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', input.characterId)
      .eq('is_active', true);
  }

  const { error: activateImportError } = await supabase
    .from('character_avatar_import_assets')
    .update({ is_active: true })
    .eq('id', input.draft.importAssetId)
    .eq('owner_user_id', ownerUserId);

  if (activateImportError) {
    throw new Error(
      `Import konnte nicht aktiviert werden: ${activateImportError.message}`,
    );
  }

  try {
    const activated = await activateAvatarArtifact(input.draft.artifactId);
    if (activated.ok === false) {
      console.warn('[avatar-import] V2 artifact activate:', activated.reasonDe);
    }
  } catch (error) {
    console.warn(
      '[avatar-import] V2 artifact activate skipped:',
      error instanceof Error ? error.message : error,
    );
  }

  return input.draft.keepSeed;
}
```

### src/infrastructure/character/avatar/character-avatar-import-service.ts:284

```ts
export async function importCharacterAvatarModel(
  file: File,
  options: {
    characterId?: string | null;
    onProgress?: (progress: AvatarImportProgress) => void;
  } = {},
): Promise<AvatarImportArtifact> {
  const draft = await uploadAndAnalyzeCharacterAvatarModel(file, options);
  if (draft.summary.flowStatus === 'failed') {
    throw new Error(draft.summary.detailDe);
  }
  const seed = await keepOriginalImportedAvatar({
    draft,
    characterId: options.characterId,
  });
  options.onProgress?.({
    status: 'success',
    message: '3D-Charakter importiert. Rig-Analyse folgt automatisch.',
    artifact: {
      artifactId: draft.importAssetId,
      format: draft.format,
      byteSize: draft.byteSize,
      storagePath: draft.storagePath,
      modelUrl: seed.modelUrl,
      rigAnalysisStatus: 'pending',
    },
    summary: draft.summary,
  });
  return {
    artifactId: draft.importAssetId,
    format: draft.format,
    byteSize: draft.byteSize,
    storagePath: draft.storagePath,
    modelUrl: seed.modelUrl,
    rigAnalysisStatus: 'pending',
  };
}
```

### src/infrastructure/character/avatar/character-avatar-import-service.ts:322

```ts
export function avatarImportLimits() {
  return {
    maxBytes: AVATAR_IMPORT_MAX_BYTES,
    accept: '.vrm,.glb,model/gltf-binary,application/octet-stream',
  };
}
```

### src/infrastructure/character/avatar/character-avatar-meshy-service.ts:27

```ts
export interface MeshyAvatarConfig {
  meshyConfigured: boolean;
  /** False when the Edge Function invoke itself failed (network/500) — not the same as missing BYOK. */
  edgeReachable: boolean;
  promptMinChars: number;
  promptMaxChars: number;
  imageMaxBytes: number;
  supportsImageTo3d: boolean;
  costHintDe: string;
  wiredProviderIds: string[];
  defaultProviderId: string;
  defaultPresetId: string;
}
```

### src/infrastructure/character/avatar/character-avatar-meshy-service.ts:97

```ts
export async function fetchMeshyAvatarConfig(): Promise<MeshyAvatarConfig> {
  const response = await invoke({ action: 'config' });
  if (response.status !== 'ok') {
    return {
      meshyConfigured: false,
      edgeReachable: false,
      promptMinChars: MESHY_AVATAR_PROMPT_MIN_CHARS,
      promptMaxChars: MESHY_AVATAR_PROMPT_MAX_CHARS,
      imageMaxBytes: MESHY_AVATAR_IMAGE_MAX_BYTES,
      supportsImageTo3d: true,
      costHintDe: 'KI-Server derzeit nicht erreichbar. Bitte Seite neu laden oder später erneut versuchen.',
      wiredProviderIds: ['meshy'],
      defaultProviderId: 'meshy',
      defaultPresetId: 'recommended',
    };
  }
  return {
    meshyConfigured: Boolean(response.meshyConfigured),
    edgeReachable: true,
    promptMinChars:
      typeof response.promptMinChars === 'number'
        ? response.promptMinChars
        : MESHY_AVATAR_PROMPT_MIN_CHARS,
    promptMaxChars:
      typeof response.promptMaxChars === 'number'
        ? response.promptMaxChars
        : MESHY_AVATAR_PROMPT_MAX_CHARS,
    imageMaxBytes:
      typeof response.imageMaxBytes === 'number'
        ? response.imageMaxBytes
        : MESHY_AVATAR_IMAGE_MAX_BYTES,
    supportsImageTo3d: response.supportsImageTo3d !== false,
    costHintDe:
      typeof response.costHintDe === 'string'
        ? response.costHintDe
        : 'Externe KI. Es entstehen Provider-Kosten.',
    wiredProviderIds: Array.isArray(response.wiredProviderIds)
      ? response.wiredProviderIds.filter((id): id is string => typeof id === 'string')
      : ['meshy'],
    defaultProviderId:
      typeof response.defaultProviderId === 'string' ? response.defaultProviderId : 'meshy',
    defaultPresetId:
      typeof response.defaultPresetId === 'string' ? response.defaultPresetId : 'recommended',
  };
}
```

### src/infrastructure/character/avatar/character-avatar-meshy-service.ts:143

```ts
export async function startMeshyAvatarJob(input: {
  mode: MeshyAvatarGenerationMode;
  prompt?: string;
  texturePrompt?: string;
  imageDataUri?: string;
  clientNonce: string;
  characterId?: string | null;
  providerId?: Avatar3dGenerationProviderId;
  presetId?: GenerationPresetId | 'custom';
  presetVersion?: number;
  presetDirty?: boolean;
  settings?: Avatar3dGenerationSettings;
}): Promise<MeshyAvatarJobSnapshot> {
  const mode = input.mode === 'image' ? 'image' : 'text';
  const texturePrompt = input.texturePrompt ?? '';
  const promptResolved = resolveMeshyAvatarJobPrompt({
    mode,
    prompt: input.prompt ?? '',
    texturePrompt,
  });
  if (promptResolved.ok === false) {
    throw new Error(promptResolved.message);
  }

  let imageDataUri: string | undefined;
  if (mode === 'image') {
    const imageCheck = validateMeshyAvatarImageDataUri(input.imageDataUri ?? '');
    if (!imageCheck.ok) {
      throw new Error(imageCheck.message ?? 'Bild ungültig.');
    }
    imageDataUri = imageCheck.normalized;
  }

  const response = await invoke({
    action: 'start',
    generationMode: mode,
    prompt: mode === 'text' ? promptResolved.prompt : undefined,
    texturePrompt: mode === 'image' ? texturePrompt : undefined,
    imageDataUri,
    clientNonce: input.clientNonce,
    characterId: input.characterId ?? null,
    providerId: input.providerId ?? 'meshy',
    presetId: input.presetId ?? 'recommended',
    presetVersion: input.presetVersion ?? 1,
    presetDirty: input.presetDirty === true,
    settings: input.settings,
  });
  if (response.status === 'not-configured') {
    return {
      jobId: '',
      status: 'provider-unavailable',
      progress: 0,
      prompt: promptResolved.prompt,
      idempotencyKey: '',
      errorMessage: response.message,
      rigAnalysisStatus: 'pending',
    };
  }
  if (response.status !== 'ok' || !isRecord(response.job)) {
    throw new Error(response.status === 'error' ? response.message : 'Start fehlgeschlagen.');
  }
  return mapJob(response.job as Record<string, unknown>);
}
```

### src/infrastructure/character/avatar/character-avatar-meshy-service.ts:207

```ts
export async function pollMeshyAvatarJob(jobId: string): Promise<MeshyAvatarJobSnapshot> {
  const response = await invoke({ action: 'poll', jobId });
  if (response.status !== 'ok' || !isRecord(response.job)) {
    throw new Error(response.status === 'error' ? response.message : 'Poll fehlgeschlagen.');
  }
  const modelUrl = browserModelUrl(response.modelUrl);
  return mapJob(response.job as Record<string, unknown>, modelUrl);
}
```

### src/infrastructure/character/avatar/character-avatar-meshy-service.ts:216

```ts
export async function retryMeshyAvatarJob(jobId: string): Promise<MeshyAvatarJobSnapshot> {
  const response = await invoke({ action: 'retry', jobId });
  if (response.status === 'not-configured') {
    return {
      jobId,
      status: 'provider-unavailable',
      progress: 0,
      prompt: '',
      idempotencyKey: '',
      errorMessage: response.message,
      rigAnalysisStatus: 'pending',
    };
  }
  if (response.status !== 'ok' || !isRecord(response.job)) {
    throw new Error(response.status === 'error' ? response.message : 'Retry fehlgeschlagen.');
  }
  const modelUrl = browserModelUrl(response.modelUrl);
  return mapJob(response.job as Record<string, unknown>, modelUrl);
}
```

### src/infrastructure/character/avatar/character-studio-manifest.ts:8

```ts
export interface CharacterStudioTraitAsset {
  id: string;
  name: string;
  modelUrl: string;
}
```

### src/infrastructure/character/avatar/character-studio-manifest.ts:14

```ts
export interface CharacterStudioTraitGroup {
  id: string;
  name: string;
  required: boolean;
  initial: boolean;
  assets: CharacterStudioTraitAsset[];
}
```

### src/infrastructure/character/avatar/character-studio-manifest.ts:22

```ts
export interface CharacterStudioManifest {
  format: CharacterAvatarFormat;
  groups: CharacterStudioTraitGroup[];
}
```

### src/infrastructure/character/avatar/character-studio-manifest.ts:59

```ts
export function normalizeCharacterStudioManifest(input: unknown, sourceUrl: string): CharacterStudioManifest {
  if (!isRecord(input)) throw new Error('CharacterStudio manifest must be a JSON object');

  const formatValue = readString(input, 'format')?.toLowerCase();
  const format: CharacterAvatarFormat = formatValue === 'glb' ? 'glb' : 'vrm';
  const assetsLocation = readString(input, 'assetsLocation');
  const traitsDirectory = readString(input, 'traitsDirectory') ?? '';
  const requiredTraits = new Set(readStringArray(input, 'requiredTraits'));
  const initialTraits = new Set(readStringArray(input, 'initialTraits'));
  const rawTraits = input.traits;
  if (!Array.isArray(rawTraits)) return { format, groups: [] };

  const groups: CharacterStudioTraitGroup[] = [];

  for (const rawTrait of rawTraits) {
    if (!isRecord(rawTrait)) continue;
    const id = readString(rawTrait, 'trait');
    if (!id) continue;
    const name = readString(rawTrait, 'name') ?? id;
    const rawCollection = rawTrait.collection;
    const assets: CharacterStudioTraitAsset[] = [];

    if (Array.isArray(rawCollection)) {
      for (const rawAsset of rawCollection) {
        if (!isRecord(rawAsset)) continue;
        const assetId = readString(rawAsset, 'id');
        const directory = readString(rawAsset, 'directory');
        if (!assetId || !directory) continue;
        const modelUrl = resolveModelUrl(sourceUrl, assetsLocation, traitsDirectory, directory);
        if (!modelUrl) continue;
        assets.push({
          id: assetId,
          name: readString(rawAsset, 'name') ?? assetId,
          modelUrl,
        });
      }
    }

    groups.push({
      id,
      name,
      required: requiredTraits.has(id),
      initial: initialTraits.has(id),
      assets,
    });
  }

  return { format, groups };
}
```

### src/infrastructure/character/avatar/character-studio-manifest.ts:109

```ts
export async function loadCharacterStudioManifest(url: string, signal?: AbortSignal): Promise<CharacterStudioManifest> {
  const safeUrl = normalizeSafeUrl(url);
  if (!safeUrl) throw new Error('CharacterStudio manifest URL is not allowed');

  const response = await fetch(safeUrl, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`CharacterStudio manifest could not be loaded (${response.status})`);

  const payload: unknown = await response.json();
  return normalizeCharacterStudioManifest(payload, safeUrl);
}
```

### src/infrastructure/character/avatar/character-studio-runtime.ts:102

```ts
export type AvatarRuntimeState =
  | { status: 'loading'; message: string }
  | { status: 'ready'; message: string }
  | { status: 'error'; message: string };
```

### src/infrastructure/character/avatar/character-studio-runtime.ts:108

```ts
export type AvatarCameraFrameId = 'full' | 'portrait' | 'face' | 'feet';
```

### src/infrastructure/character/avatar/character-studio-runtime.ts:165

```ts
export class CharacterStudioRuntime {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly loader = new GLTFLoader();
  private readonly modelContainer = new THREE.Group();
  private readonly overlaysGroup = new THREE.Group();
  private readonly clock = new THREE.Clock();
  private readonly traitLifecycle: TraitLifecycleThreeAdapter;
  private currentRoot?: THREE.Object3D;
  private currentVrm?: VRM;
  private currentAvatar?: CharacterAvatarDto;
  private currentManifest?: AvatarAssetManifest;
  /** Runtime-only overlays (equipment etc.) — never written to appearance.avatar.traits. */
  private runtimeOverlays: RuntimeTraitOverlay[] = [];
  private lastRigAnalysis?: AvatarRigAnalysisResult;
  private loadVersion = 0;
  private disposed = false;
  private readonly styleProfile: SagaTreeMToonProfileV1 = createSagaTreeMToonProfileV1();
  private readonly styleLights: MtoonStyleLights;
  private styleCompatibility: MtoonStyleCompatibility = {
    path: 'pbr-fallback',
    noticeDe: null,
  };
  /** Editor preview: SagaTree MToon profile on/off. Default off until loadModel sets VRM vs GLB. Not persisted. */
  private mtoonStyleEnabled = false;
  private materialStyleSnapshots: MaterialStyleSnapshot[] = [];
  /** Provider-neutral LookRuntime (#342) — ToonLab never imported here. */
  private readonly lookRuntime: LookRuntime = createLookRuntime();
  private lastLookApply: LookRuntimeApplyResult | null = null;
  private readonly animationRuntime: AvatarAnimationRuntime;
  private readonly facialRuntime: AvatarFacialRuntime;
  private readonly rigidEquipmentRuntime: AvatarRigidEquipmentRuntime;
  private readonly skinnedWearableRuntime: AvatarSkinnedWearableRuntime;
  private headBone: THREE.Object3D | null = null;
  private leftFootBone: THREE.Object3D | null = null;
  private rightFootBone: THREE.Object3D | null = null;
  private inspectMode = false;
  private readonly headRestQuaternion = new THREE.Quaternion();
  private readonly headScratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly headScratchQuaternion = new THREE.Quaternion();
  private readonly eyeLookTarget = new THREE.Vector3();
  private liveActAvatarOutput: LiveActAvatarOutput | null = null;
  private readonly liveActRigDebug: LiveActRigDebugController;
  private readonly liveActCharacterFaceDebug: LiveActCharacterFaceDebugController;
  private faceAnchorManifestLoadToken = 0;
  /** Model URL whose anchors are bound; null until the current model is ready. */
  private faceAnchorsModelUrl: string | null = null;
  /** Last bound `avatar.face_anchors` reference — hydration can change it without a model reload. */
  private faceAnchorsOverrideSource: SagaTreeFaceAnchorsManifestV1 | null = null;
  /** When true, LiveAct drive application is suppressed for Face Setup (#420). */
  private faceMappingAuthoringActive = false;
  /** Nested base-face capture scopes (equipment hidden / masked bases revealed). */
  private faceMappingBaseFaceCaptureDepth = 0;
  private faceMappingBaseFaceCaptureRestore: (() => void) | null = null;
  /** Independent suspend reasons — either keeps procedural clips paused. */
  private liveActDriveSuspendReason = false;
  private faceMappingSuspendReason = false;
  private readonly faceMappingProjectScratch = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onStateChange: RuntimeStateListener,
    private readonly onRigAnalysis?: RigAnalysisListener,
    private readonly onAnimationState?: AnimationStateListener,
    private readonly onFacialState?: FacialStateListener,
  ) {
    this.animationRuntime = new AvatarAnimationRuntime(this.onAnimationState);
    this.facialRuntime = new AvatarFacialRuntime(this.onFacialState);
    this.rigidEquipmentRuntime = new AvatarRigidEquipmentRuntime();
    this.skinnedWearableRuntime = new AvatarSkinnedWearableRuntime();
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.animationRuntime.setPrefersReducedMotion(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    applyMtoonProfileToRenderer(this.renderer, this.styleProfile);

    this.modelContainer.add(this.overlaysGroup);
    this.scene.add(this.modelContainer);
    this.liveActRigDebug = createLiveActRigDebugController(this.scene);
    this.liveActCharacterFaceDebug = createLiveActCharacterFaceDebugController({
      camera: this.camera,
      getCanvasSize: () => {
        const canvas = this.renderer.domElement;
        return {
          width: Math.max(1, Math.round(canvas.clientWidth)),
          height: Math.max(1, Math.round(canvas.clientHeight)),
        };
      },
    });
    this.traitLifecycle = createTraitLifecycleThreeAdapter(this.overlaysGroup);

    this.styleLights = createMtoonStyleLights(this.styleProfile);
    this.scene.add(this.styleLights.hemisphere);
    this.scene.add(this.styleLights.key);
    this.scene.add(this.styleLights.fill);
    this.scene.add(this.styleLights.rim);
    applyMtoonProfileToScene(this.scene, this.styleLights, this.styleProfile);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: '#111C2E',
      roughness: 0.82,
      metalness: 0.12,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.8, 64), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#3B82F6',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.52, 1.57, 96), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    this.scene.add(ring);

    this.camera.position.set(0, 1.2, 4.2);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.applyOrbitLimits('default');
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    this.loader.crossOrigin = 'anonymous';
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    this.renderer.setAnimationLoop(() => {
      if (this.disposed) return;
      const delta = this.clock.getDelta();
      this.currentVrm?.update(delta);
      this.animationRuntime.update(delta);
      this.controls.update();
      this.resize();
      this.renderer.render(this.scene, this.camera);
    });
  }

  async loadModel(url: string, avatar: CharacterAvatarDto, manifest: AvatarAssetManifest): Promise<void> {
    if (this.disposed) return;

    const version = ++this.loadVersion;
    this.currentAvatar = avatar;
    this.currentManifest = manifest;
    // Anchors of the incoming model must not be bound onto the outgoing mesh mid-load.
    this.faceAnchorsModelUrl = null;

    const safeUrl = normalizeAvatarModelUrl(url);
    if (!safeUrl) {
      this.removeCurrentModel();
      this.onStateChange({
        status: 'error',
        message: 'Die 3D-Modell-URL ist nicht zulässig. Erlaubt sind lokale oder HTTPS-VRM/GLB-Dateien.',
      });
      return;
    }

    this.onStateChange({ status: 'loading', message: `Lade ${manifest.displayName} …` });

    try {
      const gltf = await this.loader.loadAsync(safeUrl);
      const vrm = getVrm(gltf.userData as unknown);
      if (vrm) {
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);
        VRMUtils.rotateVRM0(vrm);
      }

      const root = vrm?.scene ?? gltf.scene;
      prepareModel(root);
      centerModel(root);

      if (this.disposed || version !== this.loadVersion) {
        VRMUtils.deepDispose(root);
        return;
      }

      this.removeCurrentModel();
      this.currentRoot = root;
      this.currentVrm = vrm;
      this.modelContainer.add(root);
      // VRM ships MToon materials — enable profile by default.
      // Meshy/species GLBs are PBR: start with style off so authored maps/factors stay intact.
      this.mtoonStyleEnabled = Boolean(vrm);
      this.materialStyleSnapshots = captureMaterialStyleSnapshots(root);
      this.applyAppearance(this.currentAvatar ?? avatar, this.currentManifest ?? manifest);
      this.setInspectMode(false);
      this.fitCamera();
      this.lastRigAnalysis = analyzeAvatarRigFromObject3D(root, { vrm });
      this.onRigAnalysis?.(this.lastRigAnalysis);
      this.animationRuntime.bind(root, this.lastRigAnalysis);
      this.facialRuntime.bind(vrm);
      this.bindHumanoidBones(vrm, this.lastRigAnalysis);
      this.rebuildLiveActAvatarOutput();
      this.liveActRigDebug.bindModelRoot(root);
      this.liveActCharacterFaceDebug.bindModelRoot(root);
      this.faceAnchorsModelUrl = safeUrl;
      this.syncCharacterFaceAnchors(this.currentAvatar ?? avatar, true);
      this.rigidEquipmentRuntime.bindAvatar(root, this.lastRigAnalysis);
      this.skinnedWearableRuntime.bindAvatar(root, this.lastRigAnalysis);
      this.onStateChange({
        status: 'ready',
        message: vrm ? `${manifest.displayName} · VRM` : `${manifest.displayName} · glTF`,
      });
    } catch (error) {
      if (this.disposed || version !== this.loadVersion) return;
      const detail = error instanceof Error ? error.message : 'Unbekannter Ladefehler';
      this.onStateChange({ status: 'error', message: `3D-Modell konnte nicht geladen werden: ${detail}` });
    }
  }

  /**
   * Replace runtime overlays (e.g. helmet that hides hair). Does not touch persisted base traits.
   */
  setRuntimeOverlays(overlays: readonly RuntimeTraitOverlay[]): void {
    this.runtimeOverlays = [...overlays];
    if (this.currentAvatar && this.currentManifest) {
      this.applyAppearance(this.currentAvatar, this.currentManifest);
    }
  }

  setRigidEquipmentUrlResolver(resolveUrl: ResolveRigidEquipmentUrl): void {
    this.rigidEquipmentRuntime.setUrlResolver(resolveUrl);
  }

  /** Apply #158 visual projection — rigid only; fail-soft; no inventory mutation. */
  async applyRigidEquipmentVisuals(visuals: readonly AvatarEquipmentVisual[]): Promise<void> {
    await this.rigidEquipmentRuntime.applyVisuals(visuals);
  }

  setSkinnedWearableUrlResolver(resolveUrl: ResolveSkinnedWearableUrl): void {
    this.skinnedWearableRuntime.setUrlResolver(resolveUrl);
  }

  async applySkinnedWearableVisuals(visuals: readonly AvatarEquipmentVisual[]): Promise<void> {
    await this.skinnedWearableRuntime.applyVisuals(visuals);
  }

  getRigidEquipmentRuntime(): AvatarRigidEquipmentRuntime {
    return this.rigidEquipmentRuntime;
  }

  getSkinnedWearableRuntime(): AvatarSkinnedWearableRuntime {
    return this.skinnedWearableRuntime;
  }

  getLastRigAnalysis(): AvatarRigAnalysisResult | undefined {
    return this.lastRigAnalysis;
  }

  getTraitLifecycle(): TraitLifecycleThreeAdapter {
    return this.traitLifecycle;
  }

  getStyleCompatibility(): MtoonStyleCompatibility {
    return this.styleCompatibility;
  }

  getStyleProfile(): SagaTreeMToonProfileV1 {
    return this.styleProfile;
  }

  /** Editor-only preview toggle — not written to appearance.avatar. */
  isMtoonStyleEnabled(): boolean {
    return this.mtoonStyleEnabled;
  }

  setMtoonStyleEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.mtoonStyleEnabled = enabled;
    if (this.currentAvatar && this.currentManifest) {
      this.applyAppearance(this.currentAvatar, this.currentManifest);
    }
  }

  getLookRuntime(): LookRuntime {
    return this.lookRuntime;
  }

  getLastLookApplyResult(): LookRuntimeApplyResult | null {
    return this.lastLookApply;
  }

  /**
   * Apply a LookProfileVersion via provider-neutral LookRuntime (#342).
   * Restores material baseline before apply; AvatarCanvas stays ToonLab-free.
   */
  applyLookProfile(
    version: LookProfileVersion,
    executionMode: LookExecutionMode = 'realtime',
  ): LookRuntimeApplyResult {
    if (this.disposed || !this.currentRoot || !this.currentAvatar) {
      const empty: LookRuntimeApplyResult = {
        status: 'unsupported',
        providerId: 'none',
        profileId: version.profileId,
        version: version.version,
        executionMode,
        capabilities: [],
        noticeDe: 'Kein Avatar geladen.',
      };
      this.lastLookApply = empty;
      return empty;
    }
    const clothingColor = clothingTint(this.currentAvatar.traits.clothing);
    const result = this.lookRuntime.applyLookProfile(
      version,
      {
        root: this.currentRoot,
        scene: this.scene,
        styleLights: this.styleLights,
        materialSnapshots: this.materialStyleSnapshots,
        isImportModel: Boolean(this.currentAvatar.model_url),
        colors: {
          skin: this.currentAvatar.colors.skin,
          hair: this.currentAvatar.colors.hair,
          clothing: clothingColor,
          eyes: this.currentAvatar.colors.eyes,
        },
      },
      executionMode,
    );
    this.lastLookApply = result;
    this.mtoonStyleEnabled = result.status === 'applied' || result.status === 'partial';
    this.renderNow();
    return result;
  }

  /** Restore load-time PBR Neutral baseline (#342). */
  restorePbrNeutralLook(): LookRuntimeApplyResult {
    if (this.disposed || !this.currentRoot) {
      const empty: LookRuntimeApplyResult = {
        status: 'unsupported',
        providerId: 'none',
        profileId: null,
        version: null,
        executionMode: null,
        capabilities: [],
        noticeDe: 'Kein Avatar geladen.',
      };
      this.lastLookApply = empty;
      return empty;
    }
    const result = this.lookRuntime.restorePbrNeutral({
      root: this.currentRoot,
      scene: this.scene,
      styleLights: this.styleLights,
      materialSnapshots: this.materialStyleSnapshots,
      isImportModel: Boolean(this.currentAvatar?.model_url),
      colors: {},
    });
    this.lastLookApply = result;
    this.mtoonStyleEnabled = false;
    if (this.currentAvatar && this.currentManifest) {
      this.applyAppearance(this.currentAvatar, this.currentManifest);
    } else {
      this.renderNow();
    }
    return result;
  }

  playAnimation(actionId: AvatarAnimationActionId): boolean {
    return this.animationRuntime.play(actionId);
  }

  getAnimationRuntime(): AvatarAnimationRuntime {
    return this.animationRuntime;
  }

  setPrefersReducedMotion(value: boolean): void {
    this.animationRuntime.setPrefersReducedMotion(value);
  }

  setFacialWeight(key: FacialCanonicalKey, weight: number): boolean {
    return this.facialRuntime.setWeight(key, weight);
  }

  resetFacialToNeutral(): void {
    this.facialRuntime.resetToNeutral();
  }

  getFacialRuntime(): AvatarFacialRuntime {
    return this.facialRuntime;
  }

  /** LiveAct output adapter for the loaded model; null until ready. */
  getLiveActAvatarOutput(): LiveActAvatarOutput | null {
    if (this.faceMappingAuthoringActive) return null;
    return this.liveActAvatarOutput;
  }

  /** Procedural clips pause while LiveAct drives this runtime so they cannot overwrite the head pose. */
  setLiveActDriveActive(active: boolean): void {
    this.liveActDriveSuspendReason = active;
    this.syncAnimationSuspendReasons();
  }

  /**
   * Merge independent suspension reasons so LiveAct cleanup cannot resume clips
   * while Face Mapping authoring still needs a frozen pose.
   */
  private syncAnimationSuspendReasons(): void {
    this.animationRuntime.setSuspended(
      this.liveActDriveSuspendReason || this.faceMappingSuspendReason,
    );
  }

  /** Asset/bone/morph inventory only — compose with engine input in app (#381). */
  getLiveActAvatarCapabilities(): LiveActAvatarCapabilities | null {
    return this.liveActAvatarOutput?.getAvatarCapabilities() ?? null;
  }

  /** True when the loaded model exposes a skinned skeleton for debug overlay. */
  hasLiveActSkeleton(): boolean {
    return this.liveActRigDebug.hasSkeleton();
  }

  /** Ephemeral viewport debug — not persisted (#333). */
  setLiveActRigDebugEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.liveActRigDebug.setEnabled(enabled);
  }

  /** Deformed mesh face anchor overlay — not persisted (#400). */
  setLiveActCharacterFaceDebugEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.liveActCharacterFaceDebug.setEnabled(enabled);
  }

  /** True when face-anchors.json loaded and bound for the current model. */
  hasLiveActCharacterFaceMapping(): boolean {
    return this.liveActCharacterFaceDebug.isMappingAvailable();
  }

  /** Read-only handle for app-layer canvas overlay (no Three.js leaks). */
  getLiveActCharacterFaceDebugHandle(): LiveActCharacterFaceDebugHandle {
    return this.liveActCharacterFaceDebug.getHandle();
  }

  /** Bound SagaTreeFaceAnchorsV1 for the current model (may be null). */
  getFaceAnchorsManifest(): SagaTreeFaceAnchorsManifestV1 | null {
    return this.liveActCharacterFaceDebug.getManifest();
  }

  /**
   * Session-local rebind for Face Mapping „Übernehmen“ — does not write disk/network.
   */
  bindFaceAnchorsManifestSession(manifest: SagaTreeFaceAnchorsManifestV1 | null): void {
    if (this.disposed) return;
    this.liveActCharacterFaceDebug.bindManifest(manifest);
  }

  /** Face Setup authoring: neutralize pose, suppress LiveAct drive, frame face frontal. */
  setFaceMappingAuthoringActive(active: boolean): void {
    if (this.disposed) return;
    this.faceMappingAuthoringActive = active;
    // Independent of LiveAct drive — cleanup must not unsuspend while authoring.
    this.faceMappingSuspendReason = active;
    this.syncAnimationSuspendReasons();
    if (active) {
      this.resetLiveActPose();
      this.resetFaceTrackingPose();
      this.setLiveActCharacterFaceDebugEnabled(false);
      this.setLiveActRigDebugEnabled(false);
      this.applyCameraFrame('face');
      // Zoom/pan allowed for precise placement; rotate stays off so marker drag wins.
      this.applyFaceMappingOrbitMode(false);
    } else {
      this.controls.enableRotate = true;
      this.controls.enabled = true;
      this.applyOrbitLimits(this.inspectMode ? 'inspect' : 'default');
    }
  }

  isFaceMappingAuthoringActive(): boolean {
    return this.faceMappingAuthoringActive;
  }

  /**
   * During Face Mapping: disable rotate always; disable zoom/pan only while dragging a marker.
   * Outside Face Mapping: toggles OrbitControls.enabled (legacy #420).
   */
  setOrbitControlsEnabled(enabled: boolean): void {
    if (this.disposed) return;
    if (this.faceMappingAuthoringActive) {
      this.applyFaceMappingOrbitMode(!enabled);
      return;
    }
    this.controls.enabled = enabled;
  }

  /**
   * Scroll-wheel zoom while the marker overlay owns pointer events.
   * Positive deltaY = zoom out, negative = zoom in (browser wheel convention).
   */
  dollyFaceMappingCamera(deltaY: number): void {
    if (this.disposed || !this.faceMappingAuthoringActive) return;
    if (!Number.isFinite(deltaY) || deltaY === 0) return;

    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = offset.length();
    if (!(distance > 1e-6)) return;

    // ~10% per 100px wheel notch; clamp to face-mapping limits.
    const factor = Math.exp(deltaY * 0.0015);
    const minD = 0.06;
    const maxD = 2.5;
    const next = Math.min(maxD, Math.max(minD, distance * factor));
    offset.multiplyScalar(next / distance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  /**
   * Screen-space pan (CSS pixels). Drag up → look higher on the face (Stirn).
   * Moves camera + orbit target together so framing stays frontal.
   */
  panFaceMappingCamera(deltaXPx: number, deltaYPx: number): void {
    if (this.disposed || !this.faceMappingAuthoringActive) return;
    if (!Number.isFinite(deltaXPx) || !Number.isFinite(deltaYPx)) return;
    if (deltaXPx === 0 && deltaYPx === 0) return;

    const canvas = this.renderer.domElement;
    const height = Math.max(1, canvas.clientHeight);
    const distance = this.camera.position.distanceTo(this.controls.target);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const worldPerPixel = (2 * Math.tan(fov / 2) * distance) / height;

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    right.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    up.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();

    // Drag right → content moves right (camera left); drag up (negative deltaY) → look higher.
    const move = right
      .multiplyScalar(-deltaXPx * worldPerPixel)
      .addScaledVector(up, -deltaYPx * worldPerPixel);

    this.camera.position.add(move);
    this.controls.target.add(move);
    this.controls.update();
  }

  /** Face-mapping camera: zoom + pan, no rotate. `draggingMarker` freezes camera. */
  private applyFaceMappingOrbitMode(draggingMarker: boolean): void {
    this.controls.enabled = true;
    this.controls.enableRotate = false;
    this.controls.enableZoom = !draggingMarker;
    this.controls.enablePan = !draggingMarker;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 2.5;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI - 0.05;
    this.controls.update();
  }

  /**
   * Shared Face Mapping world scale (Manual + Auto): interocular distance between
   * anatomical outer canthi in world space.
   *
   * Prefer evaluated draft bindings; else first allowlisted ray hits at canvas points
   * (Auto MediaPipe outer-eye samples). Returns null when scale cannot be measured.
   */
  resolveFaceMappingFaceWidthWorld(input?: {
    readonly leftOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
    readonly rightOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
    readonly leftOuterCanvas?: { readonly x: number; readonly y: number } | null;
    readonly rightOuterCanvas?: { readonly x: number; readonly y: number } | null;
  }): number | null {
    if (this.disposed || !this.currentRoot) return null;

    const leftBinding = input?.leftOuterBinding ?? null;
    const rightBinding = input?.rightOuterBinding ?? null;
    if (leftBinding && rightBinding) {
      const lp = this.evaluateFaceMappingBindingWorld(leftBinding, 'eyeLeftOuter');
      const rp = this.evaluateFaceMappingBindingWorld(rightBinding, 'eyeRightOuter');
      const fromBindings = computeFaceMappingFaceWidthWorld(lp, rp);
      if (fromBindings != null) return fromBindings;
    }

    const leftCanvas = input?.leftOuterCanvas ?? null;
    const rightCanvas = input?.rightOuterCanvas ?? null;
    if (leftCanvas && rightCanvas) {
      const lHits = this.listFaceMappingRaycastCandidatesAtCanvas(leftCanvas.x, leftCanvas.y);
      const rHits = this.listFaceMappingRaycastCandidatesAtCanvas(rightCanvas.x, rightCanvas.y);
      const lp = lHits[0]?.worldPoint ?? null;
      const rp = rHits[0]?.worldPoint ?? null;
      return computeFaceMappingFaceWidthWorld(lp, rp);
    }

    return null;
  }

  /**
   * Raycast canvas-local pointer to a triangle binding on allowlisted avatar meshes.
   * Manual Mapping: same screen ray → scale-aware strict surface select (no screen-snap,
   * no expanded pass). When `anchorId` is omitted, falls back to nearest hit (legacy).
   */
  raycastFaceMappingAtCanvas(
    canvasX: number,
    canvasY: number,
    options?: {
      readonly anchorId?: SagaTreeFaceAnchorId;
      readonly faceWidthWorld?: number | null;
      /** Draft outer-eye bindings used when faceWidthWorld is omitted. */
      readonly leftOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
      readonly rightOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
    },
  ): FaceMappingRaycastHitV1 | null {
    if (this.disposed || !this.currentRoot) return null;
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const anchorId = options?.anchorId;
    const faceWidthWorld =
      options?.faceWidthWorld !== undefined
        ? options.faceWidthWorld
        : this.resolveFaceMappingFaceWidthWorld({
            leftOuterBinding: options?.leftOuterBinding,
            rightOuterBinding: options?.rightOuterBinding,
          });
    return raycastFaceMappingPointer({
      camera: this.camera,
      root: this.currentRoot,
      canvasWidth: width,
      canvasHeight: height,
      canvasX,
      canvasY,
      selectCandidate: anchorId
        ? (candidates) => {
            const selection = selectFaceMappingSurfaceAwareCandidate(
              candidates.map((c) => ({
                order: c.order,
                distance: c.distance,
                nodeIdentity: c.nodeIdentity,
              })),
              anchorId,
              {
                faceWidthWorld,
                allowSameRayExpandedDepth: false,
              },
            );
            if (selection.selectedIndex == null) return null;
            return candidates[selection.selectedIndex] ?? null;
          }
        : undefined,
    });
  }

  /** Ordered allowlisted hits for Auto surface-aware selection (#421). */
  listFaceMappingRaycastCandidatesAtCanvas(
    canvasX: number,
    canvasY: number,
  ): FaceMappingRaycastCandidateV1[] {
    if (this.disposed || !this.currentRoot) return [];
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    return listFaceMappingRaycastCandidates({
      camera: this.camera,
      root: this.currentRoot,
      canvasWidth: width,
      canvasHeight: height,
      canvasX,
      canvasY,
    });
  }

  /** Project world point to canvas CSS pixels (null if behind camera). */
  projectWorldToFaceMappingCanvas(
    x: number,
    y: number,
    z: number,
  ): { x: number; y: number } | null {
    if (this.disposed) return null;
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    this.faceMappingProjectScratch.set(x, y, z).project(this.camera);
    if (
      !Number.isFinite(this.faceMappingProjectScratch.x) ||
      !Number.isFinite(this.faceMappingProjectScratch.y)
    ) {
      return null;
    }
    if (this.faceMappingProjectScratch.z > 1) return null;
    return {
      x: (this.faceMappingProjectScratch.x * 0.5 + 0.5) * width,
      y: (-this.faceMappingProjectScratch.y * 0.5 + 0.5) * height,
    };
  }

  /** Evaluate a draft binding to world coordinates (null if unavailable). */
  evaluateFaceMappingBindingWorld(
    binding: SagaTreeFaceAnchorTriangleBinding,
    anchorId: SagaTreeFaceAnchorId = 'noseTip',
  ): { x: number; y: number; z: number } | null {
    if (this.disposed || !this.currentRoot) return null;
    const index = buildFaceAnchorNodeIndex(this.currentRoot);
    const result = evaluateFaceAnchorWorldPosition(index, anchorId, binding);
    if (result.status !== 'available') return null;
    return { x: result.x, y: result.y, z: result.z };
  }

  getFaceMappingCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Shared camera/pose state for Auto Mapping capture + GT screen freeze (#421).
   * Keeps reference and proposal projections on the same face frame.
   */
  applyFaceMappingAutoCameraState(): void {
    if (this.disposed) return;
    this.resetLiveActPose();
    this.resetFaceTrackingPose();
    this.applyCameraFrame('face');
    this.controls.update();
  }

  /**
   * Run fn with face-mapping-excluded equipment hidden and masked base surfaces revealed.
   * Nestable: visibility is restored only when the outermost scope exits (always in finally).
   * Use around MediaPipe capture AND subsequent Auto raycasts so 2D detection and 3D binding
   * see the same uncovered base face.
   */
  withFaceMappingBaseFaceCapture<T>(fn: () => T): T {
    this.beginFaceMappingBaseFaceCaptureScope();
    try {
      return fn();
    } finally {
      this.endFaceMappingBaseFaceCaptureScope();
    }
  }

  private beginFaceMappingBaseFaceCaptureScope(): void {
    if (this.faceMappingBaseFaceCaptureDepth === 0) {
      if (!this.currentRoot || this.disposed) {
        this.faceMappingBaseFaceCaptureRestore = () => undefined;
      } else {
        const restoreRigid = this.rigidEquipmentRuntime.beginFaceMappingBaseFaceCapture();
        const restoreSkinned = this.skinnedWearableRuntime.beginFaceMappingBaseFaceCapture();
        const restoreExcludedMarkers = this.beginFaceMappingExcludedMarkerCapture(this.currentRoot);
        this.faceMappingBaseFaceCaptureRestore = () => {
          restoreExcludedMarkers();
          restoreSkinned();
          restoreRigid();
        };
      }
    }
    this.faceMappingBaseFaceCaptureDepth += 1;
  }

  private endFaceMappingBaseFaceCaptureScope(): void {
    this.faceMappingBaseFaceCaptureDepth = Math.max(0, this.faceMappingBaseFaceCaptureDepth - 1);
    if (this.faceMappingBaseFaceCaptureDepth === 0 && this.faceMappingBaseFaceCaptureRestore) {
      const restore = this.faceMappingBaseFaceCaptureRestore;
      this.faceMappingBaseFaceCaptureRestore = null;
      restore();
    }
  }

  /**
   * Deterministic frontal capture for Auto Mapping (#421).
   * Neutral pose + face camera frame; returns a 2D canvas copy (no upload/persist).
   * CSS size matches Manual Mapping raycast coordinates.
   *
   * Opens a nestable base-face visibility scope for the render. Prefer wrapping the full
   * Auto Mapping capture+raycast flow in `withFaceMappingBaseFaceCapture` so raycasts still
   * see the uncovered face after this method returns.
   */
  captureFaceMappingAutoFrame(): {
    image: HTMLCanvasElement;
    canvasWidth: number;
    canvasHeight: number;
  } | null {
    if (this.disposed || !this.currentRoot) return null;

    return this.withFaceMappingBaseFaceCapture(() => {
      this.applyFaceMappingAutoCameraState();
      this.renderer.render(this.scene, this.camera);

      const src = this.renderer.domElement;
      const canvasWidth = Math.max(1, Math.round(src.clientWidth));
      const canvasHeight = Math.max(1, Math.round(src.clientHeight));
      if (!(src.width > 0) || !(src.height > 0)) return null;

      const image = document.createElement('canvas');
      image.width = src.width;
      image.height = src.height;
      const ctx = image.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0);
      return { image, canvasWidth, canvasHeight };
    });
  }

  /**
   * Hide objects explicitly marked sagatreeExcludeFaceMapping for one capture frame.
   * Complements rigid/skinned runtime groups (same exclude contract as raycast).
   */
  private beginFaceMappingExcludedMarkerCapture(root: THREE.Object3D): () => void {
    const hide: THREE.Object3D[] = [];
    root.traverse((obj) => {
      if (obj.userData?.sagatreeExcludeFaceMapping === true) {
        hide.push(obj);
      }
    });
    if (hide.length === 0) {
      return () => undefined;
    }
    return beginFaceMappingBaseFaceCaptureVisibility({ hide, reveal: [] });
  }

  /**
   * Apply local face-tracking drive (#12) onto head bone + facial weights.
   * Ephemeral only — never written into appearance.avatar.
   */
  applyFaceTrackingDrive(drive: FaceTrackingDrive): void {
    if (this.disposed || this.faceMappingAuthoringActive) return;
    if (this.headBone) {
      this.headScratchEuler.set(drive.head.pitch, drive.head.yaw, drive.head.roll, 'YXZ');
      this.headScratchQuaternion.setFromEuler(this.headScratchEuler);
      this.headBone.quaternion.copy(this.headRestQuaternion).multiply(this.headScratchQuaternion);
    }
    const lookAt = this.currentVrm?.lookAt;
    if (lookAt) {
      this.eyeLookTarget.set(
        drive.eyeLookX * 0.35,
        1.55 + drive.eyeLookY * 0.2,
        1.2,
      );
      lookAt.lookAt(this.eyeLookTarget);
    }
    const batch: Partial<Record<FacialCanonicalKey, number>> = {};
    for (const [key, weight] of Object.entries(drive.facialWeights)) {
      batch[key as FacialCanonicalKey] = weight ?? 0;
    }
    this.facialRuntime.applyWeightsBatch(batch);
  }

  resetFaceTrackingPose(): void {
    if (this.headBone) {
      this.headBone.quaternion.copy(this.headRestQuaternion);
    }
    this.facialRuntime.resetToNeutral();
  }

  resetLiveActPose(): void {
    this.liveActAvatarOutput?.resetLiveActPose();
  }

  /** True when a model is loaded and can be snapshotted. */
  isPortraitReady(): boolean {
    return !this.disposed && Boolean(this.currentRoot);
  }

  isInspectMode(): boolean {
    return this.inspectMode;
  }

  /**
   * Inspect mode: pan + closer zoom so users can look at face, shoes, etc.
   * Default mode keeps the locked full-body orbit from launch.
   */
  setInspectMode(enabled: boolean): void {
    if (this.disposed) return;
    this.inspectMode = enabled;
    this.applyOrbitLimits(enabled ? 'inspect' : 'default');
    this.controls.update();
  }

  /** Jump orbit target to a body region; close frames auto-enable inspect. */
  applyCameraFrame(frame: AvatarCameraFrameId): void {
    if (this.disposed || !this.currentRoot) return;
    if (frame === 'face' || frame === 'feet' || frame === 'portrait') {
      this.setInspectMode(true);
    }
    if (frame === 'full') {
      this.fitCamera();
      return;
    }
    if (frame === 'portrait') {
      this.fitPortraitCamera();
      return;
    }
    if (frame === 'face') {
      this.fitRegionCamera({
        bandMin: 0.78,
        bandMax: 1,
        heightScale: 0.55,
        preferBone: this.headBone,
        boneYBias: -0.04,
      });
      return;
    }
    this.fitRegionCamera({
      bandMin: 0,
      bandMax: 0.18,
      heightScale: 0.5,
      preferBone: this.leftFootBone ?? this.rightFootBone,
      boneYBias: 0.06,
    });
  }

  /** Exit inspect limits and restore full-body framing. */
  resetCamera(): void {
    if (this.disposed) return;
    this.setInspectMode(false);
    this.fitCamera();
  }

  /**
   * Portrait capture — same renderer/style path as live preview.
   * Temporarily frames head + upper torso, then restores the live camera.
   */
  capturePortraitDataUrl(): string {
    const prevTarget = this.controls.target.clone();
    const prevPosition = this.camera.position.clone();
    const prevNear = this.camera.near;
    const prevFar = this.camera.far;
    try {
      this.fitPortraitCamera();
      return this.liveActCharacterFaceDebug.runWithoutSampling(() =>
        this.liveActRigDebug.runWithoutHelper(() => {
          this.renderNow();
          return capturePortraitFromRenderer(this.renderer);
        }),
      );
    } finally {
      this.controls.target.copy(prevTarget);
      this.camera.position.copy(prevPosition);
      this.camera.near = prevNear;
      this.camera.far = prevFar;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.renderNow();
    }
  }

  applyAppearance(avatar: CharacterAvatarDto, manifest: AvatarAssetManifest): void {
    this.currentAvatar = avatar;
    this.currentManifest = manifest;
    this.syncCharacterFaceAnchors(avatar);
    const root = this.currentRoot;
    if (!root) return;

    const base: BaseTraitSelection = {
      head: avatar.traits.head,
      ears: avatar.traits.ears,
      hair: avatar.traits.hair,
      clothing: avatar.traits.clothing,
      accessory: avatar.traits.accessory,
    };
    const effective = resolveEffectiveTraits(base, this.runtimeOverlays);
    const hairHidden =
      effective.hiddenGroups.includes('hair') || effective.traits.hair === 'bald';

    const widthScale = 0.88 + avatar.body.size * 0.0024;
    const heightScale = 0.88 + avatar.body.height * 0.0024;
    this.modelContainer.scale.set(
      manifest.modelScale * widthScale,
      manifest.modelScale * heightScale,
      manifest.modelScale * widthScale,
    );

    const clothingColor = clothingTint(effective.traits.clothing ?? avatar.traits.clothing);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const semanticName = `${object.name}`.toLowerCase();
      if (includesHint(semanticName, manifest.materialHints.hair)) {
        object.visible = !hairHidden;
      }
    });

    // Always restore load-time baseline before (re)applying profile — keeps toggle + re-tint stable.
    if (this.materialStyleSnapshots.length > 0) {
      restoreMaterialStyleSnapshots(this.materialStyleSnapshots);
    }

    const isImportModel = Boolean(avatar.model_url);
    if (this.mtoonStyleEnabled) {
      applyMtoonProfileToScene(this.scene, this.styleLights, this.styleProfile);
      this.styleCompatibility = applyMtoonProfileToModel({
        root,
        profile: this.styleProfile,
        isImportModel,
        colors: {
          skin: avatar.colors.skin,
          hair: avatar.colors.hair,
          clothing: clothingColor,
          eyes: avatar.colors.eyes,
        },
      });
    } else {
      applyNeutralPreviewLights(this.scene, this.styleLights);
      this.styleCompatibility = {
        path: 'pbr-fallback',
        noticeDe: null,
      };
    }
  }

  renderNow(): void {
    if (this.disposed) return;
    this.resize();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Apply morph contract values to existing morph targets without reloading the model.
   * Unknown target names are skipped (fail-safe).
   */
  applyMorphState(morph: {
    body: Readonly<Record<string, number>>;
    face: Readonly<Record<string, number>>;
  }): void {
    const root = this.currentRoot;
    if (!root) return;

    const weights: Record<string, number> = {};
    for (const [key, value] of Object.entries(morph.body)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        weights[`sd_body_${key}`] = Math.max(-1, Math.min(1, value));
      }
    }
    for (const [key, value] of Object.entries(morph.face)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        weights[`sd_face_${key}`] = Math.max(-1, Math.min(1, value));
      }
    }

    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const dictionary = object.morphTargetDictionary;
      const influences = object.morphTargetInfluences;
      if (!dictionary || !influences) return;
      for (const [targetName, weight] of Object.entries(weights)) {
        const index = dictionary[targetName];
        if (typeof index !== 'number') continue;
        // Morph targets typically expect 0..1; map [-1,1] → [0,1] around neutral 0.5.
        influences[index] = (weight + 1) / 2;
      }
    });
  }

  private fitCamera(): void {
    if (!this.currentRoot) return;
    this.modelContainer.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(this.modelContainer);
    if (bounds.isEmpty()) return;

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max(1.6, (size.y * 0.58) / Math.tan(verticalFov / 2));
    this.controls.target.set(center.x, center.y * 0.96, center.z);
    this.camera.position.set(center.x, center.y * 0.98, center.z + distance * 1.08);
    this.camera.near = Math.max(0.01, distance / 100);
    this.camera.far = Math.max(30, distance * 8);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /**
   * Frame head + upper torso for portrait snapshots (Meshy/import and manual generate).
   * Prefers VRM head bone when present; otherwise uses the top ~55% of the model AABB.
   */
  private fitPortraitCamera(): void {
    this.fitRegionCamera({
      bandMin: 0.45,
      bandMax: 1,
      heightScale: 0.72,
      preferBone: this.headBone,
      boneYBias: -0.18,
      minDistance: 0.85,
    });
  }

  private fitRegionCamera(options: {
    bandMin: number;
    bandMax: number;
    heightScale: number;
    preferBone: THREE.Object3D | null;
    boneYBias: number;
    minDistance?: number;
  }): void {
    if (!this.currentRoot) return;
    this.modelContainer.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(this.modelContainer);
    if (bounds.isEmpty()) return;

    const size = bounds.getSize(new THREE.Vector3());
    const fullCenter = bounds.getCenter(new THREE.Vector3());
    const regionMinY = bounds.min.y + size.y * options.bandMin;
    const regionMaxY = bounds.min.y + size.y * options.bandMax;
    const regionHeight = Math.max(0.2, regionMaxY - regionMinY);
    const center = new THREE.Vector3(fullCenter.x, (regionMinY + regionMaxY) / 2, fullCenter.z);

    if (options.preferBone) {
      const boneWorld = new THREE.Vector3();
      options.preferBone.getWorldPosition(boneWorld);
      center.x = boneWorld.x;
      center.z = boneWorld.z;
      center.y = boneWorld.y + regionHeight * options.boneYBias;
    }

    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max(
      options.minDistance ?? 0.45,
      (regionHeight * options.heightScale) / Math.tan(verticalFov / 2),
    );
    this.controls.target.copy(center);
    this.camera.position.set(center.x, center.y + regionHeight * 0.02, center.z + distance);
    this.camera.near = Math.max(0.01, distance / 100);
    this.camera.far = Math.max(30, distance * 8);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private applyOrbitLimits(mode: 'default' | 'inspect'): void {
    if (mode === 'inspect') {
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = true;
      this.controls.minDistance = 0.35;
      this.controls.maxDistance = 8;
      this.controls.minPolarAngle = 0.08;
      this.controls.maxPolarAngle = Math.PI - 0.08;
      return;
    }
    this.controls.enablePan = false;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 7;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.maxPolarAngle = Math.PI * 0.72;
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.round(width * pixelRatio);
    const targetHeight = Math.round(height * pixelRatio);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Rebinds character anchors whenever `avatar.face_anchors` changes for the loaded model
   * (e.g. hydration of a draft whose model URL/manifest stayed the same).
   */
  private syncCharacterFaceAnchors(avatar: CharacterAvatarDto, force = false): void {
    const modelUrl = this.faceAnchorsModelUrl;
    if (!modelUrl) return;
    const override = avatar.face_anchors ?? null;
    if (!force && override === this.faceAnchorsOverrideSource) return;
    this.faceAnchorsOverrideSource = override;
    void this.loadFaceAnchorsManifestForModel(modelUrl, override);
  }

  private async loadFaceAnchorsManifestForModel(
    modelUrl: string,
    characterOverride: SagaTreeFaceAnchorsManifestV1 | null = null,
  ): Promise<void> {
    const token = ++this.faceAnchorManifestLoadToken;
    // Character-persisted anchors win over asset sidecar (#persist).
    if (characterOverride) {
      const parsed = parseFaceAnchorsManifestV1(characterOverride);
      if (parsed.ok && token === this.faceAnchorManifestLoadToken) {
        this.liveActCharacterFaceDebug.bindManifest(parsed.manifest);
        return;
      }
    }
    this.liveActCharacterFaceDebug.bindManifest(null);
    const candidates = listFaceAnchorsManifestUrlCandidates(modelUrl);
    if (!candidates.length) return;
    for (const manifestUrl of candidates) {
      try {
        const response = await fetch(manifestUrl);
        if (!response.ok || token !== this.faceAnchorManifestLoadToken) continue;
        const payload: unknown = await response.json();
        if (token !== this.faceAnchorManifestLoadToken) return;
        const parsed = parseFaceAnchorsManifestV1(payload);
        if (parsed.ok) {
          this.liveActCharacterFaceDebug.bindManifest(parsed.manifest);
          return;
        }
      } catch {
        // Try next candidate — mapping stays unavailable if all fail (#400).
      }
    }
  }

  private bindHumanoidBones(
    vrm: VRM | undefined,
    rigAnalysis: AvatarRigAnalysisResult | undefined,
  ): void {
    this.headBone = null;
    this.leftFootBone = null;
    this.rightFootBone = null;
    const humanoid = vrm?.humanoid as
      | {
          getNormalizedBoneNode?: (name: string) => THREE.Object3D | null;
          getRawBoneNode?: (name: string) => THREE.Object3D | null;
        }
      | undefined;
    if (humanoid) {
      const pick = (name: string): THREE.Object3D | null =>
        humanoid.getNormalizedBoneNode?.(name) ?? humanoid.getRawBoneNode?.(name) ?? null;
      const head = pick('head');
      if (head) {
        this.headBone = head;
        this.headRestQuaternion.copy(head.quaternion);
      }
      this.leftFootBone = pick('leftFoot') ?? pick('leftToes');
      this.rightFootBone = pick('rightFoot') ?? pick('rightToes');
      return;
    }

    const headBoneName = rigAnalysis?.rig.bones.head;
    if (headBoneName && this.currentRoot) {
      const head = this.currentRoot.getObjectByName(headBoneName);
      if (head) {
        this.headBone = head;
        this.headRestQuaternion.copy(head.quaternion);
      }
    }
  }

  private rebuildLiveActAvatarOutput(): void {
    this.liveActAvatarOutput?.dispose();
    this.liveActAvatarOutput = null;
    if (!this.currentRoot) return;
    this.liveActAvatarOutput = createLiveActAvatarOutput({
      root: this.currentRoot,
      vrm: this.currentVrm,
      headBone: this.headBone,
      headRestQuaternion: this.headRestQuaternion,
      headScratchEuler: this.headScratchEuler,
      headScratchQuaternion: this.headScratchQuaternion,
    });
  }

  private removeCurrentModel(): void {
    this.animationRuntime.stopAll();
    this.facialRuntime.resetToNeutral();
    this.liveActRigDebug.bindModelRoot(null);
    this.faceAnchorManifestLoadToken += 1;
    this.faceAnchorsModelUrl = null;
    this.faceAnchorsOverrideSource = null;
    this.liveActCharacterFaceDebug.bindModelRoot(null);
    this.liveActCharacterFaceDebug.bindManifest(null);
    this.liveActAvatarOutput?.dispose();
    this.liveActAvatarOutput = null;
    this.headBone = null;
    this.leftFootBone = null;
    this.rightFootBone = null;
    this.materialStyleSnapshots = [];
    this.rigidEquipmentRuntime.bindAvatar(null, null);
    this.skinnedWearableRuntime.bindAvatar(null, null);
    if (!this.currentRoot) return;
    this.modelContainer.remove(this.currentRoot);
    VRMUtils.deepDispose(this.currentRoot);
    this.currentRoot = undefined;
    this.currentVrm = undefined;
    this.modelContainer.scale.set(1, 1, 1);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadVersion += 1;
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.animationRuntime.dispose();
    this.facialRuntime.dispose();
    this.rigidEquipmentRuntime.dispose();
    this.skinnedWearableRuntime.dispose();
    this.liveActAvatarOutput?.dispose();
    this.liveActAvatarOutput = null;
    this.liveActRigDebug.dispose();
    this.liveActCharacterFaceDebug.dispose();
    this.traitLifecycle.dispose();
    this.runtimeOverlays = [];
    this.headBone = null;
    this.removeCurrentModel();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of materialsOf(object)) material.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:16

```ts
export type FaceAnchorEvaluationStatus = 'available' | 'unavailable';
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:18

```ts
export interface FaceAnchorWorldPositionV1 {
  readonly status: 'available';
  readonly anchorId: SagaTreeFaceAnchorId;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:26

```ts
export interface FaceAnchorUnavailableV1 {
  readonly status: 'unavailable';
  readonly anchorId: SagaTreeFaceAnchorId;
}
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:31

```ts
export type FaceAnchorEvaluationV1 = FaceAnchorWorldPositionV1 | FaceAnchorUnavailableV1;
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:33

```ts
export interface FaceAnchorRuntimeSnapshotV1 {
  readonly evaluations: Readonly<Partial<Record<SagaTreeFaceAnchorId, FaceAnchorEvaluationV1>>>;
}
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:44

```ts
export function buildFaceAnchorNodeIndex(root: THREE.Object3D): ReadonlyMap<string, THREE.Object3D> {
  const map = new Map<string, THREE.Object3D>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const name = object.name.trim();
    if (!name || map.has(name)) return;
    map.set(name, object);
  });
  return map;
}
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:151

```ts
export function evaluateFaceAnchorWorldPosition(
  nodeIndex: ReadonlyMap<string, THREE.Object3D>,
  anchorId: SagaTreeFaceAnchorId,
  binding: SagaTreeFaceAnchorTriangleBinding,
  target?: THREE.Vector3,
): FaceAnchorEvaluationV1 {
  const validated = validateFaceAnchorTriangleBinding(binding, anchorId);
  if (!validated.ok) {
    return { status: 'unavailable', anchorId };
  }

  const mesh = resolveMeshForBinding(nodeIndex, binding);
  if (!mesh) {
    return { status: 'unavailable', anchorId };
  }

  const geometry = mesh.geometry;
  if (!geometry) {
    return { status: 'unavailable', anchorId };
  }

  const indices = triangleVertexIndices(geometry, binding.primitiveIndex, binding.triangleIndex);
  if (!indices) {
    return { status: 'unavailable', anchorId };
  }

  readDeformedVertex(mesh, indices[0], _vertex);
  readDeformedVertex(mesh, indices[1], _vertexB);
  readDeformedVertex(mesh, indices[2], _vertexC);

  const { u, v, w } = binding.barycentric;
  _world.copy(_vertex).multiplyScalar(u);
  _world.addScaledVector(_vertexB, v);
  _world.addScaledVector(_vertexC, w);

  mesh.localToWorld(_world);

  const out = target ?? new THREE.Vector3();
  out.copy(_world);

  return {
    status: 'available',
    anchorId,
    x: out.x,
    y: out.y,
    z: out.z,
  };
}
```

### src/infrastructure/character/avatar/face-anchor-runtime.ts:200

```ts
export function evaluateFaceAnchorsManifest(
  root: THREE.Object3D,
  manifest: SagaTreeFaceAnchorsManifestV1,
): FaceAnchorRuntimeSnapshotV1 {
  root.updateMatrixWorld(true);
  const nodeIndex = buildFaceAnchorNodeIndex(root);
  const evaluations: Partial<Record<SagaTreeFaceAnchorId, FaceAnchorEvaluationV1>> = {};

  for (const [id, binding] of Object.entries(manifest.anchors)) {
    if (!binding) continue;
    const anchorId = id as SagaTreeFaceAnchorId;
    evaluations[anchorId] = evaluateFaceAnchorWorldPosition(nodeIndex, anchorId, binding);
  }

  return { evaluations };
}
```

### src/infrastructure/character/avatar/face-mapping-auto-pipeline.ts:29

```ts
export interface FaceMappingAutoPipelineInput {
  readonly landmarks: readonly NormalizedLandmark2dLike[];
  readonly faceCount: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /**
   * Ordered allowlisted hits for one canvas point (same path as Manual Mapping).
   * Prefer this over a single-hit raycast so Auto can surface-select.
   */
  readonly listRaycastCandidates: (
    canvasX: number,
    canvasY: number,
  ) => readonly FaceMappingRaycastCandidateV1[];
  /** Optional presence score 0..1 (defaults from landmark availability). */
  readonly presenceConfidence?: number;
  /** Optional world-space face width for depth gate (when known). */
  readonly faceWidthWorld?: number | null;
}
```

### src/infrastructure/character/avatar/face-mapping-auto-pipeline.ts:101

```ts
export function runFaceMappingAutoPipeline(
  input: FaceMappingAutoPipelineInput,
): FaceMappingAutoSessionResultV1 {
  const { faceCount, canvasWidth, canvasHeight, listRaycastCandidates } = input;

  if (faceCount === 0) {
    return {
      contractVersion: FACE_MAPPING_AUTO_CONTRACT_VERSION,
      status: 'no_face',
      faceCount: 0,
      messageDe: messageForStatus('no_face', 0),
      anchors: [],
      mapVersion: MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_VERSION,
    };
  }

  if (faceCount > 1) {
    return {
      contractVersion: FACE_MAPPING_AUTO_CONTRACT_VERSION,
      status: 'multi_face',
      faceCount,
      messageDe: messageForStatus('multi_face', 0),
      anchors: [],
      mapVersion: MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_VERSION,
    };
  }

  if (!(canvasWidth > 0) || !(canvasHeight > 0) || input.landmarks.length === 0) {
    return {
      contractVersion: FACE_MAPPING_AUTO_CONTRACT_VERSION,
      status: 'failed',
      faceCount,
      messageDe: messageForStatus('failed', 0),
      anchors: [],
      mapVersion: MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_VERSION,
    };
  }

  const samples = resolveAllMediaPipeAnchorSamples(input.landmarks);
  const byId = new Map(samples.map((s) => [s.anchorId, s]));
  const leftOuter = byId.get('eyeLeftOuter');
  const rightOuter = byId.get('eyeRightOuter');
  let interocularPx: number | null = null;
  if (
    leftOuter?.available &&
    rightOuter?.available &&
    leftOuter.x != null &&
    rightOuter.x != null
  ) {
    interocularPx =
      Math.hypot(
        (leftOuter.x - rightOuter.x) * canvasWidth,
        (leftOuter.y - rightOuter.y) * canvasHeight,
      ) || null;
  }

  let faceWidthWorld = input.faceWidthWorld ?? null;
  if (
    faceWidthWorld == null &&
    leftOuter?.available &&
    rightOuter?.available
  ) {
    const lHits = listRaycastCandidates(
      leftOuter.x * canvasWidth,
      leftOuter.y * canvasHeight,
    );
    const rHits = listRaycastCandidates(
      rightOuter.x * canvasWidth,
      rightOuter.y * canvasHeight,
    );
    faceWidthWorld = computeFaceMappingFaceWidthWorld(
      lHits[0]?.worldPoint ?? null,
      rHits[0]?.worldPoint ?? null,
    );
  }

  const anchors: FaceMappingAutoAnchorResultV1[] = [];
  let mapped = 0;

  for (const sample of samples) {
    if (!sample.available) {
      anchors.push({
        anchorId: sample.anchorId,
        outcome: 'missing_landmark',
        binding: null,
        confidence: null,
        landmarkAvailability: sample.availability,
        screenX: null,
        screenY: null,
        meshNodeIdentity: null,
        laterality: sample.laterality,
      });
      continue;
    }

    if (sample.availability < 0.34) {
      anchors.push({
        anchorId: sample.anchorId,
        outcome: 'low_confidence',
        binding: null,
        confidence: sample.availability,
        landmarkAvailability: sample.availability,
        screenX: null,
        screenY: null,
        meshNodeIdentity: null,
        laterality: sample.laterality,
      });
      continue;
    }

    const screenX = sample.x * canvasWidth;
    const screenY = sample.y * canvasHeight;
    const confidence = sample.availability * (input.presenceConfidence ?? 1);
    const primaryCandidates = listRaycastCandidates(screenX, screenY);

    if (primaryCandidates.length === 0) {
      // Screen snap neighborhood before giving up as miss.
      const bias = faceMappingScreenSnapBiasForAnchor(sample.anchorId);
      const offsets = buildFaceMappingScreenSnapOffsets({
        bias,
        interocularPx,
      });
      let snapped: FaceMappingRaycastCandidateV1 | null = null;
      let snapEvidence: FaceMappingAutoSurfaceSelectionEvidenceV1 | null = null;
      for (const off of offsets) {
        const sx = screenX + off.dx;
        const sy = screenY + off.dy;
        if (sx < 0 || sy < 0 || sx > canvasWidth || sy > canvasHeight) continue;
        const cands = listRaycastCandidates(sx, sy);
        const attempt = trySelectFromCandidates(
          cands,
          sample.anchorId,
          faceWidthWorld,
        );
        if (attempt.candidate) {
          const snapDistancePx = Math.hypot(off.dx, off.dy);
          snapped = attempt.candidate;
          snapEvidence = {
            ...attempt.evidence,
            strategy: 'screen_snap',
            originalScreenX: screenX,
            originalScreenY: screenY,
            resolvedScreenX: sx,
            resolvedScreenY: sy,
            snapDistancePx,
            normalizedSnapDistance:
              interocularPx != null && interocularPx > 1e-6
                ? snapDistancePx / interocularPx
                : null,
            selectedSurface: attempt.candidate.nodeIdentity,
          };
          break;
        }
      }

      if (snapped && snapEvidence) {
        mapped += 1;
        anchors.push({
          anchorId: sample.anchorId,
          outcome: 'mapped',
          binding: snapped.binding,
          confidence,
          landmarkAvailability: sample.availability,
          screenX: snapEvidence.resolvedScreenX,
          screenY: snapEvidence.resolvedScreenY,
          meshNodeIdentity: snapped.nodeIdentity,
          laterality: sample.laterality,
          surfaceSelection: snapEvidence,
        });
        continue;
      }

      anchors.push({
        anchorId: sample.anchorId,
        outcome: 'raycast_miss',
        binding: null,
        confidence,
        landmarkAvailability: sample.availability,
        screenX,
        screenY,
        meshNodeIdentity: null,
        laterality: sample.laterality,
        surfaceSelection: {
          strategy: 'raycast_miss',
          originalScreenX: screenX,
          originalScreenY: screenY,
          resolvedScreenX: null,
          resolvedScreenY: null,
          snapDistancePx: null,
          normalizedSnapDistance: null,
          maxDepthDelta: null,
          selectedSurface: null,
          candidates: [],
        },
      });
      continue;
    }

    const primary = trySelectFromCandidates(
      primaryCandidates,
      sample.anchorId,
      faceWidthWorld,
    );
    const primaryEvidence: FaceMappingAutoSurfaceSelectionEvidenceV1 = {
      ...primary.evidence,
      originalScreenX: screenX,
      originalScreenY: screenY,
      resolvedScreenX: primary.candidate ? screenX : null,
      resolvedScreenY: primary.candidate ? screenY : null,
    };

    if (primary.candidate) {
      mapped += 1;
      anchors.push({
        anchorId: sample.anchorId,
        outcome: 'mapped',
        binding: primary.candidate.binding,
        confidence,
        landmarkAvailability: sample.availability,
        screenX,
        screenY,
        meshNodeIdentity: primary.candidate.nodeIdentity,
        laterality: sample.laterality,
        surfaceSelection: primaryEvidence,
      });
      continue;
    }

    // Same-ray had no depth-gated allowed hit → local semantic screen snap.
    const bias = faceMappingScreenSnapBiasForAnchor(sample.anchorId);
    const offsets = buildFaceMappingScreenSnapOffsets({
      bias,
      interocularPx,
    });
    let snapped: FaceMappingRaycastCandidateV1 | null = null;
    let snapEvidence: FaceMappingAutoSurfaceSelectionEvidenceV1 | null = null;
    for (const off of offsets) {
      const sx = screenX + off.dx;
      const sy = screenY + off.dy;
      if (sx < 0 || sy < 0 || sx > canvasWidth || sy > canvasHeight) continue;
      const cands = listRaycastCandidates(sx, sy);
      const attempt = trySelectFromCandidates(
        cands,
        sample.anchorId,
        faceWidthWorld,
      );
      if (attempt.candidate) {
        const snapDistancePx = Math.hypot(off.dx, off.dy);
        snapped = attempt.candidate;
        snapEvidence = {
          ...attempt.evidence,
          strategy: 'screen_snap',
          originalScreenX: screenX,
          originalScreenY: screenY,
          resolvedScreenX: sx,
          resolvedScreenY: sy,
          snapDistancePx,
          normalizedSnapDistance:
            interocularPx != null && interocularPx > 1e-6
              ? snapDistancePx / interocularPx
              : null,
          selectedSurface: attempt.candidate.nodeIdentity,
        };
        break;
      }
    }

    if (snapped && snapEvidence) {
      mapped += 1;
      anchors.push({
        anchorId: sample.anchorId,
        outcome: 'mapped',
        binding: snapped.binding,
        confidence,
        landmarkAvailability: sample.availability,
        screenX: snapEvidence.resolvedScreenX,
        screenY: snapEvidence.resolvedScreenY,
        meshNodeIdentity: snapped.nodeIdentity,
        laterality: sample.laterality,
        surfaceSelection: snapEvidence,
      });
      continue;
    }

    anchors.push({
      anchorId: sample.anchorId,
      outcome: 'surface_mismatch',
      binding: null,
      confidence,
      landmarkAvailability: sample.availability,
      screenX,
      screenY,
      meshNodeIdentity: primaryCandidates[0]?.nodeIdentity ?? null,
      laterality: sample.laterality,
      surfaceSelection: primaryEvidence,
    });
  }

  const status = mapped === 21 ? 'proposed' : mapped > 0 ? 'incomplete' : 'incomplete';
  return {
    contractVersion: FACE_MAPPING_AUTO_CONTRACT_VERSION,
    status,
    faceCount: 1,
    messageDe: messageForStatus(status, mapped),
    anchors,
    mapVersion: MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_VERSION,
  };
}
```

### src/infrastructure/character/avatar/face-mapping-base-face-capture-visibility.ts:14

```ts
export interface FaceMappingVisibilitySnapshotEntry {
  readonly object: THREE.Object3D;
  readonly visible: boolean;
}
```

### src/infrastructure/character/avatar/face-mapping-base-face-capture-visibility.ts:23

```ts
export function beginFaceMappingBaseFaceCaptureVisibility(params: {
  readonly hide: readonly THREE.Object3D[];
  readonly reveal: readonly THREE.Object3D[];
}): () => void {
  const saved: FaceMappingVisibilitySnapshotEntry[] = [];
  const seen = new Set<THREE.Object3D>();

  const remember = (object: THREE.Object3D): void => {
    if (seen.has(object)) return;
    seen.add(object);
    saved.push({ object, visible: object.visible });
  };

  for (const object of params.hide) {
    remember(object);
    object.visible = false;
  }
  for (const object of params.reveal) {
    remember(object);
    object.visible = true;
  }

  return () => {
    for (let i = saved.length - 1; i >= 0; i -= 1) {
      const entry = saved[i];
      if (!entry) continue;
      entry.object.visible = entry.visible;
    }
  };
}
```

### src/infrastructure/character/avatar/face-mapping-base-face-capture-visibility.ts:57

```ts
export function withFaceMappingBaseFaceCaptureVisibility<T>(
  params: {
    readonly hide: readonly THREE.Object3D[];
    readonly reveal: readonly THREE.Object3D[];
  },
  fn: () => T,
): T {
  const restore = beginFaceMappingBaseFaceCaptureVisibility(params);
  try {
    return fn();
  } finally {
    restore();
  }
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:47

```ts
export function isUnderFaceMappingExcludedAncestor(object: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = object;
  while (cur) {
    if (cur.userData?.sagatreeExcludeFaceMapping === true) return true;
    if (cur.userData?.isHelper === true) return true;
    if (isFaceMappingExcludedEquipmentAncestorName(cur.name)) return true;
    cur = cur.parent;
  }
  return false;
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:58

```ts
export function isFaceMappingAllowlistedMesh(object: THREE.Object3D): object is THREE.Mesh {
  if (!(object instanceof THREE.Mesh)) return false;
  if (!object.visible) return false;
  if (!(object instanceof THREE.SkinnedMesh) && !(object instanceof THREE.Mesh)) return false;
  const name = object.name.trim();
  if (!name) return false;
  if (EXCLUDE_NAME_RE.test(name)) return false;
  if (isUnderFaceMappingExcludedAncestor(object)) return false;
  const geom = object.geometry;
  if (!(geom instanceof THREE.BufferGeometry)) return false;
  if (!geom.getAttribute('position')) return false;
  return true;
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:73

```ts
export function collectFaceMappingRaycastMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (isFaceMappingAllowlistedMesh(object)) meshes.push(object);
  });
  return meshes;
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:96

```ts
export function normalizeFaceMappingBarycentric(
  u: number,
  v: number,
  w: number,
): { u: number; v: number; w: number } {
  let uu = Number.isFinite(u) ? Math.max(0, u) : 0;
  let vv = Number.isFinite(v) ? Math.max(0, v) : 0;
  let ww = Number.isFinite(w) ? Math.max(0, w) : 0;
  const sum = uu + vv + ww;
  if (!(sum > 1e-8)) {
    return { u: 1 / 3, v: 1 / 3, w: 1 / 3 };
  }
  return { u: uu / sum, v: vv / sum, w: ww / sum };
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:111

```ts
export interface FaceMappingRaycastHitV1 {
  readonly binding: SagaTreeFaceAnchorTriangleBinding;
  readonly worldPoint: { readonly x: number; readonly y: number; readonly z: number };
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:117

```ts
export interface FaceMappingRaycastCandidateV1 extends FaceMappingRaycastHitV1 {
  readonly order: number;
  readonly distance: number;
  readonly nodeIdentity: string;
  readonly triangleIndex: number;
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:175

```ts
export function listFaceMappingRaycastCandidates(input: {
  camera: THREE.Camera;
  root: THREE.Object3D;
  canvasWidth: number;
  canvasHeight: number;
  canvasX: number;
  canvasY: number;
}): FaceMappingRaycastCandidateV1[] {
  const { camera, root, canvasWidth, canvasHeight, canvasX, canvasY } = input;
  if (canvasWidth <= 0 || canvasHeight <= 0) return [];

  _pointerNdc.x = (canvasX / canvasWidth) * 2 - 1;
  _pointerNdc.y = -(canvasY / canvasHeight) * 2 + 1;
  _raycaster.setFromCamera(_pointerNdc, camera);

  const meshes = collectFaceMappingRaycastMeshes(root);
  if (meshes.length === 0) return [];

  const hits = _raycaster.intersectObjects(meshes, false);
  const out: FaceMappingRaycastCandidateV1[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const candidate = hitToCandidate(hits[i]!, i);
    if (candidate) out.push(candidate);
  }
  return out;
}
```

### src/infrastructure/character/avatar/face-mapping-raycast.ts:206

```ts
export function raycastFaceMappingPointer(input: {
  camera: THREE.Camera;
  root: THREE.Object3D;
  canvasWidth: number;
  canvasHeight: number;
  canvasX: number;
  canvasY: number;
  /**
   * Optional Auto selector over ordered candidates.
   * Return the chosen candidate (or null to miss). Defaults to first hit.
   */
  selectCandidate?: (
    candidates: readonly FaceMappingRaycastCandidateV1[],
  ) => FaceMappingRaycastCandidateV1 | null;
}): FaceMappingRaycastHitV1 | null {
  const candidates = listFaceMappingRaycastCandidates(input);
  if (candidates.length === 0) return null;
  const selected = input.selectCandidate
    ? input.selectCandidate(candidates)
    : (candidates[0] ?? null);
  if (!selected) return null;
  return {
    binding: selected.binding,
    worldPoint: selected.worldPoint,
  };
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:20

```ts
export interface MtoonStyleLights {
  hemisphere: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:57

```ts
export function detectHasMtoonMaterials(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((object) => {
    if (found || !(object instanceof THREE.Mesh)) return;
    for (const material of materialsOf(object)) {
      if (isMtoonMaterial(material)) found = true;
    }
  });
  return found;
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:68

```ts
export function createMtoonStyleLights(
  profile: SagaTreeMToonProfileV1 = createSagaTreeMToonProfileV1(),
): MtoonStyleLights {
  const light = profile.light;
  const hemisphere = new THREE.HemisphereLight(
    light.hemisphereSky,
    light.hemisphereGround,
    light.hemisphereIntensity,
  );
  const key = new THREE.DirectionalLight(light.keyColor, light.keyIntensity);
  key.position.set(...light.keyPosition);
  key.castShadow = true;
  key.shadow.mapSize.set(light.shadowMapSize, light.shadowMapSize);
  key.shadow.bias = light.shadowBias;

  const fill = new THREE.DirectionalLight(light.fillColor, light.fillIntensity);
  fill.position.set(...light.fillPosition);

  const rim = new THREE.DirectionalLight(light.rimColor, light.rimIntensity);
  rim.position.set(...light.rimPosition);

  return { hemisphere, key, fill, rim };
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:92

```ts
export function applyMtoonProfileToRenderer(
  renderer: THREE.WebGLRenderer,
  profile: SagaTreeMToonProfileV1 = createSagaTreeMToonProfileV1(),
  performancePreset: MtoonPerformancePreset = resolveMtoonPerformancePreset(),
): void {
  const perf = profile.performance[performancePreset];
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = profile.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perf.maxPixelRatio));
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:106

```ts
export function applyMtoonProfileToScene(
  scene: THREE.Scene,
  lights: MtoonStyleLights,
  profile: SagaTreeMToonProfileV1 = createSagaTreeMToonProfileV1(),
  performancePreset: MtoonPerformancePreset = resolveMtoonPerformancePreset(),
): void {
  const perf = profile.performance[performancePreset];
  const light = profile.light;
  scene.background = new THREE.Color(profile.background);
  scene.fog = new THREE.Fog(profile.background, profile.fogNear, profile.fogFar);

  lights.hemisphere.color.set(light.hemisphereSky);
  lights.hemisphere.groundColor.set(light.hemisphereGround);
  lights.hemisphere.intensity = light.hemisphereIntensity;

  lights.key.color.set(light.keyColor);
  lights.key.intensity = light.keyIntensity;
  lights.key.position.set(...light.keyPosition);
  lights.key.shadow.mapSize.set(perf.shadowMapSize, perf.shadowMapSize);
  lights.key.shadow.bias = light.shadowBias;

  lights.fill.color.set(light.fillColor);
  lights.fill.intensity = light.fillIntensity * perf.rimIntensityScale;
  lights.fill.position.set(...light.fillPosition);

  lights.rim.color.set(light.rimColor);
  lights.rim.intensity = light.rimIntensity * perf.rimIntensityScale;
  lights.rim.position.set(...light.rimPosition);
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:223

```ts
export function applyMtoonProfileToModel(input: {
  root: THREE.Object3D;
  profile?: SagaTreeMToonProfileV1;
  performancePreset?: MtoonPerformancePreset;
  isImportModel?: boolean;
  colors?: { skin?: string; hair?: string; clothing?: string; eyes?: string };
}): MtoonStyleCompatibility {
  const profile = input.profile ?? createSagaTreeMToonProfileV1();
  const perfPreset =
    input.performancePreset ??
    resolveMtoonPerformancePreset({
      maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
    });
  const perf = profile.performance[perfPreset];
  const hasMtoon = detectHasMtoonMaterials(input.root);
  const compatibility = resolveMtoonRenderPath({
    hasMtoonMaterials: hasMtoon,
    isImportModel: input.isImportModel,
  });

  input.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of materialsOf(object)) {
      const classId = classifyMtoonMaterialClass(`${object.name} ${material.name}`, profile);
      let baseColor: string | undefined;
      if (classId === 'skin') baseColor = input.colors?.skin;
      else if (classId === 'hair') baseColor = input.colors?.hair;
      else if (classId === 'eyes') baseColor = input.colors?.eyes;
      else if (classId === 'cloth' || classId === 'leather') baseColor = input.colors?.clothing;
      applyMtoonClassToMaterial(material, classId, profile, perf, baseColor);
    }
  });

  return compatibility;
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:260

```ts
export function capturePortraitFromRenderer(renderer: THREE.WebGLRenderer): string {
  return renderer.domElement.toDataURL('image/png');
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:265

```ts
export interface MaterialStyleSnapshot {
  material: THREE.Material;
  color?: string;
  roughness?: number;
  metalness?: number;
  shadeColorFactor?: string;
  shadingToonyFactor?: number;
  shadingShiftFactor?: number;
  outlineWidthMode?: string;
  outlineWidthFactor?: number;
  parametricRimFresnelPowerFactor?: number;
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:282

```ts
export function captureMaterialStyleSnapshots(root: THREE.Object3D): MaterialStyleSnapshot[] {
  const snapshots: MaterialStyleSnapshot[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of materialsOf(object)) {
      const record = material as THREE.Material & {
        color?: THREE.Color;
        roughness?: number;
        metalness?: number;
        shadeColorFactor?: THREE.Color;
        shadingToonyFactor?: number;
        shadingShiftFactor?: number;
        outlineWidthMode?: string;
        outlineWidthFactor?: number;
        parametricRimFresnelPowerFactor?: number;
      };
      snapshots.push({
        material,
        color: record.color instanceof THREE.Color ? `#${record.color.getHexString()}` : undefined,
        roughness: typeof record.roughness === 'number' ? record.roughness : undefined,
        metalness: typeof record.metalness === 'number' ? record.metalness : undefined,
        shadeColorFactor:
          record.shadeColorFactor instanceof THREE.Color
            ? `#${record.shadeColorFactor.getHexString()}`
            : undefined,
        shadingToonyFactor:
          typeof record.shadingToonyFactor === 'number' ? record.shadingToonyFactor : undefined,
        shadingShiftFactor:
          typeof record.shadingShiftFactor === 'number' ? record.shadingShiftFactor : undefined,
        outlineWidthMode:
          typeof record.outlineWidthMode === 'string' ? record.outlineWidthMode : undefined,
        outlineWidthFactor:
          typeof record.outlineWidthFactor === 'number' ? record.outlineWidthFactor : undefined,
        parametricRimFresnelPowerFactor:
          typeof record.parametricRimFresnelPowerFactor === 'number'
            ? record.parametricRimFresnelPowerFactor
            : undefined,
      });
    }
  });
  return snapshots;
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:325

```ts
export function restoreMaterialStyleSnapshots(snapshots: readonly MaterialStyleSnapshot[]): void {
  for (const snap of snapshots) {
    const material = snap.material;
    if (!material) continue;
    const record = material as THREE.Material & {
      color?: THREE.Color;
      roughness?: number;
      metalness?: number;
      shadeColorFactor?: THREE.Color;
      shadingToonyFactor?: number;
      shadingShiftFactor?: number;
      outlineWidthMode?: string;
      outlineWidthFactor?: number;
      parametricRimFresnelPowerFactor?: number;
      needsUpdate: boolean;
    };
    if (snap.color && record.color instanceof THREE.Color) record.color.set(snap.color);
    if (typeof snap.roughness === 'number' && typeof record.roughness === 'number') {
      record.roughness = snap.roughness;
    }
    if (typeof snap.metalness === 'number' && typeof record.metalness === 'number') {
      record.metalness = snap.metalness;
    }
    if (snap.shadeColorFactor && record.shadeColorFactor instanceof THREE.Color) {
      record.shadeColorFactor.set(snap.shadeColorFactor);
    }
    if (typeof snap.shadingToonyFactor === 'number' && typeof record.shadingToonyFactor === 'number') {
      record.shadingToonyFactor = snap.shadingToonyFactor;
    }
    if (typeof snap.shadingShiftFactor === 'number' && typeof record.shadingShiftFactor === 'number') {
      record.shadingShiftFactor = snap.shadingShiftFactor;
    }
    if (typeof snap.outlineWidthMode === 'string' && typeof record.outlineWidthMode === 'string') {
      record.outlineWidthMode = snap.outlineWidthMode;
    }
    if (typeof snap.outlineWidthFactor === 'number' && typeof record.outlineWidthFactor === 'number') {
      record.outlineWidthFactor = snap.outlineWidthFactor;
    }
    if (
      typeof snap.parametricRimFresnelPowerFactor === 'number' &&
      typeof record.parametricRimFresnelPowerFactor === 'number'
    ) {
      record.parametricRimFresnelPowerFactor = snap.parametricRimFresnelPowerFactor;
    }
    record.needsUpdate = true;
  }
}
```

### src/infrastructure/character/avatar/mtoon-style-applier.ts:374

```ts
export function applyNeutralPreviewLights(scene: THREE.Scene, lights: MtoonStyleLights): void {
  const bg = '#10141c';
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 16, 36);
  lights.hemisphere.color.set('#e8eef6');
  lights.hemisphere.groundColor.set('#1c222c');
  lights.hemisphere.intensity = 0.42;
  lights.key.color.set('#fff6ea');
  lights.key.intensity = 0.95;
  lights.key.position.set(2.0, 3.8, 2.6);
  lights.fill.color.set('#d5dde8');
  lights.fill.intensity = 0.28;
  lights.fill.position.set(-2.2, 2.0, 1.8);
  lights.rim.color.set('#c8d0dc');
  lights.rim.intensity = 0.08;
  lights.rim.position.set(-1.0, 2.6, -3.0);
}
```

### src/infrastructure/character/avatar/rig-analyzer.ts:42

```ts
export function analyzeAvatarRigFromObject3D(
  root: THREE.Object3D,
  options: { vrm?: VRM; claimedProviderSuccess?: boolean } = {},
): AvatarRigAnalysisResult {
  // claimedProviderSuccess is intentionally ignored (fail-closed against client/provider lies).
  void options.claimedProviderSuccess;

  const mappedBones: Partial<Record<SagaTreeHumanoidBoneId, string>> = {};
  let boneCount = 0;
  let nodeCount = 0;
  let hasSkinnedMesh = false;
  let truncated = false;

  root.traverse((object) => {
    if (truncated) return;
    nodeCount += 1;
    if (nodeCount > RIG_ANALYSIS_MAX_NODES) {
      truncated = true;
      return;
    }
    if (object instanceof THREE.SkinnedMesh) {
      hasSkinnedMesh = true;
      const bones = object.skeleton?.bones ?? [];
      for (const bone of bones) {
        boneCount += 1;
        if (boneCount > RIG_ANALYSIS_MAX_BONES) {
          truncated = true;
          break;
        }
        const canonical = resolveCanonicalBoneId(bone.name);
        if (!canonical) continue;
        if (!mappedBones[canonical]) {
          mappedBones[canonical] = bone.name;
        }
      }
    }
    if (object instanceof THREE.Bone) {
      boneCount += 1;
      const canonical = resolveCanonicalBoneId(object.name);
      if (canonical && !mappedBones[canonical]) {
        mappedBones[canonical] = object.name;
      }
    }
  });

  const vrm = options.vrm;
  const hasVrmHumanoid = Boolean(vrm?.humanoid);
  if (vrm?.humanoid) {
    const humanoid = vrm.humanoid;
    const vrmMap: Array<[SagaTreeHumanoidBoneId, string]> = [
      ['hips', 'hips'],
      ['spine', 'spine'],
      ['chest', 'chest'],
      ['neck', 'neck'],
      ['head', 'head'],
      ['leftUpperArm', 'leftUpperArm'],
      ['leftLowerArm', 'leftLowerArm'],
      ['leftHand', 'leftHand'],
      ['rightUpperArm', 'rightUpperArm'],
      ['rightLowerArm', 'rightLowerArm'],
      ['rightHand', 'rightHand'],
      ['leftUpperLeg', 'leftUpperLeg'],
      ['leftLowerLeg', 'leftLowerLeg'],
      ['leftFoot', 'leftFoot'],
      ['rightUpperLeg', 'rightUpperLeg'],
      ['rightLowerLeg', 'rightLowerLeg'],
      ['rightFoot', 'rightFoot'],
    ];
    for (const [canonical, vrmBone] of vrmMap) {
      const node = humanoid.getNormalizedBoneNode(
        vrmBone as 'hips' | 'spine' | 'chest' | 'neck' | 'head' | 'leftUpperArm' | 'leftLowerArm' | 'leftHand' | 'rightUpperArm' | 'rightLowerArm' | 'rightHand' | 'leftUpperLeg' | 'leftLowerLeg' | 'leftFoot' | 'rightUpperLeg' | 'rightLowerLeg' | 'rightFoot',
      );
      if (node && !mappedBones[canonical]) {
        mappedBones[canonical] = node.name || vrmBone;
        boneCount = Math.max(boneCount, 1);
      }
    }
  }

  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3());
  const heightMeters = Math.max(size.y, 0.001);
  // Target ~1.7m adult; clamp extreme scales in capability layer.
  const scaleFactor = 1.7 / heightMeters;

  const capabilities = resolveAvatarRigCapabilities({
    boneCount,
    mappedBones,
    hasVrmHumanoid,
    hasSkinnedMesh,
    scaleFactor,
  });
  const limitations = truncated
    ? [
        ...capabilities.limitations,
        'Analyse abgebrochen (Knoten-/Knochen-Limit) — Ergebnis eingeschränkt.',
      ]
    : [...capabilities.limitations];
  const finalCapabilities = { ...capabilities, limitations };

  const rig: SagaTreeHumanoidRigV1 = {
    contractVersion: RIG_CONTRACT_VERSION,
    bones: mappedBones,
    anchors: deriveAnchors(mappedBones),
    upAxis: 'y',
    forwardAxis: 'z',
    unit: 'meter',
    scaleFactor: Math.min(20, Math.max(0.05, scaleFactor)),
  };

  const status = summarizeRigAnalysisStatus(finalCapabilities);
  const message =
    status === 'ready'
      ? 'Rig-Analyse abgeschlossen.'
      : status === 'limited'
        ? 'Rig erkannt — einige Fähigkeiten sind eingeschränkt.'
        : status === 'analyzing'
          ? 'Rig-Analyse läuft …'
          : 'Rig-Analyse fehlgeschlagen.';

  return { status, capabilities: finalCapabilities, rig, message };
}
```

### src/infrastructure/character/avatar/rig-bone-aliases.ts:11

```ts
export const BONE_ALIAS_TABLE: Readonly<Record<string, SagaTreeHumanoidBoneId>> = {
  // VRM / UniVRM
  hips: 'hips',
  j_hips: 'hips',
  spine: 'spine',
  j_spine: 'spine',
  chest: 'chest',
  j_chest: 'chest',
  upperchest: 'chest',
  neck: 'neck',
  j_neck: 'neck',
  head: 'head',
  j_head: 'head',
  leftupperarm: 'leftUpperArm',
  left_upper_arm: 'leftUpperArm',
  j_leftupperarm: 'leftUpperArm',
  leftlowerarm: 'leftLowerArm',
  left_lower_arm: 'leftLowerArm',
  lefthand: 'leftHand',
  left_hand: 'leftHand',
  rightupperarm: 'rightUpperArm',
  right_upper_arm: 'rightUpperArm',
  rightlowerarm: 'rightLowerArm',
  right_lower_arm: 'rightLowerArm',
  righthand: 'rightHand',
  right_hand: 'rightHand',
  leftupperleg: 'leftUpperLeg',
  left_upper_leg: 'leftUpperLeg',
  leftlowerleg: 'leftLowerLeg',
  left_lower_leg: 'leftLowerLeg',
  leftfoot: 'leftFoot',
  left_foot: 'leftFoot',
  rightupperleg: 'rightUpperLeg',
  right_upper_leg: 'rightUpperLeg',
  rightlowerleg: 'rightLowerLeg',
  right_lower_leg: 'rightLowerLeg',
  rightfoot: 'rightFoot',
  right_foot: 'rightFoot',
  // Mixamo / Blender
  'mixamorig:hips': 'hips',
  'mixamorig:spine': 'spine',
  'mixamorig:spine1': 'chest',
  'mixamorig:spine2': 'chest',
  'mixamorig:neck': 'neck',
  'mixamorig:head': 'head',
  'mixamorig:leftarm': 'leftUpperArm',
  'mixamorig:leftforearm': 'leftLowerArm',
  'mixamorig:lefthand': 'leftHand',
  'mixamorig:rightarm': 'rightUpperArm',
  'mixamorig:rightforearm': 'rightLowerArm',
  'mixamorig:righthand': 'rightHand',
  'mixamorig:leftupleg': 'leftUpperLeg',
  'mixamorig:leftleg': 'leftLowerLeg',
  'mixamorig:leftfoot': 'leftFoot',
  'mixamorig:rightupleg': 'rightUpperLeg',
  'mixamorig:rightleg': 'rightLowerLeg',
  'mixamorig:rightfoot': 'rightFoot',
  // Meshy / SkinTokens-ish
  pelvis: 'hips',
  hip: 'hips',
  torso: 'spine',
  chest_bone: 'chest',
  l_upperarm: 'leftUpperArm',
  l_forearm: 'leftLowerArm',
  l_hand: 'leftHand',
  r_upperarm: 'rightUpperArm',
  r_forearm: 'rightLowerArm',
  r_hand: 'rightHand',
  l_thigh: 'leftUpperLeg',
  l_calf: 'leftLowerLeg',
  l_foot: 'leftFoot',
  r_thigh: 'rightUpperLeg',
  r_calf: 'rightLowerLeg',
  r_foot: 'rightFoot',
  armature: 'root',
  root: 'root',
};
```

### src/infrastructure/character/avatar/rig-bone-aliases.ts:101

```ts
export function normalizeBoneName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}
```

### src/infrastructure/character/avatar/rig-bone-aliases.ts:105

```ts
export function shouldIgnoreBoneName(name: string): boolean {
  const n = normalizeBoneName(name);
  return IGNORE_SUBSTRINGS.some((token) => n.includes(token));
}
```

### src/infrastructure/character/avatar/rig-bone-aliases.ts:110

```ts
export function resolveCanonicalBoneId(sourceName: string): SagaTreeHumanoidBoneId | undefined {
  if (shouldIgnoreBoneName(sourceName)) return undefined;
  const key = normalizeBoneName(sourceName);
  return BONE_ALIAS_TABLE[key];
}
```

### src/infrastructure/character/avatar/rig-bone-aliases.ts:117

```ts
export const RIG_ANALYSIS_MAX_BONES = 512;
```

### src/infrastructure/character/avatar/rig-bone-aliases.ts:118

```ts
export const RIG_ANALYSIS_MAX_NODES = 4096;
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:8

```ts
export const TOONLAB_SPIKE_ID = 'toonlab-compatibility-spike' as const;
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:9

```ts
export const TOONLAB_SPIKE_PACKAGE = '@call-me-sensei/toonlab' as const;
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:10

```ts
export const TOONLAB_SPIKE_EVALUATED_VERSION = '0.5.0' as const;
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:12

```ts
export type ToonLabSpikeVerdict = 'GO' | 'BLOCKED';
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:14

```ts
export type ToonLabSpikeCheckId =
  | 'peer-three'
  | 'peer-three-vrm'
  | 'peer-react'
  | 'renderer-stack'
  | 'skinned-mesh'
  | 'morph-targets'
  | 'alpha-transparency'
  | 'pbr-maps'
  | 'animation-skeleton'
  | 'portrait-capture'
  | 'silent-upgrade';
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:27

```ts
export interface ToonLabSpikeHostVersions {
  three: string;
  threeVrm: string;
  react: string;
  avatarRenderer: 'WebGLRenderer' | 'WebGPURenderer' | 'unknown';
  materialPath: 'mtoon-glsl' | 'pbr' | 'tsl-node' | 'mixed';
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:35

```ts
export interface ToonLabSpikePeerRequirements {
  three: string;
  threeVrm: string;
  react: string;
  rendererDefault: 'WebGPURenderer';
  materialStack: 'TSL/NodeMaterial';
  glslPathRemoved: boolean;
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:45

```ts
export const SAGATREE_AVATAR_HOST_AT_SPIKE: ToonLabSpikeHostVersions = {
  three: '0.183.2',
  threeVrm: '3.5.1',
  react: '18.3.1',
  avatarRenderer: 'WebGLRenderer',
  materialPath: 'mtoon-glsl',
};
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:54

```ts
export const TOONLAB_PEERS_AT_SPIKE: ToonLabSpikePeerRequirements = {
  three: '^0.185.1',
  threeVrm: '^3.5.4',
  react: '^19.0.0',
  rendererDefault: 'WebGPURenderer',
  materialStack: 'TSL/NodeMaterial',
  glslPathRemoved: true,
};
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:63

```ts
export interface ToonLabSpikeFixtureAsset {
  id: string;
  kind: 'glb-pbr' | 'vrm-mtoon';
  relativePath: string;
  role: 'human-male-body' | 'human-male-vrm-face';
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:71

```ts
export const TOONLAB_SPIKE_FIXTURES: readonly ToonLabSpikeFixtureAsset[] = [
  {
    id: 'human-male-glb',
    kind: 'glb-pbr',
    relativePath: 'public/assets/avatars/species/human-male-quality-20260921-m5.glb',
    role: 'human-male-body',
  },
  {
    id: 'human-male-vrm',
    kind: 'vrm-mtoon',
    relativePath: 'public/assets/avatars/species/human-male-quality-20260921-m5-face1.vrm',
    role: 'human-male-vrm-face',
  },
];
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:86

```ts
export interface ToonLabSpikeCheckRow {
  id: ToonLabSpikeCheckId;
  label: string;
  pbrOrMtoonBaseline: 'pass' | 'fail' | 'n/a';
  toonLabPath: 'pass' | 'fail' | 'blocked' | 'n/a';
  notes: string;
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:94

```ts
export interface ToonLabSpikeFinding {
  id: string;
  severity: 'blocker' | 'risk' | 'info';
  detail: string;
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:100

```ts
export interface ToonLabSpikeDecision {
  verdict: ToonLabSpikeVerdict;
  packageName: typeof TOONLAB_SPIKE_PACKAGE;
  packageVersion: typeof TOONLAB_SPIKE_EVALUATED_VERSION;
  findings: ToonLabSpikeFinding[];
  matrix: ToonLabSpikeCheckRow[];
  /** Concrete path if a later ticket unblocks integration — never a silent upgrade. */
  minimalIntegrationPath: readonly string[];
  performanceRisks: readonly string[];
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:135

```ts
export function buildToonLabSpikeMatrix(
  host: ToonLabSpikeHostVersions = SAGATREE_AVATAR_HOST_AT_SPIKE,
  peers: ToonLabSpikePeerRequirements = TOONLAB_PEERS_AT_SPIKE,
): ToonLabSpikeCheckRow[] {
  const threeOk = satisfiesCaret(host.three, peers.three);
  const vrmOk = satisfiesCaret(host.threeVrm, peers.threeVrm);
  const reactOk = satisfiesCaret(host.react, peers.react);
  const rendererOk =
    host.avatarRenderer === 'WebGPURenderer' || host.materialPath === 'tsl-node';

  return [
    {
      id: 'peer-three',
      label: 'three peer range',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: threeOk ? 'pass' : 'blocked',
      notes: `host ${host.three} vs peer ${peers.three}`,
    },
    {
      id: 'peer-three-vrm',
      label: '@pixiv/three-vrm peer range',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: vrmOk ? 'pass' : 'blocked',
      notes: `host ${host.threeVrm} vs peer ${peers.threeVrm}`,
    },
    {
      id: 'peer-react',
      label: 'react peer (package declares; avatar runtime itself is React-free)',
      pbrOrMtoonBaseline: 'n/a',
      toonLabPath: reactOk ? 'pass' : 'blocked',
      notes: `host ${host.react} vs peer ${peers.react}`,
    },
    {
      id: 'renderer-stack',
      label: 'Renderer / material stack',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: rendererOk ? 'pass' : 'blocked',
      notes: `host ${host.avatarRenderer}+${host.materialPath}; ToonLab ${peers.rendererDefault}+${peers.materialStack}; GLSL removed=${peers.glslPathRemoved}`,
    },
    {
      id: 'skinned-mesh',
      label: 'SkinnedMesh / skeleton present on fixtures',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: threeOk && rendererOk ? 'pass' : 'blocked',
      notes: 'Fixtures are skinned; Toon apply path cannot run until renderer peers clear.',
    },
    {
      id: 'morph-targets',
      label: 'Morph targets / VRM expressions',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: threeOk && rendererOk ? 'pass' : 'blocked',
      notes: 'VRM fixture carries expression morphs; Toon conversion must not strip them — unverified until executable.',
    },
    {
      id: 'alpha-transparency',
      label: 'Alpha / cutout / transparency (hair)',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: 'blocked',
      notes: 'Risk called out by ToonLab docs for imported materials; blocked until TSL path runs on fixtures.',
    },
    {
      id: 'pbr-maps',
      label: 'BaseColor / Normal / MetallicRoughness bindings',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: 'blocked',
      notes: 'PBR maps inventory on GLB; ToonLab must preserve maps — not executable on current stack.',
    },
    {
      id: 'animation-skeleton',
      label: 'Animation / skeleton binding',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: 'blocked',
      notes: 'CharacterStudioRuntime animation path OK; ToonLab character retarget is separate and blocked by peers.',
    },
    {
      id: 'portrait-capture',
      label: 'Portrait capture parity (identical camera)',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: 'blocked',
      notes: 'PBR/MToon capture exists via mtoon-style-applier; Toon side-by-side capture requires WebGPU/TSL harness.',
    },
    {
      id: 'silent-upgrade',
      label: 'Silent three/renderer upgrade forbidden',
      pbrOrMtoonBaseline: 'pass',
      toonLabPath: 'fail',
      notes: 'Acceptance forbids silent renderer upgrades; unblocking needs an explicit version+regression PR.',
    },
  ];
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:226

```ts
export function evaluateToonLabCompatibilitySpike(
  host: ToonLabSpikeHostVersions = SAGATREE_AVATAR_HOST_AT_SPIKE,
  peers: ToonLabSpikePeerRequirements = TOONLAB_PEERS_AT_SPIKE,
): ToonLabSpikeDecision {
  const matrix = buildToonLabSpikeMatrix(host, peers);
  const findings: ToonLabSpikeFinding[] = [];

  if (!satisfiesCaret(host.three, peers.three)) {
    findings.push({
      id: 'three-peer-gap',
      severity: 'blocker',
      detail: `SagaTree three@${host.three} does not satisfy ToonLab peer ${peers.three}.`,
    });
  }
  if (!satisfiesCaret(host.threeVrm, peers.threeVrm)) {
    findings.push({
      id: 'vrm-peer-gap',
      severity: 'blocker',
      detail: `SagaTree @pixiv/three-vrm@${host.threeVrm} does not satisfy ToonLab peer ${peers.threeVrm}.`,
    });
  }
  if (!satisfiesCaret(host.react, peers.react)) {
    findings.push({
      id: 'react-peer-gap',
      severity: 'risk',
      detail: `Package peers react ${peers.react}; host is ${host.react}. Avatar runtime is React-free, but installing ToonLab as a dep still advertises the peer conflict.`,
    });
  }
  if (host.avatarRenderer !== 'WebGPURenderer' && host.materialPath !== 'tsl-node') {
    findings.push({
      id: 'renderer-mismatch',
      severity: 'blocker',
      detail:
        'CharacterStudioRuntime uses THREE.WebGLRenderer + MToon/GLSL. ToonLab 0.5 is TSL/NodeMaterial WebGPU-first with GLSL path removed — not a drop-in on the current avatar renderer.',
    });
  }
  findings.push({
    id: 'mtoon-parallel-path',
    severity: 'info',
    detail:
      'SagaTree already has an allowlisted MToon style profile. ToonLab must not silently replace that contract; Look runtime (#342) should keep provider-neutral adapters.',
  });

  const blockers = findings.filter((f) => f.severity === 'blocker');
  const verdict: ToonLabSpikeVerdict = blockers.length === 0 ? 'GO' : 'BLOCKED';

  return {
    verdict,
    packageName: TOONLAB_SPIKE_PACKAGE,
    packageVersion: TOONLAB_SPIKE_EVALUATED_VERSION,
    findings,
    matrix,
    minimalIntegrationPath: [
      'Open a dedicated version-bump PR: three ≥ 0.185.1 and @pixiv/three-vrm ≥ 3.5.4 with LiveAct/avatar regression suite green — no silent bump inside a Look feature PR.',
      'Add an isolated Look preview surface using WebGPURenderer (or documented TSL WebGL2 fallback), leaving CharacterStudioRuntime on WebGL/MToon until proven.',
      'Introduce provider-neutral Look runtime adapter (#342) that calls applyToonShader only behind LookExecutionMode; never import ToonLab types into domains/look.',
      'Re-run this spike harness with side-by-side portrait capture on human-male GLB + VRM fixtures (identical camera) before declaring GO.',
      'Gate alpha/hair and morph-target regressions explicitly; fail closed if maps or morphs are dropped.',
    ],
    performanceRisks: [
      'WebGPU/TSL path + outline/post passes may exceed mobile GPU budget vs current MToon performance presets.',
      'Dual renderer maintenance (WebGL CharacterStudio + WebGPU Look preview) increases bundle and QA surface.',
      'three minor bump (183 → 185+) can regress VRM/MToon and LiveAct face retarget — requires full avatar gate before merge.',
    ],
  };
}
```

### src/infrastructure/character/avatar/toonlab-compatibility-spike.ts:293

```ts
export function assertToonLabSpikeInvariants(decision: ToonLabSpikeDecision = evaluateToonLabCompatibilitySpike()): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (decision.verdict !== 'BLOCKED' && decision.verdict !== 'GO') {
    issues.push('verdict must be GO or BLOCKED');
  }
  if (decision.matrix.length < 8) issues.push('matrix incomplete');
  if (!decision.minimalIntegrationPath.length) issues.push('missing integration path');
  if (decision.verdict === 'BLOCKED' && !decision.findings.some((f) => f.severity === 'blocker')) {
    issues.push('BLOCKED without blocker findings');
  }
  if (TOONLAB_SPIKE_FIXTURES.length < 2) issues.push('need glb + vrm fixtures');
  return { ok: issues.length === 0, issues };
}
```

### src/infrastructure/character/avatar/trait-asset-allowlist.ts:16

```ts
export type TraitAssetKey = `trait:${AvatarTraitGroupId}:${string}`;
```

### src/infrastructure/character/avatar/trait-asset-allowlist.ts:18

```ts
export function toTraitAssetKey(
  groupId: AvatarTraitGroupId,
  traitId: string,
): TraitAssetKey | undefined {
  const trimmed = traitId.trim();
  if (!isAllowedTraitId(groupId, trimmed)) return undefined;
  return `trait:${groupId}:${trimmed}`;
}
```

### src/infrastructure/character/avatar/trait-asset-allowlist.ts:27

```ts
export function parseTraitAssetKey(
  assetKey: string,
): { groupId: AvatarTraitGroupId; traitId: string } | undefined {
  const match = /^trait:(head|ears|hair|clothing|accessory):([a-z0-9-]+)$/.exec(assetKey.trim());
  if (!match) return undefined;
  const groupId = match[1] as AvatarTraitGroupId;
  const traitId = match[2];
  if (!isAllowedTraitId(groupId, traitId)) return undefined;
  return { groupId, traitId };
}
```

### src/infrastructure/character/avatar/trait-asset-allowlist.ts:38

```ts
export function resolveTraitDisplayName(
  groupId: AvatarTraitGroupId,
  traitId: string,
): string {
  return getTraitOption(groupId, traitId)?.label ?? traitId;
}
```

### src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts:16

```ts
export interface TraitGpuHandle {
  root: THREE.Object3D;
}
```

### src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts:20

```ts
export interface TraitLifecycleThreeAdapter {
  port: TraitLifecyclePort;
  /** Attach a freshly loaded root for an instance; no-op when generation is stale. */
  attachLoadedRoot(
    instanceId: string,
    generation: number,
    root: THREE.Object3D,
  ): boolean;
  getAttachedRoot(instanceId: string): THREE.Object3D | undefined;
  dispose(): void;
}
```

### src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts:37

```ts
export function disposeObject3DTreeOnce(
  root: THREE.Object3D,
  disposedRoots: WeakSet<THREE.Object3D>,
): void {
  if (disposedRoots.has(root)) return;
  disposedRoots.add(root);

  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) {
      object.skeleton?.boneInverses?.splice(0);
      // Skeleton bone arrays are owned by the skinned mesh graph; geometry/materials below.
    }
    if (object instanceof THREE.Mesh) {
      object.geometry?.dispose();
      for (const material of materialsOf(object)) {
        material.dispose();
      }
    }
  });

  if (root.parent) root.parent.remove(root);
}
```

### src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts:64

```ts
export function createTraitLifecycleThreeAdapter(
  overlayParent: THREE.Object3D,
): TraitLifecycleThreeAdapter {
  const gpuByInstance = new Map<string, TraitGpuHandle>();
  const disposedRoots = new WeakSet<THREE.Object3D>();

  const port = createTraitLifecycleRegistry({
    onDisposeInstance(instance: CharacterTraitInstance) {
      const handle = gpuByInstance.get(instance.instanceId);
      if (!handle) return;
      disposeObject3DTreeOnce(handle.root, disposedRoots);
      gpuByInstance.delete(instance.instanceId);
    },
  });

  return {
    port,
    attachLoadedRoot(instanceId, generation, root) {
      if (!port.commitAsyncLoad(instanceId, generation)) {
        disposeObject3DTreeOnce(root, disposedRoots);
        return false;
      }
      const previous = gpuByInstance.get(instanceId);
      if (previous) {
        disposeObject3DTreeOnce(previous.root, disposedRoots);
      }
      overlayParent.add(root);
      gpuByInstance.set(instanceId, { root });
      return true;
    },
    getAttachedRoot(instanceId) {
      return gpuByInstance.get(instanceId)?.root;
    },
    dispose() {
      for (const groupId of port.listOverlays().map((o) => o.groupId)) {
        port.removeOverlay(groupId);
      }
      for (const [instanceId, handle] of [...gpuByInstance.entries()]) {
        disposeObject3DTreeOnce(handle.root, disposedRoots);
        gpuByInstance.delete(instanceId);
      }
    },
  };
}
```

### src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts:113

```ts
export function toCharacterTraitManifest(input: {
  format: 'vrm' | 'glb';
  groups: readonly {
    id: string;
    name: string;
    required: boolean;
    initial: boolean;
    assets: readonly { id: string; name: string; modelUrl: string }[];
  }[];
}): import('../../../domains/character/avatar').CharacterTraitManifest {
  return {
    format: input.format,
    groups: input.groups.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      initial: group.initial,
      assets: group.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        assetKey: asset.modelUrl,
      })),
    })),
  };
}
```

### src/infrastructure/character/character-adventure-arc-service.ts:255

```ts
export const characterAdventureArcService = new CharacterAdventureArcService();
```

### src/infrastructure/character/character-lore-service.ts:106

```ts
export const characterLoreService = new CharacterLoreService();
```

### src/infrastructure/character/character-preset-service.ts:58

```ts
export function assertValidSnapshot(snapshot: CharacterPresetSnapshot): void {
  if (snapshot.schemaVersion !== 1) {
    throw new Error('Ungültiger Preset-Snapshot (Schema).');
  }
  if (snapshot.ruleset_key !== 'sagatree-core') {
    throw new Error('Presets sind derzeit nur für SagaTree Core verfügbar.');
  }
  if (!snapshot.name.trim()) {
    throw new Error('Preset-Snapshot braucht einen Charakternamen.');
  }
  if (!isGenderReading(snapshot.appearance?.gender_reading)) {
    throw new Error('Preset-Snapshot braucht eine gültige Geschlechts-Lesart.');
  }
  const level = snapshot.level;
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error('Preset-Level muss zwischen 1 und 20 liegen.');
  }

  const profile = snapshot.sagatree_profile;
  if (!profile) {
    throw new Error('Preset-Snapshot braucht ein SagaTree-Profil.');
  }
  if (!isSagaTreeEssenceKey(profile.essence)) {
    throw new Error('Preset-Snapshot braucht eine Essenz.');
  }

  const bg = profile.background;
  if (!bg?.name?.trim()) {
    throw new Error('Preset-Snapshot: Hintergrund braucht einen Namen.');
  }
  if (![bg.milieuAccess, bg.contact, bg.complication, bg.communication].every((field) => typeof field === 'string' && field.trim())) {
    throw new Error('Preset-Snapshot: Hintergrund-Felder (Milieu/Kontakt/Komplikation/Kommunikation) unvollständig.');
  }

  const traitKeys = (profile.speciesTraitInstances ?? []).map((instance) => instance.trait);
  if (getSagaTreeSpeciesTraitCost(traitKeys) !== SAGA_TREE_SPECIES_TRAIT_BUDGET) {
    throw new Error(`Preset-Snapshot: Speziesmerkmale müssen genau ${SAGA_TREE_SPECIES_TRAIT_BUDGET} Punkte ergeben.`);
  }
  if (snapshot.race === 'alien' && !profile.speciesProfile?.name?.trim()) {
    throw new Error('Preset-Snapshot: Alien-Speziesprofil braucht einen Namen.');
  }
  if (!profile.baseAttributes) {
    throw new Error('Preset-Snapshot: baseAttributes fehlen.');
  }

  assertValidSagaTreeCharacterPersistence(snapshot.attributes, snapshot.skills, profile, level);
}
```

### src/infrastructure/character/character-preset-service.ts:401

```ts
export const characterPresetService = new CharacterPresetService();
```

### src/infrastructure/character/character-service.ts:26

```ts
export type UploadPortraitOptions = {
  /**
   * When true, skip client optimize (caller already ran character-portrait intake).
   * Storage MIME/magic-byte/owner checks still run in the repository.
   */
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/character/character-service.ts:39

```ts
export async function prepareCharacterPortraitFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  // Lazy import keeps the WebP Worker out of the service module graph until prepare runs.
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'character-portrait',
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Portrait-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'portrait';
    const ext = result.outputMimeType === 'image/webp' ? 'webp' : 'bin';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Portrait-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Portrait-Optimierung fehlgeschlagen.';
  throw new Error(message);
}
```

### src/infrastructure/character/character-service.ts:268

```ts
export const characterService = new CharacterService();
```

### src/infrastructure/character/character.persistence.ts:16

```ts
export interface CharacterDto {
  id: string;
  /** Immutable public character id (CH-XXXXX). */
  public_id?: string;
  owner_user_id: string;
  world_id?: string;
  project_id?: string;
  parent_character_id?: string;
  character_type: 'pc' | 'npc' | 'companion' | 'monster' | 'gm_presence';
  ruleset_id?: string;
  ruleset_key?: CharacterRulesetKey;
  name: string;
  description: string;
  class: string;
  race: string;
  level: number;
  background_story?: string;
  dnd_background?: string | null;
  notes?: string | null;
  appearance: CharacterAppearanceDto;
  portrait_url?: string;
  token_url?: string;
  attributes: CharacterAttributeStorageDto;
  derived_stats?: Record<string, unknown>;
  skills?: Partial<Record<SagaTreeSkillKey, number>>;
  proficiencies?: string[];
  languages?: string[];
  hp_current?: number;
  hp_max?: number;
  armor_class?: number;
  initiative_bonus?: number;
  speed?: number;
  resources?: Record<string, unknown>;
  conditions?: string[];
  /** Canonical SagaTree Core profile column (073+). */
  sagatree_profile?: Partial<SagaTreeProfileDto> | null;
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  abilities: AbilityDto[];
  inventory: ItemDto[];
  /** Present when inventory_schema_version === 2; authoritative Inventory v2 state. */
  inventory_v2?: unknown | null;
  inventory_schema_version?: 1 | 2;
  emotion_profiles: EmotionProfileDto[];
  /** complete | incomplete — drafts may skip full SagaTree build asserts. */
  sheet_status?: 'complete' | 'incomplete';
  is_marketplace_item?: boolean;
  downloads_count?: number;
  rating?: number;
  created_at: string;
  updated_at: string;
}
```

### src/infrastructure/character/liveact/face-anchors-manifest-url.ts:24

```ts
export function listFaceAnchorsManifestUrlCandidates(modelUrl: string): string[] {
  const trimmed = modelUrl.trim();
  if (!trimmed) return [];
  try {
    const base =
      typeof globalThis !== 'undefined' && 'location' in globalThis
        ? globalThis.location.href
        : 'http://localhost/';
    const url = new URL(trimmed, base);
    // Keep search for cache-bust consistency; drop hash (fragment is never fetched).
    url.hash = '';
    const cacheBustSearch = url.search;
    const path = url.pathname;
    const slash = path.lastIndexOf('/');
    if (slash < 0) return [];
    const dir = path.slice(0, slash + 1);
    const stem = modelStemFromPathname(path);
    const out: string[] = [];
    if (stem) {
      url.pathname = `${dir}${stem}-face-anchors.json`;
      url.search = cacheBustSearch;
      out.push(url.href);
    }
    url.pathname = `${dir}face-anchors.json`;
    url.search = cacheBustSearch;
    out.push(url.href);
    return out;
  } catch {
    return [];
  }
}
```

### src/infrastructure/character/liveact/face-anchors-manifest-url.ts:57

```ts
export function resolveFaceAnchorsManifestUrlFromModelUrl(modelUrl: string): string | null {
  const candidates = listFaceAnchorsManifestUrlCandidates(modelUrl);
  return candidates[0] ?? null;
}
```

### src/infrastructure/character/liveact/gltf-liveact-avatar-output.ts:42

```ts
export interface GltfLiveActAvatarOutputDeps {
  root: THREE.Object3D;
  headBone: THREE.Object3D | null;
  headRestQuaternion: THREE.Quaternion;
  headScratchEuler: THREE.Euler;
  headScratchQuaternion: THREE.Quaternion;
}
```

### src/infrastructure/character/liveact/gltf-liveact-avatar-output.ts:50

```ts
export class GltfLiveActAvatarOutput implements LiveActAvatarOutput {
  private readonly morphIndex: LiveActMorphTargetIndex;
  private readonly resolved: Readonly<Partial<Record<LiveActFaceChannelId, string>>>;
  private readonly faceSupported: ReadonlySet<LiveActFaceChannelId>;
  private readonly avatarCapabilities: LiveActAvatarCapabilities;
  private readonly leftEyeBone: THREE.Object3D | null;
  private readonly rightEyeBone: THREE.Object3D | null;
  private readonly leftEyeRest = new THREE.Quaternion();
  private readonly rightEyeRest = new THREE.Quaternion();
  private readonly gazePath: LiveActGazeDrivePath;
  private readonly performanceFaceReport: PerformanceFaceValidationReportV1;
  private disposed = false;
  private applied: LiveActDiagnosticsV2AppliedValues = createUnavailableLiveActAppliedValues();

  constructor(private readonly deps: GltfLiveActAvatarOutputDeps) {
    this.morphIndex = buildLiveActMorphTargetIndex(deps.root);
    const present = listLiveActMorphTargetNames(this.morphIndex);
    const resolution = resolveLiveActChannelTargets(present);
    this.resolved = resolution.resolvedNames;

    const eyes = resolveLiveActEyeBones(deps.root);
    this.leftEyeBone = eyes.left;
    this.rightEyeBone = eyes.right;
    if (this.leftEyeBone) this.leftEyeRest.copy(this.leftEyeBone.quaternion);
    if (this.rightEyeBone) this.rightEyeRest.copy(this.rightEyeBone.quaternion);

    const hasEyeLookMorphs = LIVEACT_FACE_CHANNELS.some(
      (id) => isLiveActEyeLookFaceChannel(id) && Boolean(this.resolved[id]),
    );
    this.gazePath = resolveLiveActGazeDrivePath({
      hasEyeBones: Boolean(this.leftEyeBone && this.rightEyeBone),
      hasLookAt: false,
      hasEyeLookMorphs,
    });
    const skipEyeLook = liveActGazePathSkipsEyeLookMorphs(this.gazePath);
    this.faceSupported = new Set(
      LIVEACT_FACE_CHANNELS.filter((id) => {
        if (!this.resolved[id]) return false;
        if (skipEyeLook && isLiveActEyeLookFaceChannel(id)) return false;
        return true;
      }),
    );

    this.avatarCapabilities = createLiveActAvatarCapabilities({
      headBone: Boolean(deps.headBone),
      leftEyeBone: Boolean(this.leftEyeBone),
      rightEyeBone: Boolean(this.rightEyeBone),
      avatarFace: resolution.faceSupport,
      gazeDrivePath: this.gazePath,
      runtimeKind: 'gltf',
    });
    const arkitPresentChannels = LIVEACT_FACE_CHANNELS.filter(
      (id) => resolution.faceSupport[id],
    );
    this.performanceFaceReport = validatePerformanceFaceV2({
      presentTargetNames: present,
      hasHumanoid: Boolean(deps.headBone),
      hasHead: Boolean(deps.headBone),
      gazeDrivePath: this.gazePath,
      arkitPresentChannels,
    });
    this.recordNeutralApplied();
  }

  getAvatarCapabilities(): LiveActAvatarCapabilities {
    return this.avatarCapabilities;
  }

  getPerformanceFaceReport(): PerformanceFaceValidationReportV1 {
    return this.performanceFaceReport;
  }

  applyPerformanceFaceWeights(
    weights: Readonly<Partial<Record<PerformanceFaceControlId, number>>>,
  ): void {
    if (this.disposed || !this.performanceFaceReport.premiumEligible) return;
    writePerformanceFaceWeights({
      writeWeight: (targetName, weight) => {
        const bindings = this.morphIndex.get(targetName);
        if (!bindings?.length) return;
        for (const binding of bindings) {
          const influences = binding.mesh.morphTargetInfluences;
          if (!influences) continue;
          influences[binding.index] = weight;
        }
      },
      resolvedNames: this.performanceFaceReport.resolvedTargetNames,
      weights,
    });
  }

  getAppliedDiagnostics(): LiveActDiagnosticsV2AppliedValues {
    return this.applied;
  }

  applyLiveActFrame(frame: LiveActFrameV1): void {
    if (this.disposed || frame.trackingLost) {
      this.resetLiveActPose();
      return;
    }

    applyLiveActHeadRotation(
      this.deps.headBone,
      this.deps.headRestQuaternion,
      frame.head,
      this.deps.headScratchEuler,
      this.deps.headScratchQuaternion,
    );
    const usePoseGaze = liveActGazePathUsesPoseDriver(this.gazePath);
    if (usePoseGaze) {
      applyLiveActEyeBoneGaze(
        this.leftEyeBone,
        this.rightEyeBone,
        this.leftEyeRest,
        this.rightEyeRest,
        frame.eyeLeft,
        frame.eyeRight,
        this.deps.headScratchEuler,
        this.deps.headScratchQuaternion,
      );
    } else {
      resetLiveActEyeBoneGaze(
        this.leftEyeBone,
        this.rightEyeBone,
        this.leftEyeRest,
        this.rightEyeRest,
      );
    }

    const skipEyeLook = liveActGazePathSkipsEyeLookMorphs(this.gazePath);
    const faceApplied: Partial<Record<LiveActFaceChannelId, number>> = {};
    for (const id of LIVEACT_FACE_CHANNELS) {
      const targetName = this.resolved[id];
      if (!targetName) continue;
      if (skipEyeLook && isLiveActEyeLookFaceChannel(id)) {
        // Keep morphs at neutral when bones own gaze (#403 exclusivity).
        const bindings = this.morphIndex.get(targetName);
        if (bindings?.length) {
          for (const binding of bindings) {
            const influences = binding.mesh.morphTargetInfluences;
            if (!influences) continue;
            influences[binding.index] = 0;
          }
        }
        continue;
      }
      const bindings = this.morphIndex.get(targetName);
      if (!bindings?.length) continue;
      const weight = clampLiveActChannel(frame.face[id]);
      for (const binding of bindings) {
        const influences = binding.mesh.morphTargetInfluences;
        if (!influences) continue;
        influences[binding.index] = weight;
      }
      faceApplied[id] = weight;
    }

    this.applied = buildLiveActAppliedValuesFromFace({
      headSupported: Boolean(this.deps.headBone),
      eyeLeftSupported: usePoseGaze && Boolean(this.leftEyeBone),
      eyeRightSupported: usePoseGaze && Boolean(this.rightEyeBone),
      faceSupported: this.faceSupported,
      face: faceApplied,
      head: frame.head,
      eyeLeft: frame.eyeLeft,
      eyeRight: frame.eyeRight,
      mode: 'driven',
    });
  }

  resetLiveActPose(): void {
    resetLiveActHeadRotation(this.deps.headBone, this.deps.headRestQuaternion);
    resetLiveActEyeBoneGaze(
      this.leftEyeBone,
      this.rightEyeBone,
      this.leftEyeRest,
      this.rightEyeRest,
    );
    for (const id of LIVEACT_FACE_CHANNELS) {
      const targetName = this.resolved[id];
      if (!targetName) continue;
      const bindings = this.morphIndex.get(targetName);
      if (!bindings?.length) continue;
      const neutral = id === '_neutral' ? 1 : 0;
      for (const binding of bindings) {
        const influences = binding.mesh.morphTargetInfluences;
        if (!influences) continue;
        influences[binding.index] = neutral;
      }
    }
    this.recordNeutralApplied();
  }

  dispose(): void {
    this.disposed = true;
    this.resetLiveActPose();
    this.applied = createUnavailableLiveActAppliedValues();
  }

  private recordNeutralApplied(): void {
    const face: Partial<Record<LiveActFaceChannelId, number>> = {};
    for (const id of this.faceSupported) {
      face[id] = id === '_neutral' ? 1 : 0;
    }
    const usePoseGaze = liveActGazePathUsesPoseDriver(this.gazePath);
    this.applied = buildLiveActAppliedValuesFromFace({
      headSupported: Boolean(this.deps.headBone),
      eyeLeftSupported: usePoseGaze && Boolean(this.leftEyeBone),
      eyeRightSupported: usePoseGaze && Boolean(this.rightEyeBone),
      faceSupported: this.faceSupported,
      face,
      head: { yaw: 0, pitch: 0, roll: 0 },
      eyeLeft: { x: 0, y: 0 },
      eyeRight: { x: 0, y: 0 },
      mode: 'neutral',
    });
  }
}
```

### src/infrastructure/character/liveact/liveact-avatar-output.ts:21

```ts
export interface LiveActAvatarOutput {
  applyLiveActFrame(frame: LiveActFrameV1): void;
  resetLiveActPose(): void;
  /** Asset/bone/morph support only — never camera/input flags (#381). */
  getAvatarCapabilities(): LiveActAvatarCapabilities;
  /**
   * Read-only APPLIED stage for Diagnostics V2 (#397).
   * Reflects values actually written by the last apply/reset — not desired retarget.
   */
  getAppliedDiagnostics(): LiveActDiagnosticsV2AppliedValues;
  /** Performance Face V2 bind-time report (#450) — Premium gaps never block bind. */
  getPerformanceFaceReport(): PerformanceFaceValidationReportV1;
  /** Apply Premium PerformanceFace weights when asset is Premium-eligible (#451). */
  applyPerformanceFaceWeights(
    weights: Readonly<Partial<Record<PerformanceFaceControlId, number>>>,
  ): void;
  dispose(): void;
}
```

### src/infrastructure/character/liveact/liveact-avatar-output.ts:40

```ts
export interface CreateLiveActAvatarOutputInput {
  root: THREE.Object3D;
  vrm: VRM | undefined;
  headBone: THREE.Object3D | null;
  headRestQuaternion: THREE.Quaternion;
  headScratchEuler: THREE.Euler;
  headScratchQuaternion: THREE.Quaternion;
}
```

### src/infrastructure/character/liveact/liveact-avatar-output.ts:49

```ts
export function createLiveActAvatarOutput(
  input: CreateLiveActAvatarOutputInput,
): LiveActAvatarOutput | null {
  if (input.vrm) {
    return new VrmLiveActAvatarOutput({
      vrm: input.vrm,
      headBone: input.headBone,
      headRestQuaternion: input.headRestQuaternion,
      headScratchEuler: input.headScratchEuler,
      headScratchQuaternion: input.headScratchQuaternion,
    });
  }
  return new GltfLiveActAvatarOutput({
    root: input.root,
    headBone: input.headBone,
    headRestQuaternion: input.headRestQuaternion,
    headScratchEuler: input.headScratchEuler,
    headScratchQuaternion: input.headScratchQuaternion,
  });
}
```

### src/infrastructure/character/liveact/liveact-camera-claim.ts:8

```ts
export type LiveActCameraClaimStoppable = {
  stop(): void;
};
```

### src/infrastructure/character/liveact/liveact-camera-claim.ts:14

```ts
export function claimLiveActCamera(owner: LiveActCameraClaimStoppable): void {
  if (activeClaim && activeClaim !== owner) {
    activeClaim.stop();
  }
  activeClaim = owner;
}
```

### src/infrastructure/character/liveact/liveact-camera-claim.ts:21

```ts
export function releaseLiveActCamera(owner: LiveActCameraClaimStoppable): void {
  if (activeClaim === owner) {
    activeClaim = null;
  }
}
```

### src/infrastructure/character/liveact/liveact-camera-claim.ts:27

```ts
export function getActiveLiveActCameraClaim(): LiveActCameraClaimStoppable | null {
  return activeClaim;
}
```

### src/infrastructure/character/liveact/liveact-character-face-debug.ts:18

```ts
export interface LiveActCharacterFaceScreenPoint {
  readonly x: number;
  readonly y: number;
}
```

### src/infrastructure/character/liveact/liveact-character-face-debug.ts:23

```ts
export interface LiveActCharacterFaceDebugContours {
  readonly lips: readonly LiveActCharacterFaceScreenPoint[];
  readonly leftEye: readonly LiveActCharacterFaceScreenPoint[];
  readonly rightEye: readonly LiveActCharacterFaceScreenPoint[];
  readonly leftEyebrow: readonly LiveActCharacterFaceScreenPoint[];
  readonly rightEyebrow: readonly LiveActCharacterFaceScreenPoint[];
}
```

### src/infrastructure/character/liveact/liveact-character-face-debug.ts:31

```ts
export interface LiveActCharacterFaceDebugSnapshot {
  readonly available: boolean;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly contours: LiveActCharacterFaceDebugContours | null;
  /** Individual projected anchors (partial maps still draw). */
  readonly points: Readonly<Partial<Record<SagaTreeFaceAnchorId, LiveActCharacterFaceScreenPoint>>>;
  readonly metrics: LiveActFaceMetricsV1;
}
```

### src/infrastructure/character/liveact/liveact-character-face-debug.ts:42

```ts
export const LIVEACT_CHARACTER_FACE_OVERLAY_ANCHOR_IDS = [
  'mouthUpper',
  'mouthLower',
  'mouthCornerLeft',
  'mouthCornerRight',
  'eyeLeftInner',
  'eyeLeftOuter',
  'eyeLeftUpper',
  'eyeLeftLower',
  'eyeRightInner',
  'eyeRightOuter',
  'eyeRightUpper',
  'eyeRightLower',
  'browLeftInner',
  'browLeftCenter',
  'browLeftOuter',
  'browRightInner',
  'browRightCenter',
  'browRightOuter',
] as const satisfies readonly SagaTreeFaceAnchorId[];
```

### src/infrastructure/character/liveact/liveact-character-face-debug.ts:64

```ts
export interface LiveActCharacterFaceDebugHandle {
  /** In-place snapshot updated by {@link sample}. */
  readonly snapshot: LiveActCharacterFaceDebugSnapshot;
  sample(): void;
  isMappingAvailable(): boolean;
}
```

### src/infrastructure/character/liveact/liveact-character-face-debug.ts:71

```ts
export interface LiveActCharacterFaceDebugController {
  bindModelRoot(root: THREE.Object3D | null): void;
  bindManifest(manifest: SagaTreeFaceAnchorsManifestV1 | null): void;
  /** Currently bound manifest (session-local; may be null). */
  getManifest(): SagaTreeFaceAnchorsManifestV1 | null;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  isMappingAvailable(): boolean;
  getHandle(): LiveActCharacterFaceDebugHandle;
  /** Hide overlay sampling during portrait capture (no WebGL side effects). */
  runWithoutSampling<T>(fn: () => T): T;
  dispose(): void;
}
```

### src/infrastructure/character/liveact/liveact-character-face-debug.ts:183

```ts
export function createLiveActCharacterFaceDebugController(deps: {
  camera: THREE.PerspectiveCamera;
  getCanvasSize: () => { width: number; height: number };
}): LiveActCharacterFaceDebugController {
  let modelRoot: THREE.Object3D | null = null;
  let manifest: SagaTreeFaceAnchorsManifestV1 | null = null;
  let enabled = false;
  let suppressSampling = false;

  let snapshot: LiveActCharacterFaceDebugSnapshot = {
    available: false,
    canvasWidth: 1,
    canvasHeight: 1,
    contours: null,
    points: {},
    metrics: EMPTY_METRICS,
  };

  const handle: LiveActCharacterFaceDebugHandle = {
    get snapshot() {
      return snapshot;
    },
    sample() {
      if (suppressSampling || !enabled || !modelRoot || !manifest) {
        const { width, height } = deps.getCanvasSize();
        snapshot = {
          available: false,
          canvasWidth: width,
          canvasHeight: height,
          contours: null,
          points: {},
          metrics: EMPTY_METRICS,
        };
        return;
      }

      const { width, height } = deps.getCanvasSize();
      const evaluated = evaluateFaceAnchorsManifest(modelRoot, manifest);

      const screen: Partial<Record<SagaTreeFaceAnchorId, LiveActCharacterFaceScreenPoint>> = {};
      for (const id of OVERLAY_POINT_IDS) {
        const ev = evaluated.evaluations[id];
        if (!ev || ev.status !== 'available') continue;
        const projected = projectWorldToCanvas(
          deps.camera,
          ev.x,
          ev.y,
          ev.z,
          width,
          height,
        );
        if (projected) screen[id] = projected;
      }

      const pointCount = Object.keys(screen).length;
      if (pointCount === 0) {
        snapshot = {
          available: false,
          canvasWidth: width,
          canvasHeight: height,
          contours: null,
          points: {},
          metrics: EMPTY_METRICS,
        };
        return;
      }

      const contours = buildContours(screen);

      const normalized: Partial<Record<SagaTreeFaceAnchorId, LiveActFaceLandmark2d>> = {};
      for (const id of LIVEACT_CHARACTER_FACE_OVERLAY_ANCHOR_IDS) {
        const pt = screen[id];
        if (pt) normalized[id] = toNormalizedLandmark(pt, width, height);
      }
      const landmarks = buildLiveActFaceLandmarksFromAnchorScreenPoints(normalized);
      const metrics = computeLiveActFaceMetrics(landmarks);

      snapshot = {
        available: true,
        canvasWidth: width,
        canvasHeight: height,
        contours,
        points: screen,
        metrics,
      };
    },
    isMappingAvailable() {
      return Boolean(manifest && modelRoot);
    },
  };

  return {
    bindModelRoot(root) {
      modelRoot = root;
    },
    bindManifest(next) {
      manifest = next;
    },
    getManifest() {
      return manifest;
    },
    setEnabled(next) {
      enabled = next;
    },
    isEnabled() {
      return enabled;
    },
    isMappingAvailable() {
      return handle.isMappingAvailable();
    },
    getHandle() {
      return handle;
    },
    runWithoutSampling(fn) {
      suppressSampling = true;
      try {
        return fn();
      } finally {
        suppressSampling = false;
      }
    },
    dispose() {
      enabled = false;
      modelRoot = null;
      manifest = null;
      snapshot = {
        available: false,
        canvasWidth: 1,
        canvasHeight: 1,
        contours: null,
        points: {},
        metrics: EMPTY_METRICS,
      };
    },
  };
}
```

### src/infrastructure/character/liveact/liveact-engine.ts:106

```ts
export type LiveActCalibrationStatus = 'idle' | 'running' | 'success' | 'failed';
```

### src/infrastructure/character/liveact/liveact-engine.ts:108

```ts
export interface LiveActCalibrationResult {
  ok: boolean;
  messageDe: string;
  /**
   * Premium V2 only: whether device-local profile persistence succeeded.
   * `false` = capture applied for this session only (no false “gespeichert”).
   */
  persisted?: boolean;
}
```

### src/infrastructure/character/liveact/liveact-engine.ts:118

```ts
export interface LiveActEngineState {
  status: LiveActStatus;
  message: string;
  frame: LiveActFrameV1 | null;
  fpsCap: number;
  qualityProfileId: LiveActQualityProfile['id'];
  qualityProfileLabelDe: string;
  calibrationStatus: LiveActCalibrationStatus;
  calibrationMessage: string;
  hasNeutralBaseline: boolean;
  /** Max pass succeeded — at least one face channel carries a range gain. */
  hasRangeCalibration: boolean;
  /** True while review phase — Weiter / Fertig unlocked. */
  canAdvanceCalibration: boolean;
  /** Label for the advance control while in review; null otherwise. */
  calibrationAdvanceLabelDe: 'Weiter' | 'Fertig' | null;
  /** armed = wait for Start; holding = countdown; review = show peaks. Null outside range steps. */
  calibrationStepPhase: LiveActRangeStepPhase | null;
  /** True when Start is available for the current expression. */
  canStartCalibrationHold: boolean;
  /** True when Wiederholen is available (review). */
  canRetryCalibrationHold: boolean;
  /** Peak RAW values for the focus channels of the current step (after hold). */
  calibrationStepPeaks: readonly LiveActCalibrationStepPeakV1[];
  /**
   * Whole seconds left in the current hold (neutral or holding). Null when not counting down.
   */
  calibrationCountdownSec: number | null;
  /** Premium Personal Calibration V2 (#449) in progress. */
  personalCalibrationActive: boolean;
  /** Current V2 phase label (DE), null when inactive. */
  personalCalibrationPhaseLabelDe: string | null;
  /** True when Skip is available for the current V2 phase. */
  canSkipPersonalCalibrationPhase: boolean;
  /** Valid local Profile V2 loaded or just captured. */
  hasPersonalCalibrationProfile: boolean;
  /** Inference ticks dropped due to in-flight backpressure (UI-throttled metric). */
  droppedInferenceFrames: number;
}
```

### src/infrastructure/character/liveact/liveact-engine.ts:158

```ts
export type LiveActStatusListener = (state: LiveActEngineState) => void;
```

### src/infrastructure/character/liveact/liveact-engine.ts:159

```ts
export type LiveActFrameListener = (frame: LiveActFrameV1) => void;
```

### src/infrastructure/character/liveact/liveact-engine.ts:160

```ts
export type LiveActDiagnosticsListener = (frame: LiveActFaceDiagnosticsFrameV1) => void;
```

### src/infrastructure/character/liveact/liveact-engine.ts:161

```ts
export type LiveActDiagnosticsV2Listener = (snapshot: LiveActDiagnosticsV2Snapshot) => void;
```

### src/infrastructure/character/liveact/liveact-engine.ts:163

```ts
export type LiveActDenseFaceFeaturesListener = (frame: LiveActDenseFaceFeaturesV1) => void;
```

### src/infrastructure/character/liveact/liveact-engine.ts:165

```ts
export type LiveActIrisGazeListener = (gaze: LiveActIrisGazeV1) => void;
```

### src/infrastructure/character/liveact/liveact-engine.ts:166

```ts
export type LiveActHybridFaceListener = (frame: LiveActHybridFaceV1) => void;
```

### src/infrastructure/character/liveact/liveact-engine.ts:176

```ts
export function getActiveLiveActEngine(): LiveActEngine | null {
  return activeLiveActEngine;
}
```

### src/infrastructure/character/liveact/liveact-engine.ts:180

```ts
export class LiveActEngine {
  private status: LiveActStatus = 'idle';
  private message = liveActStatusLabelDe('idle');
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private source: LiveActFaceSource | null = null;
  private raf = 0;
  private lastFrameAt = 0;
  private frame: LiveActFrameV1 | null = null;
  private pipelineStep: LiveActCalibratedStepV1 | null = null;
  private sequence = 0;
  private disposed = false;
  private visibilityHandler: (() => void) | null = null;
  private readonly limits: LiveActLimits;
  private readonly qualityProfile: LiveActQualityProfile;
  private readonly fpsCap: number;
  private output: LiveActAvatarOutput | null = null;
  private readonly statusListeners = new Set<LiveActStatusListener>();
  private readonly frameListeners = new Set<LiveActFrameListener>();
  private readonly diagnosticsListeners = new Set<LiveActDiagnosticsListener>();
  private readonly diagnosticsV2Listeners = new Set<LiveActDiagnosticsV2Listener>();
  private readonly denseFaceFeaturesListeners = new Set<LiveActDenseFaceFeaturesListener>();
  private readonly irisGazeListeners = new Set<LiveActIrisGazeListener>();
  private readonly hybridFaceListeners = new Set<LiveActHybridFaceListener>();
  private diagnosticsV2: LiveActDiagnosticsV2Snapshot | null = null;
  private denseFaceFeatures: LiveActDenseFaceFeaturesV1 | null = null;
  private irisGaze: LiveActIrisGazeV1 | null = null;
  private hybridFace: LiveActHybridFaceV1 | null = null;
  private neutralBaseline: LiveActNeutralBaselineV1 | null = null;
  private rangeCalibration: LiveActRangeCalibrationV1 | null = null;
  private personalProfile: LiveActCalibrationProfileV2 | null = null;
  private personalSession: LiveActPersonalCalibrationSessionV2 | null = null;
  private personalCalibrating = false;
  /** Owner + character scope for Profile V2; incomplete ⇒ no persistent load/save. */
  private personalCalibrationScope: LiveActPersonalCalibrationScopeV1 | null = null;
  private personalCapturePaused = false;
  private calibrating = false;
  private calibrationPhase: 'neutral' | 'range' = 'neutral';
  private calibrationAccumulator: LiveActCalibrationAccumulator = createLiveActCalibrationAccumulator();
  private rangeAccumulator: LiveActRangeCalibrationAccumulator =
    createLiveActRangeCalibrationAccumulator();
  /** Index into LIVEACT_RANGE_CALIBRATION_STEPS while phase === 'range'. */
  private rangeStepIndex = 0;
  private rangeStepStartedAtMs = 0;
  private rangeStepFrameCount = 0;
  private rangeStepHoldMs: number = LIVEACT_RANGE_STEP_MIN_MS;
  private rangeStepPhase: LiveActRangeStepPhase = 'armed';
  private rangeStepPeakMax: Partial<Record<LiveActFaceChannelId, number>> = {};
  private rangeStepPeaks: LiveActCalibrationStepPeakV1[] = [];
  private lastEmittedCountdownSec: number | null = null;
  private calibrationStartedAtMs = 0;
  private calibrationResolve: ((result: LiveActCalibrationResult) => void) | null = null;
  private calibrationStatus: LiveActCalibrationStatus = 'idle';
  private calibrationMessage = '';
  private canAdvanceCalibration = false;
  private startGeneration = 0;
  private inferenceInFlight = 0;
  private droppedInferenceFrames = 0;
  private lastStatusEmitMs = 0;
  private pendingStatusCoalesce = false;
  private statusCoalesceTimer: ReturnType<typeof setTimeout> | null = null;
  private preferredDeviceId: string | undefined;
  private deviceChangeHandler: (() => void) | null = null;
  private retargetProfile: LiveActRetargetProfileV1 = DEFAULT_LIVEACT_RETARGET_PROFILE;

  constructor(
    private readonly sourceFactory: LiveActFaceSourceFactory = async (profile) => {
      const source = await createMediaPipeLiveActFaceSource(profile);
      if (!source) {
        throw new Error('unsupported');
      }
      return source;
    },
    limits: LiveActLimits = DEFAULT_LIVEACT_LIMITS,
  ) {
    this.limits = limits;
    this.qualityProfile = resolveLiveActQualityProfile({
      isMobile: isMobileHint(),
      maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
      limits,
    });
    this.fpsCap = this.qualityProfile.fpsCap;
    // No scope yet — fail closed (no shared `_default` profile load).
    this.emitStatus(true);
  }

  /**
   * Bind Personal Calibration persistence to authenticated owner + character.
   * Incomplete scope clears runtime personal profile and never loads `_default`.
   */
  setPersonalCalibrationScope(scope: LiveActPersonalCalibrationScopeV1 | null): void {
    const next =
      scope && isLiveActPersonalCalibrationScopeComplete(scope)
        ? {
            ownerLocalId: scope.ownerLocalId.trim(),
            characterLocalId: scope.characterLocalId.trim(),
          }
        : null;
    const prev = this.personalCalibrationScope;
    const same =
      prev?.ownerLocalId === next?.ownerLocalId &&
      prev?.characterLocalId === next?.characterLocalId;
    if (same) return;
    // Detach prior scoped profile immediately on switch / clear.
    this.personalProfile = null;
    this.personalCalibrationScope = next;
    this.reloadPersonalProfileFromStore();
    this.emitStatus(true);
  }

  /** @deprecated Use {@link setPersonalCalibrationScope}. Character-only is insufficient. */
  setCharacterLocalId(characterLocalId: string | null): void {
    if (!characterLocalId) {
      this.setPersonalCalibrationScope(null);
      return;
    }
    const owner = this.personalCalibrationScope?.ownerLocalId ?? '';
    this.setPersonalCalibrationScope(
      owner
        ? { ownerLocalId: owner, characterLocalId }
        : null,
    );
  }

  getPersonalCalibrationProfile(): LiveActCalibrationProfileV2 | null {
    return this.personalProfile;
  }

  getPersonalCalibrationScope(): LiveActPersonalCalibrationScopeV1 | null {
    return this.personalCalibrationScope;
  }

  private reloadPersonalProfileFromStore(): void {
    if (!isLiveActPersonalCalibrationScopeComplete(this.personalCalibrationScope)) {
      this.personalProfile = null;
      return;
    }
    const loaded = loadLiveActPersonalCalibrationProfile(this.personalCalibrationScope);
    if (loaded.status === 'valid' && loaded.profile) {
      this.applyPersonalProfile(loaded.profile);
      return;
    }
    // Invalid/mismatched profiles must not apply silently.
    this.personalProfile = null;
  }

  private applyPersonalProfile(profile: LiveActCalibrationProfileV2): void {
    this.personalProfile = profile;
    const set = liveActCalibrationSetFromPersonalProfile(profile);
    this.neutralBaseline = set.neutral;
    this.rangeCalibration = set.range;
  }

  bindOutput(output: LiveActAvatarOutput | null): void {
    const swapped = output !== this.output;
    this.output = output;
    // Model swap must not leak prior applied values or #448 temporal state.
    if (!output) {
      this.diagnosticsV2 = null;
    }
    if (swapped) {
      // Temporal reset only — calibration baselines are product-owned separately.
      this.pipelineStep = null;
    }
  }

  /** First-party retarget profile (identity by default; no filename-based selection). */
  setRetargetProfile(profile: LiveActRetargetProfileV1 | null | undefined): void {
    this.retargetProfile = profile ?? DEFAULT_LIVEACT_RETARGET_PROFILE;
  }

  subscribeStatus(listener: LiveActStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getState());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeFrame(listener: LiveActFrameListener): () => void {
    this.frameListeners.add(listener);
    if (this.frame) listener(this.frame);
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  subscribeDiagnostics(listener: LiveActDiagnosticsListener): () => void {
    this.diagnosticsListeners.add(listener);
    return () => {
      this.diagnosticsListeners.delete(listener);
    };
  }

  /** Diagnostics V2 stage trace (#397) — ref-friendly; no hot-path React state. */
  subscribeDiagnosticsV2(listener: LiveActDiagnosticsV2Listener): () => void {
    this.diagnosticsV2Listeners.add(listener);
    if (this.diagnosticsV2) listener(this.diagnosticsV2);
    return () => {
      this.diagnosticsV2Listeners.delete(listener);
    };
  }

  /**
   * Dense face features side-channel (#445).
   * Single access point for future #446/#447 — not part of LiveActFrameV1.
   */
  subscribeDenseFaceFeatures(listener: LiveActDenseFaceFeaturesListener): () => void {
    this.denseFaceFeaturesListeners.add(listener);
    if (this.denseFaceFeatures) listener(this.denseFaceFeatures);
    return () => {
      this.denseFaceFeaturesListeners.delete(listener);
    };
  }

  getDenseFaceFeatures(): LiveActDenseFaceFeaturesV1 | null {
    return this.denseFaceFeatures;
  }

  subscribeIrisGaze(listener: LiveActIrisGazeListener): () => void {
    this.irisGazeListeners.add(listener);
    if (this.irisGaze) listener(this.irisGaze);
    return () => {
      this.irisGazeListeners.delete(listener);
    };
  }

  getIrisGaze(): LiveActIrisGazeV1 | null {
    return this.irisGaze;
  }

  /**
   * Hybrid mouth/cheek/nose face side-channel (#447).
   * Semantic controls only — raw dense geometry stays out of LiveActFrameV1.
   */
  subscribeHybridFace(listener: LiveActHybridFaceListener): () => void {
    this.hybridFaceListeners.add(listener);
    if (this.hybridFace) listener(this.hybridFace);
    return () => {
      this.hybridFaceListeners.delete(listener);
    };
  }

  getHybridFace(): LiveActHybridFaceV1 | null {
    return this.hybridFace;
  }

  getDiagnosticsV2(): LiveActDiagnosticsV2Snapshot | null {
    return this.diagnosticsV2;
  }

  /** Session range gains from the last successful max pass; null until then. */
  getRangeCalibration(): LiveActRangeCalibrationV1 | null {
    return this.rangeCalibration;
  }

  getState(): LiveActEngineState {
    return {
      status: this.status,
      message: this.message,
      frame: this.frame,
      fpsCap: this.fpsCap,
      qualityProfileId: this.qualityProfile.id,
      qualityProfileLabelDe: this.qualityProfile.labelDe,
      calibrationStatus: this.calibrationStatus,
      calibrationMessage: this.calibrationMessage,
      hasNeutralBaseline: this.neutralBaseline !== null,
      hasRangeCalibration: this.rangeCalibration !== null,
      canAdvanceCalibration: this.computeCanAdvanceCalibration(),
      calibrationAdvanceLabelDe: this.computeCalibrationAdvanceLabel(),
      calibrationStepPhase:
        this.calibrating && this.calibrationPhase === 'range' ? this.rangeStepPhase : null,
      canStartCalibrationHold: this.computeCanStartCalibrationHold(),
      canRetryCalibrationHold: this.computeCanRetryCalibrationHold(),
      calibrationStepPeaks: this.rangeStepPeaks,
      calibrationCountdownSec: this.computeCalibrationCountdownSec(),
      personalCalibrationActive: this.personalCalibrating,
      personalCalibrationPhaseLabelDe: this.computePersonalPhaseLabelDe(),
      canSkipPersonalCalibrationPhase: this.computeCanSkipPersonalPhase(),
      hasPersonalCalibrationProfile: this.personalProfile !== null,
      droppedInferenceFrames: this.droppedInferenceFrames,
    };
  }

  /** Switch active camera device without releasing the global claim. */
  async switchCameraDevice(deviceId: string | undefined): Promise<void> {
    if (this.disposed) return;
    const sameDevice =
      deviceId === this.preferredDeviceId &&
      Boolean(this.stream?.getVideoTracks().some((track) => track.readyState === 'live'));
    if (sameDevice) return;
    this.preferredDeviceId = deviceId;
    if (this.status !== 'active' && this.status !== 'lost' && this.status !== 'paused') {
      return;
    }
    const gen = this.startGeneration;
    await this.reopenCameraStream(gen);
  }

  getQualityProfile(): LiveActQualityProfile {
    return this.qualityProfile;
  }

  /**
   * Engine/face-source input support only (#381) — never derived from avatar mesh.
   * Available before tracking starts (quality profile); face always true for MediaPipe Face.
   */
  getInputCapabilities(): LiveActInputCapabilities {
    return createLiveActInputCapabilities({
      face: true,
      headPose: this.qualityProfile.enableHeadPose,
      eyeGaze: true,
    });
  }

  /** Preview video element while tracking (engine remains stream owner). */
  getPreviewVideo(): HTMLVideoElement | null {
    return this.video;
  }

  /**
   * Step 1: 30 valid neutral frames within 2 s (on failure the previous calibration is kept).
   * Then one max-pass expression at a time; the user advances with {@link advanceCalibration}.
   * Classic V1 / fallback path — prefer {@link calibratePersonalV2} for Premium Fidelity.
   */
  calibrate(): Promise<LiveActCalibrationResult> {
    if (this.disposed) {
      return Promise.resolve({
        ok: false,
        messageDe: 'LiveAct ist nicht verfügbar.',
      });
    }
    if (this.status !== 'active' && this.status !== 'lost') {
      return Promise.resolve({
        ok: false,
        messageDe: 'Kalibrierung erfordert aktives Tracking.',
      });
    }
    if (this.calibrating || this.personalCalibrating) {
      return Promise.resolve({
        ok: false,
        messageDe: 'Kalibrierung läuft bereits.',
      });
    }

    return new Promise((resolve) => {
      // Classic session override: disable Personal apply for this session.
      // Persisted Premium profile is NOT deleted — reload may restore it.
      this.personalProfile = null;
      this.calibrating = true;
      this.calibrationPhase = 'neutral';
      this.canAdvanceCalibration = false;
      this.rangeStepIndex = 0;
      this.rangeStepFrameCount = 0;
      this.rangeStepPhase = 'armed';
      this.rangeStepPeaks = [];
      this.rangeStepPeakMax = {};
      this.lastEmittedCountdownSec = Math.ceil(LIVEACT_CALIBRATION_TIMEOUT_MS / 1000);
      this.calibrationAccumulator = createLiveActCalibrationAccumulator();
      this.calibrationStartedAtMs =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.calibrationResolve = resolve;
      this.setCalibrationUi('running', liveActNeutralCalibrationPrompt());
      this.emitStatus(true);
    });
  }

  /**
   * Premium Personal Calibration V2 (#449) — compact auto-advancing ~20–40 s session.
   * Persists a local fingerprint-bound profile; V1 classic {@link calibrate} remains.
   */
  calibratePersonalV2(): Promise<LiveActCalibrationResult> {
    if (this.disposed) {
      return Promise.resolve({
        ok: false,
        messageDe: 'LiveAct ist nicht verfügbar.',
      });
    }
    if (this.status !== 'active' && this.status !== 'lost') {
      return Promise.resolve({
        ok: false,
        messageDe: 'Kalibrierung erfordert aktives Tracking.',
      });
    }
    if (this.calibrating || this.personalCalibrating) {
      return Promise.resolve({
        ok: false,
        messageDe: 'Kalibrierung läuft bereits.',
      });
    }

    return new Promise((resolve) => {
      this.personalCalibrating = true;
      this.personalCapturePaused = false;
      this.personalSession = createLiveActPersonalCalibrationSessionV2(
        this.personalCalibrationScope,
      );
      this.calibrationResolve = resolve;
      const phase0 = LIVEACT_PERSONAL_CALIBRATION_PHASES[0];
      this.setCalibrationUi(
        'running',
        phase0 ? `${phase0.labelDe}: ${phase0.holdDe}` : 'Premium-Kalibrierung…',
      );
      this.emitStatus(true);
    });
  }

  /** Skip current Personal V2 phase when allowed (motor limitation / N/A). */
  skipPersonalCalibrationPhase(): void {
    if (!this.personalCalibrating || !this.personalSession) return;
    if (!this.computeCanSkipPersonalPhase()) return;
    this.personalCapturePaused = false;
    const advanced = skipLiveActPersonalCalibrationPhase(this.personalSession);
    if (!advanced) {
      this.completePersonalCalibration();
      return;
    }
    this.emitPersonalPhasePrompt();
    this.emitStatus(true);
  }

  /** Begin the countdown/hold for the current armed expression. */
  startCalibrationHold(): void {
    if (!this.computeCanStartCalibrationHold()) return;
    this.rangeStepPhase = 'holding';
    this.rangeStepFrameCount = 0;
    this.rangeStepPeakMax = {};
    this.rangeStepPeaks = [];
    this.canAdvanceCalibration = false;
    this.rangeStepStartedAtMs =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastEmittedCountdownSec = Math.ceil(this.rangeStepHoldMs / 1000);
    this.emitStatus(true);
  }

  /** Discard the last hold and wait for Start again. */
  retryCalibrationHold(): void {
    if (!this.computeCanRetryCalibrationHold()) return;
    this.beginRangeStep(this.rangeStepIndex);
    this.emitStatus(true);
  }

  /**
   * Advance from review to the next expression, or finish after the last.
   * No-op until the hold is complete and reviewed.
   */
  advanceCalibration(): void {
    if (!this.calibrating || this.calibrationPhase !== 'range') return;
    if (!this.computeCanAdvanceCalibration()) return;
    const next = this.rangeStepIndex + 1;
    if (next >= LIVEACT_RANGE_CALIBRATION_STEPS.length) {
      this.completeRangeCalibration();
      return;
    }
    this.beginRangeStep(next);
    this.emitStatus(true);
  }

  /** Explicit user action only — never auto-start on construct/reload. */
  async start(deviceId?: string): Promise<void> {
    if (this.disposed) return;
    if (this.status === 'active' || this.status === 'starting') return;

    if (typeof deviceId === 'string' && deviceId.length > 0) {
      this.preferredDeviceId = deviceId;
    }

    const generation = ++this.startGeneration;

    if (activeLiveActEngine && activeLiveActEngine !== this) {
      activeLiveActEngine.stop();
    }
    claimLiveActCamera(this);
    activeLiveActEngine = this;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.setStatus('unsupported', liveActStatusLabelDe('unsupported'));
      this.releaseActiveClaim();
      return;
    }

    this.setStatus('starting', liveActStatusLabelDe('starting'));

    try {
      this.stream = await this.openCameraStream();
    } catch (error) {
      if (generation !== this.startGeneration) {
        return;
      }
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.setStatus('denied', liveActStatusLabelDe('denied'));
        this.releaseActiveClaim();
        return;
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        this.setStatus('unsupported', 'Keine Kamera gefunden.');
        this.releaseActiveClaim();
        return;
      }
      this.setStatus('error', liveActStatusLabelDe('error'));
      this.releaseActiveClaim();
      return;
    }

    if (this.disposed || activeLiveActEngine !== this || generation !== this.startGeneration) {
      this.cleanupMedia();
      return;
    }

    try {
      this.source = await this.sourceFactory(this.qualityProfile);
    } catch {
      this.cleanupMedia();
      this.setStatus('unsupported', liveActStatusLabelDe('unsupported'));
      this.releaseActiveClaim();
      return;
    }

    if (
      this.disposed ||
      activeLiveActEngine !== this ||
      generation !== this.startGeneration
    ) {
      this.cleanupMedia();
      return;
    }

    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => undefined);

    if (generation !== this.startGeneration) {
      this.cleanupMedia();
      return;
    }

    this.attachRuntimeListeners();

    this.setStatus('active', liveActStatusLabelDe('active'));
    this.lastFrameAt = 0;
    this.droppedInferenceFrames = 0;
    this.loop();
  }

  stop(): void {
    if (this.disposed) return;
    this.startGeneration += 1;
    this.cancelCalibration('LiveAct gestoppt.');
    this.cancelLoop();
    this.cleanupMedia();
    this.frame = null;
    this.pipelineStep = null;
    this.diagnosticsV2 = null;
    this.denseFaceFeatures = null;
    this.irisGaze = null;
    this.hybridFace = null;
    this.output?.resetLiveActPose();
    this.releaseActiveClaim();
    this.setStatus('stopped', liveActStatusLabelDe('stopped'));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.startGeneration += 1;
    this.cancelCalibration('LiveAct beendet.');
    this.neutralBaseline = null;
    this.rangeCalibration = null;
    this.personalProfile = null;
    this.personalSession = null;
    this.personalCalibrating = false;
    this.cancelLoop();
    this.cleanupMedia();
    this.frame = null;
    this.pipelineStep = null;
    this.diagnosticsV2 = null;
    this.denseFaceFeatures = null;
    this.irisGaze = null;
    this.hybridFace = null;
    this.output = null;
    this.statusListeners.clear();
    this.frameListeners.clear();
    this.diagnosticsListeners.clear();
    this.diagnosticsV2Listeners.clear();
    this.denseFaceFeaturesListeners.clear();
    this.irisGazeListeners.clear();
    this.hybridFaceListeners.clear();
    this.releaseActiveClaim();
    this.setStatus('idle', liveActStatusLabelDe('idle'));
    this.setCalibrationUi('idle', '');
  }

  /** Test helper: push one sample through map/smooth without camera. */
  ingestSampleForTests(sample: LiveActSourceSample, timestampMs = 0): LiveActFrameV1 {
    return this.processSample(sample, timestampMs, null, null, null);
  }

  /** Test helper: inject dense features without MediaPipe (#445). */
  ingestDenseFaceFeaturesForTests(frame: LiveActDenseFaceFeaturesV1): void {
    assertDenseFaceFeaturesLocalOnly(frame);
    this.denseFaceFeatures = frame;
    this.emitDenseFaceFeatures(frame);
  }

  private releaseActiveClaim(): void {
    if (activeLiveActEngine === this) {
      activeLiveActEngine = null;
    }
    releaseLiveActCamera(this);
  }

  private loop = (): void => {
    if (this.disposed || this.status === 'stopped' || this.status === 'idle') return;
    this.raf = requestAnimationFrame(this.loop);

    if (this.status === 'paused') return;
    const video = this.video;
    const source = this.source;
    if (!video || !source || video.readyState < 2) return;

    const now = performance.now();
    const minDelta = 1000 / Math.max(1, this.fpsCap);
    if (now - this.lastFrameAt < minDelta) return;
    this.lastFrameAt = now;

    if (shouldDropLiveActInferenceTick(this.inferenceInFlight)) {
      this.droppedInferenceFrames += 1;
      this.scheduleCoalescedStatusEmit();
      return;
    }

    this.inferenceInFlight += 1;
    let detect;
    try {
      detect = source.detect(video, now);
    } catch (error) {
      console.warn('[liveact] detect failed', error);
      this.setStatus('error', liveActStatusLabelDe('error'));
      this.stop();
      return;
    } finally {
      this.inferenceInFlight = Math.max(0, this.inferenceInFlight - 1);
    }

    const primary = selectPrimaryLiveActFaceIndex(detect.samples);
    const sample =
      primary >= 0
        ? { ...detect.samples[primary], faceIndex: primary, faceCount: detect.samples.length }
        : createEmptyLiveActSourceSample();

    const diagnosticsRaw =
      primary >= 0 && detect.diagnostics[primary]
        ? detect.diagnostics[primary]
        : createEmptyLiveActFaceDiagnosticsFrame({ timestampMs: now, sequence: this.sequence + 1 });

    const denseRaw =
      primary >= 0 && detect.denseFeatures[primary] ? detect.denseFeatures[primary] : null;

    const irisRaw =
      primary >= 0 && detect.irisGaze[primary] ? detect.irisGaze[primary] : null;

    this.processSample(sample, now, diagnosticsRaw, denseRaw, irisRaw);
  };

  private processSample(
    sample: LiveActSourceSample,
    timestampMs: number,
    diagnosticsSeed: LiveActFaceDiagnosticsFrameV1 | null,
    denseSeed: LiveActDenseFaceFeaturesV1 | null,
    irisSeed: LiveActIrisGazeV1 | null,
  ): LiveActFrameV1 {
    this.sequence += 1;

    // #447 Orientation authority = anatomical.
    // Fuse RAW anatomical semantic + RAW anatomical dense, then mirror ONCE.
    // Never fuse mirrored semantic against unmirrored dense (L/R mismatch).
    const denseForHybrid: LiveActDenseFaceFeaturesV1 | null = denseSeed
      ? {
          ...denseSeed,
          sequence: this.sequence,
          timestampMs,
          presence: denseSeed.presence,
        }
      : null;
    const hybrid = solveHybridFace({
      semanticFace: sample.face,
      dense: denseForHybrid,
      sequence: this.sequence,
      timestampMs,
      denseSequence: denseForHybrid?.sequence ?? null,
    });
    assertHybridFaceLocalOnly(hybrid);
    this.hybridFace = hybrid;
    this.emitHybridFace(hybrid);

    const anatomicalFused: LiveActSourceSample = {
      ...sample,
      face: applyHybridFaceToSemantic(sample.face, hybrid),
    };
    // Single mirror point — avatar orientation for map/calibrate/output.
    const oriented = LIVEACT_MIRROR_AVATAR
      ? mirrorLiveActSourceSample(anatomicalFused)
      : anatomicalFused;

    const mapped = mapLiveActSourceSample(oriented, {
      timestampMs,
      sequence: this.sequence,
      limits: this.limits,
    });

    this.tickCalibration(oriented);

    const step = stepLiveActCalibratedFrame(
      this.pipelineStep,
      mapped,
      { neutral: this.neutralBaseline, range: this.rangeCalibration },
      this.limits,
      'adaptive',
      this.personalProfile,
    );
    this.pipelineStep = step;
    const { smoothed, calibrated } = step;
    assertLiveActFrameLocalOnly(calibrated);
    this.frame = calibrated;
    const retargeted = applyLiveActRetargetProfile(calibrated, this.retargetProfile);
    this.output?.applyLiveActFrame(retargeted);
    // #451 Premium PerformanceFace — only writes when bind report is premiumEligible.
    const performanceWeights = drivePerformanceFaceWeights({
      hybrid: this.hybridFace,
      face: retargeted.face,
    });
    this.output?.applyPerformanceFaceWeights(performanceWeights);
    this.emitFrame(calibrated);

    const applied = this.output
      ? this.output.getAppliedDiagnostics()
      : createUnavailableLiveActAppliedValues();

    const diagnosticsV2 = createLiveActDiagnosticsV2Snapshot({
      timestampMs,
      sequence: this.sequence,
      trackingLost: mapped.trackingLost,
      // RAW remains pre-hybrid tracker sample; mapped includes hybrid face controls.
      raw: snapshotLiveActDiagnosticsV2FromSample(sample),
      mapped: snapshotLiveActDiagnosticsV2FromFrame(mapped),
      smoothed: snapshotLiveActDiagnosticsV2FromFrame(smoothed),
      calibrated: snapshotLiveActDiagnosticsV2FromFrame(calibrated),
      retargeted: snapshotLiveActDiagnosticsV2FromFrame(retargeted),
      applied,
    });
    assertLiveActDiagnosticsV2LocalOnly(diagnosticsV2);
    this.diagnosticsV2 = diagnosticsV2;
    this.emitDiagnosticsV2(diagnosticsV2);

    const diagnostics: LiveActFaceDiagnosticsFrameV1 = diagnosticsSeed
      ? {
          ...diagnosticsSeed,
          timestampMs,
          sequence: this.sequence,
          trackingLost: mapped.trackingLost,
          faceIndex: sample.faceIndex,
          faceCount: sample.faceCount,
        }
      : createEmptyLiveActFaceDiagnosticsFrame({
          timestampMs,
          sequence: this.sequence,
        });
    this.emitDiagnostics(diagnostics);

    const dense: LiveActDenseFaceFeaturesV1 = denseSeed
      ? {
          ...denseSeed,
          sequence: this.sequence,
          timestampMs,
          presence: denseSeed.presence && !mapped.trackingLost,
        }
      : createEmptyDenseFaceFeatures({
          sequence: this.sequence,
          timestampMs,
          faceConfidence: 0,
          normalizationStatus: 'unavailable',
        });
    assertDenseFaceFeaturesLocalOnly(dense);
    assertLiveActFrameLocalOnly(calibrated);
    this.denseFaceFeatures = dense;
    this.emitDenseFaceFeatures(dense);

    const irisBase =
      irisSeed ??
      createEmptyIrisGaze({ sequence: this.sequence, timestampMs });
    const irisOriented = LIVEACT_MIRROR_AVATAR ? mirrorIrisGaze(irisBase) : irisBase;
    const iris: LiveActIrisGazeV1 = {
      ...irisOriented,
      sequence: this.sequence,
      timestampMs,
    };
    assertIrisGazeLocalOnly(iris);
    this.irisGaze = iris;
    this.emitIrisGaze(iris);

    if (mapped.trackingLost) {
      if (this.status !== 'lost') this.setStatus('lost', liveActStatusLabelDe('lost'));
    } else if (this.status === 'lost') {
      this.setStatus('active', liveActStatusLabelDe('active'));
    } else {
      this.emitStatus(false);
    }

    return calibrated;
  }

  private async openCameraStream(): Promise<MediaStream> {
    const videoConstraints: MediaTrackConstraints = {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: this.fpsCap, max: this.fpsCap },
    };
    if (this.preferredDeviceId) {
      videoConstraints.deviceId = { exact: this.preferredDeviceId };
      delete videoConstraints.facingMode;
    }
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: videoConstraints,
    });
  }

  private async reopenCameraStream(generation: number): Promise<void> {
    this.cleanupStreamOnly();
    if (generation !== this.startGeneration || this.disposed) return;
    try {
      this.stream = await this.openCameraStream();
    } catch {
      this.setStatus('unsupported', 'Kamera nicht verfügbar.');
      this.stop();
      return;
    }
    if (generation !== this.startGeneration || this.disposed) {
      this.cleanupStreamOnly();
      return;
    }
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => undefined);
    if (generation !== this.startGeneration) {
      this.cleanupStreamOnly();
    }
  }

  private attachRuntimeListeners(): void {
    if (typeof document !== 'undefined' && !this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (typeof document === 'undefined') return;
        if (document.visibilityState === 'hidden') {
          if (this.status === 'active') {
            this.setStatus('paused', liveActStatusLabelDe('paused'));
          }
        } else if (this.status === 'paused') {
          this.setStatus('active', liveActStatusLabelDe('active'));
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && !this.deviceChangeHandler) {
      this.deviceChangeHandler = () => {
        if (this.status !== 'active' && this.status !== 'lost' && this.status !== 'paused') {
          return;
        }
        void this.switchCameraDevice(this.preferredDeviceId);
      };
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
    }
  }

  private cleanupStreamOnly(): void {
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }

  private tickCalibration(sample: LiveActSourceSample): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.personalCalibrating) {
      this.tickPersonalCalibration(sample, now);
      return;
    }
    if (!this.calibrating) return;

    if (this.calibrationPhase === 'range') {
      this.tickRangeCalibration(sample, now);
      return;
    }
    this.emitCountdownIfChanged();
    if (now - this.calibrationStartedAtMs > LIVEACT_CALIBRATION_TIMEOUT_MS) {
      this.failCalibration('Kalibrierung fehlgeschlagen — zu wenig gültige Frames.');
      return;
    }

    const pushed = pushLiveActCalibrationSample(this.calibrationAccumulator, sample, {
      headPoseSupported: this.qualityProfile.enableHeadPose,
      limits: this.limits,
    });
    if (!pushed) {
      this.failCalibration('Gesicht verloren — Kalibrierung abgebrochen.');
      return;
    }
    if (this.calibrationAccumulator.count >= LIVEACT_CALIBRATION_FRAME_TARGET) {
      this.completeCalibration();
    }
  }

  private completeCalibration(): void {
    const next = finalizeLiveActCalibration(this.calibrationAccumulator);
    if (!next) {
      this.failCalibration('Kalibrierung fehlgeschlagen.');
      return;
    }
    this.neutralBaseline = next;
    // Range gains are spans above the neutral pose — a new baseline invalidates them.
    this.rangeCalibration = null;
    this.calibrationPhase = 'range';
    this.rangeAccumulator = createLiveActRangeCalibrationAccumulator();
    this.beginRangeStep(0);
    this.emitStatus(true);
  }

  private beginRangeStep(stepIndex: number): void {
    this.rangeStepIndex = stepIndex;
    this.rangeStepFrameCount = 0;
    this.canAdvanceCalibration = false;
    this.rangeStepHoldMs = liveActRangeStepHoldMs(stepIndex);
    this.rangeStepPhase = 'armed';
    this.rangeStepPeakMax = {};
    this.rangeStepPeaks = [];
    this.lastEmittedCountdownSec = null;
    this.setCalibrationUi('running', liveActRangeCalibrationStepPrompt(stepIndex));
  }

  private computeCanStartCalibrationHold(): boolean {
    return (
      this.calibrating &&
      this.calibrationPhase === 'range' &&
      this.rangeStepPhase === 'armed'
    );
  }

  private computeCanRetryCalibrationHold(): boolean {
    return (
      this.calibrating &&
      this.calibrationPhase === 'range' &&
      this.rangeStepPhase === 'review'
    );
  }

  private computeCanAdvanceCalibration(): boolean {
    return (
      this.calibrating &&
      this.calibrationPhase === 'range' &&
      this.rangeStepPhase === 'review'
    );
  }

  private computeCalibrationAdvanceLabel(): 'Weiter' | 'Fertig' | null {
    if (!this.computeCanAdvanceCalibration()) return null;
    return this.rangeStepIndex >= LIVEACT_RANGE_CALIBRATION_STEPS.length - 1
      ? 'Fertig'
      : 'Weiter';
  }

  private computeCalibrationCountdownSec(): number | null {
    if (this.calibrationStatus !== 'running') return null;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.personalCalibrating && this.personalSession) {
      return liveActPersonalCalibrationPhaseRemainingSec(this.personalSession);
    }
    if (!this.calibrating) return null;
    if (this.calibrationPhase === 'neutral') {
      const remaining = LIVEACT_CALIBRATION_TIMEOUT_MS - (now - this.calibrationStartedAtMs);
      return Math.max(0, Math.ceil(remaining / 1000));
    }
    if (this.rangeStepPhase !== 'holding') return null;
    const remaining = this.rangeStepHoldMs - (now - this.rangeStepStartedAtMs);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  private emitCountdownIfChanged(): void {
    const sec = this.computeCalibrationCountdownSec();
    if (sec === this.lastEmittedCountdownSec) return;
    this.lastEmittedCountdownSec = sec;
    this.emitStatus(true);
  }

  private tickRangeCalibration(sample: LiveActSourceSample, now: number): void {
    if (this.rangeStepPhase !== 'holding') return;

    const pushed = pushLiveActRangeCalibrationSample(this.rangeAccumulator, sample, this.limits);
    if (pushed) {
      this.rangeStepFrameCount += 1;
      for (const channel of liveActRangeStepChannels(this.rangeStepIndex)) {
        const value = sample.face[channel];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const prev = this.rangeStepPeakMax[channel] ?? 0;
        if (value > prev) this.rangeStepPeakMax[channel] = value;
      }
    }
    this.emitCountdownIfChanged();

    const holdDone =
      this.rangeStepFrameCount >= LIVEACT_RANGE_STEP_MIN_FRAMES &&
      now - this.rangeStepStartedAtMs >= this.rangeStepHoldMs;

    if (!holdDone) return;

    this.rangeStepPeaks = liveActRangeStepChannels(this.rangeStepIndex).map((channel) => ({
      channel,
      max: Math.round((this.rangeStepPeakMax[channel] ?? 0) * 1000) / 1000,
    }));
    this.rangeStepPhase = 'review';
    this.canAdvanceCalibration = true;
    this.lastEmittedCountdownSec = 0;
    this.emitStatus(true);
  }

  private completeRangeCalibration(): void {
    const baseline = this.neutralBaseline;
    const range = baseline
      ? finalizeLiveActRangeCalibration(this.rangeAccumulator, baseline)
      : null;
    this.rangeCalibration = range;
    this.calibrating = false;
    this.calibrationPhase = 'neutral';
    this.canAdvanceCalibration = false;
    this.rangeStepPhase = 'armed';
    this.rangeStepPeaks = [];
    this.lastEmittedCountdownSec = null;
    const resolve = this.calibrationResolve;
    this.calibrationResolve = null;
    const channelCount = range ? Object.keys(range.gain).length : 0;
    const messageDe = range
      ? `Kalibriert: Neutral + Maximal (${channelCount} Kanäle, nur diese Sitzung).`
      : 'Neutral gespeichert — Maximal-Schritt ohne genug Bewegung, Ausschlag bleibt 1:1.';
    if (!range) {
      console.warn('[liveact] range calibration skipped', {
        frames: this.rangeAccumulator.count,
      });
    }
    this.setCalibrationUi('success', messageDe);
    resolve?.({ ok: true, messageDe });
    this.emitStatus(true);
  }

  private tickPersonalCalibration(sample: LiveActSourceSample, now: number): void {
    const session = this.personalSession;
    if (!session) return;

    const pushed = pushLiveActPersonalCalibrationSample(session, sample, {
      headPoseSupported: this.qualityProfile.enableHeadPose,
      limits: this.limits,
      nowMs: now,
    });
    if (!pushed) {
      // Tracking lost / invalid sample: pause valid-capture clock (no wall-clock advance).
      if (!this.personalCapturePaused) {
        this.personalCapturePaused = true;
        this.setCalibrationUi(
          'running',
          'Gesicht nicht erkannt — Kalibrierung pausiert',
        );
      }
      this.emitCountdownIfChanged();
      return;
    }

    if (this.personalCapturePaused) {
      this.personalCapturePaused = false;
      this.emitPersonalPhasePrompt();
    }

    this.emitCountdownIfChanged();
    if (!isLiveActPersonalCalibrationPhaseComplete(session, now)) return;

    const hasNext = advanceLiveActPersonalCalibrationPhase(session);
    if (!hasNext) {
      this.completePersonalCalibration();
      return;
    }
    this.emitPersonalPhasePrompt();
    this.emitStatus(true);
  }

  private completePersonalCalibration(): void {
    const session = this.personalSession;
    if (!session || !hasLiveActPersonalCalibrationEnoughValidSamples(session)) {
      this.failCalibration(
        'Premium-Kalibrierung unvollständig — zu wenig gültige Samples.',
      );
      return;
    }
    const createdAt =
      typeof performance !== 'undefined' ? Date.now() : 1_700_000_000_000;
    const profile = finalizeLiveActPersonalCalibrationProfile(session, createdAt);
    if (profile.status !== 'valid') {
      this.failCalibration(
        'Premium-Kalibrierung unvollständig — zu wenig gültige Samples.',
      );
      return;
    }
    // Persist only with complete owner+character scope; otherwise session-only.
    // Persistence lives in the domain store (not inline in the engine stack).
    const persisted = saveLiveActPersonalCalibrationProfile(profile);
    this.applyPersonalProfile(profile);
    this.personalCalibrating = false;
    this.personalCapturePaused = false;
    this.personalSession = null;
    this.lastEmittedCountdownSec = null;
    const resolve = this.calibrationResolve;
    this.calibrationResolve = null;
    const messageDe = persisted
      ? 'Premium-Kalibrierung gespeichert (lokal) — Neutral, Range, Noise Floor aktiv.'
      : 'Premium-Kalibrierung aktiv — lokales Speichern nicht verfügbar. Gilt nur für diese Sitzung.';
    this.setCalibrationUi('success', messageDe);
    resolve?.({ ok: true, messageDe, persisted });
    this.emitStatus(true);
  }

  private computePersonalPhaseLabelDe(): string | null {
    if (!this.personalCalibrating || !this.personalSession) return null;
    const id = currentLiveActPersonalPhaseId(this.personalSession);
    const phase = LIVEACT_PERSONAL_CALIBRATION_PHASES.find((p) => p.id === id);
    return phase?.labelDe ?? null;
  }

  private computeCanSkipPersonalPhase(): boolean {
    if (!this.personalCalibrating || !this.personalSession) return false;
    const id = currentLiveActPersonalPhaseId(this.personalSession);
    const phase = LIVEACT_PERSONAL_CALIBRATION_PHASES.find((p) => p.id === id);
    return Boolean(phase?.skipAllowed);
  }

  private emitPersonalPhasePrompt(): void {
    if (!this.personalSession) return;
    const id = currentLiveActPersonalPhaseId(this.personalSession);
    const phase = LIVEACT_PERSONAL_CALIBRATION_PHASES.find((p) => p.id === id);
    if (!phase) return;
    this.setCalibrationUi('running', `${phase.labelDe}: ${phase.holdDe}`);
  }

  private failCalibration(messageDe: string): void {
    this.calibrating = false;
    this.personalCalibrating = false;
    this.personalSession = null;
    this.calibrationPhase = 'neutral';
    this.canAdvanceCalibration = false;
    this.rangeStepPhase = 'armed';
    this.rangeStepPeaks = [];
    this.lastEmittedCountdownSec = null;
    const resolve = this.calibrationResolve;
    this.calibrationResolve = null;
    this.setCalibrationUi('failed', messageDe);
    resolve?.({ ok: false, messageDe });
    this.emitStatus(true);
  }

  private cancelCalibration(messageDe: string): void {
    if (!this.calibrating && !this.personalCalibrating) return;
    this.calibrating = false;
    this.personalCalibrating = false;
    this.personalSession = null;
    this.calibrationPhase = 'neutral';
    this.canAdvanceCalibration = false;
    this.rangeStepPhase = 'armed';
    this.rangeStepPeaks = [];
    this.lastEmittedCountdownSec = null;
    const resolve = this.calibrationResolve;
    this.calibrationResolve = null;
    this.setCalibrationUi('idle', messageDe);
    resolve?.({ ok: false, messageDe });
  }

  private setCalibrationUi(status: LiveActCalibrationStatus, message: string): void {
    this.calibrationStatus = status;
    this.calibrationMessage = message;
  }

  private cancelLoop(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private cleanupMedia(): void {
    if (this.statusCoalesceTimer !== null) {
      clearTimeout(this.statusCoalesceTimer);
      this.statusCoalesceTimer = null;
    }
    this.pendingStatusCoalesce = false;
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.deviceChangeHandler && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
      this.deviceChangeHandler = null;
    }
    try {
      this.source?.dispose();
    } catch {
      // ignore
    }
    this.source = null;
    this.cleanupStreamOnly();
    this.inferenceInFlight = 0;
  }

  private setStatus(status: LiveActStatus, message: string): void {
    this.status = status;
    this.message = message;
    this.emitStatus(true);
  }

  private scheduleCoalescedStatusEmit(): void {
    if (this.pendingStatusCoalesce || this.statusCoalesceTimer !== null) return;
    this.pendingStatusCoalesce = true;
    const delay = Math.max(50, 1000 / 5);
    this.statusCoalesceTimer = setTimeout(() => {
      this.statusCoalesceTimer = null;
      this.pendingStatusCoalesce = false;
      this.emitStatus(false);
    }, delay);
  }

  private emitStatus(force: boolean): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && shouldThrottleLiveActUiStatus(this.lastStatusEmitMs, now)) {
      this.scheduleCoalescedStatusEmit();
      return;
    }
    this.lastStatusEmitMs = now;
    const state = this.getState();
    for (const listener of this.statusListeners) {
      listener(state);
    }
  }

  private emitFrame(frame: LiveActFrameV1): void {
    for (const listener of this.frameListeners) {
      listener(frame);
    }
  }

  private emitDiagnostics(frame: LiveActFaceDiagnosticsFrameV1): void {
    for (const listener of this.diagnosticsListeners) {
      listener(frame);
    }
  }

  private emitDiagnosticsV2(snapshot: LiveActDiagnosticsV2Snapshot): void {
    for (const listener of this.diagnosticsV2Listeners) {
      listener(snapshot);
    }
  }

  private emitDenseFaceFeatures(frame: LiveActDenseFaceFeaturesV1): void {
    for (const listener of this.denseFaceFeaturesListeners) {
      listener(frame);
    }
  }

  private emitIrisGaze(gaze: LiveActIrisGazeV1): void {
    for (const listener of this.irisGazeListeners) {
      listener(gaze);
    }
  }

  private emitHybridFace(frame: LiveActHybridFaceV1): void {
    for (const listener of this.hybridFaceListeners) {
      listener(frame);
    }
  }
}
```

### src/infrastructure/character/liveact/liveact-engine.ts:1479

```ts
export function createIdleLiveActFrame(): LiveActFrameV1 {
  return createNeutralLiveActFrame({ timestampMs: 0, sequence: 0, trackingLost: true });
}
```

### src/infrastructure/character/liveact/liveact-eye-bone-aliases.ts:30

```ts
export function resolveLiveActEyeBones(root: THREE.Object3D): {
  left: THREE.Object3D | null;
  right: THREE.Object3D | null;
} {
  const leftSet = new Set<string>(LEFT_EYE_ALIASES);
  const rightSet = new Set<string>(RIGHT_EYE_ALIASES);
  let left: THREE.Object3D | null = null;
  let right: THREE.Object3D | null = null;

  root.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return;
    const key = normalizeBoneName(object.name);
    if (!left && leftSet.has(key)) left = object;
    if (!right && rightSet.has(key)) right = object;
  });

  return { left, right };
}
```

### src/infrastructure/character/liveact/liveact-face-diagnostics.ts:44

```ts
export function mapMediaPipeLandmarksToLiveActDiagnostics(input: {
  landmarks: readonly NormalizedLandmarkLike[] | undefined;
  connections: {
    faceOval: readonly ConnectionLike[];
    lips: readonly ConnectionLike[];
    leftEye: readonly ConnectionLike[];
    rightEye: readonly ConnectionLike[];
    leftEyebrow: readonly ConnectionLike[];
    rightEyebrow: readonly ConnectionLike[];
  };
  timestampMs: number;
  sequence: number;
  faceIndex: number;
  faceCount: number;
  trackingLost: boolean;
}): LiveActFaceDiagnosticsFrameV1 {
  if (input.trackingLost || !input.landmarks || input.landmarks.length === 0) {
    return createEmptyLiveActFaceDiagnosticsFrame({
      timestampMs: input.timestampMs,
      sequence: input.sequence,
    });
  }

  const landmarks: LiveActFaceLandmark2d[] = input.landmarks.map((lm) => ({
    x: typeof lm.x === 'number' && Number.isFinite(lm.x) ? lm.x : 0,
    y: typeof lm.y === 'number' && Number.isFinite(lm.y) ? lm.y : 0,
  }));

  const contours: LiveActFaceDiagnosticsContours = {
    faceOval: polylineFromConnections(input.landmarks, input.connections.faceOval),
    lips: polylineFromConnections(input.landmarks, input.connections.lips),
    leftEye: polylineFromConnections(input.landmarks, input.connections.leftEye),
    rightEye: polylineFromConnections(input.landmarks, input.connections.rightEye),
    leftEyebrow: polylineFromConnections(input.landmarks, input.connections.leftEyebrow),
    rightEyebrow: polylineFromConnections(input.landmarks, input.connections.rightEyebrow),
  };

  const frame: LiveActFaceDiagnosticsFrameV1 = {
    contractVersion: 'SagaTreeLiveActFaceDiagnosticsV1',
    timestampMs: input.timestampMs,
    sequence: input.sequence,
    trackingLost: false,
    faceIndex: input.faceIndex,
    faceCount: input.faceCount,
    landmarks,
    contours,
  };
  assertLiveActFaceDiagnosticsLocalOnly(frame);
  return frame;
}
```

### src/infrastructure/character/liveact/liveact-morph-target-index.ts:8

```ts
export interface LiveActMorphTargetBinding {
  mesh: THREE.Mesh;
  index: number;
}
```

### src/infrastructure/character/liveact/liveact-morph-target-index.ts:13

```ts
export type LiveActMorphTargetIndex = ReadonlyMap<string, readonly LiveActMorphTargetBinding[]>;
```

### src/infrastructure/character/liveact/liveact-morph-target-index.ts:16

```ts
export function buildLiveActMorphTargetIndex(root: THREE.Object3D): LiveActMorphTargetIndex {
  const map = new Map<string, LiveActMorphTargetBinding[]>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const dictionary = object.morphTargetDictionary;
    const influences = object.morphTargetInfluences;
    if (!dictionary || !influences) return;
    for (const [name, index] of Object.entries(dictionary)) {
      if (typeof index !== 'number') continue;
      const list = map.get(name) ?? [];
      list.push({ mesh: object, index });
      map.set(name, list);
    }
  });

  return map;
}
```

### src/infrastructure/character/liveact/liveact-morph-target-index.ts:35

```ts
export function listLiveActMorphTargetNames(index: LiveActMorphTargetIndex): string[] {
  return [...index.keys()].sort();
}
```

### src/infrastructure/character/liveact/liveact-pose-drive.ts:20

```ts
export interface LiveActLookAtGazeScaleDeg {
  horizontal: number;
  up: number;
  down: number;
}
```

### src/infrastructure/character/liveact/liveact-pose-drive.ts:35

```ts
export function liveActLookAtGazeScaleDeg(applier: VRMLookAtApplier): LiveActLookAtGazeScaleDeg {
  const fallback = LIVEACT_LOOKAT_FALLBACK_INPUT_MAX_DEG;
  const inputMax = (map: VRMLookAtRangeMap): number => positiveOr(map.inputMaxValue, fallback);
  if (applier instanceof VRMLookAtBoneApplier) {
    // three-vrm's bone applier reads rangeMapVerticalDown for pitch < 0 (up) and
    // rangeMapVerticalUp for pitch > 0 (down); pinned by scripts/liveact-fidelity-check.mjs.
    return {
      horizontal: inputMax(applier.rangeMapHorizontalOuter),
      up: inputMax(applier.rangeMapVerticalDown),
      down: inputMax(applier.rangeMapVerticalUp),
    };
  }
  if (applier instanceof VRMLookAtExpressionApplier) {
    const fullWeightInput = (map: VRMLookAtRangeMap): number =>
      inputMax(map) * Math.min(1, 1 / positiveOr(map.outputScale, 1));
    return {
      horizontal: fullWeightInput(applier.rangeMapHorizontalOuter),
      up: fullWeightInput(applier.rangeMapVerticalUp),
      down: fullWeightInput(applier.rangeMapVerticalDown),
    };
  }
  return { horizontal: fallback, up: fallback, down: fallback };
}
```

### src/infrastructure/character/liveact/liveact-pose-drive.ts:59

```ts
export function applyLiveActHeadRotation(
  headBone: THREE.Object3D | null,
  restQuaternion: THREE.Quaternion,
  head: LiveActHeadPose,
  scratchEuler: THREE.Euler,
  scratchQuaternion: THREE.Quaternion,
): void {
  if (!headBone) return;
  scratchEuler.set(head.pitch, head.yaw, head.roll, 'YXZ');
  scratchQuaternion.setFromEuler(scratchEuler);
  headBone.quaternion.copy(restQuaternion).multiply(scratchQuaternion);
}
```

### src/infrastructure/character/liveact/liveact-pose-drive.ts:79

```ts
export function applyLiveActVrmEyeLookAt(
  vrm: VRM | undefined,
  eyeLeft: LiveActEyeGaze,
  eyeRight: LiveActEyeGaze,
): void {
  const lookAt = vrm?.lookAt;
  if (!lookAt) return;
  const x = (eyeLeft.x + eyeRight.x) * 0.5;
  const y = (eyeLeft.y + eyeRight.y) * 0.5;
  const scale = liveActLookAtGazeScaleDeg(lookAt.applier);
  lookAt.yaw = x * scale.horizontal;
  lookAt.pitch = -y * (y >= 0 ? scale.up : scale.down);
}
```

### src/infrastructure/character/liveact/liveact-pose-drive.ts:93

```ts
export function applyLiveActEyeBoneGaze(
  leftEye: THREE.Object3D | null,
  rightEye: THREE.Object3D | null,
  leftRest: THREE.Quaternion,
  rightRest: THREE.Quaternion,
  eyeLeft: LiveActEyeGaze,
  eyeRight: LiveActEyeGaze,
  scratchEuler: THREE.Euler,
  scratchQuaternion: THREE.Quaternion,
): void {
  if (leftEye) {
    scratchEuler.set(eyeLeft.y * 0.35, eyeLeft.x * 0.35, 0, 'YXZ');
    scratchQuaternion.setFromEuler(scratchEuler);
    leftEye.quaternion.copy(leftRest).multiply(scratchQuaternion);
  }
  if (rightEye) {
    scratchEuler.set(eyeRight.y * 0.35, eyeRight.x * 0.35, 0, 'YXZ');
    scratchQuaternion.setFromEuler(scratchEuler);
    rightEye.quaternion.copy(rightRest).multiply(scratchQuaternion);
  }
}
```

### src/infrastructure/character/liveact/liveact-pose-drive.ts:115

```ts
export function resetLiveActHeadRotation(
  headBone: THREE.Object3D | null,
  restQuaternion: THREE.Quaternion,
): void {
  if (!headBone) return;
  headBone.quaternion.copy(restQuaternion);
}
```

### src/infrastructure/character/liveact/liveact-pose-drive.ts:123

```ts
export function resetLiveActEyeBoneGaze(
  leftEye: THREE.Object3D | null,
  rightEye: THREE.Object3D | null,
  leftRest: THREE.Quaternion,
  rightRest: THREE.Quaternion,
): void {
  if (leftEye) leftEye.quaternion.copy(leftRest);
  if (rightEye) rightEye.quaternion.copy(rightRest);
}
```

### src/infrastructure/character/liveact/liveact-retarget-profile-registry.ts:15

```ts
export interface LiveActRetargetProfileSelectionInput {
  /** Validated avatar capability matrix from the bound output adapter. */
  avatarCapabilities: LiveActAvatarCapabilities | null;
  /**
   * Optional evidence note for future QA-documented overrides.
   * Unused while identity is the shipped default (#403).
   */
  evidenceNote?: string | null;
}
```

### src/infrastructure/character/liveact/liveact-retarget-profile-registry.ts:29

```ts
export function resolveLiveActRetargetProfile(
  _input: LiveActRetargetProfileSelectionInput,
): LiveActRetargetProfileV1 {
  return createIdentityLiveActRetargetProfile();
}
```

### src/infrastructure/character/liveact/liveact-rig-debug.ts:11

```ts
export interface LiveActRigDebugController {
  /** Rebind after model load/swap; pass null when model removed. */
  bindModelRoot(root: THREE.Object3D | null): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  hasSkeleton(): boolean;
  /** Hide helper during portrait capture (restores prior visibility after). */
  runWithoutHelper<T>(fn: () => T): T;
  dispose(): void;
}
```

### src/infrastructure/character/liveact/liveact-rig-debug.ts:36

```ts
export function createLiveActRigDebugController(scene: THREE.Scene): LiveActRigDebugController {
  let modelRoot: THREE.Object3D | null = null;
  let helper: SkeletonHelper | null = null;
  let enabled = false;

  const removeHelper = (): void => {
    if (!helper) return;
    scene.remove(helper);
    helper.geometry.dispose();
    if (helper.material instanceof THREE.Material) {
      helper.material.dispose();
    }
    helper = null;
  };

  const rebuildHelper = (): void => {
    removeHelper();
    if (!modelRoot) return;
    const skinned = findPrimarySkinnedMesh(modelRoot);
    if (!skinned || !skinned.skeleton?.bones?.length) return;
    helper = new SkeletonHelper(skinned);
    helper.userData.sagatreeLiveActRigDebug = true;
    // Draw through the mesh so the debug overlay is actually visible.
    const materials = Array.isArray(helper.material) ? helper.material : [helper.material];
    for (const mat of materials) {
      if (mat && 'depthTest' in mat) {
        mat.depthTest = false;
        mat.depthWrite = false;
      }
    }
    helper.renderOrder = 10;
    helper.visible = enabled;
    scene.add(helper);
  };

  return {
    bindModelRoot(root) {
      modelRoot = root;
      rebuildHelper();
    },
    setEnabled(next) {
      enabled = next;
      if (helper) {
        helper.visible = next;
        return;
      }
      if (next && modelRoot) rebuildHelper();
    },
    isEnabled() {
      return enabled;
    },
    hasSkeleton() {
      if (!modelRoot) return false;
      return Boolean(findPrimarySkinnedMesh(modelRoot));
    },
    runWithoutHelper(fn) {
      if (helper) helper.visible = false;
      try {
        return fn();
      } finally {
        if (helper) helper.visible = enabled;
      }
    },
    dispose() {
      enabled = false;
      modelRoot = null;
      removeHelper();
    },
  };
}
```

### src/infrastructure/character/liveact/liveact-session-transport.ts:26

```ts
export type LiveActRemoteApplyTarget = {
  applyLiveActFrame(frame: LiveActFrameV1): void;
  resetLiveActPose(): void;
};
```

### src/infrastructure/character/liveact/liveact-session-transport.ts:31

```ts
export type LiveActSessionTransportOptions = {
  readonly mediaPlane: SessionMediaPlane;
  /** Subscribe calibrated frames from LiveActEngine.subscribeFrame. */
  readonly subscribeLocalFrame: (listener: (frame: LiveActFrameV1) => void) => () => void;
  /** Authoritative userId → characterId. */
  readonly getRosterByUserId: () => Readonly<Record<string, string>>;
  /** Resolve avatar output for a character (remote apply). */
  readonly getOutputForCharacter: (characterId: string) => LiveActRemoteApplyTarget | null;
  readonly canPublish: boolean;
  readonly nowMs?: () => number;
  readonly maxSendHz?: number;
};
```

### src/infrastructure/character/liveact/liveact-session-transport.ts:44

```ts
export class LiveActSessionTransport {
  private unsubLocal: (() => void) | null = null;
  private unsubData: (() => void) | null = null;
  private lastSendMs = 0;
  private lastSentSequence = 0;
  private readonly remoteByIdentity = new Map<string, LiveActRemoteConsumerState>();
  private readonly nowMs: () => number;
  private readonly minSendIntervalMs: number;

  constructor(private readonly options: LiveActSessionTransportOptions) {
    this.nowMs = options.nowMs ?? (() => Date.now());
    const hz = options.maxSendHz ?? LIVEACT_NETWORK_MAX_SEND_HZ;
    this.minSendIntervalMs = Math.max(1, Math.floor(1000 / hz));
  }

  start(): void {
    this.stop();
    if (this.options.canPublish) {
      this.unsubLocal = this.options.subscribeLocalFrame((frame) => {
        void this.publishFrame(frame);
      });
    }
    this.unsubData = this.options.mediaPlane.subscribeLiveActData((message) => {
      if (message.topic !== LIVEACT_NETWORK_TOPIC) return;
      this.onRemotePayload(message.publisherIdentity, message.payload);
    });
  }

  stop(): void {
    this.unsubLocal?.();
    this.unsubLocal = null;
    this.unsubData?.();
    this.unsubData = null;
    for (const [identity, state] of this.remoteByIdentity) {
      this.clearPublisher(identity, state);
    }
    this.remoteByIdentity.clear();
  }

  private async publishFrame(frame: LiveActFrameV1): Promise<void> {
    if (!this.options.canPublish) return;
    const now = this.nowMs();
    if (now - this.lastSendMs < this.minSendIntervalMs) return;
    if (frame.sequence <= this.lastSentSequence && !frame.trackingLost) return;
    const network = encodeLiveActNetworkFrame(frame);
    const ok = await this.options.mediaPlane.publishLiveActData(
      serializeLiveActNetworkFrame(network),
    );
    if (ok) {
      this.lastSendMs = now;
      this.lastSentSequence = frame.sequence;
    }
  }

  private onRemotePayload(publisherIdentity: string, payload: string): void {
    const decoded = parseLiveActNetworkFrameJson(payload);
    if (!decoded.ok) return;

    const characterId = resolveRemoteLiveActCharacterId({
      publisherIdentity,
      rosterByUserId: this.options.getRosterByUserId(),
    });
    if (!characterId) return;

    const output = this.options.getOutputForCharacter(characterId);
    if (!output) return;

    let state =
      this.remoteByIdentity.get(publisherIdentity) ?? createLiveActRemoteConsumerState();
    const accepted = acceptLiveActRemoteFrame({
      state,
      network: decoded.frame,
      liveAct: decoded.liveAct,
      nowWallMs: this.nowMs(),
    });
    this.remoteByIdentity.set(publisherIdentity, accepted.state);

    if (accepted.result.action === 'drop') return;
    if (accepted.result.action === 'neutral') {
      output.resetLiveActPose();
      output.applyLiveActFrame(accepted.result.frame);
      return;
    }
    output.applyLiveActFrame(accepted.result.frame);
  }

  private clearPublisher(
    identity: string,
    state: LiveActRemoteConsumerState,
  ): void {
    const cleared = clearLiveActRemoteConsumer(state);
    const characterId = resolveRemoteLiveActCharacterId({
      publisherIdentity: identity,
      rosterByUserId: this.options.getRosterByUserId(),
    });
    if (!characterId) return;
    const output = this.options.getOutputForCharacter(characterId);
    if (!output) return;
    output.resetLiveActPose();
    if (cleared.result.action === 'neutral' || cleared.result.action === 'apply') {
      output.applyLiveActFrame(cleared.result.frame);
    }
  }
}
```

### src/infrastructure/character/liveact/mediapipe-dense-semantic-points-v1.ts:24

```ts
export const MEDIAPIPE_DENSE_SEMANTIC_POINTS_VERSION =
  'MediaPipeDenseSemanticPointsV1' as const;
```

### src/infrastructure/character/liveact/mediapipe-dense-semantic-points-v1.ts:58

```ts
export interface MediaPipeDenseExtensionEntryV1 {
  readonly pointId: DenseSemanticPointId;
  readonly landmarkIndices: readonly number[];
  readonly kind: MediaPipeFaceAnchorMapEntryV1['kind'];
}
```

### src/infrastructure/character/liveact/mediapipe-dense-semantic-points-v1.ts:64

```ts
export const MEDIAPIPE_DENSE_EXTENSION_MAP_V1: readonly MediaPipeDenseExtensionEntryV1[] = [
  // Upper lip stations (anatomical left → right)
  { pointId: 'lipUpperOuterLeft', landmarkIndices: [291, 312], kind: 'midpoint' },
  { pointId: 'lipUpperInnerLeft', landmarkIndices: [311, 312], kind: 'midpoint' },
  { pointId: 'lipUpperInnerRight', landmarkIndices: [81, 82], kind: 'midpoint' },
  { pointId: 'lipUpperOuterRight', landmarkIndices: [61, 82], kind: 'midpoint' },
  // Lower lip stations
  { pointId: 'lipLowerOuterLeft', landmarkIndices: [291, 321], kind: 'midpoint' },
  { pointId: 'lipLowerInnerLeft', landmarkIndices: [321, 405], kind: 'midpoint' },
  { pointId: 'lipLowerInnerRight', landmarkIndices: [91, 181], kind: 'midpoint' },
  { pointId: 'lipLowerOuterRight', landmarkIndices: [61, 91], kind: 'midpoint' },
  // Nose bridge / alar (tip already from anchors)
  { pointId: 'noseBridge', landmarkIndices: [6, 168], kind: 'midpoint' },
  { pointId: 'noseAlarLeft', landmarkIndices: [129, 358], kind: 'midpoint' },
  { pointId: 'noseAlarRight', landmarkIndices: [102, 49], kind: 'midpoint' },
  // Cheeks
  { pointId: 'cheekLeft', landmarkIndices: [425, 427], kind: 'midpoint' },
  { pointId: 'cheekRight', landmarkIndices: [205, 207], kind: 'midpoint' },
  // Nasolabial proxies
  { pointId: 'nasolabialLeft', landmarkIndices: [410, 287], kind: 'midpoint' },
  { pointId: 'nasolabialRight', landmarkIndices: [186, 57], kind: 'midpoint' },
  // Jaw
  { pointId: 'jawLeft', landmarkIndices: [397, 365], kind: 'midpoint' },
  { pointId: 'jawRight', landmarkIndices: [172, 136], kind: 'midpoint' },
] as const;
```

### src/infrastructure/character/liveact/mediapipe-dense-semantic-points-v1.ts:154

```ts
export function mapMediaPipeLandmarksToDenseSemanticGeometry(input: {
  landmarks: readonly NormalizedLandmark2dLike[] | undefined;
  faceConfidence?: number;
}): DenseSemanticGeometryV1 {
  const points = {} as Record<DenseSemanticPointId, DenseSemanticPoint3>;
  for (const id of DENSE_SEMANTIC_POINT_IDS) {
    points[id] = emptyPoint();
  }

  const landmarks = input.landmarks;
  if (!landmarks || landmarks.length === 0) {
    return {
      contractVersion: LIVEACT_DENSE_SEMANTIC_GEOMETRY_CONTRACT,
      points,
      faceConfidence: 0,
    };
  }

  for (const entry of MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_V1) {
    const denseId = ANCHOR_TO_DENSE[entry.anchorId];
    if (!denseId) continue;
    points[denseId] = resolveAnchorPoint(landmarks, entry);
  }

  for (const entry of MEDIAPIPE_DENSE_EXTENSION_MAP_V1) {
    points[entry.pointId] = resolveExtension(landmarks, entry);
  }

  const faceConfidence =
    typeof input.faceConfidence === 'number' && Number.isFinite(input.faceConfidence)
      ? Math.min(1, Math.max(0, input.faceConfidence))
      : 1;

  return {
    contractVersion: LIVEACT_DENSE_SEMANTIC_GEOMETRY_CONTRACT,
    points,
    faceConfidence,
  };
}
```

### src/infrastructure/character/liveact/mediapipe-face-image-landmarker.ts:14

```ts
export interface MediaPipeImageLandmark2d {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
```

### src/infrastructure/character/liveact/mediapipe-face-image-landmarker.ts:20

```ts
export interface MediaPipeFaceImageDetectResult {
  readonly faceCount: number;
  /** Normalized landmarks for face 0 (empty when faceCount !== 1). */
  readonly landmarks: readonly MediaPipeImageLandmark2d[];
}
```

### src/infrastructure/character/liveact/mediapipe-face-image-landmarker.ts:26

```ts
export interface MediaPipeFaceImageLandmarker {
  detect(image: HTMLCanvasElement | HTMLImageElement | ImageBitmap): MediaPipeFaceImageDetectResult;
  dispose(): void;
}
```

### src/infrastructure/character/liveact/mediapipe-face-image-landmarker.ts:35

```ts
export async function createMediaPipeFaceImageLandmarker(): Promise<MediaPipeFaceImageLandmarker | null> {
  if (typeof window === 'undefined') return null;
  try {
    const mod = await import('@mediapipe/tasks-vision');
    const fileset = await mod.FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_PATH);
    // CPU: still frames + avoids GPU context fights with the Three.js renderer.
    const landmarker = await mod.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

    return {
      detect(image) {
        const result = landmarker.detect(image);
        const raw = result.faceLandmarks ?? [];
        const faceCount = raw.length;
        if (faceCount !== 1 || !raw[0]) {
          return { faceCount, landmarks: [] };
        }
        const landmarks = raw[0].map((p) => ({
          x: p.x,
          y: p.y,
          z: typeof p.z === 'number' ? p.z : 0,
        }));
        return { faceCount, landmarks };
      },
      dispose() {
        try {
          landmarker.close?.();
        } catch {
          // ignore
        }
      },
    };
  } catch (error) {
    console.warn('[face-mapping-auto] MediaPipe IMAGE landmarker unavailable', error);
    return null;
  }
}
```

### src/infrastructure/character/liveact/mediapipe-face-source.ts:31

```ts
export const MEDIAPIPE_VISION_WASM_PATH = '/mediapipe/wasm';
```

### src/infrastructure/character/liveact/mediapipe-face-source.ts:32

```ts
export const MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH =
  '/mediapipe/models/face_landmarker.task';
```

### src/infrastructure/character/liveact/mediapipe-face-source.ts:35

```ts
export interface LiveActFaceDetectResult {
  samples: LiveActSourceSample[];
  diagnostics: LiveActFaceDiagnosticsFrameV1[];
  /** Provider-neutral dense features — side-channel; not part of LiveActFrameV1. */
  denseFeatures: LiveActDenseFaceFeaturesV1[];
  /** Iris geometric gaze — side-channel; blendshape remains fallback evidence. */
  irisGaze: LiveActIrisGazeV1[];
}
```

### src/infrastructure/character/liveact/mediapipe-face-source.ts:44

```ts
export interface LiveActFaceSource {
  detect(video: HTMLVideoElement, timestampMs: number): LiveActFaceDetectResult;
  dispose(): void;
}
```

### src/infrastructure/character/liveact/mediapipe-face-source.ts:49

```ts
export type LiveActFaceSourceFactory = (
  profile: LiveActQualityProfile,
) => Promise<LiveActFaceSource>;
```

### src/infrastructure/character/liveact/mediapipe-face-source.ts:57

```ts
export async function createMediaPipeLiveActFaceSource(
  profile: LiveActQualityProfile = resolveLiveActQualityProfile({}),
): Promise<LiveActFaceSource | null> {
  if (typeof window === 'undefined') return null;
  try {
    const mod = await import('@mediapipe/tasks-vision');
    const fileset = await mod.FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_PATH);
    const landmarker = await mod.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: profile.outputFaceBlendshapes,
      outputFacialTransformationMatrixes: profile.outputFacialTransformationMatrixes,
    });

    const connections = {
      faceOval: mod.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
      lips: mod.FaceLandmarker.FACE_LANDMARKS_LIPS,
      leftEye: mod.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      rightEye: mod.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
      leftEyebrow: mod.FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
      rightEyebrow: mod.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    };

    return {
      detect(video, timestampMs) {
        const result = landmarker.detectForVideo(video, timestampMs);
        const shapes = result.faceBlendshapes ?? [];
        const rawLandmarks = result.faceLandmarks ?? [];
        if (shapes.length === 0) {
          return { samples: [], diagnostics: [], denseFeatures: [], irisGaze: [] };
        }
        const blendshapeSamples: LiveActSourceSample[] = shapes.map((shape, index) =>
          mapMediaPipeFaceToLiveActSample({
            categories: shape.categories,
            matrix: result.facialTransformationMatrixes?.[index]?.data,
            enableHeadPose: profile.enableHeadPose,
            faceIndex: index,
            faceCount: shapes.length,
          }),
        );

        const diagnostics = shapes.map((_, index) =>
          mapMediaPipeLandmarksToLiveActDiagnostics({
            landmarks: rawLandmarks[index],
            connections,
            timestampMs,
            sequence: 0,
            faceIndex: index,
            faceCount: shapes.length,
            trackingLost: false,
          }),
        );

        // Dense features side-channel (#445): landmarks → semantic points → extract.
        // Raw landmark arrays are not retained on the returned dense frame.
        const denseFeatures = shapes.map((_, index) => {
          const geometry = mapMediaPipeLandmarksToDenseSemanticGeometry({
            landmarks: rawLandmarks[index],
            faceConfidence: 1,
          });
          return extractDenseFaceFeatures({
            geometry,
            sequence: 0,
            timestampMs,
          });
        });

        // Iris gaze (#446): geometry → head-local solve → arbitrate vs blendshape eyeLook*.
        const irisGaze: LiveActIrisGazeV1[] = [];
        const samples: LiveActSourceSample[] = blendshapeSamples.map((sample, index) => {
          const irisGeom = mapMediaPipeLandmarksToIrisGeometry({
            landmarks: rawLandmarks[index],
            faceConfidence: 1,
          });
          const solved = solveIrisGaze({
            geometry: irisGeom,
            sequence: 0,
            timestampMs,
          });
          const arb = arbitrateLiveActGaze({
            iris: solved,
            blendshape: {
              eyeLeftX: sample.eyeLeftX,
              eyeLeftY: sample.eyeLeftY,
              eyeRightX: sample.eyeRightX,
              eyeRightY: sample.eyeRightY,
            },
          });
          irisGaze.push(arb.iris ?? solved);
          return {
            ...sample,
            eyeLeftX: arb.eyeLeftX,
            eyeLeftY: arb.eyeLeftY,
            eyeRightX: arb.eyeRightX,
            eyeRightY: arb.eyeRightY,
          };
        });

        return { samples, diagnostics, denseFeatures, irisGaze };
      },
      dispose() {
        try {
          landmarker.close?.();
        } catch {
          // ignore
        }
      },
    };
  } catch (error) {
    console.warn('[liveact] MediaPipe face source unavailable', error);
    return null;
  }
}
```

### src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts:25

```ts
export const MEDIAPIPE_IRIS_GEOMETRY_VERSION = 'MediaPipeIrisGeometryV1' as const;
```

### src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts:31

```ts
export const MEDIAPIPE_LEFT_IRIS_CONTOUR_INDICES = [474, 475, 476, 477] as const;
```

### src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts:32

```ts
export const MEDIAPIPE_RIGHT_IRIS_CONTOUR_INDICES = [469, 470, 471, 472] as const;
```

### src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts:113

```ts
export function mapMediaPipeLandmarksToIrisGeometry(input: {
  landmarks: readonly NormalizedLandmark2dLike[] | undefined;
  faceConfidence?: number;
}): IrisBinocularGeometryV1 {
  const landmarks = input.landmarks;
  const faceConfidence =
    typeof input.faceConfidence === 'number' && Number.isFinite(input.faceConfidence)
      ? Math.min(1, Math.max(0, input.faceConfidence))
      : 1;

  if (!landmarks || landmarks.length === 0) {
    const emptyEye: IrisEyeGeometryV1 = {
      innerCorner: emptyPoint(),
      outerCorner: emptyPoint(),
      upperLid: emptyPoint(),
      lowerLid: emptyPoint(),
      irisCenter: emptyPoint(),
      irisContourAvailableCount: 0,
    };
    return {
      contractVersion: LIVEACT_IRIS_EYE_GEOMETRY_CONTRACT,
      left: emptyEye,
      right: emptyEye,
      forehead: emptyPoint(),
      noseBridge: emptyPoint(),
      noseTip: emptyPoint(),
      faceConfidence: 0,
    };
  }

  return {
    contractVersion: LIVEACT_IRIS_EYE_GEOMETRY_CONTRACT,
    left: resolveEye(landmarks, 'left'),
    right: resolveEye(landmarks, 'right'),
    forehead: resolveAnchor(landmarks, 'forehead'),
    noseBridge: (() => {
      // Dense extension uses nose bridge; fall back to midpoint noseTip/forehead if missing
      const tip = resolveAnchor(landmarks, 'noseTip');
      const fh = resolveAnchor(landmarks, 'forehead');
      if (tip.available && fh.available) {
        return {
          available: true,
          x: (tip.x + fh.x) * 0.5,
          y: (tip.y + fh.y) * 0.5,
          z: (tip.z + fh.z) * 0.5,
        };
      }
      return tip.available ? tip : fh;
    })(),
    noseTip: resolveAnchor(landmarks, 'noseTip'),
    faceConfidence,
  };
}
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:21

```ts
export const MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_VERSION =
  'MediaPipeSagaTreeFaceAnchorMapV1' as const;
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:24

```ts
export type MediaPipeFaceAnchorSampleKind = 'single' | 'centroid' | 'midpoint';
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:26

```ts
export interface MediaPipeFaceAnchorMapEntryV1 {
  readonly anchorId: SagaTreeFaceAnchorId;
  /** MediaPipe Face Mesh / Face Landmarker landmark index(es). */
  readonly landmarkIndices: readonly number[];
  readonly kind: MediaPipeFaceAnchorSampleKind;
  /** Anatomical / authoring rationale (DE/EN ok). */
  readonly rationale: string;
  /** Expected surface region for QA. */
  readonly expectedRegion:
    | 'mouth'
    | 'eye_left'
    | 'eye_right'
    | 'brow_left'
    | 'brow_right'
    | 'midline';
  /** Anatomical laterality relative to the subject (not screen). */
  readonly laterality: 'left' | 'right' | 'center';
}
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:49

```ts
export function mediapipeAnatomicalLeftLandmarkIndicesForTests(): readonly number[] {
  return [
    291, // mouth corner left
    362, // eye left inner (LEFT_EYE)
    263, // eye left outer (LEFT_EYE)
    386, // eye left upper lid (LEFT_EYE)
    385,
    387,
    374, // eye left lower lid
    380,
    373,
    336, // brow left inner
    334, // brow left (in LEFT_EYEBROW centroid set)
    300, // brow left outer
    296,
    295,
    293,
    285,
    283,
    282,
    276,
  ] as const;
}
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:77

```ts
export const MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_V1: readonly MediaPipeFaceAnchorMapEntryV1[] = [
  {
    anchorId: 'noseTip',
    landmarkIndices: [1],
    kind: 'single',
    rationale: 'Face Mesh tip of nose (stable midline). Keep unless new evidence.',
    expectedRegion: 'midline',
    laterality: 'center',
  },
  {
    anchorId: 'chin',
    landmarkIndices: [175, 199],
    kind: 'midpoint',
    rationale:
      'Chin pad center: midpoint of tesselation chin-pad landmarks 175+199 — not FACE_OVAL bottom 152.',
    expectedRegion: 'midline',
    laterality: 'center',
  },
  {
    anchorId: 'forehead',
    landmarkIndices: [151, 10],
    kind: 'midpoint',
    rationale:
      'Visible forehead center: midpoint of mid-forehead 151 and oval-top 10 — not hairline-only 10.',
    expectedRegion: 'midline',
    laterality: 'center',
  },
  {
    anchorId: 'mouthUpper',
    landmarkIndices: [0, 13],
    kind: 'midpoint',
    rationale:
      'Upper lip body: midpoint of outer upper lip 0 and inner upper 13 (FACE_LANDMARKS_LIPS). Not seam-only 13.',
    expectedRegion: 'mouth',
    laterality: 'center',
  },
  {
    anchorId: 'mouthLower',
    landmarkIndices: [14, 17],
    kind: 'midpoint',
    rationale:
      'Lower lip body: midpoint of inner lower 14 and outer lower 17 (FACE_LANDMARKS_LIPS). Not seam-only 14.',
    expectedRegion: 'mouth',
    laterality: 'center',
  },
  {
    anchorId: 'mouthCornerLeft',
    landmarkIndices: [291],
    kind: 'single',
    rationale:
      "Anatomical left mouth corner (291). Paired with FACE_LANDMARKS_LEFT_EYE laterality — not LiveAct mouthLeft=61.",
    expectedRegion: 'mouth',
    laterality: 'left',
  },
  {
    anchorId: 'mouthCornerRight',
    landmarkIndices: [61],
    kind: 'single',
    rationale:
      "Anatomical right mouth corner (61). Paired with FACE_LANDMARKS_RIGHT_EYE laterality — not LiveAct mouthRight=291.",
    expectedRegion: 'mouth',
    laterality: 'right',
  },
  {
    anchorId: 'eyeLeftInner',
    landmarkIndices: [362],
    kind: 'single',
    rationale:
      "Subject's left eye inner canthus — FaceLandmarker.FACE_LANDMARKS_LEFT_EYE (362).",
    expectedRegion: 'eye_left',
    laterality: 'left',
  },
  {
    anchorId: 'eyeLeftOuter',
    landmarkIndices: [263],
    kind: 'single',
    rationale:
      "Subject's left eye outer canthus — FaceLandmarker.FACE_LANDMARKS_LEFT_EYE (263).",
    expectedRegion: 'eye_left',
    laterality: 'left',
  },
  {
    anchorId: 'eyeLeftUpper',
    landmarkIndices: [386, 385, 387],
    kind: 'centroid',
    rationale:
      'Left upper lid centroid from FACE_LANDMARKS_LEFT_EYE (386+neighbors) — single lid index alone jitters.',
    expectedRegion: 'eye_left',
    laterality: 'left',
  },
  {
    anchorId: 'eyeLeftLower',
    landmarkIndices: [374, 380, 373],
    kind: 'centroid',
    rationale:
      'Left lower lid centroid from FACE_LANDMARKS_LEFT_EYE neighborhood (374+neighbors).',
    expectedRegion: 'eye_left',
    laterality: 'left',
  },
  {
    anchorId: 'eyeRightInner',
    landmarkIndices: [133],
    kind: 'single',
    rationale:
      "Subject's right eye inner canthus — FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE (133).",
    expectedRegion: 'eye_right',
    laterality: 'right',
  },
  {
    anchorId: 'eyeRightOuter',
    landmarkIndices: [33],
    kind: 'single',
    rationale:
      "Subject's right eye outer canthus — FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE (33).",
    expectedRegion: 'eye_right',
    laterality: 'right',
  },
  {
    anchorId: 'eyeRightUpper',
    landmarkIndices: [159, 158, 157],
    kind: 'centroid',
    rationale:
      'Right upper lid centroid from FACE_LANDMARKS_RIGHT_EYE (159+neighbors).',
    expectedRegion: 'eye_right',
    laterality: 'right',
  },
  {
    anchorId: 'eyeRightLower',
    landmarkIndices: [145, 144, 153],
    kind: 'centroid',
    rationale:
      'Right lower lid centroid from FACE_LANDMARKS_RIGHT_EYE neighborhood (145+neighbors).',
    expectedRegion: 'eye_right',
    laterality: 'right',
  },
  {
    anchorId: 'browLeftInner',
    landmarkIndices: [336],
    kind: 'single',
    rationale:
      "Subject's left brow near glabella — FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW (336).",
    expectedRegion: 'brow_left',
    laterality: 'left',
  },
  {
    anchorId: 'browLeftCenter',
    landmarkIndices: [296, 334, 282],
    kind: 'centroid',
    rationale:
      "Visible left brow centerline mid — centroid of LEFT_EYEBROW mid-arc 296/334/282 (between inner 336 and outer 300).",
    expectedRegion: 'brow_left',
    laterality: 'left',
  },
  {
    anchorId: 'browLeftOuter',
    landmarkIndices: [300],
    kind: 'single',
    rationale:
      "Subject's left brow temple end — FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW (300).",
    expectedRegion: 'brow_left',
    laterality: 'left',
  },
  {
    anchorId: 'browRightInner',
    landmarkIndices: [107],
    kind: 'single',
    rationale:
      "Subject's right brow near glabella — FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW (107).",
    expectedRegion: 'brow_right',
    laterality: 'right',
  },
  {
    anchorId: 'browRightCenter',
    landmarkIndices: [66, 105, 52],
    kind: 'centroid',
    rationale:
      "Visible right brow centerline mid — centroid of RIGHT_EYEBROW mid-arc 66/105/52 (between inner 107 and outer 70).",
    expectedRegion: 'brow_right',
    laterality: 'right',
  },
  {
    anchorId: 'browRightOuter',
    landmarkIndices: [70],
    kind: 'single',
    rationale:
      "Subject's right brow temple end — FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW (70).",
    expectedRegion: 'brow_right',
    laterality: 'right',
  },
] as const;
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:268

```ts
export const FACE_ANCHOR_MAP_V1_LIMITATIONS = [
  'no_full_upper_lip_curve',
  'no_full_lower_lip_curve',
  'no_detailed_cheek_surface',
  'no_nasolabial_curve',
  'no_iris_pupil_representation',
  'no_detailed_lid_curve',
] as const;
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:277

```ts
export interface NormalizedLandmark2dLike {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:283

```ts
export interface ResolvedMediaPipeAnchorSampleV1 {
  readonly anchorId: SagaTreeFaceAnchorId;
  readonly available: boolean;
  readonly x: number;
  readonly y: number;
  /** Fraction of required landmarks present (0..1). */
  readonly availability: number;
  readonly laterality: 'left' | 'right' | 'center';
}
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:304

```ts
export function resolveMediaPipeAnchorSample(
  landmarks: readonly NormalizedLandmark2dLike[],
  entry: MediaPipeFaceAnchorMapEntryV1,
): ResolvedMediaPipeAnchorSampleV1 {
  const points: NormalizedLandmark2dLike[] = [];
  for (const index of entry.landmarkIndices) {
    const p = at(landmarks, index);
    if (p) points.push(p);
  }
  const availability =
    entry.landmarkIndices.length === 0 ? 0 : points.length / entry.landmarkIndices.length;
  if (points.length === 0) {
    return {
      anchorId: entry.anchorId,
      available: false,
      x: Number.NaN,
      y: Number.NaN,
      availability: 0,
      laterality: entry.laterality,
    };
  }
  // single / midpoint / centroid all use equal-weight mean of present indices.
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  x /= points.length;
  y /= points.length;
  return {
    anchorId: entry.anchorId,
    available: true,
    x,
    y,
    availability,
    laterality: entry.laterality,
  };
}
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:344

```ts
export function resolveAllMediaPipeAnchorSamples(
  landmarks: readonly NormalizedLandmark2dLike[],
): readonly ResolvedMediaPipeAnchorSampleV1[] {
  return MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_V1.map((entry) =>
    resolveMediaPipeAnchorSample(landmarks, entry),
  );
}
```

### src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts:353

```ts
export function assertMediaPipeSagaTreeFaceAnchorMapComplete(): void {
  const ids = new Set(MEDIAPIPE_SAGATREE_FACE_ANCHOR_MAP_V1.map((e) => e.anchorId));
  if (ids.size !== 21) {
    throw new Error(`MediaPipe map must cover 21 unique anchors (got ${ids.size}).`);
  }
}
```

### src/infrastructure/character/liveact/vrm-liveact-avatar-output.ts:59

```ts
export interface VrmLiveActAvatarOutputDeps {
  vrm: VRM;
  headBone: THREE.Object3D | null;
  headRestQuaternion: THREE.Quaternion;
  headScratchEuler: THREE.Euler;
  headScratchQuaternion: THREE.Quaternion;
}
```

### src/infrastructure/character/liveact/vrm-liveact-avatar-output.ts:67

```ts
export class VrmLiveActAvatarOutput implements LiveActAvatarOutput {
  private readonly resolved: Readonly<Partial<Record<LiveActFaceChannelId, string>>>;
  private readonly faceSupported: ReadonlySet<LiveActFaceChannelId>;
  private readonly avatarCapabilities: LiveActAvatarCapabilities;
  private readonly hasLookAt: boolean;
  private readonly gazePath: LiveActGazeDrivePath;
  private readonly performanceFaceReport: PerformanceFaceValidationReportV1;
  private disposed = false;
  private applied: LiveActDiagnosticsV2AppliedValues = createUnavailableLiveActAppliedValues();

  constructor(private readonly deps: VrmLiveActAvatarOutputDeps) {
    const present = listVrmExpressionNames(deps.vrm);
    const resolution = resolveLiveActChannelTargets(present);
    this.resolved = resolution.resolvedNames;
    this.hasLookAt = Boolean(deps.vrm.lookAt);
    const hasEyeLookMorphs = LIVEACT_FACE_CHANNELS.some(
      (id) => isLiveActEyeLookFaceChannel(id) && Boolean(this.resolved[id]),
    );
    this.gazePath = resolveLiveActGazeDrivePath({
      hasEyeBones: false,
      hasLookAt: this.hasLookAt,
      hasEyeLookMorphs,
    });
    const skipEyeLook = liveActGazePathSkipsEyeLookMorphs(this.gazePath);
    this.faceSupported = new Set(
      LIVEACT_FACE_CHANNELS.filter((id) => {
        if (!this.resolved[id]) return false;
        if (skipEyeLook && isLiveActEyeLookFaceChannel(id)) return false;
        return true;
      }),
    );
    this.avatarCapabilities = createLiveActAvatarCapabilities({
      headBone: Boolean(deps.headBone),
      leftEyeBone: this.hasLookAt,
      rightEyeBone: this.hasLookAt,
      avatarFace: resolution.faceSupport,
      gazeDrivePath: this.gazePath,
      runtimeKind: 'vrm',
    });
    const arkitPresentChannels = LIVEACT_FACE_CHANNELS.filter(
      (id) => resolution.faceSupport[id],
    );
    this.performanceFaceReport = validatePerformanceFaceV2({
      presentTargetNames: present,
      hasHumanoid: Boolean(deps.headBone || deps.vrm.humanoid),
      hasHead: Boolean(deps.headBone),
      gazeDrivePath: this.gazePath,
      arkitPresentChannels,
    });
    this.recordNeutralApplied();
  }

  getAvatarCapabilities(): LiveActAvatarCapabilities {
    return this.avatarCapabilities;
  }

  getPerformanceFaceReport(): PerformanceFaceValidationReportV1 {
    return this.performanceFaceReport;
  }

  applyPerformanceFaceWeights(
    weights: Readonly<Partial<Record<PerformanceFaceControlId, number>>>,
  ): void {
    if (this.disposed || !this.performanceFaceReport.premiumEligible) return;
    const manager = this.deps.vrm.expressionManager;
    if (!manager) return;
    writePerformanceFaceWeights({
      writeWeight: (targetName, weight) => {
        try {
          manager.setValue(targetName, weight);
        } catch {
          // fail-soft — expression may be absent despite name resolution
        }
      },
      resolvedNames: this.performanceFaceReport.resolvedTargetNames,
      weights,
    });
  }

  getAppliedDiagnostics(): LiveActDiagnosticsV2AppliedValues {
    return this.applied;
  }

  applyLiveActFrame(frame: LiveActFrameV1): void {
    if (this.disposed || frame.trackingLost) {
      this.resetLiveActPose();
      return;
    }

    applyLiveActHeadRotation(
      this.deps.headBone,
      this.deps.headRestQuaternion,
      frame.head,
      this.deps.headScratchEuler,
      this.deps.headScratchQuaternion,
    );
    const usePoseGaze = liveActGazePathUsesPoseDriver(this.gazePath);
    if (usePoseGaze && this.hasLookAt) {
      applyLiveActVrmEyeLookAt(this.deps.vrm, frame.eyeLeft, frame.eyeRight);
    } else {
      this.deps.vrm.lookAt?.reset?.();
    }

    const skipEyeLook = liveActGazePathSkipsEyeLookMorphs(this.gazePath);
    const manager = this.deps.vrm.expressionManager;
    const faceApplied: Partial<Record<LiveActFaceChannelId, number>> = {};
    if (manager) {
      for (const id of LIVEACT_FACE_CHANNELS) {
        const name = this.resolved[id];
        if (!name) continue;
        if (skipEyeLook && isLiveActEyeLookFaceChannel(id)) {
          try {
            manager.setValue(name, 0);
          } catch {
            // fail-soft
          }
          continue;
        }
        const weight = clampLiveActChannel(frame.face[id]);
        try {
          manager.setValue(name, weight);
          faceApplied[id] = weight;
        } catch {
          // fail-soft per binding
        }
      }
    }

    this.applied = buildLiveActAppliedValuesFromFace({
      headSupported: Boolean(this.deps.headBone),
      eyeLeftSupported: usePoseGaze && this.hasLookAt,
      eyeRightSupported: usePoseGaze && this.hasLookAt,
      faceSupported: this.faceSupported,
      face: faceApplied,
      head: frame.head,
      eyeLeft: frame.eyeLeft,
      eyeRight: frame.eyeRight,
      mode: 'driven',
    });
  }

  resetLiveActPose(): void {
    resetLiveActHeadRotation(this.deps.headBone, this.deps.headRestQuaternion);
    this.deps.vrm.lookAt?.reset?.();
    this.deps.vrm.expressionManager?.resetValues?.();
    for (const id of LIVEACT_FACE_CHANNELS) {
      const name = this.resolved[id];
      if (!name || !this.deps.vrm.expressionManager) continue;
      const neutral = id === '_neutral' ? 1 : 0;
      try {
        this.deps.vrm.expressionManager.setValue(name, neutral);
      } catch {
        // ignore
      }
    }
    this.recordNeutralApplied();
  }

  dispose(): void {
    this.disposed = true;
    this.resetLiveActPose();
    this.applied = createUnavailableLiveActAppliedValues();
  }

  private recordNeutralApplied(): void {
    const face: Partial<Record<LiveActFaceChannelId, number>> = {};
    for (const id of this.faceSupported) {
      face[id] = id === '_neutral' ? 1 : 0;
    }
    const usePoseGaze = liveActGazePathUsesPoseDriver(this.gazePath);
    this.applied = buildLiveActAppliedValuesFromFace({
      headSupported: Boolean(this.deps.headBone),
      eyeLeftSupported: usePoseGaze && this.hasLookAt,
      eyeRightSupported: usePoseGaze && this.hasLookAt,
      faceSupported: this.faceSupported,
      face,
      head: { yaw: 0, pitch: 0, roll: 0 },
      eyeLeft: { x: 0, y: 0 },
      eyeRight: { x: 0, y: 0 },
      mode: 'neutral',
    });
  }
}
```

### src/infrastructure/character/supabase-character.repository.ts:72

```ts
export class SupabaseCharacterRepository {
  private readonly tableName = 'characters';

  mapToViewModel(dto: CharacterDto): CharacterVm {
    const rulesetKey = dto.ruleset_key === 'dnd-5.5e' ? 'dnd-5.5e' : 'sagatree-core';
    const inventoryRead = readCharacterInventory(dto);
    return {
      id: dto.id,
      publicId: typeof dto.public_id === 'string' ? dto.public_id : undefined,
      name: dto.name,
      description: dto.description,
      class: dto.class,
      race: dto.race,
      rulesetKey,
      dndBackground: rulesetKey === 'dnd-5.5e' && typeof dto.dnd_background === 'string' ? dto.dnd_background : undefined,
      level: dto.level,
      sheetStatus: normalizeSheetStatus(dto.sheet_status),
      backgroundStory: dto.background_story,
      notes: typeof dto.notes === 'string' ? dto.notes : '',
      personalityTraits: normalizeTextBlocks(dto.personality_traits),
      ideals: normalizeTextBlocks(dto.ideals),
      bonds: normalizeTextBlocks(dto.bonds),
      flaws: normalizeTextBlocks(dto.flaws),
      appearance: normalizeCharacterAppearance(dto.appearance),
      attributes: normalizeAttributes(dto.attributes),
      skills: normalizeSkills(dto.skills),
      sagaTreeProfile: normalizeSagaTreeProfile(dto.sagatree_profile),
      abilities: dto.abilities || [],
      inventory: normalizeInventory(dto.inventory),
      inventoryV2: inventoryRead.state,
      inventorySchemaVersion: inventoryRead.authoritativeV2 ? 2 : 1,
      abstractResources: parseCharacterAbstractResources(dto.resources),
      emotionProfiles: dto.emotion_profiles || [],
      portraitUrl: dto.portrait_url || undefined,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    };
  }

  async getUserCharacterSummaries(): Promise<CharacterSummaryVm[]> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(this.tableName)
        .select('id, public_id, name, class, race, level, portrait_url, sheet_status')
        .eq('owner_user_id', userId)
        .eq('character_type', 'pc')
        .order('created_at', { ascending: false }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Failed to fetch characters: request timed out',
    );
    if (error) throw new Error(`Failed to fetch characters: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      publicId: typeof row.public_id === 'string' ? row.public_id : undefined,
      name: typeof row.name === 'string' ? row.name : '',
      class: typeof row.class === 'string' ? row.class : '',
      race: typeof row.race === 'string' ? row.race : '',
      level: typeof row.level === 'number' ? row.level : 1,
      sheetStatus: normalizeSheetStatus(row.sheet_status),
      portraitUrl: typeof row.portrait_url === 'string' ? row.portrait_url : undefined,
    }));
  }

  async getUserCharacters(): Promise<CharacterVm[]> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await raceWithTimeoutReject(
      supabase.from(this.tableName).select('*').eq('owner_user_id', userId).eq('character_type', 'pc').order('created_at', { ascending: false }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Failed to fetch characters: request timed out',
    );
    if (error) throw new Error(`Failed to fetch characters: ${error.message}`);
    return (data || []).map((character) => this.mapToViewModel(character as CharacterDto));
  }

  async getCharacterById(id: string): Promise<CharacterVm> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase.from(this.tableName).select('*').eq('id', id).eq('owner_user_id', userId).single();
    if (error) throw new Error(`Failed to fetch character: ${error.message}`);
    if (!data) throw new Error('Character not found');
    return this.mapToViewModel(data as CharacterDto);
  }

  /**
   * Batch roster meta for lobby — one `in(id)` select, owner-scoped, no full sheet JSONB.
   * Missing / non-owned ids are omitted (caller applies fallbacks).
   */
  async getCharacterRosterMetaByIds(ids: readonly string[]): Promise<CharacterRosterMetaVm[]> {
    const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))];
    if (unique.length === 0) return [];
    const userId = await getAuthenticatedUserId();
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(this.tableName)
        .select('id, public_id, name, portrait_url, level, class, race, sagatree_profile')
        .eq('owner_user_id', userId)
        .in('id', unique),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Failed to fetch character roster meta: request timed out',
    );
    if (error) throw new Error(`Failed to fetch character roster meta: ${error.message}`);
    return (data ?? []).map((row) => {
      const profile =
        row.sagatree_profile && typeof row.sagatree_profile === 'object'
          ? (row.sagatree_profile as Record<string, unknown>)
          : null;
      const essenceRaw = profile && typeof profile.essence === 'string' ? profile.essence : null;
      const archetypeRaw =
        profile && typeof profile.archetype === 'string' ? profile.archetype : null;
      return {
        id: row.id as string,
        publicId: typeof row.public_id === 'string' ? row.public_id : null,
        name: typeof row.name === 'string' && row.name.length > 0 ? row.name : 'Charakter',
        portraitUrl: typeof row.portrait_url === 'string' && row.portrait_url.length > 0
          ? row.portrait_url
          : null,
        level: typeof row.level === 'number' && Number.isFinite(row.level) ? row.level : null,
        classLabel: typeof row.class === 'string' && row.class.trim().length > 0
          ? row.class.trim()
          : null,
        raceKey: typeof row.race === 'string' && row.race.trim().length > 0
          ? row.race.trim()
          : null,
        essenceKey: essenceRaw,
        archetypeKey: archetypeRaw,
      };
    });
  }

  async getCharacterByPublicId(publicId: string): Promise<CharacterVm> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('public_id', publicId.trim().toUpperCase())
      .eq('owner_user_id', userId)
      .single();
    if (error) throw new Error(`Failed to fetch character: ${error.message}`);
    if (!data) throw new Error('Character not found');
    return this.mapToViewModel(data as CharacterDto);
  }

  async createCharacter(payload: CreateCharacterDto): Promise<CharacterVm> {
    const userId = await getAuthenticatedUserId();
    const rulesetKey = payload.ruleset_key ?? 'sagatree-core';
    const attributes = normalizeAttributes(payload.attributes);
    const level = payload.level || 1;
    const sagatreeProfile = rulesetKey === 'sagatree-core'
      ? normalizeSagaTreeProfile(payload.sagatree_profile)
      : null;
    const skills = normalizeSkills(payload.skills);
    const sheetStatus = normalizeSheetStatus(payload.sheet_status);
    // Incomplete drafts skip full build asserts; complete sheets stay strict.
    if (sagatreeProfile && sheetStatus === 'complete') {
      assertValidSagaTreeCharacterPersistence(attributes, skills, sagatreeProfile, level);
    }
    const inventoryV2 = payload.inventory_v2
      ? await assertWritableInventoryV2(payload.inventory_v2, null)
      : undefined;
    const characterData: Partial<CharacterDto> = {
      owner_user_id: userId,
      character_type: 'pc',
      name: payload.name,
      description: payload.description,
      class: payload.class,
      race: payload.race,
      ruleset_key: rulesetKey,
      dnd_background: rulesetKey === 'dnd-5.5e' ? payload.dnd_background ?? null : null,
      level,
      sheet_status: sheetStatus,
      background_story: payload.background_story,
      notes: payload.notes?.trim() || null,
      personality_traits: payload.personality_traits,
      ideals: payload.ideals,
      bonds: payload.bonds,
      flaws: payload.flaws,
      appearance: normalizeCharacterAppearance(payload.appearance),
      attributes,
      skills: normalizeSkills(payload.skills),
      sagatree_profile: sagatreeProfile,
      abilities: payload.abilities ?? [],
      inventory: normalizeInventory(payload.inventory),
      ...(inventoryV2
        ? { inventory_v2: inventoryV2, inventory_schema_version: 2 as const }
        : { inventory_schema_version: 1 as const }),
      resources: serializeCharacterAbstractResources(
        payload.abstractResources ?? createDefaultAbstractResources(),
      ),
      emotion_profiles: [],
      portrait_url: payload.portrait_url || undefined,
    };
    const { data, error } = await supabase.from(this.tableName).insert(characterData).select().single();
    if (error) throw new Error(`Failed to create character: ${error.message}`);
    return this.mapToViewModel(data as CharacterDto);
  }

  async updateCharacter(id: string, payload: UpdateCharacterDto): Promise<CharacterVm> {
    const userId = await getAuthenticatedUserId();
    const rulesetPatch = payload.ruleset_key
      ? { ruleset_key: payload.ruleset_key, dnd_background: payload.ruleset_key === 'dnd-5.5e' ? payload.dnd_background ?? null : null }
      : {};
    const attributes = payload.attributes ? normalizeAttributes(payload.attributes) : undefined;
    const profilePatch = payload.sagatree_profile;
    const sagatreeProfile = profilePatch ? normalizeSagaTreeProfile(profilePatch) : undefined;
    // Any SagaTree-relevant field in the patch triggers validation of the full
    // effective future state (patch values merged over the stored character).
    const touchesSagaTreeState = Boolean(
      payload.attributes
        || payload.skills
        || payload.sagatree_profile
        || typeof payload.level === 'number'
        || payload.ruleset_key
        || payload.sheet_status,
    );
    if (touchesSagaTreeState) {
      // Loaded exactly once; owner-scoped, so foreign characters stay unreachable.
      const existing = await this.getCharacterById(id);
      const effectiveRuleset = payload.ruleset_key ?? existing.rulesetKey;
      const effectiveSheetStatus = payload.sheet_status
        ? normalizeSheetStatus(payload.sheet_status)
        : existing.sheetStatus;
      if (effectiveRuleset === 'sagatree-core' && effectiveSheetStatus === 'complete') {
        assertValidSagaTreeCharacterPersistence(
          attributes ?? existing.attributes,
          payload.skills ? normalizeSkills(payload.skills) : existing.skills,
          sagatreeProfile ?? existing.sagaTreeProfile,
          typeof payload.level === 'number' ? payload.level : existing.level,
        );
      }
    }
    const {
      inventory_v2: inventoryV2Patch,
      inventory: inventoryPatch,
      abstractResources: abstractResourcesPatch,
      // Callers must not flip the marker without a validated inventory_v2 write.
      inventory_schema_version: _ignoredSchemaVersion,
      ...safePayload
    } = payload as UpdateCharacterDto & { inventory_schema_version?: 1 | 2 };

    const inventoryV2 = inventoryV2Patch
      ? await assertWritableInventoryV2(inventoryV2Patch, id)
      : undefined;

    const updatePayload = {
      ...safePayload,
      ...rulesetPatch,
      ...(payload.sheet_status ? { sheet_status: normalizeSheetStatus(payload.sheet_status) } : {}),
      ...(payload.appearance ? { appearance: normalizeCharacterAppearance(payload.appearance) } : {}),
      ...(attributes ? { attributes } : {}),
      ...(payload.skills ? { skills: normalizeSkills(payload.skills) } : {}),
      ...(sagatreeProfile ? { sagatree_profile: sagatreeProfile } : {}),
      ...(inventoryPatch ? { inventory: normalizeInventory(inventoryPatch) } : {}),
      ...(inventoryV2
        ? { inventory_v2: inventoryV2, inventory_schema_version: 2 as const }
        : {}),
      ...(abstractResourcesPatch
        ? { resources: serializeCharacterAbstractResources(abstractResourcesPatch) }
        : {}),
      ...(typeof payload.notes === 'string' ? { notes: payload.notes.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from(this.tableName).update(updatePayload).eq('id', id).eq('owner_user_id', userId).select().single();
    if (error) throw new Error(`Failed to update character: ${error.message}`);
    return this.mapToViewModel(data as CharacterDto);
  }

  async deleteCharacter(id: string): Promise<void> {
    const userId = await getAuthenticatedUserId();
    const { error } = await supabase.from(this.tableName).delete().eq('id', id).eq('owner_user_id', userId);
    if (error) throw new Error(`Failed to delete character: ${error.message}`);
  }

  async searchCharacters(query: string): Promise<CharacterVm[]> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase.from(this.tableName).select('*').eq('owner_user_id', userId).eq('character_type', 'pc').ilike('name', `%${query}%`).order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to search characters: ${error.message}`);
    return (data || []).map((character) => this.mapToViewModel(character as CharacterDto));
  }

  async uploadPortrait(file: File): Promise<string> {
    const userId = await getAuthenticatedUserId();
    const sniffed = await sniffPortraitMime(file);
    if (!sniffed) {
      throw new Error('Invalid file type. Only PNG, JPEG, WEBP and GIF images are allowed.');
    }
    if (file.type && file.type !== sniffed) {
      throw new Error('Declared image type does not match file contents.');
    }
    const extension = CHARACTER_PORTRAIT_MIME_EXTENSIONS[sniffed];
    if (file.size > CHARACTER_PORTRAIT_MAX_BYTES) throw new Error('File too large. Maximum size is 5MB.');
    const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(CHARACTER_PORTRAIT_BUCKET).upload(filePath, file, {
      contentType: sniffed,
      upsert: false,
    });
    if (uploadError) throw new Error(`Failed to upload portrait: ${uploadError.message}`);
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(CHARACTER_PORTRAIT_BUCKET)
      .createSignedUrl(filePath, CHARACTER_PORTRAIT_SIGNED_SECONDS);
    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(signedUrlError ? `Failed to create portrait URL: ${signedUrlError.message}` : 'Failed to create portrait URL');
    }
    return signedUrlData.signedUrl;
  }
}
```

### src/infrastructure/character/supabase-character.repository.ts:378

```ts
export const supabaseCharacterRepository = new SupabaseCharacterRepository();
```


## Remaining backend helper operations

### src/infrastructure/character/avatar/character-avatar-artifact-service.ts:49

```ts
async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error('Anmeldung erforderlich für Avatar-Artefakte.');
  }
  return data.user.id;
}
```

### src/infrastructure/character/avatar/character-avatar-export-service.ts:26

```ts
async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error('Anmeldung erforderlich, um den Avatar zu exportieren.');
  }
  return data.user.id;
}
```

### src/infrastructure/character/avatar/character-avatar-export-service.ts:40

```ts
async function tryFetchSourceMeshBytes(url: string | undefined): Promise<Uint8Array | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return undefined;
  }
}
```

### src/infrastructure/character/avatar/character-avatar-import-service.ts:33

```ts
async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error('Anmeldung erforderlich, um einen 3D-Charakter zu importieren.');
  }
  return data.user.id;
}
```

### src/infrastructure/character/avatar/character-avatar-meshy-service.ts:89

```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('character-avatar-meshy', { body });
  if (error) {
    return { status: 'error', message: error.message || 'Edge Function fehlgeschlagen.' };
  }
  return parseResponse(data);
}
```

### src/infrastructure/character/character-adventure-arc-service.ts:84

```ts
async listArcsForCharacter(characterId: string): Promise<CharacterAdventureArcVm[]> {
    const trimmedId = characterId.trim();
    if (!trimmedId) throw new Error('Character id is required.');

    const { data: memberships, error: membershipError } = await supabase
      .from('project_members')
      .select('project_id, joined_at, status')
      .eq('character_id', trimmedId);

    if (membershipError) {
      throw new Error(`Abenteuer-Mitgliedschaften konnten nicht geladen werden: ${membershipError.message}`);
    }

    const activeMemberships = (memberships ?? []).filter((row) => row.status === 'active');

    const { data: existingArcs, error: arcsError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('character_id', trimmedId)
      .order('started_at', { ascending: false });

    if (arcsError) {
      throw new Error(`Abenteuer-Statistik konnte nicht geladen werden: ${arcsError.message}`);
    }

    const arcsByProject = new Map(
      ((existingArcs ?? []) as CharacterAdventureArcDto[]).map((arc) => [arc.project_id, arc]),
    );

    for (const membership of activeMemberships) {
      const projectId = membership.project_id as string;
      if (arcsByProject.has(projectId)) continue;

      const { data: inserted, error: insertError } = await supabase
        .from(TABLE)
        .insert({
          character_id: trimmedId,
          project_id: projectId,
          status: 'active',
          started_at: membership.joined_at ?? new Date().toISOString(),
          developments: [],
        })
        .select('*')
        .single();

      if (insertError) {
        // Concurrent upsert / unique race: reload later in this pass.
        if (insertError.code === '23505') continue;
        throw new Error(`Abenteuer-Bogen konnte nicht angelegt werden: ${insertError.message}`);
      }

      arcsByProject.set(projectId, inserted as CharacterAdventureArcDto);
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('character_id', trimmedId)
      .order('started_at', { ascending: false });

    if (refreshError) {
      throw new Error(`Abenteuer-Statistik konnte nicht aktualisiert werden: ${refreshError.message}`);
    }

    const arcs = (refreshed ?? []) as CharacterAdventureArcDto[];
    if (arcs.length === 0) return [];

    const projectIds = [...new Set(arcs.map((arc) => arc.project_id))];

    const [{ data: projects, error: projectsError }, { data: sessions, error: sessionsError }] = await Promise.all([
      supabase.from('projects').select('id, name, status').in('id', projectIds),
      supabase.from('sessions').select('project_id').in('project_id', projectIds),
    ]);

    if (projectsError) {
      throw new Error(`Projekte zur Statistik konnten nicht geladen werden: ${projectsError.message}`);
    }
    if (sessionsError) {
      throw new Error(`Sessions zur Statistik konnten nicht geladen werden: ${sessionsError.message}`);
    }

    const projectMeta = new Map(
      (projects ?? []).map((project) => [
        project.id as string,
        {
          name: typeof project.name === 'string' ? project.name : 'Unbenanntes Abenteuer',
          status: typeof project.status === 'string' ? project.status : null,
        },
      ]),
    );

    const sessionCounts = new Map<string, number>();
    for (const session of sessions ?? []) {
      const projectId = session.project_id as string;
      sessionCounts.set(projectId, (sessionCounts.get(projectId) ?? 0) + 1);
    }

    return arcs.map((arc) => {
      const meta = projectMeta.get(arc.project_id);
      return mapArc(
        arc,
        meta?.name ?? 'Unbekanntes Abenteuer',
        meta?.status ?? null,
        sessionCounts.get(arc.project_id) ?? 0,
      );
    });
  }
```

### src/infrastructure/character/character-adventure-arc-service.ts:192

```ts
async appendDevelopment(
    arcId: string,
    input: AppendAdventureDevelopmentInput,
  ): Promise<CharacterAdventureArcVm> {
    const title = input.title.trim();
    if (!title) throw new Error('Titel der Entwicklung ist erforderlich.');
    if (!isDevelopmentKind(input.kind)) throw new Error('Ungültige Entwicklungsart.');

    const { data: current, error: loadError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', arcId)
      .single();

    if (loadError || !current) {
      throw new Error(`Abenteuer-Bogen nicht gefunden: ${loadError?.message ?? 'missing'}`);
    }

    const dto = current as CharacterAdventureArcDto;
    const developments = normalizeDevelopments(dto.developments);
    const nextEntry: CharacterAdventureDevelopmentDto = {
      id: createDevelopmentId(),
      at: new Date().toISOString(),
      kind: input.kind,
      title,
    };
    const detail = input.detail?.trim();
    if (detail) nextEntry.detail = detail;
    if (input.meta && Object.keys(input.meta).length > 0) nextEntry.meta = input.meta;

    const nextDevelopments = [...developments, nextEntry];

    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update({ developments: nextDevelopments })
      .eq('id', arcId)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new Error(`Entwicklung konnte nicht gespeichert werden: ${updateError?.message ?? 'missing'}`);
    }

    const { data: project } = await supabase
      .from('projects')
      .select('name, status')
      .eq('id', (updated as CharacterAdventureArcDto).project_id)
      .maybeSingle();

    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', (updated as CharacterAdventureArcDto).project_id);

    return mapArc(
      updated as CharacterAdventureArcDto,
      typeof project?.name === 'string' ? project.name : 'Unbenanntes Abenteuer',
      typeof project?.status === 'string' ? project.status : null,
      count ?? 0,
    );
  }
```

### src/infrastructure/character/character-lore-service.ts:74

```ts
async generateBackground(
    request: CharacterLoreGenerationRequest,
  ): Promise<CharacterLoreGenerationResult> {
    const { data, error } = await supabase.functions.invoke('character-lore', {
      body: {
        action: 'generate-background',
        context: request.context,
        currentBackgroundStory: request.currentBackgroundStory,
      },
    });

    if (error) {
      const serverMessage = await getFunctionErrorMessage(error);
      throw new Error(
        serverMessage ??
          'Hintergrundgeschichte konnte nicht generiert werden. Bitte versuche es erneut.',
      );
    }

    const response = parseFunctionResponse(data);
    if (response.status !== 'ok') {
      throw new Error(response.message);
    }

    return {
      story: response.story,
      provider: response.provider,
      model: response.model,
    };
  }
```

### src/infrastructure/character/character-preset-service.ts:198

```ts
async listUserPresets(): Promise<CharacterPresetVm[]> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(TABLE)
        .select('*')
        .eq('owner_user_id', userId)
        .eq('origin', 'user')
        .order('created_at', { ascending: false }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Presets konnten nicht geladen werden: Zeitüberschreitung',
    );
    if (error) throw new Error(`Presets konnten nicht geladen werden: ${error.message}`);

    const rows = (data ?? []) as CharacterPresetDto[];
    const sourceIds = Array.from(new Set(rows.map((row) => row.source_character_id).filter((id): id is string => Boolean(id))));
    const existingSourceIds = new Set<string>();
    if (sourceIds.length > 0) {
      const { data: characters, error: charactersError } = await supabase
        .from('characters')
        .select('id')
        .eq('owner_user_id', userId)
        .in('id', sourceIds);
      if (charactersError) {
        console.error('Preset source character lookup failed:', charactersError.message);
      } else {
        for (const row of characters ?? []) {
          if (typeof row.id === 'string') existingSourceIds.add(row.id);
        }
      }
    }

    return rows.map((row) => {
      const missing = Boolean(row.source_character_id) && !existingSourceIds.has(row.source_character_id as string);
      return mapToViewModel(row, missing);
    });
  }
```

### src/infrastructure/character/character-preset-service.ts:236

```ts
async getPresetForCharacter(characterId: string): Promise<CharacterPresetVm | null> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('owner_user_id', userId)
      .eq('source_character_id', characterId)
      .eq('origin', 'user')
      .maybeSingle();
    if (error) throw new Error(`Preset konnte nicht geladen werden: ${error.message}`);
    if (!data) return null;
    return mapToViewModel(data as CharacterPresetDto, false);
  }
```

### src/infrastructure/character/character-preset-service.ts:250

```ts
async createPresetFromCharacter(input: CreateCharacterPresetInput): Promise<CharacterPresetVm> {
    const userId = await getAuthenticatedUserId();
    if (input.rulesetKey !== 'sagatree-core') {
      throw new Error('Presets sind derzeit nur für SagaTree Core verfügbar.');
    }
    const snapshot = withSafePortraitUrl(input.snapshot);
    assertValidSnapshot(snapshot);

    const existing = await this.getPresetForCharacter(input.sourceCharacterId);
    if (existing) {
      throw new Error('Für diesen Charakter existiert bereits ein Preset. Nutze „Version freigeben“.');
    }

    const version: CharacterPresetVersionDto = {
      level: snapshot.level,
      snapshot,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        owner_user_id: userId,
        display_name: input.displayName.trim() || `${snapshot.name.trim()} Preset`,
        ruleset_key: 'sagatree-core',
        origin: 'user',
        source_character_id: input.sourceCharacterId,
        published: false,
        versions: [version],
      })
      .select()
      .single();
    if (error) throw new Error(`Preset konnte nicht gespeichert werden: ${error.message}`);
    return mapToViewModel(data as CharacterPresetDto, false);
  }
```

### src/infrastructure/character/character-preset-service.ts:285

```ts
async releaseVersion(input: ReleaseCharacterPresetVersionInput): Promise<CharacterPresetVm> {
    const userId = await getAuthenticatedUserId();
    const snapshot = withSafePortraitUrl(input.snapshot);
    assertValidSnapshot(snapshot);

    const { data: existing, error: loadError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', input.presetId)
      .eq('owner_user_id', userId)
      .single();
    if (loadError || !existing) {
      throw new Error(loadError ? `Preset nicht gefunden: ${loadError.message}` : 'Preset nicht gefunden.');
    }

    const dto = existing as CharacterPresetDto;
    const versions = normalizeVersions(dto.versions);
    if (versions.some((version) => version.level === snapshot.level)) {
      throw new Error(`Für Level ${snapshot.level} existiert bereits eine Preset-Version.`);
    }

    const nextVersions = [
      ...versions,
      {
        level: snapshot.level,
        snapshot,
        created_at: new Date().toISOString(),
      },
    ].sort((a, b) => a.level - b.level || a.created_at.localeCompare(b.created_at));

    const { data, error } = await supabase
      .from(TABLE)
      .update({ versions: nextVersions, published: false, updated_at: new Date().toISOString() })
      .eq('id', input.presetId)
      .eq('owner_user_id', userId)
      .select()
      .single();
    if (error) throw new Error(`Version konnte nicht freigegeben werden: ${error.message}`);
    return mapToViewModel(data as CharacterPresetDto, false);
  }
```

### src/infrastructure/character/character-preset-service.ts:326

```ts
async renamePreset(presetId: string, displayName: string): Promise<CharacterPresetVm> {
    const userId = await getAuthenticatedUserId();
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error('Preset-Name darf nicht leer sein.');
    const { data, error } = await supabase
      .from(TABLE)
      .update({ display_name: trimmed, published: false, updated_at: new Date().toISOString() })
      .eq('id', presetId)
      .eq('owner_user_id', userId)
      .select()
      .single();
    if (error) throw new Error(`Preset konnte nicht umbenannt werden: ${error.message}`);
    return mapToViewModel(data as CharacterPresetDto, false);
  }
```

### src/infrastructure/character/character-preset-service.ts:341

```ts
async duplicatePreset(presetId: string): Promise<CharacterPresetVm> {
    const userId = await getAuthenticatedUserId();
    const { data: existing, error: loadError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', presetId)
      .eq('owner_user_id', userId)
      .single();
    if (loadError || !existing) {
      throw new Error(loadError ? `Preset nicht gefunden: ${loadError.message}` : 'Preset nicht gefunden.');
    }
    const dto = existing as CharacterPresetDto;
    const versions = normalizeVersions(dto.versions);
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        owner_user_id: userId,
        display_name: `${dto.display_name} (Kopie)`,
        ruleset_key: dto.ruleset_key,
        origin: 'user',
        source_character_id: null,
        published: false,
        versions,
      })
      .select()
      .single();
    if (error) throw new Error(`Preset konnte nicht dupliziert werden: ${error.message}`);
    return mapToViewModel(data as CharacterPresetDto, false);
  }
```

### src/infrastructure/character/character-preset-service.ts:371

```ts
async deletePreset(presetId: string): Promise<void> {
    const userId = await getAuthenticatedUserId();
    const { error } = await supabase.from(TABLE).delete().eq('id', presetId).eq('owner_user_id', userId);
    if (error) throw new Error(`Preset konnte nicht gelöscht werden: ${error.message}`);
  }
```

### src/infrastructure/character/character-service.ts:144

```ts
private async assertPersonalLookWriteGate(
    characterId: string,
    personalLookProfileId: string | null,
  ): Promise<void> {
    const actorUserId = await getAuthenticatedUserId();
    // Owner-scoped fetch — proves the actor can access this character.
    await supabaseCharacterRepository.getCharacterById(characterId);

    let sagaAllows = true;
    try {
      const arcs = await characterAdventureArcService.listArcsForCharacter(characterId);
      const activeArcs = arcs.filter((arc) => arc.status === 'active');
      for (const arc of activeArcs) {
        const project = await projectService.getProjectById(arc.projectId);
        if (!project.allowPlayerCharacterLookOverride) {
          sagaAllows = false;
          break;
        }
      }
    } catch {
      sagaAllows = true;
    }

    let lookOwnerUserId: string | null = null;
    let lookStatus: string | null = null;
    if (personalLookProfileId) {
      const record = await getLookProfile(personalLookProfileId);
      lookOwnerUserId = record?.profile.ownerId ?? null;
      lookStatus = record?.status ?? null;
    }

    const gate = assertPersonalLookOverrideWrite({
      // getCharacterById is owner-scoped — successful fetch implies actor owns the character.
      characterOwnerUserId: actorUserId,
      actorUserId,
      personalLookProfileId,
      lookOwnerUserId,
      lookStatus,
      sagaAllowsPlayerOverrides: sagaAllows,
    });
    if (gate.ok === false) {
      throw new Error(gate.messageDe);
    }
  }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/character/avatar/animation-contract.ts` | `33b20efada16c48167e86bc5cf07ec29039162a706930e1297ac5ceb3a79c759` |
| `src/domains/character/avatar/asset-authoring-contract-v1.ts` | `04cdfc70d0760b668179b3091b214abbbae437eeaae0a3e9f7ad28c3bbc4a72c` |
| `src/domains/character/avatar/avatar-artifact-contract-v2.ts` | `40c846babdc34cd397c26d381b70a4e11e20178e1352a95ee5760caffc3cfc29` |
| `src/domains/character/avatar/avatar-import.ts` | `64907a2a32d029949496267211fbe7c2d0796494f5e1c5b730246d893a5bff48` |
| `src/domains/character/avatar/avatar-save-export.ts` | `723555abf953885005eb277de17ad37e0c74a39689fcf99b25afb89461e41dac` |
| `src/domains/character/avatar/avatar-source.ts` | `8de1e469716b722f17e157e0e2297960ea92a94471b284670b7298f8f410f507` |
| `src/domains/character/avatar/avatar-structure-analyzer-v2.ts` | `0aa35307f1895ec321898139ec2e6bc0ac932e93b498e7c1f3ddefd2741b5de7` |
| `src/domains/character/avatar/base-body-contract.ts` | `533cc060b3e5a686a398cb37facb36b2df9b3096ea57f0040f02afc998fb4694` |
| `src/domains/character/avatar/body-conversion-flow-v1.ts` | `7017bbf19812d2743363d0bdebf0a1ca114158202ee4376d5e5296b5749ac951` |
| `src/domains/character/avatar/body-family-variant-resolver-v1.ts` | `ccbd4f02afefd7116ec37b386a73d938765d4d80bede0b7f4424884a4850b755` |
| `src/domains/character/avatar/body-profile-contract-v1.ts` | `4db146c3b7effc7146d64574711fea862331c7f8f67d21f4a9421fcb17f672d9` |
| `src/domains/character/avatar/body-region-mask-v1.ts` | `2f925a51bd534f23ce7c8bef812130a2f8009e233b28a2556db8ab80352e8eb9` |
| `src/domains/character/avatar/canonical-body-families-v1.ts` | `0640921ac722240e6ac203a057601c6cc006b9bcc5603986f0b2307b7ae5f76f` |
| `src/domains/character/avatar/composition-contract-v2.ts` | `dbbd97418183b59d37572c36024e7bae9bb89b7ae7eb28e4572191d258304046` |
| `src/domains/character/avatar/content-pack-v1.ts` | `b4a44ed3104126621b1860f96cafd1c90b2c043d816d392d5a44ca8125165816` |
| `src/domains/character/avatar/custom-creature-flow-v1.ts` | `96ce926dd9ef900abf22e268827ad07726111afa6c9051ba118cead980c8cbda` |
| `src/domains/character/avatar/custom-rig-decision-v1.ts` | `2e55886058007be9d24275f1de43025cc97fab5d0fb8e257dcabfc93483bc790` |
| `src/domains/character/avatar/editor-surface-resolver-v1.ts` | `f4e882a343eccf7568912b7919d100f9e55231d31c6129f2395e021b8f15ac18` |
| `src/domains/character/avatar/equipment-visual-contract.ts` | `b9f93ce6a4f06d38ae5075eab2de15ce7c5bb2b70ffeb652c12d57f0c307ca90` |
| `src/domains/character/avatar/face-anchor-agent-review-v1.ts` | `c9655ff898b5f74d006221415a52eb2bbd15e529e8359dbc63ffc045bec6d5ba` |
| `src/domains/character/avatar/face-anchor-contract.ts` | `e302f0b6ab5827217a8bd30aa0a77fa8b0147c429b32a48b15c312f4cd778b5a` |
| `src/domains/character/avatar/face-mapping-authoring-contract.ts` | `a1a947ff31b6415767eb531a6c89f5064b431d19638def08a093636e42090d5e` |
| `src/domains/character/avatar/face-mapping-auto-surface-select-v1.ts` | `0570266232e960c90fd1beea5972c42292c1fa3b761ed7181fef1820e0f5e8dc` |
| `src/domains/character/avatar/face-mapping-auto-v1.ts` | `da3d8081ddfdb1e149d2542aed01f7545f246e9d5ae86a3d5a257f07fe92ab45` |
| `src/domains/character/avatar/face-mapping-draft-v1.ts` | `855ccc2c4c0c233c48e4e532c01f79115bf7b1c9a5084b91bdf2a23cdd26ee4b` |
| `src/domains/character/avatar/face-mapping-guide-geometry.ts` | `bbb6e5b280d776d8d2e4e1da10c5f536ec9069962aa87b6e02bba82bb8e62fcb` |
| `src/domains/character/avatar/face-mapping-surface-semantics-v1.ts` | `bed23c8e68d516b377b814f945afa5636a1a9fa0a8ead96d2addea7f98c48455` |
| `src/domains/character/avatar/face-tracking-contract.ts` | `6eecc53ae87de2ed4226a471584586c7df6f78a90320fb317980a92dd2132c85` |
| `src/domains/character/avatar/facial-contract.ts` | `78c283731f333f0016b7b9125ac8fba69bd752cd7bb776dd65061a191f1c2c39` |
| `src/domains/character/avatar/final-acceptance-matrix-v1.ts` | `c068168a243d789946354b8e70771ba909f7e397dc543b646522c37f48206f28` |
| `src/domains/character/avatar/fit-range-contract.ts` | `eca8543858dded161bbedca738c83882c45baa224bef89578f10fb87ff182048` |
| `src/domains/character/avatar/generate-product-flow-v1.ts` | `e38747b16be855a561cf8f2e0352673633206cf705c3ffcd262ba668916367f2` |
| `src/domains/character/avatar/generation/index.ts` | `da7b8ca8f2972d00a7e7ca821883922154a249175c5f37d06ee61f30b0b6e2d7` |
| `src/domains/character/avatar/generation/meshy-adapter.ts` | `eac4b4f1534e1055528fa983ff1ee1a8445e938349712bf6699964c6cf300b00` |
| `src/domains/character/avatar/generation/resolve-settings.ts` | `22e0592bf5b50162126ad2298c91fbe02ecc263ca48cfc266a4f3efcc4ad03ed` |
| `src/domains/character/avatar/generation/types.ts` | `2ec5ffd3bd6cbbb70fe2073c1352745b18c14c34bb750308094908b71c5ec201` |
| `src/domains/character/avatar/identity-transfer-v1.ts` | `c35cf3acf1c11934ba067d6fb65509bc71a40ce3a270299e1928f06264a321ab` |
| `src/domains/character/avatar/import-original-flow-v1.ts` | `da4ad959cfab4ecbc6cab718ff582a37c5a828778aa8350a6f6d8e7c22c14e60` |
| `src/domains/character/avatar/index.ts` | `6bd7b9c2be53a3e29e22784525c7a5039d48b531b2b48f2310cd4562e3842ac6` |
| `src/domains/character/avatar/item-avatar-fit-defaults.ts` | `fc92309fabedece2358d84418e0e1782bbec44c876a60f5440dffa0f1bb8e1cc` |
| `src/domains/character/avatar/liveact-golden-reference-avatar-v1.ts` | `e15fba59900d4225d2bd9db53e753eef9b6e12d1e0b7bcf287ce7d1967510566` |
| `src/domains/character/avatar/meshy-avatar-job.ts` | `43ee0bed91a257d0b7e585ec047f59ec9bf62b64491951f1b86ebe331861545e` |
| `src/domains/character/avatar/modular-generate-decomposition-v1.ts` | `3c152565d112e155022b4817d58256d4bb2e81332c1719f8847a7460a52a00a5` |
| `src/domains/character/avatar/modular-generate-flow-v1.ts` | `26ff65f437d4563b11e335fe07ef611261fd68a79c7cdd1c8df7fc00999bed26` |
| `src/domains/character/avatar/modular-glb-contract-v1.ts` | `03f700ffb59f1b00f4d5cef92083845a6795269b9af757c3c17589e3f09b1731` |
| `src/domains/character/avatar/morph-contract.ts` | `7540a9aaaba59981033500ac67329060e39c2f259c35460c964c39c1e461d96f` |
| `src/domains/character/avatar/mtoon-profile.ts` | `26ee5c67078a58d989167c19a36ddf2dca8d79ed840e0e30879a9b5c563b0cb7` |
| `src/domains/character/avatar/rig-capability-contract-v2.ts` | `930f6a1f526ace01315b6fd0ec168adcb5ed85efd97c60f1dfccfcd1f381dab7` |
| `src/domains/character/avatar/rig-contract.ts` | `4b3eb13f2704159dacd50d5e55302f467d85c12d1353327943c022ff3c4400ee` |
| `src/domains/character/avatar/rigging-provider-contract.ts` | `c66dc56cf750e02b1844f26bed1b54944b9a82a93523116c1681b411dd0a32c3` |
| `src/domains/character/avatar/rigid-equipment-plan.ts` | `dc06bdd8fc982ec18b0d2961559d028496ba830c6d1531c2c79680af24d6313a` |
| `src/domains/character/avatar/saga-human-canonical-v1.ts` | `49b2e32ee2d84739adea7c3709946b9110a9aa4508c4de5be8ced02c123cbf1d` |
| `src/domains/character/avatar/shared-avatar-surface.ts` | `38389f5af9aa5640c970eea4814a095a88947ae0409f518fba1130df677bf876` |
| `src/domains/character/avatar/skinned-wearable-plan.ts` | `97d99a7f7b1a026abcd7ac4ca25e656d2101ec6b61ca6cfa398e39bab7ffa028` |
| `src/domains/character/avatar/species-template-ingress-v1.ts` | `7d23775f3ea96683f6f369e8d06e000d8df1f8811226eddc61642d6f2c5dd3cd` |
| `src/domains/character/avatar/species-template-models-v1.ts` | `fe09b2a05490e02cd99468e3c42c6a0198d7fee483b11c974dd2800bfa03ea7f` |
| `src/domains/character/avatar/species-template-pack-v1.ts` | `e67e69b747215bc11b3a36239224f899e6033ae93cb09b8e098c5d3b6b18d2fb` |
| `src/domains/character/avatar/starter-wardrobe-manifest-v1.ts` | `fe01a2e66308f3d3681fa69eb948ea003be0e9e36a67b51c63435b02c18c8f1b` |
| `src/domains/character/avatar/trait-catalog.ts` | `75eca716c4a9d42e9c9d9ed6326a2d2bbd51942b80b1b172e6ac68fb2f527332` |
| `src/domains/character/avatar/trait-layers.ts` | `5817ec2ebc94700e618d0539853585f4c0d1ac25aea7781b10c11b0d28f4680a` |
| `src/domains/character/avatar/trait-lifecycle-registry.ts` | `795e0fc147296467e9741c363b515051030d1ea083b7ee01a58c8ccff5e65e4b` |
| `src/domains/character/avatar/types.ts` | `1d1984cc20e3bbbc2476a8ab5c04ddd6c6f65be37e0e665c9ce37e0bf0b76aeb` |
| `src/domains/character/contracts/character-adventure-arc.types.ts` | `603c8531f6856ce058fe6025f649aeb15ba2d7a112889fe53188e61b16e1e696` |
| `src/domains/character/contracts/character-lore.types.ts` | `9b8ee74cb51251a6719bbee8ed9803fa445a1e24c0a6b1863f8943b0ac325b09` |
| `src/domains/character/contracts/character-preset.types.ts` | `0ddf8611dd2686eedd2b9b7bb5708bca900c250397d5c7beb5a3cefc01d89aa5` |
| `src/domains/character/contracts/character.commands.ts` | `b186af193502c4be7c0d0dc5b5ad53ac3955f4be87fc65ff7439b1c27d17fce9` |
| `src/domains/character/contracts/character.views.ts` | `719d6744010c3ae71c84a0c36c186284d53bbd7c8a91ab21ab6775670acaba1f` |
| `src/domains/character/domain/character.entity.ts` | `56e76a478531eb46ae523b1b1c3d8fd4d076af742baf2ef1edea5dac70768120` |
| `src/domains/character/domain/sagatree-profile.entity.ts` | `05e8ef0db1b750a537db5ef30456e6e7ec18ce49583d64f3e6c4d296cfde7f2f` |
| `src/domains/character/index.ts` | `7cd01341945c32463c762f0cda627d7af7dacb4c1cd6a7dfd9fcf4d353f15ef3` |
| `src/domains/character/inventory-v2/catalog.ts` | `f909f58dcb7c831a3626c74e51fa16ce9d4c8c118ac8b8b9ec3b7385cb1df31d` |
| `src/domains/character/inventory-v2/core-catalog.ts` | `d3822381e8fdc3a4cee8dccdd2202fd9d1124d76e4cec1bac4f270b26e7c12ed` |
| `src/domains/character/inventory-v2/index.ts` | `893781b8449f0db869c064c184d56c6d412aefae61c122645cddae2d19673ba0` |
| `src/domains/character/inventory-v2/migrate-legacy.ts` | `25dbe6979d3f16380078fcedfbe9dc132a93bfece2474b868181a636189bf11c` |
| `src/domains/character/inventory-v2/operations.ts` | `a2e704b8a6c9d0f734d0c2f8db4fd5fcd7f419ddf2468ad7ac210d5c4d5c62d9` |
| `src/domains/character/inventory-v2/primitives.ts` | `7fd8dd5bddc63580ede1b8e0d6c89c146531ba7751128b664bf731c405343c86` |
| `src/domains/character/inventory-v2/state.ts` | `c78ffa8a34d754fcfa444f587d1ae8457b1cfbbbea8d80e205f5b964b05de775` |
| `src/domains/character/inventory-v2/types.ts` | `ac4780f56499b209346e1be76ed06c1a81bbbc78843ff5d74a9bd96f83fc8643` |
| `src/domains/character/inventory-v2/validation.ts` | `d893ca4d051be6075a44e42b6be1bba2d72366bdac267b5625b723a39318609f` |
| `src/domains/character/liveact/index.ts` | `ef08477100fe4e25dd199df7b395914c1bd0e0639f61d3fb16c593ccb7960800` |
| `src/domains/character/liveact/liveact-calibration.ts` | `fde3b77fa8a055ddeb503d88b59570d23014ce05d9d041ab919b57556a388c06` |
| `src/domains/character/liveact/liveact-capabilities.ts` | `e266a4282dddc3ae735be152e62c53d237342d76322f8f98f699718011282cbd` |
| `src/domains/character/liveact/liveact-capability-inspector.ts` | `c4e3b50257db68373c30f8f9a88b4e182cbdeffdccc7fc3670865e08fbdc3fc3` |
| `src/domains/character/liveact/liveact-channel-target-aliases.ts` | `df7a746fa1e0ec7481b3dd2639eb0d1bf2bbe4869cc3c620333ccec938461928` |
| `src/domains/character/liveact/liveact-contract.ts` | `3f4e7474711e9ef69e0609e0938fa39ad5da61be69cb05a1b201bc01653882ed` |
| `src/domains/character/liveact/liveact-dense-face-features-contour-metric.ts` | `86641f7ea12392494eeba94e895d1610ab5e447d07372e8d07ff446fc859b603` |
| `src/domains/character/liveact/liveact-dense-face-features-contract.ts` | `bad40c94a474fb5e24ba71e1aa97dcc412c8d5adcd7b50fdca458bc9941d817b` |
| `src/domains/character/liveact/liveact-dense-face-features-extract.ts` | `62f87df9609da5f4b966a4bf15a27d9b1cde7577110f6ad66590c2d0211a26ec` |
| `src/domains/character/liveact/liveact-dense-face-features-fixtures.ts` | `07526a067b5fadcd75a20c42611502bc40f05c9d109197090e7cea4c45580f21` |
| `src/domains/character/liveact/liveact-dense-face-features-normalize.ts` | `5964628e94a4724ce5fc7117c010047cc742982fd6653c817e7e0d0444c51e43` |
| `src/domains/character/liveact/liveact-diagnostics-peaks.ts` | `5d2ded3d128fd75c3b245ea3f9a2dbd61daf26d8d327b5456ff3f53a9576b6ef` |
| `src/domains/character/liveact/liveact-diagnostics-v2.ts` | `479eea88e545156aef5aa870671ed0832a518f611a8212c9ab35bc0cc7a64d99` |
| `src/domains/character/liveact/liveact-face-asset-contract.ts` | `830240cf234c2d0b7c62bf48fc9e54b7b9a5f7fad0dcf2b5ebbd713dd3e7e922` |
| `src/domains/character/liveact/liveact-face-contract.ts` | `88fe38ab1e2aa26cbc0a0296f36f17204389dfcbb92a820adcdea3357cbfdaac` |
| `src/domains/character/liveact/liveact-face-diagnostics.ts` | `94069279dff9f82f49190703b12decf2b0ef1544eaf0cb36026983f917a88261` |
| `src/domains/character/liveact/liveact-face-metrics.ts` | `ea1e385a9f2c0089388b156165ae6c0319dcb1848aacb98c6977bd2fc82eb6f7` |
| `src/domains/character/liveact/liveact-gaze-path.ts` | `85cbabb5bffc9c25f6ff2adda9aaf115c0800c05d0d8dc6f186d3dde5a5689a5` |
| `src/domains/character/liveact/liveact-hybrid-face-ab.ts` | `6a78877e092c1ffbd2bec581a95c727b57558ff21e2147284b56d2e04921168d` |
| `src/domains/character/liveact/liveact-hybrid-face-contract.ts` | `7aac3709478ca4d7ce039ae0b120dfe93f6a2da15750d5446762a98706b16181` |
| `src/domains/character/liveact/liveact-hybrid-face-fixtures.ts` | `1df200405d7c63d7034cab4674735f0d4b2d36de983c14b241bfbc9d8edc4abe` |
| `src/domains/character/liveact/liveact-hybrid-face-fusion.ts` | `f6167eea60cc6514675c02db585a38f9238b57e45d1daf636ada1e68ba6d52e8` |
| `src/domains/character/liveact/liveact-hybrid-face-solve.ts` | `c32d9cca218a06f89413f6cc1abe76d9a267b903651706308612c29109eed39a` |
| `src/domains/character/liveact/liveact-iris-gaze-ab.ts` | `4325a4c600967ebd4faba6a2fa182aeaba45033f67290543d472dd9fe392131c` |
| `src/domains/character/liveact/liveact-iris-gaze-contract.ts` | `18bce38e47aa498325827d096e2d4f8ee01d36bc8974dee737deb549e45a9052` |
| `src/domains/character/liveact/liveact-iris-gaze-fixtures.ts` | `68d30a2a873345ba18ea6597a3fe401866e1d06ff4089644f92ab0ad75fb6da8` |
| `src/domains/character/liveact/liveact-iris-gaze-solve.ts` | `40943a5e0902b15bc908b7a3873117c4f9bc138b88e60c19272ca8237a4d7ae6` |
| `src/domains/character/liveact/liveact-iris-gaze-sphere.ts` | `0474dd45eed8a95b9d1f7025c1b4ff8f8c84422ff44d6c3a8142f38f9211974a` |
| `src/domains/character/liveact/liveact-mediapipe-sample.ts` | `080f76930772b76fe8c4104da7cbc9fc6e221bbcce27a03bfcd8e21d63543356` |
| `src/domains/character/liveact/liveact-motion-test.ts` | `aa6d64d99d79f2b411286d2f008a6358e1d6fd34adeeec717198356227da0442` |
| `src/domains/character/liveact/liveact-network-frame.ts` | `5df6009112f465d8b0e6e79e4465e99524413466daf6e038171e8f0d2a2f7ff8` |
| `src/domains/character/liveact/liveact-perfect-fidelity-capture.ts` | `ef2761e06a3b705fd846c7d42efc38e7f3cedc27e6b7e4976939cb7b7f1e9ef1` |
| `src/domains/character/liveact/liveact-perfect-fidelity-contract.ts` | `1248d6c0840e9ba8888462e972b3a0ec581e53d397c17b492265dd7806cc841b` |
| `src/domains/character/liveact/liveact-perfect-fidelity-evaluate.ts` | `4db50963ae0a546688481ce0e534df7ce59a064f87658a067b28382088499cd6` |
| `src/domains/character/liveact/liveact-perfect-fidelity-fixtures.ts` | `d1264df10313fc1a0bc670439ca52e85e1e40510b2b341f6bc3fa1136ce3930f` |
| `src/domains/character/liveact/liveact-perfect-fidelity-math.ts` | `cf86d1a02a39b4714e221623a862a4faaf4a9528d0e9b301b41b222470d0641f` |
| `src/domains/character/liveact/liveact-perfect-fidelity-v2-e2e.ts` | `1cacc9128ec20c190438dcd694fc4909fd232ea2723906e40cb67c5fe294ef40` |
| `src/domains/character/liveact/liveact-performance-face-aliases.ts` | `11d48947074474063ba2c6fb6a6e001ef6b9e1c5282ec22884c3315b028acb2a` |
| `src/domains/character/liveact/liveact-performance-face-contract.ts` | `644f0f4c921be37015e0f4da5ee7de53f3733e2d65ed8a063ea1f0b77a25af31` |
| `src/domains/character/liveact/liveact-performance-face-drive.ts` | `c6f5c30dfcd4a19e47f2e3925cd5b415a7bb88e24fbfd92d829076d67f8d0bb9` |
| `src/domains/character/liveact/liveact-performance-face-validate.ts` | `21475e854875d2c4f94b52c6545178372cc394ef2b331a802bddb08b6d1537d9` |
| `src/domains/character/liveact/liveact-personal-calibration-ab.ts` | `e51cf66b978e8058f6b22d660746a9b5b18cd03493a0e6fd3245a6f0d93ae14e` |
| `src/domains/character/liveact/liveact-personal-calibration-contract.ts` | `fa229564df38933262c5e23c2596b24054fc1ccf4cf6d76f4c331e8806aa8345` |
| `src/domains/character/liveact/liveact-personal-calibration-fixtures.ts` | `e6668efa27ba993b34373ea904647640ef58f17d99db0f3445cdd5e72185a56a` |
| `src/domains/character/liveact/liveact-personal-calibration-solve.ts` | `fcf3f40a60769a9c917719865c087e11250102283e5a0ce49f0ae963ea7c90ea` |
| `src/domains/character/liveact/liveact-personal-calibration-store.ts` | `886c6a27fdfd3d50216c9d4f8477238a51398edb9aa5997dae06ce25ca57bea4` |
| `src/domains/character/liveact/liveact-remote-consumer.ts` | `af48f4b7213e7ce4cbef83678972ac7c839d917d341abafdf08260cf06853552` |
| `src/domains/character/liveact/liveact-retarget-profile.ts` | `a50d599bc07f441601322e36b84fae3542385c9a00244acdd4057d571f70f657` |
| `src/domains/character/liveact/liveact-runtime-policy.ts` | `ce4e5de733a4c22a47f286bff89f63071d1d176449916ff29865fadfff5f5220` |
| `src/domains/character/liveact/liveact-temporal-ab.ts` | `d12ee8aed4ca8fa0da58404a08deeee0605751081c2dee79ed559370a151598d` |
| `src/domains/character/liveact/liveact-temporal-contract.ts` | `8fea6f590878906999a12429251dbceb0a604e6499df2eea303d951684b13a52` |
| `src/domains/character/liveact/liveact-temporal-fixtures.ts` | `4797e70ff26464b81e461ee636497bc27937dbd925b9638d75dc2848ad9d1cec` |
| `src/domains/character/liveact/liveact-temporal-solve.ts` | `eb38b7c31bdd52f5cab3c8db0ba09aee7f3a002d0b46e43cadfefb529072ad92` |
| `src/domains/character/liveact/liveact-video-viewport-transform.ts` | `859550400ba76a025998d7d72b31e2e5025211d81b1c08b708840ab3005e1a88` |
| `src/domains/character/use-cases/assert-character-persistence.ts` | `fd03cc2ee269937de791ed8be8d77561fa800b127d1bb22a2006f50ecb92dc55` |
| `src/domains/character/use-cases/avatar-presets.ts` | `8d49ca20f98e0168298235f6f77610e92dc78da0d02e628f7168714d3a17a7bd` |
| `src/domains/character/use-cases/character-lore-examples.ts` | `df79463c8ceadd59ca98b67286fb9e1c336c27ab32a84b1ab0a140a6ee84f590` |
| `src/domains/character/use-cases/character-lore-traits.ts` | `6620c55286f3275387a3e86dbe072855d60a5b38f0807e9ea8d4002d4cb7fba0` |
| `src/domains/character/use-cases/dornhain-pregen-sheets.ts` | `c0c59df30e35a4eaaba21387dc0dc8e9cfeba2ab7d6e90ea8fcea9d73457e59b` |
| `src/domains/character/use-cases/genderReading.ts` | `d138d9b83399edbe8fa12e7a1b44b28eb020063c19aea9143c24cd9d36c83f8a` |
| `src/domains/character/use-cases/normalize-character.ts` | `1078d6a184e6896afc6db12d3d585d3150252e360ad5d79596f539b12558f97d` |
| `src/domains/character/use-cases/sagatree-native-gm-presence.ts` | `05252b6954b433b7bc017930a5b4ec3cb430a036b8cafe4fa0a370290eb49675` |
| `src/domains/items/assets.ts` | `531258cd09a5e29affafb2d52d7154400cd17a19a7e4a0e1f05dffa26461ae24` |
| `src/domains/items/definition.ts` | `e47891149c62504d1ff96fb38e6a86ca26bf2e9a52795b7cd876a66b90c78b4a` |
| `src/domains/items/fork.ts` | `6123d90663a24b1af0dd583a601cb491799137ef4ae894b0e2bf3d5643fb8b76` |
| `src/domains/items/icon-assets.ts` | `afa9813b79e9cbd36e56c0ab1b378a07e055f531cac8091ccdb93f45230c0079` |
| `src/domains/items/index.ts` | `f0bf801bd99a13014598868bcd1def1c03e1a2dcab208f5b7fdb0d8b9bd89b48` |
| `src/domains/items/library-query.ts` | `513d0d38b0531a58c25f9f680f4887f6e667d0594fa2c05bb4908179b34d8f83` |
| `src/domains/items/model3d-assets.ts` | `389043b61b7b9cea94ccc7e2c14a871b6e755d3bf428a205b3a3a278fe5fef2c` |
| `src/domains/items/normalize.ts` | `4b26c5ec71b9c3c2d1186004b6a4e7d1d09a48e078447e7b8815d2e5bf908909` |
| `src/domains/items/pack.ts` | `3214e2a3cbe1db088fb0eaca3d52503911f3c3601c6b01ed08bb75ef2707d975` |
| `src/domains/items/packs/build-standard-item.ts` | `1c2654f0e7980b409762995fe9025649f9cc2bd5324df3a6d50dd4642bdfe569` |
| `src/domains/items/packs/contemporary-basic.ts` | `c72535324491133bc1331abd5fb050d6c328f2177976b8d76f39b2438118f1c1` |
| `src/domains/items/packs/context-packs.ts` | `768e1cf834ea03ecb0b6b3e2335da8e4356682da34bf045df5ba18a1dd9df6fb` |
| `src/domains/items/packs/core-snapshots.ts` | `440e4fe239eedb982555c2e4aa82ea45ae3d687cb26e057516c1b36feccbc19e` |
| `src/domains/items/packs/fantasy-basic.ts` | `0d18e6a46d5d0603b66eade2eaa92f56a0531ad0e71dc1361bfca6cb4f507c2a` |
| `src/domains/items/packs/index.ts` | `d851952181c448d93ac61a51e2f4d02d89253447ef74ca93ff1048590bfff43d` |
| `src/domains/items/packs/scifi-basic.ts` | `6bfed5584dfaabcbc1ce6c323ebd6d9ababc286e9a94d77106c8355667379333` |
| `src/domains/items/payload.ts` | `cca377861fecbee054a248d6df16baa630a1cedc496fac0fd34b0dc58e575efc` |
| `src/domains/items/taxonomy.ts` | `fa58dde95e4f9fa424244137f845ee4dbf8ae77d3e4e3ec1d114b74b1debc54a` |
| `src/domains/items/validate.ts` | `3ad0170cce5d6cd27889eecf9752c707c19680e28ccdf493d71851bffbab4524` |
| `src/domains/items/world-catalog.ts` | `fc39966cc6290f6c59bfdef799cd9e972e7799978299b8fe83a6a8b4b1162941` |
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
| `src/domains/media/index.ts` | `768ded2d0f0fd1d510d660924e787817673955dbeff021d7de9e0a8d8e38bdec` |
| `src/domains/media/optimization-contract.ts` | `ba9216dab79a9c03f66a16b77dedf1c26d4d00d6ae2693cc5a68919d1647846d` |
| `src/domains/media/optimization-policy.ts` | `6145574bc08d1eb94f54d488ebc1f8bc030c2a956e3e3fd24cb15a7c8e50c5ec` |
| `src/domains/project/contracts/project.types.ts` | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| `src/domains/rules/sagatree/attribute-progression/index.ts` | `1f7ef073a45fd01150c4a90c7b711953f9e0c9efe4ba235bb2cf93e5b6523ae3` |
| `src/domains/rules/sagatree/background-templates/index.ts` | `4f912284953deae8f0b241899e77c02a5e6c33d5b3b9003cab3e702d4e69fa96` |
| `src/domains/rules/sagatree/character-creation/index.ts` | `9e032fe110c4665ec6744e0750d07c57a5d6b083fb292b2bd6441e21db7cdb07` |
| `src/domains/rules/sagatree/items/carry-capacity.ts` | `1ea1910d07cbfcbbe5373a78a9256e79a746273f16a3c2e2e82693f1a17037df` |
| `src/domains/rules/sagatree/items/index.ts` | `ab296a0e5462aecb9c94a1e5b530a1afac2b1556d793c09eab631cad6bd62822` |
| `src/domains/rules/sagatree/items/resource-affordability.ts` | `ed42c8faa66a711bd8c7be240df38530bb2d02fff435d1f3aa200538f9388a09` |
| `src/domains/rules/sagatree/items/tool-rules.ts` | `3026c3797388370309b0ea33d1366969abc05b803654cf99c68c4eff42832f18` |
| `src/domains/rules/sagatree/items/types.ts` | `af76e6a5ebcec4a5e8acc3d3fd6461abfe083065c025080ef0b2ca851fdc6ff2` |
| `src/domains/rules/sagatree/items/validators.ts` | `257732bceab776a0afc34f01340eb7e47a94b5c9d984ebf3fff8e0bb7c8ff543` |
| `src/domains/rules/sagatree/skill-progression/index.ts` | `7b4f5f109d49785497b4639a154b6e3856d58e52421befa7fa0ba0a278967cb7` |
| `src/domains/rules/sagatree/species-trait-options/index.ts` | `b21687494d66c5e5b3e1b791eadf3aa1ecabb9094695768a7961bba8b36730c4` |
| `src/domains/rules/sagatree/starting-templates/catalog.ts` | `7eb34eaed1ff7e6ccabea5cd8a4631ef135ef83c5a694caecaa8ae23f9907c0f` |
| `src/domains/rules/sagatree/starting-templates/index.ts` | `6caa69e3a84101614ad55604473dc7838407d98c513c7bccd20dc9f8346d21cf` |
| `src/domains/rules/sagatree/starting-templates/types.ts` | `c9c79a2284ea49966c4756ca3a2954a9861222fc0a49c59b6e8a371ce192bc6a` |
| `src/domains/rules/sagatree/starting-templates/validate.ts` | `bb03a23dffac39b6228690dc721caec61e4b0a881e261ca43e4e943e2dac9f4b` |
| `src/domains/session/contracts/live-session-access.ts` | `5c5fea67625237d0ae703e54e07dceb52d1694df8fe7bab6248b13810f4df411` |
| `src/domains/session/media/media-plane-contract.ts` | `7cba204291a86a1159b961048280899541f95c102abad8e2c8f61e7662ba8c1b` |
| `src/infrastructure/character/avatar/avatar-animation-runtime.ts` | `ebce0a65ab12fafec9b68864de7a79f0d0e595d78ec369d7dfab42bb16c85334` |
| `src/infrastructure/character/avatar/avatar-asset-manifests.ts` | `2f10a4976588ac2224a57422b6088cc2c827bcd4828fcbd489d89ad29b8072e9` |
| `src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts` | `1410dc1918343c56aba38affcfa3d78a0f07c23db676066e648b9bcaa4793f90` |
| `src/infrastructure/character/avatar/avatar-facial-runtime.ts` | `ba34da83b2659525ffa523f9302b475682141d9908e4e962ba11395eebce2eec` |
| `src/infrastructure/character/avatar/avatar-rigid-equipment-runtime.ts` | `be33c31c8abe0a8a4182fed7de281ed362f3736a24cd94bd6756954475920b32` |
| `src/infrastructure/character/avatar/avatar-skinned-wearable-runtime.ts` | `81717514554779eb6da46719071bf6df1d35ae04b4260b704e86a781c9a3495b` |
| `src/infrastructure/character/avatar/avatar-structure-scanner.ts` | `9b824439400cd99d35ecca9cabb9f1b945870a7b28feaf1d999f9ea85c41d6c1` |
| `src/infrastructure/character/avatar/base-body-catalog.ts` | `b2ddcc05a3b83c54312ea0eb669deff02b0f058a41b5c1f6b833c48475f9f499` |
| `src/infrastructure/character/avatar/body-profile-metrics.ts` | `327e1d33b62844c3819cbfdb6985ab2a4093842c596c633f086de6a4357e2e3a` |
| `src/infrastructure/character/avatar/character-avatar-artifact-service.ts` | `d9f17a83b9e555485e7c6e4f5733ab97f3f6a28c9f15dcc59dc7fc9410feda92` |
| `src/infrastructure/character/avatar/character-avatar-export-service.ts` | `34e97033209cb65e915f96f19b37ae65f29f9b9208bacd91a9a2be65ad9f4e59` |
| `src/infrastructure/character/avatar/character-avatar-import-service.ts` | `27336fdbb8edcaa4c00a0934049a81e820b176f08b030fbca329421342aabcc3` |
| `src/infrastructure/character/avatar/character-avatar-meshy-service.ts` | `d651c0cac61f73bdd668c86f536d338411383ffc2b72792ad3b20c276b07147d` |
| `src/infrastructure/character/avatar/character-studio-manifest.ts` | `af5409910fb6f8a18ea2f5928dca2366b7574c19b7087aa2230add5989dfe77f` |
| `src/infrastructure/character/avatar/character-studio-runtime.ts` | `83d5c4877e46c394a3c287e41f4620f932e2f1122e1abee993c6394136ead8cf` |
| `src/infrastructure/character/avatar/face-anchor-runtime.ts` | `1cf63b090e45babe137a93244a2d3653afb7c723940487235e77b728c72575b0` |
| `src/infrastructure/character/avatar/face-mapping-auto-pipeline.ts` | `a122b68f6bdd7430a27645a648ad0c964c6978a3f291983d21327d2f23ae3002` |
| `src/infrastructure/character/avatar/face-mapping-base-face-capture-visibility.ts` | `1c0db64fe1cf71890d86428b7c8d1102402ee7c117df09a53bfee0e2e887c516` |
| `src/infrastructure/character/avatar/face-mapping-raycast.ts` | `34e8dd6425664c56cd43b2a2f54d1cd1f45cbd5dee67c4d38b2fda4f071fc330` |
| `src/infrastructure/character/avatar/mtoon-style-applier.ts` | `1c9fc4fdb30546c0b34ccb222035c74d78251985e575f8a79da86f3f6cd762be` |
| `src/infrastructure/character/avatar/rig-analyzer.ts` | `a9fc2d69f2bde15efe76839537a05b225bccd52822827590363384649ee9f757` |
| `src/infrastructure/character/avatar/rig-bone-aliases.ts` | `350285728959b192ee514de5379df638c28db9e665cfa88cff43915c4871c508` |
| `src/infrastructure/character/avatar/toonlab-compatibility-spike.ts` | `e896927b2a2fa4c4ad74550b0909a681596d41bdc356980a31afd42b493f5d30` |
| `src/infrastructure/character/avatar/trait-asset-allowlist.ts` | `9aa2ecef7d49f63909420f2df21b66a62167e844fd6c97202f49c28058feec57` |
| `src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts` | `e02df093e7e626eb3d46d2f8fce8bb133d0a8e7546b89980aee5ae0469072303` |
| `src/infrastructure/character/character-adventure-arc-service.ts` | `15e8bea5f542c4c445e3b8ef5afeaac3e63e09317919c1cb763a6fcace9af15b` |
| `src/infrastructure/character/character-lore-service.ts` | `864f22acd15e0605a0a8e5e848b09eaf85e0a95838ab3b5c2e62b2828457cba0` |
| `src/infrastructure/character/character-preset-service.ts` | `6acece04669bde738d04e6295f41d7d7d7a81afedc9f350d6b531c01cd4e9789` |
| `src/infrastructure/character/character-service.ts` | `e591323439fd26f117035934bda58178488bf1095b722fb99f138abc0755d195` |
| `src/infrastructure/character/character.persistence.ts` | `5ed5f363555b9c4a3922507e01a227f74aee706764065641eb27ac9510024bd5` |
| `src/infrastructure/character/liveact/face-anchors-manifest-url.ts` | `e7d40a0bffeb9b24fd3cd472acc3ef6927d25635f1dbfa9b585a3a28413619ff` |
| `src/infrastructure/character/liveact/gltf-liveact-avatar-output.ts` | `2d97b650a5c7002ed43f72b853e861ba511a47bb8c2c737fc9462e02d1273577` |
| `src/infrastructure/character/liveact/index.ts` | `3e3ce524563528a2a6ab6b6940cbae21f2d3de43960af335bc7134cc32fa6046` |
| `src/infrastructure/character/liveact/liveact-avatar-output.ts` | `eef7c6414b56b555ab59ebfa8d1afefdcfa45712f0b1ccb07a545d9ad94a2555` |
| `src/infrastructure/character/liveact/liveact-camera-claim.ts` | `d5a618f0b3a1f6a6c50765672eb9e6641582b2396fae85fbf2745cf207f4efe7` |
| `src/infrastructure/character/liveact/liveact-character-face-debug.ts` | `c621a058728205ef614a4fabae4d9bfbb4bdeeb6fdc0caddddbc481d03ef5c16` |
| `src/infrastructure/character/liveact/liveact-engine.ts` | `c2565ea2a0302b3238cc1947b48f46c4e6f91c28b6dd96c5ac042212aada7797` |
| `src/infrastructure/character/liveact/liveact-eye-bone-aliases.ts` | `06dc05df830f8282f73d9252daa784c4a487ee2ea35d068fc888cda46a5e99ff` |
| `src/infrastructure/character/liveact/liveact-face-diagnostics.ts` | `f0161f4a9da643965e322086fbc52ef00c51710504c6c5cc2539aba5a0f7afc8` |
| `src/infrastructure/character/liveact/liveact-morph-target-index.ts` | `6698cea3bd02cad7eb5910e2126d33c1bcd55731edc07f439cebc6a04522623f` |
| `src/infrastructure/character/liveact/liveact-pose-drive.ts` | `03180a19b25c2959133f5d75cfc5a69a958044bb60c865258c033fc7e2f8a2da` |
| `src/infrastructure/character/liveact/liveact-retarget-profile-registry.ts` | `1933bed1da24853a8aac552a630a220f6924505db0af2fc77a7e1c1552e2a9d8` |
| `src/infrastructure/character/liveact/liveact-rig-debug.ts` | `0e58eeadc2186016d515d1d9125873e0250367daf9cf124cd51748510b54cdfc` |
| `src/infrastructure/character/liveact/liveact-session-transport.ts` | `edd2d7390e168b6bbf08015236671de118d4f33b49e3522d2b1d2d701d2e3499` |
| `src/infrastructure/character/liveact/mediapipe-dense-semantic-points-v1.ts` | `2584b01e048b95a5a5f82245cb49e76ea674171447100290a792a52a45bbd2ac` |
| `src/infrastructure/character/liveact/mediapipe-face-image-landmarker.ts` | `0bc4ecbd1b925bf86fb56535a0c6e91ffefd8f893a548f88686490a178eb20ed` |
| `src/infrastructure/character/liveact/mediapipe-face-source.ts` | `ae4ad98f7d39c27797d4421162a7f866b144a80f19f3b028422dcd6eefddcc2a` |
| `src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts` | `5c097d026beeb882e78bbd2fb277555a6b47553ac7e0c41a665647e0421772df` |
| `src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts` | `b092e31c50b885b9dbeb396ef2bdbfa39a953df717da7e0042e081849c173d9a` |
| `src/infrastructure/character/liveact/vrm-liveact-avatar-output.ts` | `f5ef95d582ee0f3a2ec47748e8d958306f3833d45a5e8e1b250d1eecfba5d9a6` |
| `src/infrastructure/character/supabase-character.repository.ts` | `ae0034e06c55c384124c933bc8093c3926b7ece34a5222213913d1fdc03a9878` |
| `src/infrastructure/inventory/inventory-persistence.ts` | `79aaa09053ecd72a0bec8f8f0610b31ab0c9b34779f4a4c87f19f0d2ef7e4ac2` |
| `src/infrastructure/inventory/item-catalog.persistence.ts` | `a68903ba909af8030e81d28555a65798800c9a32a790a4281e96f52b1550c566` |
| `src/infrastructure/inventory/supabase-item-catalog.repository.ts` | `1ea1b14afc3d01c117c13e96af516a8cc0a315edfb170a6f1f11c6903ab366eb` |
| `src/infrastructure/look/adapters/host-mtoon-look-adapter.ts` | `19b2f7008ffa27b5bd6c951019a55bde20d82f195ff9f798aa91b4d0a729e3a5` |
| `src/infrastructure/look/adapters/toonlab-look-adapter.ts` | `4edeab261bda3b114a4a9c9d7dcdb16a1cc73c24df0db23539480aa3a0834acb` |
| `src/infrastructure/look/host-look-adapter.ts` | `f1c8129f9ff83fb5e586da01b59cf26e3d6e54385f20e631ee353d0802c409c1` |
| `src/infrastructure/look/host-look-ports.contract.ts` | `f815bac34628b904e1c813d4929872b688d6dc140bebdf2a17a586c11556cf0f` |
| `src/infrastructure/look/index.ts` | `c51fc97d92ac25e40f1427086c846cb000990dd7556f2f1aab7deb14a9ccccd0` |
| `src/infrastructure/look/look-material-roles.ts` | `2e8161b18a046bb073664a586bb645dc1428c5796d04ade0b625c9339f8cfcdb` |
| `src/infrastructure/look/look-reference-analysis-service.ts` | `a032b123fff9a4fe81429f04cc3113fb776d296f069952f147293f350ebf50a3` |
| `src/infrastructure/look/look-runtime-types.ts` | `c31d27eaf600ed47e69f16120e584b06a985f29618923118a4c08570f276b2c6` |
| `src/infrastructure/look/look-runtime.ts` | `64487d02f2831514e86b721d41b0964ac8e99b37faf1a33b8771b4fa7b955d23` |
| `src/infrastructure/look/look-service.ts` | `0abf24e1268e8d9fa1651550e81d9fc937fc8f9f74667db3fd1bdb857f8a2d44` |
| `src/infrastructure/look/look.persistence.ts` | `ed0a97cba6560930610fc032bd7679b5a7e4b49f837e401cd5a872974598f482` |
| `src/infrastructure/look/supabase-look.repository.ts` | `4dc795897a12bf3319998860b855b0b9b55425e2be7e4c9b0844e7b2ec647121` |
| `src/infrastructure/media/optimizer/engines/audio/index.ts` | `7585190a705085692bff0896e08b4d78f791895b47e24d57deeaaa10bb669d4e` |
| `src/infrastructure/media/optimizer/engines/image/image.worker.ts` | `d34793b4de682556d9306194cfbcd05fdafdf215da25393f955d2669c7499276` |
| `src/infrastructure/media/optimizer/engines/image/index.ts` | `4944001b7e0f7784d487da2e60d06d845aa564e9ddd7516ff50633af1591a322` |
| `src/infrastructure/media/optimizer/engines/image/optimize-image.ts` | `bf73e826651227f704aff5ed584546a087f22f26c68a4c45ba918dfefbe7ce3e` |
| `src/infrastructure/media/optimizer/engines/image/raster-decode.ts` | `8ba5eda07565b10d1fb3d4090d068d12b1415399088c6c6b4a2aadc3fe4d290c` |
| `src/infrastructure/media/optimizer/engines/image/resource-limits.ts` | `1178fc226c85aee4f4989a7bd650d0b9830b37657c7499c1cec174b4aa9af364` |
| `src/infrastructure/media/optimizer/engines/image/types.ts` | `501095579c8bf1cc3af3a93147f4ab9fe1f280909c02e759d3d95c0f7151d45d` |
| `src/infrastructure/media/optimizer/engines/image/webp-budget.ts` | `7e7a1669b42c38b713f35952517260a61ca636cc6f84f29c76b949e3bcc2f70c` |
| `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts` | `718b74e3146c6723862f0a4639eb5b7905a35f70a8c0e3c6e33d530a4ef80b84` |
| `src/infrastructure/media/optimizer/engines/model3d/index.ts` | `bcc13ca0c9f7bfa1a68e6c893509b21e682fe2c44732945fba85215042ac6d62` |
| `src/infrastructure/media/optimizer/engines/video/index.ts` | `d8c6aaaabb2ad762d4c15f9ef4aa9bc016f5968b2512cfe52f71cb09655dd842` |
| `src/infrastructure/media/optimizer/index.ts` | `c1b162af47239195707de742a8991bea14d85f2238108968613c3bad3d91cf02` |
| `src/infrastructure/media/optimizer/media-optimizer.ts` | `7d58424f12b7855ccb3c0153270628850e03afc15c285b1fc2b47218918255d9` |
| `src/infrastructure/project/project-member-service.ts` | `573f8aa8d8cf55347cdac8062cc8449c9ca6a7db57ed17d1e76cc1d5dafbf054` |
| `src/infrastructure/project/project-service.ts` | `0afb7b8014dc8eb7ac2e5f9481c72105ba266534a73faff8143e048da1308eeb` |
| `src/infrastructure/session/media/livekit-media-plane-adapter.ts` | `ba41c95f3816b79818a9c312c056ec896ac75fd4633dba27954cdcdb797b381d` |
| `src/infrastructure/session/media/media-plane-adapter.ts` | `1dbdf0f7c75c1edc435fb629d5029a1c04806a5a6cbcf9b037ad8a620dcc34cd` |
| `src/infrastructure/session/media/media-token-client.ts` | `07e4692a4eb42ab86393e808e495383f3c7348d8a2699881dc4590869cc90bd6` |
| `src/infrastructure/session/media/memory-media-plane-adapter.ts` | `31fc7cee75c49c1e3af09b784e4a8dad3446bbe5ae5ddd6f7b2c9aee142dc5be` |
| `src/infrastructure/session/media/memory-media-plane-bus.ts` | `1616d229067f513a12c67319aec28649e3a0afdf77779f9071b595dc024ff193` |
| `src/infrastructure/session/media/session-media-plane.ts` | `ce8d3ec690f83745646400443d7870cd96383e341628a2d8f017e2d391fbb225` |
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/entityCache.ts` | `02b7a3d41ae651c6562d4523a1c94a395608aa13785f0849cfc9acd834aecd61` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

