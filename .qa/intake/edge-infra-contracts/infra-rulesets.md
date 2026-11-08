# Infrastructure contract: rulesets

**Status: SPEC; current branch source verified.** Implementation issue: **#808**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-rulesets.json](source-contracts/infra-rulesets.json) (SHA-256 `094ebd803519cac89f9a02c4639106f41c21f805c2623cdf413663f3dbffb898`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Ruleset facade reads public/native definitions and manages permitted custom ruleset records through PostgREST; blocked rulesets worker is not called.

Public-read policy must stay public where currently allowed; custom writes require owner as enforced by RLS.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


## Acceptance and negative tests (required, not executed)

- Load default/native/custom ruleset with equivalent sorting and decoding.
- Owner can save permitted custom ruleset; foreign owner write denied and public ruleset read not accidentally restricted.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.

## Complete public declarations and facade operation contracts

### src/infrastructure/rulesets/ruleset-service.ts:21

```ts
export const rulesetService = {
  async getAll(): Promise<Ruleset[]> {
    assertHost();
    return fetchHostRulesets(false);
  },

  async getOfficial(): Promise<Ruleset[]> {
    assertHost();
    return fetchHostRulesets(true);
  },

  async getById(id: string): Promise<Ruleset | null> {
    assertHost();
    return fetchHostRuleset(id);
  },

  async create(dto: CreateRulesetDTO): Promise<Ruleset> {
    assertHost();
    return createHostRuleset(dto);
  },

  async update(dto: UpdateRulesetDTO): Promise<Ruleset> {
    assertHost();
    return updateHostRuleset(dto);
  },

  async delete(id: string): Promise<void> {
    assertHost();
    await deleteHostRuleset(id);
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
| `src/infrastructure/host/host-catalog-http.ts` | `9049245360683a74e7e2602d35126d815d64344d384c6684e4c2c3d41aa626d3` |
| `src/infrastructure/host/host-library-http.ts` | `c56b88c60d6c9491fc7b6e6e1143ac4985ffdab5dff16afef8a54bce79629a07` |
| `src/infrastructure/rulesets/ruleset-service.ts` | `63ee20191f274a6c5f788e4824a098dc9761273ec0681af0341c2576dd92bb2d` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |

