/**
 * session-media-token — short-lived SFU tokens from session membership (#363).
 * Location: supabase/functions/session-media-token/index.ts
 *
 * Auth JWT required. Room name derived server-side. No LiveKit secret to browser.
 * When LIVEKIT_API_KEY/SECRET/URL missing → degraded response (gameplay continues).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';
import {
  deriveMediaRoomId,
  mintLiveKitAccessToken,
  resolveEdgeMediaGrant,
} from '../_shared/session-media-token.ts';
import { privilegedClientBodyRejectionMessage } from '../_shared/client-trust-body.ts';

const CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  missingOriginPolicy: 'configured-or-star',
};

const DEFAULT_TTL_SECONDS = 120;
const MAX_TTL_SECONDS = 300;

type JsonRecord = Record<string, unknown>;

function json(req: Request, body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req, CORS_OPTS),
      'Content-Type': 'application/json',
    },
  });
}

function readEnv(name: string): string {
  return Deno.env.get(name)?.trim() ?? '';
}

async function getUserId(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anonKey },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { id?: string };
  return typeof body.id === 'string' ? body.id : null;
}

type MembershipRow = {
  user_id: string;
  role: string;
  capabilities: string[] | null;
  character_id: string | null;
};

async function loadMembership(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  sessionId: string;
  userId: string;
}): Promise<MembershipRow | null> {
  // Prefer project_members via session → project; fall back to session_players demo table shape.
  const headers = {
    Authorization: `Bearer ${input.serviceRoleKey}`,
    apikey: input.serviceRoleKey,
    'Content-Type': 'application/json',
  };

  const sessionRes = await fetch(
    `${input.supabaseUrl}/rest/v1/sessions?id=eq.${encodeURIComponent(input.sessionId)}&select=id,project_id`,
    { headers },
  );
  if (!sessionRes.ok) return null;
  const sessions = (await sessionRes.json()) as Array<{
    id: string;
    project_id: string;
  }>;
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const projectId = sessions[0]!.project_id;

  const memberRes = await fetch(
    `${input.supabaseUrl}/rest/v1/project_members?project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(input.userId)}&status=eq.active&select=user_id,role,character_id`,
    { headers },
  );
  if (!memberRes.ok) return null;
  const members = (await memberRes.json()) as Array<{
    user_id: string;
    role: string;
    character_id: string | null;
  }>;
  if (!Array.isArray(members) || members.length === 0) return null;
  const row = members[0]!;
  return {
    user_id: row.user_id,
    role: row.role,
    capabilities: null,
    character_id: row.character_id,
  };
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = readEnv('SUPABASE_URL');
  const anonKey = readEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Supabase config fehlt.',
      },
      503,
    );
  }

  const userId = await getUserId(req, supabaseUrl, anonKey);
  if (!userId) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'unauthorized',
        message: 'Authentifizierung erforderlich.',
      },
      401,
    );
  }

  let body: JsonRecord;
  try {
    body = (await req.json()) as JsonRecord;
  } catch {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'bad_request',
        message: 'Ungültiger JSON-Body.',
      },
      400,
    );
  }

  const privilegedReject = privilegedClientBodyRejectionMessage(body);
  if (privilegedReject) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'bad_request',
        message: privilegedReject,
      },
      400,
    );
  }

  const sessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'bad_request',
        message: 'sessionId fehlt.',
      },
      400,
    );
  }

  if (!serviceRoleKey) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Membership lookup nicht konfiguriert.',
      },
      503,
    );
  }

  const membership = await loadMembership({
    supabaseUrl,
    serviceRoleKey,
    sessionId,
    userId,
  });
  if (!membership) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'forbidden',
        message: 'Keine aktive Session-Mitgliedschaft.',
      },
      403,
    );
  }

  const grant = resolveEdgeMediaGrant({
    role: membership.role,
    capabilities: membership.capabilities ?? [],
  });
  if (!grant || !grant.canSubscribe) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'forbidden',
        message: 'Rolle darf Media-Token nicht beziehen.',
      },
      403,
    );
  }

  const apiKey = readEnv('LIVEKIT_API_KEY');
  const apiSecret = readEnv('LIVEKIT_API_SECRET');
  const livekitUrl = readEnv('LIVEKIT_URL');
  if (!apiKey || !apiSecret || !livekitUrl) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message:
          'LiveKit nicht konfiguriert — Session läuft ohne Media Plane weiter.',
      },
      503,
    );
  }

  const ttlRaw =
    typeof body.ttlSeconds === 'number' ? body.ttlSeconds : DEFAULT_TTL_SECONDS;
  const ttlSeconds = Math.min(
    MAX_TTL_SECONDS,
    Math.max(30, Math.floor(ttlRaw)),
  );
  const roomId = deriveMediaRoomId(sessionId);
  const identity = `user:${userId}`;

  const minted = await mintLiveKitAccessToken({
    apiKey,
    apiSecret,
    identity,
    roomName: roomId,
    ttlSeconds,
    grant,
  });

  return json(req, {
    ok: true,
    token: minted.token,
    url: livekitUrl,
    roomId,
    expiresAt: minted.expiresAt,
    ttlSeconds,
    grant: {
      canPublish: grant.canPublish,
      canSubscribe: grant.canSubscribe,
      receiveOnly: grant.receiveOnly,
    },
  });
});
