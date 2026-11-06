/**
 * character-lore-service — AI background generation facade.
 * Location: src/infrastructure/character/character-lore-service.ts
 *
 * CUT-13: host-first via POST `/api/v1/ai/character-lore` when host library is on.
 * Legacy Edge `character-lore` remains until dual-path removal (CUT-20).
 */
import { supabase } from '../../lib/supabase';
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

function hasResponseContext(error: unknown): error is { context: Response } {
  return isRecord(error) && error.context instanceof Response;
}

async function getFunctionErrorMessage(error: unknown): Promise<string | undefined> {
  if (!hasResponseContext(error)) return undefined;

  try {
    const responseBody: unknown = await error.context.clone().json();
    const parsed = parseFunctionResponse(responseBody);
    return parsed.status === 'ok' ? undefined : parsed.message;
  } catch {
    return undefined;
  }
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
  const base = getHostAuthBaseUrl();
  if (base === null) {
    return {
      status: 'error',
      message:
        'Hintergrundgeschichte konnte nicht generiert werden. Bitte versuche es erneut.',
    };
  }
  // same-origin: base === '' → relative `/api/v1/ai/character-lore`
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

    if (isHostLibraryEnabled()) {
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

    const { data, error } = await supabase.functions.invoke('character-lore', {
      body,
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
}

export const characterLoreService = new CharacterLoreService();
