/**
 * character-lore-service — Edge-function adapter for AI background generation.
 * Location: src/infrastructure/character/character-lore-service.ts
 *
 * FE-HOST-08: under host library flag, AI lore generation is explicitly unavailable
 * (German error) until a host AI path is mounted — no Supabase hang.
 */
import { supabase } from '../../lib/supabase';
import type { CharacterLoreGenerationRequest, CharacterLoreGenerationResult } from '../../domains/character/contracts/character-lore.types';
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

class CharacterLoreService {
  async generateBackground(
    request: CharacterLoreGenerationRequest,
  ): Promise<CharacterLoreGenerationResult> {
    if (isHostLibraryEnabled()) {
      throw new Error(
        'KI-Hintergrundgeschichte ist im Host-Modus noch nicht verfügbar.',
      );
    }
    const { data, error } = await supabase.functions.invoke('character-lore', {
      body: {
        action: 'generate-background',
        context: request.context,
        currentBackgroundStory: request.currentBackgroundStory,
      },
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