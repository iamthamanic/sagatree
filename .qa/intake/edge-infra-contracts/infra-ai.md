# Infrastructure contract: ai

**Status: SPEC; current branch source verified.** Implementation issue: **#800**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-ai.json](source-contracts/infra-ai.json) (SHA-256 `83aee082ecc5fe371cfb4a399e3136805895c4dbb7671f5d6133361ca60b993a`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Public facade manages current account BYOK catalog (ai-provider-credentials) and Organize Ollama prefs (ollama-settings get/upsert/test/listModels); providers validated through parse layer, no project membership precondition.

User access token only to ai-provider-credentials and ollama-settings; no API key persisted in browser facade or returned as credential/settings metadata.

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

- List/add/refresh/delete preserve typed public credential view and expose provider errors without key leakage.
- Ollama Organize get/upsert/test/listModels preserve typed settings view without apiKey leakage; foreign account cannot mutate owner prefs.
- Foreign account cannot list or mutate owner credentials; missing session fails before invoke.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.

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

### src/infrastructure/ai/aiberto-ask-service.ts:11

```ts
export type AibertoAskCitation = {
  readonly sectionId: string;
  readonly title?: string;
  readonly number?: string | null;
};
```

### src/infrastructure/ai/aiberto-ask-service.ts:17

```ts
export type AibertoAskFinal =
  | {
      readonly status: 'ok';
      readonly answer: string;
      readonly citations: readonly AibertoAskCitation[];
      readonly droppedCitationIds?: readonly string[];
      readonly indexRevision: string;
      readonly retrievedSectionIds: readonly string[];
      readonly provider?: string;
      readonly model?: string;
    }
  | {
      readonly status: 'unanswered';
      readonly reason: string;
      readonly message: string;
      readonly indexRevision: string;
      readonly retrievedSectionIds: readonly string[];
    }
  | {
      readonly status: 'disabled' | 'not-configured';
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly status: 'error';
      readonly code: string;
      readonly message: string;
      readonly httpStatus?: number;
    };
```

### src/infrastructure/ai/aiberto-ask-service.ts:47

```ts
export type AibertoAskStreamHandlers = {
  readonly onMeta?: (data: Record<string, unknown>) => void;
  readonly onToken?: (text: string) => void;
  readonly onFinal?: (data: AibertoAskFinal) => void;
  readonly onError?: (data: AibertoAskFinal) => void;
};
```

### src/infrastructure/ai/aiberto-ask-service.ts:138

```ts
export async function streamAibertoAsk(
  question: string,
  handlers: AibertoAskStreamHandlers,
  options?: {
    readonly signal?: AbortSignal;
    readonly fetchImpl?: typeof fetch;
    readonly env?: EnvLike;
  },
): Promise<void> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const env = options?.env ?? ((import.meta as ImportMeta & { env?: EnvLike }).env ?? {});
  const url = askUrl(env, true);
  if (!url) {
    handlers.onError?.({
      status: 'error',
      code: 'HOST_UNAVAILABLE',
      message: 'Aiberto-Host ist nicht erreichbar. Prüfe die Verbindung.',
    });
    return;
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: options?.signal,
    });
  } catch (err) {
    if (options?.signal?.aborted) return;
    handlers.onError?.({
      status: 'error',
      code: 'HOST_UNAVAILABLE',
      message: 'Aiberto-Host ist nicht erreichbar. Prüfe die Verbindung.',
    });
    return;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('text/event-stream') || !response.body) {
    let fallback: AibertoAskFinal | null = null;
    try {
      const json: unknown = await response.json();
      fallback = parseFinal(json);
    } catch {
      fallback = null;
    }
    handlers.onError?.(
      fallback ?? {
        status: 'error',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Aiberto-Chat konnte nicht gestartet werden. Bitte später erneut versuchen.',
      },
    );
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let sawTerminal = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBlocks(pending);
      pending = rest;
      for (const evt of events) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(evt.data);
        } catch {
          continue;
        }
        if (evt.event === 'meta' && isRecord(parsed)) {
          handlers.onMeta?.(parsed);
        } else if (evt.event === 'token' && isRecord(parsed) && typeof parsed.text === 'string') {
          handlers.onToken?.(parsed.text);
        } else if (evt.event === 'final') {
          const final = parseFinal(parsed);
          if (final) {
            sawTerminal = true;
            handlers.onFinal?.(final);
          }
        } else if (evt.event === 'error') {
          sawTerminal = true;
          const errFinal = parseFinal(parsed);
          handlers.onError?.(
            errFinal ?? {
              status: 'error',
              code: 'INTERNAL',
              message: 'Aiberto-Stream fehlgeschlagen.',
            },
          );
        }
      }
    }
    if (!sawTerminal && !options?.signal?.aborted) {
      handlers.onError?.({
        status: 'error',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Aiberto-Stream endete ohne Antwort. Bitte erneut versuchen.',
      });
    }
  } catch (err) {
    if (options?.signal?.aborted) return;
    handlers.onError?.({
      status: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Aiberto-Stream abgebrochen. Bitte erneut versuchen.',
    });
  }
}
```

### src/infrastructure/ai/aiberto-tools-service.ts:10

```ts
export type AibertoToolCapability = {
  readonly id: string;
  readonly kind: 'read' | 'nav';
  readonly labelDe: string;
  readonly descriptionDe: string;
  readonly argsSchema: Readonly<Record<string, string>>;
};
```

### src/infrastructure/ai/aiberto-tools-service.ts:18

```ts
export type AibertoClientNavigateAction = {
  readonly type: 'app.navigate';
  readonly path: string;
};
```

### src/infrastructure/ai/aiberto-tools-service.ts:23

```ts
export type AibertoToolsCapabilitiesResult =
  | {
      readonly status: 'ok';
      readonly enabled: true;
      readonly note: string;
      readonly tools: readonly AibertoToolCapability[];
    }
  | {
      readonly status: 'disabled';
      readonly code: string;
      readonly message: string;
      readonly enabled: false;
      readonly tools: readonly [];
    }
  | {
      readonly status: 'error';
      readonly code: string;
      readonly message: string;
    };
```

### src/infrastructure/ai/aiberto-tools-service.ts:43

```ts
export type AibertoToolInvokeResult =
  | {
      readonly status: 'ok';
      readonly toolId: string;
      readonly data: unknown;
      readonly clientAction?: AibertoClientNavigateAction;
    }
  | {
      readonly status: 'disabled';
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly status: 'error';
      readonly code: string;
      readonly message: string;
      readonly toolId?: string;
    };
```

### src/infrastructure/ai/aiberto-tools-service.ts:159

```ts
export async function fetchAibertoToolCapabilities(
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<AibertoToolsCapabilitiesResult> {
  const base = toolsBase(env);
  if (base === null) {
    return {
      status: 'error',
      code: 'NOT_CONFIGURED',
      message: 'Host nicht erreichbar.',
    };
  }
  try {
    const response = await fetchImpl(`${base}/api/v1/ai/aiberto-tools/capabilities`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const json: unknown = await response.json().catch(() => null);
    return parseCapabilities(json);
  } catch {
    return {
      status: 'error',
      code: 'INTERNAL',
      message: 'Capabilities-Anfrage fehlgeschlagen.',
    };
  }
}
```

### src/infrastructure/ai/aiberto-tools-service.ts:188

```ts
export async function invokeAibertoTool(
  toolId: string,
  args: Record<string, unknown> = {},
  env: EnvLike = defaultEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<AibertoToolInvokeResult> {
  const base = toolsBase(env);
  if (base === null) {
    return {
      status: 'error',
      code: 'NOT_CONFIGURED',
      message: 'Host nicht erreichbar.',
    };
  }
  try {
    const response = await fetchImpl(`${base}/api/v1/ai/aiberto-tools/invoke`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toolId, args }),
    });
    const json: unknown = await response.json().catch(() => null);
    return parseInvoke(json);
  } catch {
    return {
      status: 'error',
      code: 'INTERNAL',
      message: 'Tool-Aufruf fehlgeschlagen.',
      toolId,
    };
  }
}
```

### src/infrastructure/ai/host-ai-invoke.ts:10

```ts
export type AiInvokeFn = (
  path: 'provider-credentials' | 'ollama-settings',
  body: Record<string, unknown>,
) => Promise<unknown>;
```

### src/infrastructure/ai/host-ai-invoke.ts:80

```ts
export function createAiInvoke(options?: {
  readonly fetchImpl?: typeof fetch;
  readonly env?: EnvLike;
}): AiInvokeFn {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const env = options?.env ?? ((import.meta as ImportMeta & { env?: EnvLike }).env ?? {});

  return async (path, body) => {
    return invokeHost(
      path,
      body,
      path === 'ollama-settings'
        ? 'Ollama-Einstellungen nicht erreichbar.'
        : 'AI-Provider-Dienst nicht erreichbar.',
      fetchImpl,
      env,
    );
  };
}
```

### src/infrastructure/ai/host-ai-invoke.ts:100

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

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/ai-providers/contracts.ts` | `7ddd1f75a92998d2ed8ec32d8bf868ed74ef8d2cd5a4f1b1aa07e57e587102cb` |
| `src/domains/ai-providers/index.ts` | `460e4fa3639a12e0e028b19de91b947e482fee90585dc9844d6f8cfa70df2f05` |
| `src/domains/ai-providers/ollama-settings.ts` | `f3cbc6de1a3822b21cf3edf08f6debb19ea27299b46f54dbd1bfac0eaf83150c` |
| `src/infrastructure/ai/ai-provider-credentials-service.ts` | `deabff23986dd311748c7efff1539c2fe977465fa8357c5a1fda1577c5562e51` |
| `src/infrastructure/ai/aiberto-ask-service.ts` | `c70d02b82d012089fa26299ace355ca5edbb73f967c8c462fb4864e46f5f0441` |
| `src/infrastructure/ai/aiberto-tools-service.ts` | `e466ae827b15233b575789e500cb9a0cc29121d242cf96924bec6d6d3d8ca640` |
| `src/infrastructure/ai/host-ai-invoke.ts` | `1d85a9e6c3aad0022c11202a5e829f35eb40a9b503f3eced462d028169fb81db` |
| `src/infrastructure/ai/ollama-settings-service.ts` | `aaf53b0f3004f001018518dade230a67f923c98897413476c9635f7d0aae1116` |
| `src/infrastructure/host/host-library-http.ts` | `c56b88c60d6c9491fc7b6e6e1143ac4985ffdab5dff16afef8a54bce79629a07` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |

