# Infrastructure contract: user-profile

**Status: SPEC; current branch source verified.** Implementation issue: **#811**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-user-profile.json](source-contracts/infra-user-profile.json) (SHA-256 `eb05a60867b2db56b7d3784b2692935c4a52fce06843bd0f1d11fe0bd78b48e6`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

ensureOwnProfileRow performs own select-then-insert and treats23505 duplicate race as success; getOwnProfile maps displayName/avatarPath/avatarUrl/updatedAt. getProfilesByUserIds trims/deduplicates arbitrary requested IDs, queries visible profile rows and signs avatar URLs in parallel for lobby display. uploadAvatar validates PNG/JPEG/WebP magic/MIME and<=5MiB, uploads owner/random path, updates own row, cleans failed new object best-effort and old object asynchronously, then signs604800s URL.

Writes derive own user identity and storage prefix from authenticated user. Batch profile display intentionally reads visible other-user profiles and signs their visible avatars under actual table/storage policies. Do not invent an owner-only read restriction that breaks lobby identity; do not allow foreign profile writes.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (1): `user_profiles`.

Storage buckets (1): `user-avatars`.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 3.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| table | `user_profiles` | #791 | Policy #792 |
| storage | `user-avatars` | #841 |  |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `media` | #805 |  |

## Acceptance and negative tests (required, not executed)

- Own row race23505 succeeds; actual select/insert errors fail with formatted details.
- Batch IDs are trimmed/deduplicated, absent rows omitted, signing failures returnavatarUrl null, and visible teammate profiles remain displayable.
- Valid<=5MiB avatar replaces own path and emits cache/event update; foreign writes denied; invalid magic/MIME/size rejected; DB update failure cleans new object while retaining previous row.

## Observed source defects and explicit successor decisions

- Object deletion is best effort/asynchronous and separate from profile row update; no atomic storage+DB transaction. There is no standalone delete-avatar or display-name mutation method in this facade.

## All backend calls, arguments, filters and result handling

### storage: user-avatars

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:61` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage
    .from(USER_AVATARS_BUCKET)
    .createSignedUrl(path, USER_AVATAR_SIGNED_SECONDS)
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:59`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:92` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:91`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: user_profiles

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:93` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:91`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: user_profiles

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:103` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('user_profiles').insert({ id: userId })
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:91`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:111` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:110`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: user_profiles

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:113` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('user_profiles')
      .select('id, display_name, avatar_path, updated_at')
      .eq('id', userId)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:110`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: user_profiles

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:134` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('user_profiles')
      .select('id, display_name, avatar_path, updated_at')
      .in('id', ids)
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:131`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:149` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:148`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: user-avatars

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:165` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage
      .from(USER_AVATARS_BUCKET)
      .upload(filePath, file, {
        contentType: sniffed,
        upsert: false,
      })
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:148`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: user_profiles

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:175` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('user_profiles')
      .select('avatar_path')
      .eq('id', userId)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:148`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: user_profiles

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:185` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('user_profiles')
      .update({ avatar_path: filePath })
      .eq('id', userId)
      .select('id, display_name, avatar_path, updated_at')
      .single()
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:148`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: user-avatars

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:193` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(USER_AVATARS_BUCKET).remove([filePath])
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:148`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: user-avatars

`src/infrastructure/user-profile/supabase-user-profile.repository.ts:202` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(USER_AVATARS_BUCKET).remove([previousPath])
```

Enclosing operation: `src/infrastructure/user-profile/supabase-user-profile.repository.ts:148`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/user-profile/account-avatar-changed.ts:11

```ts
export const ACCOUNT_AVATAR_CHANGED_EVENT = 'sagatree:account-avatar-changed';
```

### src/infrastructure/user-profile/account-avatar-changed.ts:13

```ts
export type AccountAvatarChangedDetail = {
  readonly avatarUrl: string | null;
};
```

### src/infrastructure/user-profile/account-avatar-changed.ts:17

```ts
export function notifyAccountAvatarChanged(avatarUrl: string | null): void {
  publishAccountAvatarUrl(avatarUrl);
}
```

### src/infrastructure/user-profile/account-avatar-changed.ts:21

```ts
export function subscribeAccountAvatarChanged(
  listener: (avatarUrl: string | null) => void,
): () => void {
  return subscribeAccountAvatarUrl(listener);
}
```

### src/infrastructure/user-profile/account-avatar-store.ts:17

```ts
export function getAccountAvatarUrlCache(): string | null {
  return cachedAvatarUrl;
}
```

### src/infrastructure/user-profile/account-avatar-store.ts:21

```ts
export function getAccountAvatarLoadedUserId(): string | null {
  return remoteLoadedUserId;
}
```

### src/infrastructure/user-profile/account-avatar-store.ts:25

```ts
export function publishAccountAvatarUrl(avatarUrl: string | null): void {
  if (cachedAvatarUrl === avatarUrl) return;
  cachedAvatarUrl = avatarUrl;
  for (const listener of listeners) {
    listener(avatarUrl);
  }
}
```

### src/infrastructure/user-profile/account-avatar-store.ts:33

```ts
export function clearAccountAvatarUrlCache(): void {
  remoteLoadedUserId = null;
  loadInFlight = null;
  if (cachedAvatarUrl === null) return;
  cachedAvatarUrl = null;
  for (const listener of listeners) {
    listener(null);
  }
}
```

### src/infrastructure/user-profile/account-avatar-store.ts:43

```ts
export function subscribeAccountAvatarUrl(listener: AvatarListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

### src/infrastructure/user-profile/account-avatar-store.ts:56

```ts
export function ensureAccountAvatarLoaded(
  userId: string,
  loadProfile: ProfileLoader,
): Promise<void> {
  if (remoteLoadedUserId === userId) {
    return Promise.resolve();
  }
  if (loadInFlight) return loadInFlight;

  loadInFlight = (async () => {
    try {
      const row = await loadProfile();
      const remote = row?.avatarUrl ?? null;
      remoteLoadedUserId = userId;
      if (remote) {
        publishAccountAvatarUrl(remote);
      }
      // else: keep optimistic cache (local Object URL) if present
    } catch (err) {
      console.error('Account avatar remote load failed:', err);
      remoteLoadedUserId = userId;
    } finally {
      loadInFlight = null;
    }
  })();

  return loadInFlight;
}
```

### src/infrastructure/user-profile/supabase-user-profile.repository.ts:211

```ts
export const supabaseUserProfileRepository = new SupabaseUserProfileRepository();
```

### src/infrastructure/user-profile/user-profile-service.ts:8

```ts
export type UploadUserAvatarOptions = {
  /**
   * When true, skip client optimize (caller already ran user-avatar intake).
   * Storage MIME/magic-byte/owner checks still run in the repository.
   */
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/user-profile/user-profile-service.ts:21

```ts
export async function prepareUserAvatarFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'user-avatar',
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
      throw new Error('Avatar-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'avatar';
    const ext = result.outputMimeType === 'image/webp' ? 'webp' : 'bin';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Avatar-Optimierung abgebrochen.');
  }

  throw new Error(
    result.message || `Avatar-Optimierung fehlgeschlagen (${result.status}).`,
  );
}
```

### src/infrastructure/user-profile/user-profile-service.ts:63

```ts
export const userProfileService = {
  async getOwnProfile(): Promise<UserProfileVm | null> {
    return supabaseUserProfileRepository.getOwnProfile();
  },

  async getProfilesByUserIds(userIds: readonly string[]): Promise<UserProfileVm[]> {
    return supabaseUserProfileRepository.getProfilesByUserIds(userIds);
  },

  async uploadAvatar(file: File, options?: UploadUserAvatarOptions): Promise<UserProfileVm> {
    const prepared = options?.alreadyOptimized
      ? file
      : await prepareUserAvatarFile(file, options?.signal);
    return supabaseUserProfileRepository.uploadAvatar(prepared);
  },

  prepareAvatarFile: prepareUserAvatarFile,
};
```


## Remaining backend helper operations

### src/infrastructure/user-profile/supabase-user-profile.repository.ts:59

```ts
async function signedUrlForPath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(USER_AVATARS_BUCKET)
    .createSignedUrl(path, USER_AVATAR_SIGNED_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
```

### src/infrastructure/user-profile/supabase-user-profile.repository.ts:91

```ts
async ensureOwnProfileRow(): Promise<void> {
    const userId = await getAuthenticatedUserId();
    const { data, error: selectError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (selectError) {
      throw new Error(`Profil konnte nicht geladen werden: ${formatSupabaseError(selectError)}`);
    }
    if (data) return;

    const { error: insertError } = await supabase.from('user_profiles').insert({ id: userId });
    if (!insertError) return;
    // Concurrent ensure / signup trigger already created the row.
    if (insertError.code === '23505') return;
    throw new Error(`Profil konnte nicht angelegt werden: ${formatSupabaseError(insertError)}`);
  }
```

### src/infrastructure/user-profile/supabase-user-profile.repository.ts:110

```ts
async getOwnProfile(): Promise<UserProfileVm | null> {
    const userId = await getAuthenticatedUserId();
    await this.ensureOwnProfileRow();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_path, updated_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      throw new Error(`Profil konnte nicht geladen werden: ${formatSupabaseError(error)}`);
    }
    if (!data) return null;
    const row = data as UserProfileRow;
    const avatarUrl = await signedUrlForPath(row.avatar_path);
    return mapRow(row, avatarUrl);
  }
```

### src/infrastructure/user-profile/supabase-user-profile.repository.ts:131

```ts
async getProfilesByUserIds(userIds: readonly string[]): Promise<UserProfileVm[]> {
    const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_path, updated_at')
      .in('id', ids);
    if (error) {
      throw new Error(`Profile konnten nicht geladen werden: ${formatSupabaseError(error)}`);
    }
    const rows = (data ?? []) as UserProfileRow[];
    const mapped = await Promise.all(
      rows.map(async (row) => mapRow(row, await signedUrlForPath(row.avatar_path))),
    );
    return mapped;
  }
```

### src/infrastructure/user-profile/supabase-user-profile.repository.ts:148

```ts
async uploadAvatar(file: File): Promise<UserProfileVm> {
    const userId = await getAuthenticatedUserId();
    await this.ensureOwnProfileRow();

    const sniffed = await sniffUserAvatarMime(file);
    if (!sniffed) {
      throw new Error('Ungültiger Dateityp. Nur PNG, JPEG und WEBP sind erlaubt.');
    }
    if (file.type && file.type !== sniffed) {
      throw new Error('Deklarierter Bildtyp stimmt nicht mit dem Dateiinhalt überein.');
    }
    if (file.size > USER_AVATAR_MAX_BYTES) {
      throw new Error('Datei zu groß. Maximum ist 5MB.');
    }

    const extension = USER_AVATAR_MIME_EXTENSIONS[sniffed];
    const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(USER_AVATARS_BUCKET)
      .upload(filePath, file, {
        contentType: sniffed,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Avatar-Upload fehlgeschlagen: ${formatSupabaseError(uploadError)}`);
    }

    const { data: previous } = await supabase
      .from('user_profiles')
      .select('avatar_path')
      .eq('id', userId)
      .maybeSingle();
    const previousPath =
      previous && typeof (previous as { avatar_path?: unknown }).avatar_path === 'string'
        ? (previous as { avatar_path: string }).avatar_path
        : null;

    const { data: updated, error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_path: filePath })
      .eq('id', userId)
      .select('id, display_name, avatar_path, updated_at')
      .single();
    if (updateError || !updated) {
      // Best-effort cleanup of orphan object; keep prior avatar_path on row.
      await supabase.storage.from(USER_AVATARS_BUCKET).remove([filePath]);
      throw new Error(
        updateError
          ? `Avatar konnte nicht gespeichert werden: ${formatSupabaseError(updateError)}`
          : 'Avatar konnte nicht gespeichert werden',
      );
    }

    if (previousPath && previousPath !== filePath) {
      void supabase.storage.from(USER_AVATARS_BUCKET).remove([previousPath]);
    }

    const row = updated as UserProfileRow;
    const avatarUrl = await signedUrlForPath(row.avatar_path);
    return mapRow(row, avatarUrl);
  }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/media/index.ts` | `768ded2d0f0fd1d510d660924e787817673955dbeff021d7de9e0a8d8e38bdec` |
| `src/domains/media/optimization-contract.ts` | `ba9216dab79a9c03f66a16b77dedf1c26d4d00d6ae2693cc5a68919d1647846d` |
| `src/domains/media/optimization-policy.ts` | `6145574bc08d1eb94f54d488ebc1f8bc030c2a956e3e3fd24cb15a7c8e50c5ec` |
| `src/domains/user-profile/contracts/user-profile.types.ts` | `2f3f3472e9a3448099144be0993fd83bbbc2270050ce76dceadd8821501c26b7` |
| `src/domains/user-profile/display-name.ts` | `87cfc4858f198e56ea2857c505162f112efd5edacde4dbb1f7fcd995b4535516` |
| `src/domains/user-profile/index.ts` | `d094d245ff9356298ef20c48635ca3e7adcc0e1ccf180554586949e0b496c496` |
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
| `src/infrastructure/user-profile/account-avatar-changed.ts` | `79b2b404b93bdf7174d30341c08b23662aaa412686c9b3251106e1d79fc42045` |
| `src/infrastructure/user-profile/account-avatar-store.ts` | `ca478b00af6f5b52a531dcb244e8a2d5f92e4765bde69d1d52afa80e1542dbdb` |
| `src/infrastructure/user-profile/supabase-user-profile.repository.ts` | `21c6318bd3941ea565a1160598a9ad6203c75d9a4d74a2ec10be33fe990dd076` |
| `src/infrastructure/user-profile/user-profile-service.ts` | `049906c505155c6b73f71355d44b607d251d556a565a03d44bc7ed86a5a8c981` |
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

