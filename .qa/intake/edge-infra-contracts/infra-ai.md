# Infrastructure contract: ai

**Status: SPEC; current branch source verified.** Implementation issue: **#800**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-ai.json](source-contracts/infra-ai.json) (SHA-256 `8042aca0facae9dee39021517042bb1d0e298b2fc3575e6f8eb61a8f8a2f1913`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

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

`src/infrastructure/ai/host-ai-invoke.ts:68` — finite-literal-union.

Exact call/query chain:
```ts
supabase.functions.invoke(functionName, { body })
```

Enclosing operation: `src/infrastructure/ai/host-ai-invoke.ts:63`; complete request/default/result/error logic is in the declarations below and the snapshot.
### edge: ollama-settings

`src/infrastructure/ai/host-ai-invoke.ts:68` — finite-literal-union.

Exact call/query chain:
```ts
supabase.functions.invoke(functionName, { body })
```

Enclosing operation: `src/infrastructure/ai/host-ai-invoke.ts:63`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/ai/ai-provider-credentials-service.ts:81

```ts
export class AiProviderCredentialsService {
  private readonly invokeFn: AiInvokeFn;

  constructor(invokeFn: AiInvokeFn = createAiInvoke()) {
    this.invokeFn = invokeFn;
  }

  private async invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
    return parseResponse(await this.invokeFn('provider-credentials', body));
  }

  async list(modality?: AiModality): Promise<AiProviderCredentialView[]> {
    const response = await this.invoke({
      action: 'list',
      ...(modality ? { modality } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    const providers = Array.isArray(response.providers) ? response.providers : [];
    return providers
      .map((row) => parseProviderView(row))
      .filter((row): row is AiProviderCredentialView => row !== null);
  }

  async upsert(providerId: string, apiKey: string): Promise<AiProviderCredentialView> {
    const response = await this.invoke({
      action: 'upsert',
      providerId,
      apiKey,
    });
    if (response.status !== 'ok') throw new Error(response.message);
    const provider = parseProviderView(response.provider);
    if (!provider) throw new Error('Speicher-Antwort unvollständig.');
    return provider;
  }

  async refresh(providerId: string): Promise<AiProviderCredentialView> {
    const response = await this.invoke({ action: 'refresh', providerId });
    if (response.status !== 'ok') throw new Error(response.message);
    const provider = parseProviderView(response.provider);
    if (!provider) throw new Error('Aktualisierungs-Antwort unvollständig.');
    return provider;
  }

  async delete(providerId: string): Promise<void> {
    const response = await this.invoke({ action: 'delete', providerId });
    if (response.status !== 'ok') throw new Error(response.message);
  }
}
```

### src/infrastructure/ai/ai-provider-credentials-service.ts:130

```ts
export const aiProviderCredentialsService = new AiProviderCredentialsService();
```

### src/infrastructure/ai/host-ai-invoke.ts:12

```ts
export type AiInvokeFn = (
  path: 'provider-credentials' | 'ollama-settings',
  body: Record<string, unknown>,
) => Promise<unknown>;
```

### src/infrastructure/ai/host-ai-invoke.ts:115

```ts
export function createAiInvoke(options?: {
  readonly fetchImpl?: typeof fetch;
  readonly env?: EnvLike;
  /** Force Edge even when host AI opt-in is set (tests). */
  readonly forceEdge?: boolean;
}): AiInvokeFn {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const env = options?.env ?? ((import.meta as ImportMeta & { env?: EnvLike }).env ?? {});
  const forceEdge = options?.forceEdge === true;

  return async (path, body) => {
    const preferHost =
      !forceEdge && getHostAuthBaseUrl(env) !== null && isHostAiEnabled(env);
    if (preferHost) {
      return invokeHost(
        path,
        body,
        path === 'ollama-settings'
          ? 'Ollama-Einstellungen nicht erreichbar.'
          : 'AI-Provider-Dienst nicht erreichbar.',
        fetchImpl,
        env,
      );
    }
    return invokeEdge(
      path === 'ollama-settings' ? 'ollama-settings' : 'ai-provider-credentials',
      body,
      path === 'ollama-settings'
        ? 'Ollama-Einstellungen nicht erreichbar.'
        : 'AI-Provider-Dienst nicht erreichbar.',
    );
  };
}
```

### src/infrastructure/ai/host-ai-invoke.ts:149

```ts
export const defaultAiInvoke = createAiInvoke();
```

### src/infrastructure/ai/ollama-settings-service.ts:68

```ts
export class OllamaSettingsService {
  private readonly invokeFn: AiInvokeFn;

  constructor(invokeFn: AiInvokeFn = createAiInvoke()) {
    this.invokeFn = invokeFn;
  }

  private async invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
    return parseResponse(await this.invokeFn('ollama-settings', body));
  }

  async get(): Promise<OllamaSettingsView> {
    const response = await this.invoke({ action: 'get' });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Einstellungen unvollständig.');
    return settings;
  }

  async upsert(input: OllamaSettingsUpsertInput): Promise<{
    settings: OllamaSettingsView;
    models: string[];
  }> {
    const response = await this.invoke({
      action: 'upsert',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      model: input.model,
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Speicher-Antwort unvollständig.');
    return { settings, models: parseModels(response.models) };
  }

  async test(input: {
    useCloud: boolean;
    baseUrl: string;
    model?: string;
    apiKey?: string;
  }): Promise<{ message: string; models: string[] }> {
    const response = await this.invoke({
      action: 'test',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      ...(input.model ? { model: input.model } : {}),
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    return {
      message: typeof response.message === 'string' ? response.message : 'Verbindung OK.',
      models: parseModels(response.models),
    };
  }

  async listModels(input: {
    useCloud: boolean;
    baseUrl: string;
    apiKey?: string;
  }): Promise<string[]> {
    const response = await this.invoke({
      action: 'listModels',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    return parseModels(response.models);
  }

  async clear(): Promise<OllamaSettingsView> {
    const response = await this.invoke({ action: 'clear' });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Reset-Antwort unvollständig.');
    return settings;
  }
}
```

### src/infrastructure/ai/ollama-settings-service.ts:148

```ts
export const ollamaSettingsService = new OllamaSettingsService();
```


## Remaining backend helper operations

### src/infrastructure/ai/host-ai-invoke.ts:63

```ts
async function invokeEdge(
  functionName: 'ai-provider-credentials' | 'ollama-settings',
  body: Record<string, unknown>,
  unreachableMessage: string,
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    const serverMessage = await edgeErrorMessage(error);
    throw new Error(serverMessage ?? unreachableMessage);
  }
  return data;
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/ai-providers/contracts.ts` | `7ddd1f75a92998d2ed8ec32d8bf868ed74ef8d2cd5a4f1b1aa07e57e587102cb` |
| `src/domains/ai-providers/index.ts` | `460e4fa3639a12e0e028b19de91b947e482fee90585dc9844d6f8cfa70df2f05` |
| `src/domains/ai-providers/ollama-settings.ts` | `f3cbc6de1a3822b21cf3edf08f6debb19ea27299b46f54dbd1bfac0eaf83150c` |
| `src/infrastructure/ai/ai-provider-credentials-service.ts` | `deabff23986dd311748c7efff1539c2fe977465fa8357c5a1fda1577c5562e51` |
| `src/infrastructure/ai/host-ai-invoke.ts` | `2ca0b59aa92fc669d37349ff52ee4b701ed6abcdfd476a7e8847dda23271c44e` |
| `src/infrastructure/ai/ollama-settings-service.ts` | `aaf53b0f3004f001018518dade230a67f923c98897413476c9635f7d0aae1116` |
| `src/lib/hostAuthBridge.ts` | `6807ead91edd60cf1811c6d96c40f360a4e461845047b9b09aae2a835be1905b` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

