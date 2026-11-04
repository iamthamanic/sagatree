/**
 * session-recap-ai-service — Invoke session-recap Edge Function + summary RPCs (#573).
 * Location: src/infrastructure/session/session-recap-ai-service.ts
 *
 * FE-HOST-08: under host library flag, AI generate/save are explicitly unavailable
 * (German error) until host AI paths ship — get-recap remains on host-session-http.
 */
import { supabase } from '../../lib/supabase';
import { raceWithTimeoutReject, SUPABASE_QUERY_TIMEOUT_MS } from '../../lib/networkTimeout';
import { isHostLibraryEnabled, saveHostSessionRecapSummary } from '../host/host-session-http';

export type EpisodeSummaryStatus = 'none' | 'draft' | 'approved';

export type SessionRecapAiGenerateResult = {
  readonly summaryText: string;
  readonly summaryStatus: EpisodeSummaryStatus;
  readonly provider: string;
  readonly model: string;
};

type FunctionResponse =
  | {
      status: 'ok';
      summaryText: string;
      summaryStatus: string;
      provider: string;
      model: string;
    }
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFunctionResponse(value: unknown): FunctionResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', message: 'Die KI-Antwort hatte ein ungültiges Format.' };
  }
  if (
    value.status === 'ok' &&
    typeof value.summaryText === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.model === 'string'
  ) {
    return {
      status: 'ok',
      summaryText: value.summaryText,
      summaryStatus: typeof value.summaryStatus === 'string' ? value.summaryStatus : 'draft',
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

class SessionRecapAiService {
  async generateDraft(sessionId: string): Promise<SessionRecapAiGenerateResult> {
    if (isHostLibraryEnabled()) {
      throw new Error(
        'KI-Zusammenfassung ist im Host-Modus noch nicht verfügbar. Bitte manuell schreiben.',
      );
    }
    const { data, error } = await supabase.functions.invoke('session-recap', {
      body: { sessionId },
    });
    if (error) {
      const serverMessage = await getFunctionErrorMessage(error);
      throw new Error(
        serverMessage ??
          'Zusammenfassung konnte nicht generiert werden. Bitte manuell schreiben.',
      );
    }
    const response = parseFunctionResponse(data);
    if (response.status !== 'ok') {
      throw new Error(response.message);
    }
    return {
      summaryText: response.summaryText,
      summaryStatus: response.summaryStatus === 'approved' ? 'approved' : 'draft',
      provider: response.provider,
      model: response.model,
    };
  }

  async saveSummary(
    sessionId: string,
    summaryText: string,
    status: 'draft' | 'approved',
  ): Promise<{ summaryText: string | null; summaryStatus: EpisodeSummaryStatus }> {
    if (isHostLibraryEnabled()) {
      const saved = await saveHostSessionRecapSummary(sessionId, summaryText, status);
      return {
        summaryText:
          typeof saved.summaryText === 'string' ? saved.summaryText : summaryText,
        summaryStatus:
          saved.summaryStatus === 'approved'
            ? 'approved'
            : saved.summaryStatus === 'draft'
              ? 'draft'
              : status,
      };
    }
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('save_session_recap_summary', {
        p_session_id: sessionId,
        p_summary_text: summaryText,
        p_status: status,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Speichern Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Zusammenfassung konnte nicht gespeichert werden');
    }
    if (!isRecord(data)) {
      return { summaryText, summaryStatus: status };
    }
    return {
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : summaryText,
      summaryStatus:
        data.summaryStatus === 'approved'
          ? 'approved'
          : data.summaryStatus === 'draft'
            ? 'draft'
            : 'none',
    };
  }
}

export const sessionRecapAiService = new SessionRecapAiService();
