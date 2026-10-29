#!/usr/bin/env node
/**
 * mig-420-session-media-token.self-test — host isolated-contract (#836).
 * Location: scripts/mig-420-session-media-token.self-test.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function actor(id) {
  return { kind: 'solo-local', actorId: id };
}

const [mod, app, allow] = await Promise.all([
  import(
    pathToFileURL(join(root, 'server/src/modules/session/session-media-token.ts')).href
  ),
  import(
    pathToFileURL(join(root, 'server/src/application/session-media-token/index.ts')).href
  ),
  import(
    pathToFileURL(
      join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
    ).href
  ),
]);

const {
  SESSION_MEDIA_TOKEN_DEFAULT_TTL_SECONDS,
  SESSION_MEDIA_TOKEN_MAX_TTL_SECONDS,
  SESSION_MEDIA_TOKEN_MIN_TTL_SECONDS,
  SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
  clampSessionMediaTtlSeconds,
  createSessionMediaTokenStore,
  deriveMediaRoomId,
  describeSessionMediaTokenLegacyDefects,
  seedSessionMediaTokenMember,
  seedSessionMediaTokenSession,
  sessionMediaTokenErrorContainsSecrets,
  verifyLiveKitAccessToken,
} = mod;
const { createSessionMediaTokenUseCases } = app;
const { isEdgeDispatcherAllowed } = allow;

assert(SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public activation');
assert(isEdgeDispatcherAllowed('session-media-token') === true, 'edge stays allowlisted');
assert(SESSION_MEDIA_TOKEN_DEFAULT_TTL_SECONDS === 120, 'default TTL 120');
assert(SESSION_MEDIA_TOKEN_MIN_TTL_SECONDS === 30, 'min TTL 30');
assert(SESSION_MEDIA_TOKEN_MAX_TTL_SECONDS === 300, 'max TTL 300');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/session-media-token/i.test(createApp), 'no create-app cutover mount');

const PLAYER = 'player-user-1';
const GM = 'gm-user-1';
const VIEWER = 'viewer-user-1';
const FOREIGN = 'foreign-user-1';
const INACTIVE = 'inactive-user-1';
const UNSUPPORTED = 'unsupported-role-user';
const SESSION_ID = 'sess-media-1';
const PROJECT_ID = 'proj-media-1';
const API_KEY = 'lk_api_key_test';
const API_SECRET = 'lk_api_secret_super_secret';
const LIVEKIT_URL = 'wss://livekit.test.invalid';

function seedBase(store) {
  seedSessionMediaTokenSession(store, { id: SESSION_ID, project_id: PROJECT_ID });
  seedSessionMediaTokenMember(store, PROJECT_ID, {
    user_id: PLAYER,
    role: 'player',
    status: 'active',
    character_id: 'char-1',
  });
  seedSessionMediaTokenMember(store, PROJECT_ID, {
    user_id: GM,
    role: 'gm',
    status: 'active',
    character_id: null,
  });
  seedSessionMediaTokenMember(store, PROJECT_ID, {
    user_id: VIEWER,
    role: 'observer',
    status: 'active',
    character_id: null,
  });
  seedSessionMediaTokenMember(store, PROJECT_ID, {
    user_id: INACTIVE,
    role: 'player',
    status: 'inactive',
    character_id: null,
  });
  seedSessionMediaTokenMember(store, PROJECT_ID, {
    user_id: UNSUPPORTED,
    role: 'npc',
    status: 'active',
    character_id: null,
  });
  // Legacy session_players row for FOREIGN — must NOT grant access.
  store.sessionPlayers.push({
    session_id: SESSION_ID,
    user_id: FOREIGN,
    role: 'player',
  });
  store.sessionPlayers.push({
    session_id: SESSION_ID,
    user_id: INACTIVE,
    role: 'player',
  });
}

function configuredStore() {
  const store = createSessionMediaTokenStore({
    livekit: { apiKey: API_KEY, apiSecret: API_SECRET, url: LIVEKIT_URL },
    supabaseConfigured: true,
    membershipLookupConfigured: true,
  });
  seedBase(store);
  return store;
}

// --- Fall 1: distinct roles; foreign 403; client role/caps/room ignored ---
{
  const store = configuredStore();
  const uc = createSessionMediaTokenUseCases({ store });
  const room = deriveMediaRoomId(SESSION_ID);

  const player = await uc.issue(actor(PLAYER), {
    body: {
      sessionId: SESSION_ID,
      role: 'gamemaster',
      capabilities: ['director'],
      room: 'hijacked-room',
    },
    clientRole: 'gamemaster',
    clientCapabilities: ['director'],
    clientRoom: 'hijacked-room',
  });
  assert(player.status === 'ok' && player.ok === true, 'player ok');
  assert(player.roomId === room, 'player room server-derived');
  assert(player.grant.canPublish === true && player.grant.canSubscribe === true, 'player publish+sub');
  assert(player.grant.receiveOnly === false, 'player not receiveOnly');
  const playerClaims = await verifyLiveKitAccessToken(player.token, API_SECRET);
  assert(playerClaims?.sub === `user:${PLAYER}`, 'player identity server-derived');
  assert(playerClaims?.room === room, 'player JWT room server-derived');
  assert(playerClaims?.canPublish === true, 'player JWT canPublish');

  const gm = await uc.issue(actor(GM), { body: { sessionId: SESSION_ID } });
  assert(gm.status === 'ok', 'gm ok');
  assert(gm.grant.canPublish === true && gm.grant.receiveOnly === false, 'gm publish');
  const gmClaims = await verifyLiveKitAccessToken(gm.token, API_SECRET);
  assert(gmClaims?.sub === `user:${GM}`, 'gm identity');

  const viewer = await uc.issue(actor(VIEWER), {
    body: { sessionId: SESSION_ID, role: 'gamemaster' },
    clientRole: 'gamemaster',
  });
  assert(viewer.status === 'ok', 'viewer ok');
  assert(
    viewer.grant.canPublish === false &&
      viewer.grant.canSubscribe === true &&
      viewer.grant.receiveOnly === true,
    'viewer receive-only',
  );
  const viewerClaims = await verifyLiveKitAccessToken(viewer.token, API_SECRET);
  assert(viewerClaims?.canPublish === false && viewerClaims?.canSubscribe === true, 'viewer JWT');

  const foreign = await uc.issue(actor(FOREIGN), {
    body: { sessionId: SESSION_ID, role: 'gamemaster' },
    clientRole: 'gamemaster',
  });
  assert(foreign.httpStatus === 403 && foreign.reason === 'forbidden', 'foreign 403');

  const unsupported = await uc.issue(actor(UNSUPPORTED), {
    body: { sessionId: SESSION_ID },
  });
  assert(unsupported.httpStatus === 403 && unsupported.reason === 'forbidden', 'unsupported role 403');

  assert(store.writeCount === 0, 'no DB writes');
  assert(store.livekitHttpCalls === 0, 'no LiveKit HTTP');
}

// --- Fall 2: JWT HS256 claims + TTL clamp ---
{
  const store = configuredStore();
  const uc = createSessionMediaTokenUseCases({ store });
  const room = deriveMediaRoomId(SESSION_ID);

  assert(clampSessionMediaTtlSeconds(undefined) === 120, 'TTL omitted → 120');
  assert(clampSessionMediaTtlSeconds(1) === 30, 'TTL 1 → 30');
  assert(clampSessionMediaTtlSeconds(999) === 300, 'TTL 999 → 300');

  const omitted = await uc.issue(actor(PLAYER), { body: { sessionId: SESSION_ID } });
  assert(omitted.ttlSeconds === 120, 'response TTL omitted 120');
  const low = await uc.issue(actor(PLAYER), {
    body: { sessionId: SESSION_ID, ttlSeconds: 1 },
  });
  assert(low.ttlSeconds === 30, 'response TTL 1→30');
  const high = await uc.issue(actor(PLAYER), {
    body: { sessionId: SESSION_ID, ttlSeconds: 999 },
  });
  assert(high.ttlSeconds === 300, 'response TTL 999→300');

  const claims = await verifyLiveKitAccessToken(omitted.token, API_SECRET);
  assert(claims, 'JWT verifies');
  assert(claims.iss === API_KEY, 'iss=apiKey');
  assert(claims.sub === `user:${PLAYER}` && claims.name === `user:${PLAYER}`, 'sub/name');
  assert(claims.room === room, 'video.room');
  assert(claims.nbf === claims.iat - 10, 'nbf = iat-10');
  assert(claims.exp === claims.iat + 120, 'exp = iat+ttl');
  assert(
    !sessionMediaTokenErrorContainsSecrets(omitted, [API_SECRET]),
    'success body has no api secret',
  );
}

// --- Fall 3: no project_members → 403 even with session_players; inactive 403 ---
{
  const store = configuredStore();
  const uc = createSessionMediaTokenUseCases({ store });

  const onlyPlayers = await uc.issue(actor(FOREIGN), {
    body: { sessionId: SESSION_ID },
  });
  assert(
    onlyPlayers.httpStatus === 403 && onlyPlayers.reason === 'forbidden',
    'session_players alone never grants',
  );

  const inactive = await uc.issue(actor(INACTIVE), {
    body: { sessionId: SESSION_ID },
  });
  assert(inactive.httpStatus === 403 && inactive.reason === 'forbidden', 'inactive 403');
}

// --- Fall 4: missing LiveKit → 503 degraded; no secrets; gameplay state unchanged ---
{
  const store = createSessionMediaTokenStore({
    livekit: null,
    supabaseConfigured: true,
    membershipLookupConfigured: true,
  });
  seedBase(store);
  const writesBefore = store.writeCount;
  const uc = createSessionMediaTokenUseCases({ store });
  const res = await uc.issue(actor(PLAYER), { body: { sessionId: SESSION_ID } });
  assert(res.httpStatus === 503 && res.degraded === true, 'LiveKit missing 503');
  assert(res.reason === 'media_service_unavailable', 'degraded reason');
  assert(
    !sessionMediaTokenErrorContainsSecrets(res, [API_SECRET, API_KEY]),
    'no secrets in 503',
  );
  assert(store.writeCount === writesBefore, 'gameplay/membership state unchanged');

  const partial = createSessionMediaTokenStore({
    livekit: { apiKey: API_KEY, apiSecret: '', url: LIVEKIT_URL },
    supabaseConfigured: true,
    membershipLookupConfigured: true,
  });
  seedBase(partial);
  const partialUc = createSessionMediaTokenUseCases({ store: partial });
  const partialRes = await partialUc.issue(actor(PLAYER), {
    body: { sessionId: SESSION_ID },
  });
  assert(partialRes.httpStatus === 503, 'partial LiveKit 503');
}

// --- Fall 5: null body / missing sessionId / unauth / method / config gaps ---
{
  const store = configuredStore();
  const uc = createSessionMediaTokenUseCases({ store });

  const nullBody = await uc.issue(actor(PLAYER), { body: null });
  assert(nullBody.httpStatus === 400 && nullBody.reason === 'bad_request', 'null body 400');

  const missingSid = await uc.issue(actor(PLAYER), { body: { ttlSeconds: 60 } });
  assert(missingSid.httpStatus === 400 && missingSid.reason === 'bad_request', 'missing sessionId');

  const unauth = await uc.issue(actor(''), { body: { sessionId: SESSION_ID } });
  assert(unauth.httpStatus === 401 && unauth.reason === 'unauthorized', 'unauth 401');

  const method = await uc.issue(actor(PLAYER), {
    method: 'GET',
    body: { sessionId: SESSION_ID },
  });
  assert(method.httpStatus === 405 && method.methodNotAllowed === true, 'GET 405');

  // Non-finite TTL: typeof number but Math.floor(NaN)=NaN → clamp via Math.max/min still yields NaN.
  // Edge does not separately reject; record as required successor input/error characterization.
  const nanTtl = clampSessionMediaTtlSeconds(Number.NaN);
  assert(Number.isNaN(nanTtl), 'non-finite TTL not separately rejected (legacy gap)');

  const noSupabase = createSessionMediaTokenStore({
    livekit: { apiKey: API_KEY, apiSecret: API_SECRET, url: LIVEKIT_URL },
    supabaseConfigured: false,
    membershipLookupConfigured: true,
  });
  seedBase(noSupabase);
  const noSb = await createSessionMediaTokenUseCases({ store: noSupabase }).issue(
    actor(PLAYER),
    { body: { sessionId: SESSION_ID } },
  );
  assert(noSb.httpStatus === 503, 'supabase missing 503');

  const noMembershipCfg = createSessionMediaTokenStore({
    livekit: { apiKey: API_KEY, apiSecret: API_SECRET, url: LIVEKIT_URL },
    supabaseConfigured: true,
    membershipLookupConfigured: false,
  });
  seedBase(noMembershipCfg);
  const noMem = await createSessionMediaTokenUseCases({
    store: noMembershipCfg,
  }).issue(actor(PLAYER), { body: { sessionId: SESSION_ID } });
  assert(noMem.httpStatus === 503, 'membership lookup missing 503');
}

// --- Fall 6: legacy defects documented ---
{
  const defects = describeSessionMediaTokenLegacyDefects();
  assert(defects.length >= 3, 'legacy defects listed');
  assert(
    defects.some((d) => /timeout/i.test(d)),
    'timeout gap documented',
  );
  assert(
    defects.some((d) => /exception|normalization/i.test(d)),
    'exception gap documented',
  );
  assert(
    defects.some((d) => /TTL/i.test(d)),
    'TTL gap documented',
  );
}

console.log('PASS: mig-420-session-media-token.self-test');
