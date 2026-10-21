# Infrastructure contract: rulesets

**Status: SPEC; current branch source verified.** Implementation issue: **#808**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-rulesets.json](source-contracts/infra-rulesets.json) (SHA-256 `b26a7d7ac4a716ef7316d76344bb229b97f3b92263252d221f66721315a78fec`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

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

`src/infrastructure/rulesets/ruleset-service.ts:10` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('rulesets')
      .select('*')
      .order('is_official', { ascending: false })
      .order('name')
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:9`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:21` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('rulesets')
      .select('*')
      .eq('is_official', true)
      .order('name')
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:20`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:32` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('rulesets').select('*').eq('id', id).single()
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:31`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:39` — literal-or-constant.

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

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:38`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:55` — literal-or-constant.

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

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:53`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: rulesets

`src/infrastructure/rulesets/ruleset-service.ts:70` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from('rulesets').delete().eq('id', id)
```

Enclosing operation: `src/infrastructure/rulesets/ruleset-service.ts:69`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/rulesets/ruleset-service.ts:8

```ts
export const rulesetService = {
  async getAll(): Promise<Ruleset[]> {
    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .order('is_official', { ascending: false })
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getOfficial(): Promise<Ruleset[]> {
    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('is_official', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Ruleset | null> {
    const { data, error } = await supabase.from('rulesets').select('*').eq('id', id).single();

    if (error) throw error;
    return data;
  },

  async create(dto: CreateRulesetDTO): Promise<Ruleset> {
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
| `src/domains/rules/ruleset-catalog/index.ts` | `c2f52133fdeaa82ca586670b79ce0144063cc852a2a5ca8b5b6b44369fc0e21e` |
| `src/domains/rules/ruleset-catalog/types.ts` | `1b76d37fc3c90d29d3f719644e6915a66462d7b55c4c6cec07a0caadfdf1512d` |
| `src/infrastructure/rulesets/ruleset-service.ts` | `edc092742690e6c376d1a9e8b6c4900672dc79f0f4754773c0953f87a91e1d4d` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

