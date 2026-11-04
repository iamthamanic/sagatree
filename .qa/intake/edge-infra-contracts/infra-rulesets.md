# Infrastructure contract: rulesets

**Status: SPEC; current branch source verified.** Implementation issue: **#808**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-rulesets.json](source-contracts/infra-rulesets.json) (SHA-256 `05cb1479983038a230a3911de895814ff6a01068e155e31f317a1cecc2f0d370`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Ruleset facade reads public/native definitions and manages permitted custom ruleset records through PostgREST; blocked rulesets worker is not called.

Public-read policy must stay public where currently allowed; custom writes require owner as enforced by RLS.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (1): `rulesets`.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| table | `rulesets` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- Load default/native/custom ruleset with equivalent sorting and decoding.
- Owner can save permitted custom ruleset; foreign owner write denied and public ruleset read not accidentally restricted.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:23` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('rulesets')
      .select('*')
      .order('is_official', { ascending: false })
      .order('name')
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:19`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:37` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('rulesets')
      .select('*')
      .eq('is_official', true)
      .order('name')
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:33`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:51` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('rulesets').select('*').eq('id', id).single()
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:47`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:61` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('rulesets')
      .insert({
        ...dto,
        is_official: false,
        is_marketplace_item: false,
      })
      .select()
      .single()
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:57`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:80` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('rulesets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:75`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:99` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('rulesets').delete().eq('id', id)
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:94`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/rulesets/ruleset-service.ts:18

```ts
export const rulesetService = {
  async getAll(): Promise<Ruleset[]> {
    if (isHostLibraryEnabled()) {
      return fetchHostRulesets(false);
    }
    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .order('is_official', { ascending: false })
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getOfficial(): Promise<Ruleset[]> {
    if (isHostLibraryEnabled()) {
      return fetchHostRulesets(true);
    }
    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('is_official', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Ruleset | null> {
    if (isHostLibraryEnabled()) {
      return fetchHostRuleset(id);
    }
    const { data, error } = await supabase.from('rulesets').select('*').eq('id', id).single();

    if (error) throw error;
    return data;
  },

  async create(dto: CreateRulesetDTO): Promise<Ruleset> {
    if (isHostLibraryEnabled()) {
      return createHostRuleset(dto);
    }
    const { data, error } = await supabase
      .from('rulesets')
      .insert({
        ...dto,
        is_official: false,
        is_marketplace_item: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(dto: UpdateRulesetDTO): Promise<Ruleset> {
    if (isHostLibraryEnabled()) {
      return updateHostRuleset(dto);
    }
    const { id, ...updates } = dto;
    const { data, error } = await supabase
      .from('rulesets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (isHostLibraryEnabled()) {
      await deleteHostRuleset(id);
      return;
    }
    const { error } = await supabase.from('rulesets').delete().eq('id', id);

    if (error) throw error;
  },
};
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/marketplace/contracts/marketplace.types.ts` | `000aecc695577333ad6fce27422ad02bc15f26ffca88507ebfee1fafb04b9467` |
| `src/domains/rules/ruleset-catalog/index.ts` | `c2f52133fdeaa82ca586670b79ce0144063cc852a2a5ca8b5b6b44369fc0e21e` |
| `src/domains/rules/ruleset-catalog/types.ts` | `1b76d37fc3c90d29d3f719644e6915a66462d7b55c4c6cec07a0caadfdf1512d` |
| `src/domains/user-profile/contracts/user-profile.types.ts` | `2f3f3472e9a3448099144be0993fd83bbbc2270050ce76dceadd8821501c26b7` |
| `src/domains/user-profile/display-name.ts` | `87cfc4858f198e56ea2857c505162f112efd5edacde4dbb1f7fcd995b4535516` |
| `src/domains/user-profile/index.ts` | `d094d245ff9356298ef20c48635ca3e7adcc0e1ccf180554586949e0b496c496` |
| `src/infrastructure/host/host-catalog-http.ts` | `a33c807b3bde9200f472b2d4d057d633960fba65fcf14b32e6f7053adb9c9f5a` |
| `src/infrastructure/host/host-library-http.ts` | `88754decbf6c4b587d9901f090eb63cd2bb9406e34086984acb9e316196ae84c` |
| `src/infrastructure/rulesets/ruleset-service.ts` | `bab6988a93fe3d917d9014a02b832dd8c4b803f81e9cfb36f107411f0e763542` |
| `src/lib/hostAuthBridge.ts` | `0de05e68ee6699238e48897ea41de2d6f133ef4818159729ba694d96fbee1c98` |
| `src/lib/supabase.ts` | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

