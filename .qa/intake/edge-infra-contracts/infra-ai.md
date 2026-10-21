# Infrastructure contract: ai

**Status: SPEC; current branch source verified.** Implementation issue: **#800**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-ai.json](source-contracts/infra-ai.json) (SHA-256 `12fceac5fa232fcf0be1497c6ad17006a35c2a091f994a1254ff0edce6ad5a19`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Public facade manages current account BYOK catalog (ai-provider-credentials) and Organize Ollama prefs (ollama-settings get/upsert/test/listModels); providers validated through parse layer, no project membership precondition.

User access token only to ai-provider-credentials and ollama-settings; no API key persisted in browser facade or returned as credential/settings metadata.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (2): `ai-provider-credentials`, `ollama-settings`.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `ai-provider-credentials` | #818 |  |
| edge | `ollama-settings` | #818 |  |
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- List/add/refresh/delete preserve typed public credential view and expose provider errors without key leakage.
- Ollama Organize get/upsert/test/listModels preserve typed settings view without apiKey leakage; foreign account cannot mutate owner prefs.
- Foreign account cannot list or mutate owner credentials; missing session fails before invoke.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### edge: ai-provider-credentials

`src/infrastructure/ai/ai-provider-credentials-service.ts:57` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('ai-provider-credentials', { body })
```

Enclosing operation: `src/infrastructure/ai/ai-provider-credentials-service.ts:56`; complete request/default/result/error logic is in the declarations below and the snapshot.
### edge: ollama-settings

`src/infrastructure/ai/ollama-settings-service.ts:52` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('ollama-settings', { body })
```

Enclosing operation: `src/infrastructure/ai/ollama-settings-service.ts:51`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/ai/ai-provider-credentials-service.ts:143

```ts
export const aiProviderCredentialsService = new AiProviderCredentialsService();
```

### src/infrastructure/ai/ollama-settings-service.ts:161

```ts
export const ollamaSettingsService = new OllamaSettingsService();
```


## Remaining backend helper operations

### src/infrastructure/ai/ai-provider-credentials-service.ts:56

```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('ai-provider-credentials', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? 'AI-Provider-Dienst nicht erreichbar.');
  }
  return parseResponse(data);
}
```

### src/infrastructure/ai/ollama-settings-service.ts:51

```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('ollama-settings', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? 'Ollama-Einstellungen nicht erreichbar.');
  }
  return parseResponse(data);
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/ai-providers/contracts.ts` | `7ddd1f75a92998d2ed8ec32d8bf868ed74ef8d2cd5a4f1b1aa07e57e587102cb` |
| `src/domains/ai-providers/index.ts` | `460e4fa3639a12e0e028b19de91b947e482fee90585dc9844d6f8cfa70df2f05` |
| `src/domains/ai-providers/ollama-settings.ts` | `f3cbc6de1a3822b21cf3edf08f6debb19ea27299b46f54dbd1bfac0eaf83150c` |
| `src/infrastructure/ai/ai-provider-credentials-service.ts` | `2d8233ab5816f88afd6b20db580e87d6f8d8b447a28e0f02d02d7c7425249d50` |
| `src/infrastructure/ai/ollama-settings-service.ts` | `e7b2dede5b175b22e3b3218f10e2c897deb2135dcac131dcefc1e87796891a91` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

