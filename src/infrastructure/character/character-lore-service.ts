/**
 * character-lore-service — AI background generation facade (CUT-20).
 * Location: src/infrastructure/character/character-lore-service.ts
 *
 * Host-only: POST `/api/v1/ai/character-lore`.
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import type {
  CharacterLoreGenerationRequest,
  CharacterLoreGenerationResult,
} from '../../domains/character/contracts/character-lore.types';
import { isHostLibraryEnabled } from '../host/host-library-http';

type CharacterLoreFunctionResponse =
  | {
      status: 'ok';
      story: string;
      provider: CharacterLoreGenerationResult['provider'];
      model: string;
    }
  | {
      status: 'not-configured';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFunctionResponse(value: unknown): CharacterLoreFunctionResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', message: 'Die KI-Antwort hatte ein ungültiges Format.' };
  }

  if (
    value.status === 'ok' &&
    typeof value.story === 'string' &&
    (value.provider === 'openai-compatible' || value.provider === 'ollama') &&
    typeof value.model === 'string'
  ) {
    return {
      status: 'ok',
      story: value.story,
      provider: value.provider,
      model: value.model,
    };
  }

  if (
    (value.status === 'not-configured' || value.status === 'error') &&
    typeof value.message === 'string'
  ) {
    return { status: value.status, message: value.message };
  }

  return { status: 'error', message: 'Die KI-Antwort hatte ein ungültiges Format.' };
}

function buildRequestBody(request: CharacterLoreGenerationRequest): Record<string, unknown> {
  return {
    action: 'generate-background',
    context: request.context,
    currentBackgroundStory: request.currentBackgroundStory,
  };
}

async function invokeHostCharacterLore(
  body: Record<string, unknown>,
): Promise<CharacterLoreFunctionResponse> {
  if (!isHostLibraryEnabled()) {
    return {
      status: 'error',
      message:
        'Hintergrundgeschichte konnte nicht generiert werden. Host-Anmeldung fehlt (VITE_SAGATREE_HOST_AUTH_URL).',
    };
  }
  const base = getHostAuthBaseUrl();
  if (base === null) {
    return {
      status: 'error',
      message:
        'Hintergrundgeschichte konnte nicht generiert werden. Bitte versuche es erneut.',
    };
  }
  const requestUrl = base === '' ? '/api/v1/ai/character-lore' : `${base}/api/v1/ai/character-lore`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      status: 'error',
      message:
        'Hintergrundgeschichte konnte nicht generiert werden. Bitte versuche es erneut.',
    };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      status: 'error',
      message:
        'Hintergrundgeschichte konnte nicht generiert werden. Bitte versuche es erneut.',
    };
  }
  return parseFunctionResponse(data);
}

class CharacterLoreService {
  async generateBackground(
    request: CharacterLoreGenerationRequest,
  ): Promise<CharacterLoreGenerationResult> {
    const body = buildRequestBody(request);

    const response = await invokeHostCharacterLore(body);
    if (response.status !== 'ok') {
      throw new Error(response.message);
    }
    return {
      story: response.story,
      provider: response.provider,
      model: response.model,
    };
  }
}

export const characterLoreService = new CharacterLoreService();
