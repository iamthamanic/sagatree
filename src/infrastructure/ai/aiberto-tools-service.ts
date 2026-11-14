/**
 * aiberto-tools-service — FE facade for Host Read/Nav tools (AIB-06 / #1129).
 * Location: src/infrastructure/ai/aiberto-tools-service.ts
 *
 * Cookie auth only. Capabilities are not rights. Navigate returns ClientAction.
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import { isHostLibraryEnabled } from '../host/host-library-http';

export type AibertoToolCapability = {
  readonly id: string;
  readonly kind: 'read' | 'nav';
  readonly labelDe: string;
  readonly descriptionDe: string;
  readonly argsSchema: Readonly<Record<string, string>>;
};

export type AibertoClientNavigateAction = {
  readonly type: 'app.navigate';
  readonly path: string;
};

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

type EnvLike = {
  readonly VITE_SAGATREE_HOST_AUTH_URL?: string;
};

function defaultEnv(): EnvLike {
  try {
    return (import.meta as ImportMeta & { env?: EnvLike }).env ?? {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toolsBase(env: EnvLike): string | null {
  const base = getHostAuthBaseUrl(env);
  if (base === null || !isHostLibraryEnabled(env)) return null;
  return base === '' ? '' : base;
}

function parseCapabilities(value: unknown): AibertoToolsCapabilitiesResult {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', code: 'INTERNAL', message: 'Ungültige Capabilities-Antwort.' };
  }
  if (value.status === 'ok' && Array.isArray(value.tools)) {
    return {
      status: 'ok',
      enabled: true,
      note: typeof value.note === 'string' ? value.note : '',
      tools: value.tools.filter(
        (t): t is AibertoToolCapability =>
          isRecord(t) &&
          typeof t.id === 'string' &&
          (t.kind === 'read' || t.kind === 'nav') &&
          typeof t.labelDe === 'string',
      ),
    };
  }
  if (value.status === 'disabled') {
    return {
      status: 'disabled',
      code: typeof value.code === 'string' ? value.code : 'FLAG_DISABLED',
      message:
        typeof value.message === 'string'
          ? value.message
          : 'Aiberto-Tools sind deaktiviert.',
      enabled: false,
      tools: [],
    };
  }
  return {
    status: 'error',
    code: typeof value.code === 'string' ? value.code : 'INTERNAL',
    message: typeof value.message === 'string' ? value.message : 'Capabilities fehlgeschlagen.',
  };
}

function parseInvoke(value: unknown): AibertoToolInvokeResult {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', code: 'INTERNAL', message: 'Ungültige Tool-Antwort.' };
  }
  if (value.status === 'ok' && typeof value.toolId === 'string') {
    let clientAction: AibertoClientNavigateAction | undefined;
    if (
      isRecord(value.clientAction) &&
      value.clientAction.type === 'app.navigate' &&
      typeof value.clientAction.path === 'string'
    ) {
      clientAction = { type: 'app.navigate', path: value.clientAction.path };
    }
    return {
      status: 'ok',
      toolId: value.toolId,
      data: value.data,
      ...(clientAction ? { clientAction } : {}),
    };
  }
  if (value.status === 'disabled') {
    return {
      status: 'disabled',
      code: typeof value.code === 'string' ? value.code : 'FLAG_DISABLED',
      message:
        typeof value.message === 'string'
          ? value.message
          : 'Aiberto-Tools sind deaktiviert.',
    };
  }
  return {
    status: 'error',
    code: typeof value.code === 'string' ? value.code : 'INTERNAL',
    message: typeof value.message === 'string' ? value.message : 'Tool-Aufruf fehlgeschlagen.',
    ...(typeof value.toolId === 'string' ? { toolId: value.toolId } : {}),
  };
}

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
