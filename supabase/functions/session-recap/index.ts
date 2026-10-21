/**
 * session-recap — Edge Function: GM-only AI episode summary draft (#573).
 * Location: supabase/functions/session-recap/index.ts
 *
 * Prompt is built server-side from audience-projected highlights only.
 * Client may send sessionId; never secret adventure text.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildSessionRecapPrompt,
  type SessionRecapPromptLine,
} from '../_shared/session-recap-prompt.ts';
import {
  generateSessionRecapSummary,
  resolveSessionRecapProviderConfig,
} from '../_shared/session-recap-provider.ts';
import { consumePersistentSessionRecapRateLimit } from '../_shared/session-recap-rate-limit.ts';
import {
  loadOllamaSettingsForUser,
  prefsToProviderConfig,
} from '../_shared/ollama-llm-resolve.ts';
import {
  corsHeaders,
  handleOptions,
  jsonResponse as sharedJsonResponse,
  type CorsOptions,
} from '../_shared/cors.ts';

type JsonRecord = Record<string, unknown>;

const CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['SESSION_RECAP_AI_ALLOWED_ORIGIN', 'CHARACTER_AI_ALLOWED_ORIGIN'],
};

const RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT = 6;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_REQUEST_BYTES = 8_000;

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function getCorsHeaders(request: Request): HeadersInit {
  return corsHeaders(request, CORS_OPTS);
}

function jsonResponse(request: Request, body: JsonRecord, status = 200): Response {
  return sharedJsonResponse(request, body, status, CORS_OPTS);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getRateLimit(): number {
  const configured = Number.parseInt(
    Deno.env.get('SESSION_RECAP_AI_RATE_LIMIT_PER_MINUTE') ||
      Deno.env.get('CHARACTER_AI_RATE_LIMIT_PER_MINUTE') ||
      '',
    10,
  );
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 60)
    : DEFAULT_RATE_LIMIT;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  return url && anonKey
    ? {
        url: url.replace(/\/+$/, ''),
        anonKey,
        serviceRoleKey: serviceRoleKey || undefined,
      }
    : null;
}

async function authenticate(request: Request): Promise<string | null> {
  const config = getSupabaseConfig();
  const authorization = request.headers.get('Authorization');
  if (!config || !authorization?.startsWith('Bearer ')) return null;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: config.anonKey,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  return isRecord(body) && typeof body.id === 'string' ? body.id : null;
}

async function serviceFetch(
  config: SupabaseConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!config.serviceRoleKey) throw new Error('service role missing');
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  });
}

function parseHighlightLines(raw: unknown): SessionRecapPromptLine[] {
  if (!Array.isArray(raw)) return [];
  const out: SessionRecapPromptLine[] = [];
  for (const item of raw.slice(0, 40)) {
    if (!isRecord(item)) continue;
    const summary = typeof item.summary === 'string' ? item.summary : '';
    if (!summary.trim()) continue;
    out.push({
      id: typeof item.id === 'string' ? item.id : summary.slice(0, 32),
      kind: typeof item.kind === 'string' ? item.kind : 'generic',
      summary,
      visibility: typeof item.visibility === 'string' ? item.visibility : 'shared',
    });
  }
  return out;
}

serve(async (request: Request) => {
  const optionsResponse = handleOptions(request, CORS_OPTS);
  if (optionsResponse) return optionsResponse;
  if (request.method !== 'POST') {
    return jsonResponse(request, { status: 'error', message: 'Method not allowed' }, 405);
  }

  // Silence unused import warning pattern for corsHeaders side use
  void getCorsHeaders;

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(request, { status: 'error', message: 'Request body too large' }, 413);
  }

  const userId = await authenticate(request);
  if (!userId) {
    return jsonResponse(request, { status: 'error', message: 'Authentication required' }, 401);
  }

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig?.serviceRoleKey) {
    console.error('session-recap: missing service-role configuration');
    return jsonResponse(
      request,
      {
        status: 'error',
        message: 'Session-Recap ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
      },
      503,
    );
  }

  try {
    const allowed = await consumePersistentSessionRecapRateLimit(
      {
        url: supabaseConfig.url,
        serviceRoleKey: supabaseConfig.serviceRoleKey,
        limit: getRateLimit(),
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      },
      userId,
    );
    if (!allowed) {
      return jsonResponse(
        request,
        {
          status: 'error',
          message: 'Zu viele Generierungen. Bitte warte kurz und versuche es erneut.',
        },
        429,
      );
    }
  } catch (error) {
    console.error(
      'session-recap rate limit failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return jsonResponse(
      request,
      {
        status: 'error',
        message: 'Session-Recap ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
      },
      503,
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse(request, { status: 'error', message: 'Request body too large' }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse(request, { status: 'error', message: 'Invalid JSON body' }, 400);
  }

  if (!isRecord(body)) {
    return jsonResponse(request, { status: 'error', message: 'Ungültige Anfrage.' }, 400);
  }

  const sessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!isUuid(sessionId)) {
    return jsonResponse(request, { status: 'error', message: 'Ungültige Session-ID.' }, 400);
  }

  // Reject client-supplied prompt/secret payloads (Postel harden).
  if (
    body.prompt != null ||
    body.highlights != null ||
    body.adventure != null ||
    body.worldState != null ||
    body.summaryText != null
  ) {
    return jsonResponse(
      request,
      { status: 'error', message: 'Client-Prompt-Payload ist nicht erlaubt.' },
      400,
    );
  }

  let providerConfig = null as ReturnType<typeof resolveSessionRecapProviderConfig>;
  try {
    if (supabaseConfig.serviceRoleKey) {
      const stored = await loadOllamaSettingsForUser(
        {
          url: supabaseConfig.url,
          serviceRoleKey: supabaseConfig.serviceRoleKey,
        },
        userId,
      );
      if (stored) {
        providerConfig = prefsToProviderConfig(stored);
      }
    }
  } catch (error) {
    console.error(
      'session-recap ollama prefs:',
      error instanceof Error ? error.message : 'unknown',
    );
  }
  if (!providerConfig) {
    providerConfig = resolveSessionRecapProviderConfig();
  }
  if (!providerConfig) {
    return jsonResponse(request, {
      status: 'not-configured',
      message:
        'Session-Recap-KI ist noch nicht konfiguriert. Hinterlege Provider und Modell unter Einstellungen → AI → Organize oder in der Server-Umgebung.',
    });
  }

  try {
    const sessionRes = await serviceFetch(
      supabaseConfig,
      `/rest/v1/sessions?id=eq.${sessionId}&select=id,name,status,project_id,world_state`,
    );
    if (!sessionRes.ok) throw new Error(`session lookup ${sessionRes.status}`);
    const sessions: unknown = await sessionRes.json();
    if (!Array.isArray(sessions) || sessions.length === 0 || !isRecord(sessions[0])) {
      return jsonResponse(request, { status: 'error', message: 'Session nicht gefunden.' }, 404);
    }
    const session = sessions[0];
    const projectId = typeof session.project_id === 'string' ? session.project_id : '';
    const status = typeof session.status === 'string' ? session.status : '';
    if (!projectId) {
      return jsonResponse(request, { status: 'error', message: 'Session ungültig.' }, 400);
    }
    if (status !== 'completed' && status !== 'cancelled') {
      return jsonResponse(
        request,
        {
          status: 'error',
          message: 'Zusammenfassung nur für abgeschlossene Sessions.',
        },
        400,
      );
    }

    const projectRes = await serviceFetch(
      supabaseConfig,
      `/rest/v1/projects?id=eq.${projectId}&select=id,name,gm_user_id`,
    );
    if (!projectRes.ok) throw new Error(`project lookup ${projectRes.status}`);
    const projects: unknown = await projectRes.json();
    if (!Array.isArray(projects) || !isRecord(projects[0])) {
      return jsonResponse(request, { status: 'error', message: 'Saga nicht gefunden.' }, 404);
    }
    const project = projects[0];
    if (project.gm_user_id !== userId) {
      return jsonResponse(request, { status: 'error', message: 'Nur der Gamemaster darf generieren.' }, 403);
    }

    // Ensure recap skeleton exists / load snapshot via RPC helper (service role).
    const upsertRes = await serviceFetch(
      supabaseConfig,
      '/rest/v1/rpc/sagatree_upsert_session_recap',
      {
        method: 'POST',
        body: JSON.stringify({ p_session_id: sessionId }),
      },
    );
    if (!upsertRes.ok) {
      console.error('session-recap upsert failed', upsertRes.status);
      throw new Error('recap upsert failed');
    }

    const recapRes = await serviceFetch(
      supabaseConfig,
      `/rest/v1/session_recaps?session_id=eq.${sessionId}&select=snapshot,highlight_lines,summary_text,summary_status`,
    );
    if (!recapRes.ok) throw new Error(`recap lookup ${recapRes.status}`);
    const recaps: unknown = await recapRes.json();
    const recap = Array.isArray(recaps) && isRecord(recaps[0]) ? recaps[0] : null;
    const snapshot = recap && isRecord(recap.snapshot) ? recap.snapshot : {};
    const linesFromDb = parseHighlightLines(recap?.highlight_lines);
    // Player-safe lines only: visibility public/shared (builder filters gm_only).
    const prompt = buildSessionRecapPrompt({
      sessionName: typeof session.name === 'string' ? session.name : 'Episode',
      sagaTitle: typeof project.name === 'string' ? project.name : null,
      highlightLines: linesFromDb.length
        ? linesFromDb
        : parseHighlightLines(
            Array.isArray(snapshot.consequences) ? snapshot.consequences : [],
          ),
    });

    const summary = await generateSessionRecapSummary(providerConfig, prompt);
    if (!summary || summary.length > MAX_SUMMARY_LENGTH) {
      throw new Error('Generated summary length is invalid');
    }

    const patchRes = await serviceFetch(
      supabaseConfig,
      `/rest/v1/session_recaps?session_id=eq.${sessionId}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          summary_text: summary,
          summary_status: 'draft',
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!patchRes.ok) {
      console.error('session-recap draft patch failed', patchRes.status);
      throw new Error('draft persist failed');
    }

    return jsonResponse(request, {
      status: 'ok',
      summaryText: summary,
      summaryStatus: 'draft',
      provider: providerConfig.provider,
      model: providerConfig.model,
      promptVersion: prompt.version,
      eventCount: prompt.eventCount,
    });
  } catch (error) {
    console.error(
      'session-recap generation failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return jsonResponse(
      request,
      {
        status: 'error',
        message:
          'Zusammenfassung konnte nicht generiert werden. Du kannst den Text manuell schreiben.',
      },
      500,
    );
  }
});
