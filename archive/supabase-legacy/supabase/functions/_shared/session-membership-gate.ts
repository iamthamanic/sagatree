/**
 * session-membership-gate — deny Edge calls for non-members of a play session (#607).
 * Location: supabase/functions/_shared/session-membership-gate.ts
 *
 * Uses the caller's Bearer JWT against PostgREST (RLS). Empty session visibility
 * or missing active project_members row → 403.
 */

function restBase(
  env: { get(key: string): string | undefined } = Deno.env,
): string {
  const raw =
    env.get('SUPABASE_URL') ||
    env.get('API_EXTERNAL_URL') ||
    'http://supabase-kong:8000';
  return raw.replace(/\/$/, '');
}

function anonKey(env: { get(key: string): string | undefined } = Deno.env): string {
  return env.get('SUPABASE_ANON_KEY') || env.get('ANON_KEY') || '';
}

/**
 * Returns a 401/403 Response when the caller may not use `sessionId`; null if OK.
 */
export async function assertSessionMemberAccess(
  req: Request,
  sessionId: string,
  env: { get(key: string): string | undefined } = Deno.env,
): Promise<Response | null> {
  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing or invalid sessionId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'missing Authorization bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = anonKey(env);
  const base = restBase(env);
  const headers = {
    apikey: key,
    Authorization: auth,
    'Content-Type': 'application/json',
  };

  const sessionRes = await fetch(
    `${base}/rest/v1/sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,project_id`,
    { headers },
  );
  if (!sessionRes.ok) {
    return new Response(JSON.stringify({ error: 'session lookup failed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const sessions = (await sessionRes.json()) as Array<{ id: string; project_id: string }>;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return new Response(JSON.stringify({ error: 'session not found or access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const projectId = sessions[0].project_id;
  const userRes = await fetch(`${base}/auth/v1/user`, { headers });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const userBody = (await userRes.json()) as { id?: string };
  const userId = userBody?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const memberRes = await fetch(
    `${base}/rest/v1/project_members?project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=user_id,role&limit=1`,
    { headers },
  );
  if (!memberRes.ok) {
    return new Response(JSON.stringify({ error: 'membership lookup failed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const members = (await memberRes.json()) as unknown[];
  if (!Array.isArray(members) || members.length === 0) {
    return new Response(JSON.stringify({ error: 'not a project member' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}
