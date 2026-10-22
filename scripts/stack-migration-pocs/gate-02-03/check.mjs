import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir, platform, arch, release } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createServer } from 'node:http';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import ts from 'typescript';
import { FixtureHost, credentials, active, delay, timeout } from './harness.mjs';
import { cookieBrowserProbe } from './browser.mjs';
import { validateObservation, reportHash } from './observations.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write', '--check-execution'].includes(mode) || process.argv.length > 3) throw new Error('Usage: node scripts/stack-migration-pocs/gate-02-03/check.mjs [--check|--write|--check-execution]');
const folder = await mkdtemp(join(tmpdir(), 'sagatree-gate-02-03-'));
const cases = { 'GATE-02': [], 'GATE-03': [] };
const observations = { 'GATE-02': {}, 'GATE-03': {} };
const hosts = {};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const denied = (data, code) => assert.deepEqual(data, { ok: false, error: { code } });
const seat = (user) => ({ sessionId: 'demo', seat: user.role === 'host-admin' ? 'gm' : 'player', ...(user.characterId ? { characterId: user.characterId } : {}) });
const percentiles = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p) => Number(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]?.toFixed(3) ?? 0);
  return { samples: sorted.length, p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), maxMs: percentile(1) };
};
async function until(test, budgetMs, label) {
  const started = performance.now();
  while (!test()) { if (performance.now() - started >= budgetMs) throw new Error(`${label} exceeded ${budgetMs}ms`); await delay(10); }
}
async function rejected(promise, expected) {
  await assert.rejects(timeout(promise, 10000), (error) => !/timed out/i.test(String(error.message)) && (!expected || String(error.message).includes(expected)));
}
async function run(gate, id, title, execute) {
  const initial = new Map(Object.values(hosts).map((host) => [host, new Set(host.links)]));
  try { cases[gate].push({ id, title, status: 'PASS', evidence: await execute() }); }
  catch (error) {
    const message = String(error.message).replaceAll(folder, '<temporary-directory>').replace(/http:\/\/127\.0\.0\.1:\d+/g, '<fixture-origin>');
    cases[gate].push({ id, title, status: 'FAIL', error: message });
    process.stderr.write(`${gate}/${id} FAIL: ${message}\n`);
  } finally {
    for (const [host, links] of initial) for (const link of [...host.links]) if (!links.has(link)) await host.leave(link).catch(() => {});
  }
}

let typedClient;
try {
  for (const variant of ['minimal', 'hono']) {
    const host = new FixtureHost(); hosts[variant] = host;
    await host.init({ variant, databasePath: join(folder, `${variant}.sqlite`) });
    host.users = {};
    for (const [label, role, characterId] of [
      ['gm', 'host-admin'], ['player1', 'player', 'character-1'], ['player2', 'player', 'character-2'],
      ['revokable', 'player', 'character-revokable'], ['expired', 'player', 'character-expired'], ['outsider', 'outsider'],
    ]) host.users[label] = await host.user(label, role, characterId);
  }
  const primary = hosts.minimal;

  for (const kind of ['cookie', 'jwt']) {
    const prefix = kind === 'cookie' ? 'A' : 'B';
    const player = primary.users.player1;
    const headers = credentials(primary, player.login, kind);
    await run('GATE-02', `${prefix}-1-wire`, `Real Better Auth ${kind} login, HTTP identity and WS join`, async () => {
      const result = await primary.http('/api/whoami', { headers });
      assert.equal(result.status, 200);
      assert.deepEqual(result.data, { ok: true, role: 'player', credentialKind: kind });
      assert.deepEqual(player.login.attributes, { httpOnly: true, sameSiteLax: true, secure: false });
      const link = await primary.join(headers, seat(player));
      assert.equal((await link.room.request('seat')).role, 'player');
      if (kind === 'jwt') {
        const jwks = createRemoteJWKSet(new URL('/api/auth/jwks', primary.origin));
        const verified = await jwtVerify(player.login.jwt, jwks, { issuer: primary.origin, audience: primary.origin, algorithms: ['EdDSA'] });
        assert.equal(verified.payload.sub, player.userId);
        assert.equal(typeof verified.payload.sid, 'string');
      }
      return { realEmailPasswordSignIn: true, realDatabaseSession: true, httpWhoami: 200, webSocketJoined: true, cookieHttpOnly: true, cookieSameSite: 'Lax', cookieSecureOnLoopbackHttp: false, credentialKind: kind, ...(kind === 'jwt' ? { jwtSignatureVerifiedAgainstBetterAuthJwks: true, algorithm: 'EdDSA', issuerAndAudienceChecked: true } : {}) };
    });
    if (kind === 'jwt') cases['GATE-02'].push({ id: `${prefix}-1-browser`, title: 'JWT Browser/Tauri secure credential storage', status: 'NOT RUN', reason: 'Real JWTs travel in Node ws Authorization headers. A secure browser transport/store for JWTs and Tauri secure storage were not executed. The separate real Chromium cookie probe demonstrates a credential-exposure failure of the combined auth profile.' });
    await run('GATE-02', `${prefix}-2`, 'Unauthenticated WebSocket join is rejected', async () => {
      await rejected(primary.join({ origin: primary.origin }, seat(player)), 'UNAUTHENTICATED');
      return { unauthenticatedJoinDenied: true };
    });
    await run('GATE-02', `${prefix}-3`, 'Real logout/revoke denies active socket, new join and reconnect within 2s', async () => {
      const timings = [];
      for (const endpoint of ['sign-out', 'revoke-session']) {
        const user = primary.users.revokable;
        const login = await primary.login(user);
        const authHeaders = credentials(primary, login, kind);
        const link = await primary.join(authHeaders, seat(user));
        const token = link.room.reconnectionToken;
        const start = performance.now();
        const response = await primary.http(`/api/auth/${endpoint}`, { headers: { cookie: login.cookie }, body: endpoint === 'revoke-session' ? { token: login.sessionToken } : {} });
        assert.equal(response.status, 200);
        await rejected(primary.join(authHeaders, seat(user)), 'UNAUTHENTICATED');
        await until(() => !link.room.connection.isOpen, 1900, 'active session revocation');
        const elapsedMs = performance.now() - start;
        assert.ok(elapsedMs <= 2000, 'end-to-end revocation exceeded 2 seconds');
        await rejected(primary.reconnect(authHeaders, token));
        const who = await primary.http('/api/whoami', { headers: authHeaders });
        assert.equal(who.status, 401); denied(who.data, 'UNAUTHENTICATED');
        if (kind === 'jwt') {
          // Canary: signature alone still accepts a revoked session's unexpired JWT.
          await jwtVerify(login.jwt, createRemoteJWKSet(new URL('/api/auth/jwks', primary.origin)), { issuer: primary.origin, audience: primary.origin, algorithms: ['EdDSA'] });
        }
        timings.push({ operation: endpoint, endToEndMs: Number(elapsedMs.toFixed(3)) });
      }
      observations['GATE-02'][`${kind}Revocation`] = timings;
      return { logoutAndRevokeExercised: true, deadlineMs: 2000, activeSocketClosed: true, newJoinDenied: true, reconnectDenied: true, currentSessionRechecked: true, ...(kind === 'jwt' ? { signatureOnlyCanaryStillAcceptsRevokedJwt: true, sessionStoreCheckRejectsIt: true } : {}) };
    });
    await run('GATE-02', `${prefix}-4`, 'Valid reconnect restores the same seat and rejects another actor using its ticket', async () => {
      const link = await primary.join(headers, seat(player));
      const previous = { token: link.room.reconnectionToken, sessionId: link.room.sessionId, roomId: link.room.roomId };
      link.room.connection.transport.ws.terminate();
      await until(() => !link.room.connection.isOpen, 1000, 'socket drop');
      await rejected(primary.reconnect(credentials(primary, primary.users.player2.login, kind), previous.token));
      const otherLogin = await primary.login(player);
      await rejected(primary.reconnect(credentials(primary, otherLogin, kind), previous.token));
      const restored = await primary.reconnect(headers, previous.token);
      assert.equal(restored.room.sessionId, previous.sessionId);
      assert.equal(restored.room.roomId, previous.roomId);
      assert.notEqual(restored.room.reconnectionToken, previous.token);
      const restoredSeat = await restored.room.request('seat');
      assert.equal(restoredSeat.role, 'player'); assert.equal(restoredSeat.seat, 'player');
      return { sameRoom: true, sameSeat: true, tokenRotated: true, restoredRole: 'player', differentActorTicketReplayDenied: true, sameActorDifferentSessionTicketReplayDenied: true, denialTimeoutAcceptedAsPass: false };
    });
    await run('GATE-02', `${prefix}-5`, 'Player cannot claim GM authority or another character', async () => {
      await rejected(primary.join(headers, { sessionId: 'demo', seat: 'gm', role: 'host-admin', userId: primary.users.gm.userId }), 'GM_REQUIRED');
      await rejected(primary.join(headers, { sessionId: 'demo', seat: 'player', characterId: 'character-2' }), 'CHARACTER_FORBIDDEN');
      await rejected(primary.join(credentials(primary, primary.users.outsider.login, kind), { sessionId: 'demo', seat: 'gm' }), 'SESSION_FORBIDDEN');
      const link = await primary.join(headers, { ...seat(player), role: 'host-admin', userId: primary.users.gm.userId });
      assert.equal((await link.room.request('seat')).role, 'player');
      return { gmSeatDenied: true, foreignCharacterDenied: true, authenticatedOutsiderDenied: true, clientRoleAndUserIdCannotElevate: true };
    });
    await run('GATE-02', `${prefix}-6`, 'Credentials and origins are isolated between two real hosts', async () => {
      const other = hosts.hono;
      const foreign = credentials(other, player.login, kind);
      assert.equal((await other.http('/api/whoami', { headers: foreign })).status, 401);
      await rejected(other.join(foreign, seat(player)), 'UNAUTHENTICATED');
      const wrongOrigin = credentials(primary, player.login, kind, other.origin);
      const deniedOrigin = await primary.http('/api/whoami', { headers: wrongOrigin });
      assert.equal(deniedOrigin.status, 403); denied(deniedOrigin.data, 'ORIGIN_DENIED');
      await rejected(primary.join(wrongOrigin, seat(player)), 'ORIGIN_DENIED');
      return { independentSecretsAndStores: true, crossHostCredentialRejected: true, foreignOriginHttpDenied: true, foreignOriginWebSocketDenied: true };
    });
    await run('GATE-02', `${prefix}-negative`, 'Expired and tampered credentials are rejected', async () => {
      const user = primary.users.expired;
      const login = await primary.login(user);
      await primary.call('expire', { userId: user.userId });
      await rejected(primary.join(credentials(primary, login, kind), seat(user)), 'UNAUTHENTICATED');
      const tampered = { ...headers };
      if (kind === 'cookie') tampered.cookie += 'tampered';
      else tampered.authorization = `Bearer ${player.login.jwt.slice(0, -12)}aaaaaaaaaaaa`;
      await rejected(primary.join(tampered, seat(player)), 'UNAUTHENTICATED');
      return { expiredDatabaseSessionDenied: true, tamperedCredentialDenied: true, expirationMethod: 'Explicit fixture update of real Better Auth session.expiresAt; no clock-mock authentication.' };
    });
  }

  await run('GATE-02', 'A-1-browser', 'Real Chromium cookie flow and credential-exposure canary', async () => {
    const result = await cookieBrowserProbe(primary, hosts.hono, primary.users.player1);
    observations['GATE-02'].browser = result.observations;
    return result.evidence;
  });
  await run('GATE-02', 'A-csrf', 'Cookie command/logout origin and preflight negatives', async () => {
    const login = primary.users.player1.login;
    const attack = await primary.http('/api/ping-session', { headers: { cookie: login.cookie, origin: 'https://foreign.invalid' }, body: { sessionId: 'demo', commandId: 'csrf-attempt' } });
    assert.equal(attack.status, 403); denied(attack.data, 'ORIGIN_DENIED');
    const logout = await primary.http('/api/auth/sign-out', { headers: { cookie: login.cookie, origin: 'https://foreign.invalid' }, body: {} });
    assert.equal(logout.status, 403);
    assert.equal((await primary.http('/api/whoami', { headers: credentials(primary, login) })).status, 200);
    assert.equal((await primary.http('/api/ping-session', { method: 'OPTIONS', headers: { origin: 'https://foreign.invalid' } })).status, 403);
    for (const fixture of [
      { path: '/api/whoami', method: 'GET', fetchSite: undefined },
      { path: '/api/whoami', method: 'GET', fetchSite: 'cross-site' },
      { path: '/api/ping-session', method: 'POST', fetchSite: 'same-origin' },
    ]) {
      const response = await fetch(`${primary.origin}${fixture.path}`, { method: fixture.method, headers: { cookie: login.cookie, ...(fixture.fetchSite ? { 'sec-fetch-site': fixture.fetchSite } : {}), ...(fixture.method === 'POST' ? { 'content-type': 'application/json' } : {}) }, body: fixture.method === 'POST' ? JSON.stringify({ sessionId: 'demo', commandId: 'originless-write' }) : undefined });
      assert.equal(response.status, 403); denied(await response.json(), 'ORIGIN_DENIED');
    }
    return { foreignOriginCommandDenied: true, betterAuthForeignOriginLogoutDenied: true, originalSessionStillValid: true, foreignPreflightDenied: true, missingOriginDoesNotPermitWritesOrUnprovenReads: true, realBrowserCase: 'A-1-browser' };
  });
  await run('GATE-02', 'B-bearer-distinction', 'Better Auth opaque bearer is real and distinct from signed JWT', async () => {
    const login = primary.users.player1.login;
    assert.equal(typeof login.opaqueBearer, 'string');
    const result = await primary.http('/api/auth/get-session', { headers: { authorization: `Bearer ${login.opaqueBearer}` } });
    assert.equal(result.status, 200); assert.equal(result.data.user.id, primary.users.player1.userId);
    assert.notEqual(login.opaqueBearer, login.jwt);
    return { betterAuthBearerPluginExecuted: true, opaqueSessionTokenDiffersFromJwtPluginToken: true };
  });
  await run('GATE-02', 'common-7', 'Solo configuration cannot bind publicly and local identity cannot authorize remote requests', async () => {
    const guard = new FixtureHost();
    try { await rejected(guard.init({ variant: 'minimal', mode: 'solo', bindHost: '0.0.0.0', databasePath: join(folder, 'guard.sqlite') }), 'SOLO_REQUIRES_LOOPBACK'); }
    finally { await guard.close(); }
    await rejected(primary.join({ origin: primary.origin, 'x-solo-user': 'local-owner' }, { sessionId: 'demo', seat: 'gm', localIdentity: 'local-owner' }), 'UNAUTHENTICATED');
    return { publicSoloBindRejectedBeforeListen: true, localIdentityHeaderAndPayloadCannotAuthorizeRemoteJoin: true, tauriBootstrapExecuted: false };
  });

  await run('GATE-03', 'common-2', 'Typed client compiles and OpenAPI describes the actual command/query surface', async () => {
    const path = join(here, 'api-client.ts');
    const program = ts.createProgram([path], { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], skipLibCheck: true });
    const errors = ts.getPreEmitDiagnostics(program);
    assert.deepEqual(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')), []);
    const source = await readFile(path, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    typedClient = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
    const openapi = JSON.parse(await readFile(join(here, 'openapi.json'), 'utf8'));
    assert.equal(openapi.openapi, '3.1.0');
    assert.equal(openapi.paths['/api/ping-session'].post.operationId, 'pingSession');
    assert.equal(openapi.paths['/api/snapshot'].get.operationId, 'getSnapshot');
    assert.deepEqual(openapi.paths['/health'].get.security, []);
    const malformed = [
      { action: 'pingSession', status: 200, body: { ok: true, sessionId: 'demo', commandId: 'bad', revision: '1' } },
      { action: 'pingSession', status: 200, body: { ok: true, sessionId: 'demo', commandId: 7, revision: 1 } },
      { action: 'getSnapshot', status: 200, body: { ok: true, sessionId: 'demo', revision: 1, value: '1' } },
      { action: 'getSnapshot', status: 200, body: { ok: true, sessionId: 'demo', revision: -1, value: 1 } },
      { action: 'pingSession', status: 403, body: { ok: false, error: { code: 403 } } },
      { action: 'getSnapshot', status: 200, text: '{"truncated":' },
      { action: 'pingSession', status: 401, body: { ok: true, sessionId: 'demo', commandId: 'bad', revision: 1 } },
    ];
    const responses = [...malformed, { status: 403, body: { ok: false, error: { code: 'GM_REQUIRED' } } }];
    const malformedServer = createServer((request, response) => {
      request.resume();
      const fixture = responses.shift();
      response.writeHead(fixture?.status ?? 500, { 'content-type': 'application/json' });
      response.end(fixture?.text ?? JSON.stringify(fixture?.body ?? null));
    });
    try {
      await new Promise((resolve, reject) => { malformedServer.once('error', reject); malformedServer.listen(0, '127.0.0.1', resolve); });
      const client = typedClient.createCandidateClient(`http://127.0.0.1:${malformedServer.address().port}`, {});
      for (const fixture of malformed) await assert.rejects(client[fixture.action]({ sessionId: 'demo', commandId: 'decode-probe' }), { message: 'INVALID_RESPONSE' });
      assert.deepEqual(await client.pingSession({ sessionId: 'demo', commandId: 'valid-denial' }), { ok: false, error: { code: 'GM_REQUIRED' } });
      assert.equal(responses.length, 0);
    } finally { await new Promise((resolve) => malformedServer.close(resolve)); }
    return { typescript: ts.version, diagnostics: 0, compiledClientUsedByLiveLoadTest: true, runtimeDecoders: ['CommandAck', 'Snapshot', 'ApiFailure'], malformedRealHttpResponsesRejected: malformed.length, validStructuredDenialPreserved: true, uncheckedResponseCasts: 0, openapiPaths: Object.keys(openapi.paths).sort(), schemaGenerationToolExecuted: false };
  });

  for (const variant of ['minimal', 'hono']) {
    const host = hosts[variant];
    await run('GATE-03', `${variant}-1`, 'HTTP and WebSocket use identical current policy and denial reasons', async () => {
      const player = host.users.player1;
      const headers = credentials(host, player.login);
      const link = await host.join(headers, seat(player));
      const before = await host.call('stats');
      const command = { sessionId: 'demo', commandId: `forbidden-${variant}`, role: 'host-admin' };
      const http = await host.http('/api/gm-command', { headers, body: command });
      const ws = await link.room.request('gmOnly', command);
      assert.equal(http.status, 403); denied(http.data, 'GM_REQUIRED'); assert.deepEqual(ws, http.data);
      assert.equal((await host.call('stats')).revision, before.revision);
      const health = await host.http('/health'); assert.equal(health.status, 200);
      const unauthenticated = await host.http('/api/ping-session', { body: { sessionId: 'demo', commandId: 'no-auth' } });
      assert.equal(unauthenticated.status, 401); denied(unauthenticated.data, 'UNAUTHENTICATED');
      const nullHttp = await host.http('/api/ping-session', { headers, body: null });
      const nullWs = await link.room.request('pingSession', null);
      assert.equal(nullHttp.status, 400); denied(nullHttp.data, 'INVALID_PAYLOAD'); assert.deepEqual(nullWs, nullHttp.data);
      assert.equal((await host.call('stats')).revision, before.revision);
      return { samePolicyImplementation: true, identicalDenyCode: 'GM_REQUIRED', clientRoleOverrideIgnored: true, unauthorizedSideEffects: 0, healthPublic: true, commandRequiresAuthentication: true, jsonNullRejectedIdentically: { httpStatus: 400, code: 'INVALID_PAYLOAD' } };
    });
    await run('GATE-03', `${variant}-3`, '200 concurrent commands by 1 GM and 2 players retain every ACK and delta', async () => {
      assert.ok(typedClient, 'typed client must compile before load');
      const users = [host.users.gm, host.users.player1, host.users.player2];
      const links = await Promise.all(users.map((user) => host.join(credentials(host, user.login), seat(user))));
      const clients = users.map((user) => typedClient.createCandidateClient(host.origin, credentials(host, user.login)));
      const before = await host.call('stats');
      const timings = [];
      const started = performance.now();
      const results = await Promise.all(Array.from({ length: 200 }, async (_, index) => {
        const command = { sessionId: 'demo', commandId: `storm-${variant}-${index}` };
        const start = performance.now();
        const response = index % 2 === 0 ? await clients[index % 3].pingSession(command) : await links[index % 3].room.request('pingSession', command);
        timings.push(performance.now() - start);
        assert.equal(response.ok, true); assert.equal(response.commandId, command.commandId);
        return response;
      }));
      const elapsedMs = performance.now() - started;
      assert.equal(new Set(results.map((result) => result.commandId)).size, 200);
      assert.deepEqual(results.map((result) => result.revision).sort((a, b) => a - b), Array.from({ length: 200 }, (_, i) => before.revision + i + 1));
      await until(() => links.every((link) => link.deltas.filter((event) => event.commandId.startsWith(`storm-${variant}-`)).length === 200), 3000, 'delta delivery');
      for (const link of links) assert.equal(new Set(link.deltas.map((event) => event.commandId)).size, 200);
      const after = await host.call('stats'); assert.equal(after.commits - before.commits, 200);
      for (const client of clients) assert.equal((await client.getSnapshot()).revision, after.revision);
      observations['GATE-03'][`${variant}Commands`] = { ...percentiles(timings), elapsedMs: Number(elapsedMs.toFixed(3)), errorRate: 0, operationsPerSecond: Number((200000 / elapsedMs).toFixed(3)) };
      return { actors: { hostAdmin: 1, players: 2 }, concurrentCommands: 200, httpCommands: 100, webSocketCommands: 100, acknowledgements: 200, lostAcknowledgements: 0, uniqueRevisions: 200, deltasPerObserver: [200, 200, 200], errorRate: 0 };
    });
    await run('GATE-03', `${variant}-4`, 'A caught HTTP 500 leaves the existing WebSocket room usable', async () => {
      const user = host.users.gm;
      const link = await host.join(credentials(host, user.login), seat(user));
      const before = { roomId: link.room.roomId, seatId: link.room.sessionId };
      const failure = await host.http('/api/failure'); assert.equal(failure.status, 500); denied(failure.data, 'INTERNAL_ERROR');
      const response = await link.room.request('pingSession', { sessionId: 'demo', commandId: `after-500-${variant}` });
      assert.equal(response.ok, true);
      assert.equal(link.room.connection.isOpen, true); assert.deepEqual(link.leaves, []);
      assert.equal(link.room.roomId, before.roomId); assert.equal(link.room.sessionId, before.seatId);
      return { observedHttpStatus: 500, sameRoomAndSeat: true, commandAcknowledgedAfterFailure: true, socketDisconnects: 0, processCrashIsolationTested: false };
    });
    await run('GATE-03', `${variant}-reconnect-200`, '200 real reconnects overlap 200 HTTP commands without lost ACKs', async () => {
      const users = [host.users.gm, host.users.player1, host.users.player2];
      const links = await Promise.all(Array.from({ length: 200 }, (_, index) => host.join(credentials(host, users[index % 3].login), seat(users[index % 3]))));
      const reservations = links.map((link, index) => ({ token: link.room.reconnectionToken, roomId: link.room.roomId, sessionId: link.room.sessionId, user: users[index % 3] }));
      const dropped = await host.call('drop-room', { roomId: links[0].room.roomId }); assert.equal(dropped.dropped, 200);
      await until(() => links.every((link) => !link.room.connection.isOpen), 2000, '200 transport drops');
      const timings = [], httpTimings = [], reconnectIntervals = [], httpIntervals = [];
      const before = await host.call('stats');
      const started = performance.now();
      let activeReconnects = 0, activeHttp = 0, httpAcksDuringReconnects = 0, reconnectsDuringHttp = 0;
      const reconnectJobs = [], httpJobs = [];
      const clients = users.map((user) => typedClient.createCandidateClient(host.origin, credentials(host, user.login)));
      let firstConnected;
      const firstConnection = new Promise((resolve) => { firstConnected = resolve; });
      for (const reservation of reservations) {
        reconnectJobs.push((async () => {
        const start = performance.now();
        activeReconnects++;
        try {
          const link = await host.reconnect(credentials(host, reservation.user.login), reservation.token);
          firstConnected();
          assert.equal(link.room.sessionId, reservation.sessionId); assert.equal(link.room.roomId, reservation.roomId);
          assert.equal((await link.room.request('seat')).role, reservation.user.role);
          if (activeHttp > 0) reconnectsDuringHttp++;
          const end = performance.now(); timings.push(end - start); reconnectIntervals.push([start, end]);
          return link;
        } finally { activeReconnects--; }
        })());
      }
      // Begin all HTTP commands at an observed real WS-handshake milestone,
      // while the reconnect burst is still running. No artificial server delay.
      const settledReconnects = Promise.allSettled(reconnectJobs);
      await timeout(firstConnection, 10000, 'first real reconnect');
      for (let index = 0; index < 200; index++) {
        httpJobs.push((async () => {
          const start = performance.now(); activeHttp++;
          try {
            const commandId = `overlap-${variant}-${index}`;
            const ack = await clients[index % 3].pingSession({ sessionId: 'demo', commandId });
            assert.equal(ack.ok, true); assert.equal(ack.commandId, commandId);
            if (activeReconnects > 0) httpAcksDuringReconnects++;
            const end = performance.now(); httpTimings.push(end - start); httpIntervals.push([start, end]);
            return ack;
          } finally { activeHttp--; }
        })());
      }
      const [restored, httpResults] = await Promise.all([settledReconnects, Promise.allSettled(httpJobs)]);
      const errors = restored.filter((result) => result.status === 'rejected');
      const httpErrors = httpResults.filter((result) => result.status === 'rejected');
      const overlapMs = Math.min(Math.max(...reconnectIntervals.map((interval) => interval[1])), Math.max(...httpIntervals.map((interval) => interval[1]))) - Math.max(Math.min(...reconnectIntervals.map((interval) => interval[0])), Math.min(...httpIntervals.map((interval) => interval[0])));
      observations['GATE-03'][`${variant}Reconnects`] = { ...percentiles(timings), elapsedMs: Number((performance.now() - started).toFixed(3)), attempts: 200, succeeded: restored.length - errors.length, errorRate: errors.length / 200 };
      observations['GATE-03'][`${variant}ConcurrentHttp`] = { ...percentiles(httpTimings), attempts: 200, succeeded: 200 - httpErrors.length, errorRate: httpErrors.length / 200, overlapMs: Number(overlapMs.toFixed(3)), httpAcksDuringReconnects, reconnectsDuringHttp };
      assert.equal(errors.length, 0, errors.map((error) => error.reason?.message).join('; '));
      assert.equal(httpErrors.length, 0, httpErrors.map((error) => error.reason?.message).join('; '));
      const acks = httpResults.map((result) => result.value);
      assert.equal(new Set(acks.map((ack) => ack.commandId)).size, 200);
      assert.deepEqual(acks.map((ack) => ack.revision).sort((a, b) => a - b), Array.from({ length: 200 }, (_, index) => before.revision + index + 1));
      const after = await host.call('stats'); assert.equal(after.commits - before.commits, 200);
      assert.ok(overlapMs > 0, 'reconnect and HTTP request intervals must overlap');
      assert.ok(reconnectsDuringHttp > 0, 'real reconnects must finish while HTTP requests remain in flight');
      return { concurrentReconnects: 200, concurrentHttpCommands: 200, concurrentHttpAcks: 200, concurrentHttpUniqueRevisions: 200, realTimeOverlapObserved: true, reconnectCompletionsWhileHttpInFlightObserved: true, httpBurstTrigger: 'first real WS reconnect handshake; no artificial delay', signedInIdentities: 3, transport: 'real ws TCP connections via Colyseus SDK', successfulReconnects: 200, sameSeats: 200, checkedRoles: 200, errors: 0, errorRate: 0, freshLoginStorm: false };
    });
  }
} catch (error) {
  const message = String(error.message).replaceAll(folder, '<temporary-directory>');
  for (const gate of Object.keys(cases)) cases[gate].push({ id: 'setup', title: 'Real candidate fixture setup', status: 'FAIL', error: message });
  process.stderr.write(`Candidate setup FAIL: ${message}\n`);
} finally {
  for (const host of active) await host.close();
  await rm(folder, { recursive: true, force: true });
}

const packageJson = JSON.parse(await readFile(join(here, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(here, 'package-lock.json'), 'utf8'));
const sourceFiles = ['package.json', 'package-lock.json', 'policy.mjs', 'server.mjs', 'harness.mjs', 'browser.mjs', 'observations.mjs', 'check.mjs', 'api-client.ts', 'openapi.json', 'README.md'];
const sources = await Promise.all(sourceFiles.map(async (name) => ({ path: `scripts/stack-migration-pocs/gate-02-03/${name}`, sha256: hash(await readFile(join(here, name))) })));
const versions = Object.fromEntries(await Promise.all(Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies }).sort(([a], [b]) => a.localeCompare(b)).map(async ([name, wanted]) => {
  const installed = JSON.parse(await readFile(join(here, 'node_modules', name, 'package.json'), 'utf8'));
  assert.equal(installed.version, wanted, `installed ${name} differs from exact candidate pin`);
  assert.equal(installed.version, lock.packages[`node_modules/${name}`].version, `installed ${name} differs from lockfile`);
  return [name, installed.version];
})));
const vendorFiles = [
  '@colyseus/core/build/MatchMaker.mjs', '@colyseus/core/build/Room.mjs', '@colyseus/core/build/Server.mjs',
  '@colyseus/ws-transport/build/WebSocketTransport.mjs', '@colyseus/sdk/build/Client.mjs',
  '@colyseus/sdk/build/Room.mjs', '@colyseus/sdk/build/transport/WebSocketTransport.mjs',
  '@colyseus/better-call/dist/endpoint.mjs', 'better-auth/dist/plugins/jwt/sign.mjs',
  'better-auth/dist/api/routes/session.mjs', 'better-auth/dist/api/routes/sign-out.mjs', 'better-auth/dist/api/routes/sign-in.mjs', 'better-auth/dist/plugins/bearer/index.mjs',
];
const installedIntegrationSources = await Promise.all(vendorFiles.map(async (path) => ({ path: `node_modules/${path}`, sha256: hash(await readFile(join(here, 'node_modules', path))) })));
const codeSize = Object.fromEntries(await Promise.all(['policy.mjs', 'server.mjs', 'harness.mjs', 'browser.mjs', 'observations.mjs', 'check.mjs', 'api-client.ts'].map(async (path) => [path, (await readFile(join(here, path), 'utf8')).trimEnd().split('\n').length])));
cases['GATE-03'].push({ id: 'common-5', title: 'One business/policy implementation with explicit adapter and fixture boundaries', status: 'PASS', evidence: { lineCounts: codeSize, sharedPolicyAndCommands: 'policy.mjs', httpAndRoomWiring: 'server.mjs', reproducibilityOnly: ['harness.mjs', 'browser.mjs', 'observations.mjs', 'check.mjs'], productionFrameworkChoice: 'NOT APPROVED' } });
const statusFor = (entries, ids) => ids.some((id) => entries.find((entry) => entry.id === id)?.status === 'FAIL') ? 'FAIL' : ids.every((id) => entries.find((entry) => entry.id === id)?.status === 'PASS') ? 'PASS' : 'NOT RUN';
const summaries = [];
for (const gate of Object.keys(cases)) {
  const entries = cases[gate];
  const criteria = gate === 'GATE-02'
    ? ['A', 'B'].flatMap((variant) => Array.from({ length: 7 }, (_, index) => {
      const row = index + 1;
      const ids = row === 1 ? [`${variant}-1-wire`, `${variant}-1-browser`] : row === 7 ? ['common-7'] : [`${variant}-${row}`];
      if (variant === 'A' && row === 1 && entries.find((entry) => entry.id === 'A-1-browser')?.evidence?.requiredCriterionOutcome === 'FAIL') return { variant: 'A-cookie', row, cases: ids, status: 'FAIL', reason: 'Real Chromium can read authenticating tokens from sign-in JSON and set-auth-token, then authenticate without any cookie. HttpOnly document.cookie isolation does not satisfy full credential isolation in this combined A/B profile.' };
      return { variant: variant === 'A' ? 'A-cookie' : 'B-jwt', row, cases: ids, status: statusFor(entries, ids) };
    }))
    : ['minimal', 'hono'].flatMap((variant) => Array.from({ length: 5 }, (_, index) => {
      const row = index + 1;
      const ids = [row === 2 || row === 5 ? `common-${row}` : `${variant}-${row}`];
      return { variant, row, cases: ids, status: statusFor(entries, ids) };
    }));
  const executed = entries.filter((entry) => entry.status !== 'NOT RUN');
  const executedStatus = executed.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL';
  const status = executedStatus === 'FAIL' || criteria.some((row) => row.status === 'FAIL') ? 'FAIL' : criteria.some((row) => row.status === 'NOT RUN') ? 'NOT RUN' : 'PASS';
  const spec = `.qa/design/gates/${gate === 'GATE-02' ? 'GATE-02-better-auth-colyseus.md' : 'GATE-03-colyseus-http-vs-hono.md'}`;
  const report = {
    schemaVersion: 1, gate, status, executedStatus, approval: 'NOT APPROVED',
    scope: 'Executed isolated candidate libraries over real local HTTP and WebSocket; no product integration or human technology decision.',
    versions, criteria, cases: entries, installedIntegrationSources,
    observationValidation: 'Recorded observations are required and checked against the stable report hash, runtime/schema, exact sample counts, percentile order, revocation deadline, ACK/reconnect success and measured concurrency invariants; fresh timings need not equal historical timings.',
    notRun: gate === 'GATE-02' ? [
      { id: 'https-and-tauri-cookie', status: 'NOT RUN', reason: 'Real Chromium loopback login, document.cookie isolation, ordinary GET, WS and foreign-Origin CSRF were executed. HTTPS Secure-cookie behavior, other browsers and Tauri cookie persistence were not.' },
      { id: 'browser-jwt-storage', status: 'NOT RUN', reason: 'No browser/Tauri persistent secure-store proof. Node ws supports Authorization headers; browser WebSocket does not. SDK client.auth.token puts auth bearer in _authToken URL, which this fixture rejects. Colyseus seat/reconnect identifiers still use protocol URLs and require the tested extra actor/session binding.' },
      { id: 'production-policy', status: 'NOT RUN', reason: 'Fixture DB roles and character ownership exercise the shared policy boundary; complete GATE-01 policy, invitation and owner/GM product contracts are not integrated.' },
      { id: 'public-and-solo-platform', status: 'NOT RUN', reason: 'Loopback HTTP only; public TLS deployment, trusted proxy topology, solo identity creation and Tauri bootstrap/persistence not executed.' },
    ] : [
      { id: 'process-failure-isolation', status: 'NOT RUN', reason: 'HTTP 500 is a caught request failure, not a killed/blocked shared process. Both variants share a process in this fixture; Hono does not provide process isolation by itself.' },
      { id: 'production-operations', status: 'NOT RUN', reason: 'In-memory counter commands, loopback, three reused authenticated identities, no production state size, hardware/SLO, long soak, distributed rooms, external logging/metrics backend or backpressure qualification.' },
      { id: 'generated-openapi', status: 'NOT RUN', reason: 'Explicit OpenAPI fixture document and compiled typed client are provided; full automatic schema generation and compatibility with a product-wide client generator were not exercised.' },
    ],
    securityAndIntegrationBoundaries: [
      'Better Auth owns email/password sign-in, real SQLite sessions, signed cookies, bearer sessions, JWT issuance, JWKS and logout/revoke.',
      'JWT signature/issuer/audience/expiry verification is combined with the real current session record; signature-only verification cannot prove immediate logout revocation.',
      'Initial join/create reservation checks current auth. Colyseus HTTP reconnect reservation uses its existing reconnect ticket and does not itself rerun onAuth; even absent auth or wrong Origin can reach that reservation response. The actual WS upgrade enforces Origin and current actor/session binding, then room reconnect and every command recheck current auth/policy. A reservation response is not successful room access. Active clients are rechecked every 250ms.',
      'Real Chromium demonstrated a failing cookie credential-isolation goal: document.cookie cannot read the HttpOnly cookie, but sign-in JSON and set-auth-token expose usable session bearers to JavaScript in the combined A/B auth profile. GATE-02 A/1 and the overall gate are FAIL. No token proxy or cookie-only production profile is claimed.',
      'The pinned Colyseus reserveSeatFor authData.sessionId hook creates a random seat id so the WS upgrade can bind it to the exact Better Auth session. This source-dependent integration seam is hashed and not a product architecture decision.',
      'Better Auth cookies and JWTs are never placed in URLs. The Colyseus SDK uses seat/reconnection identifiers in protocol URLs; their additional binding to the current actor and exact Better Auth session is explicitly tested. Evidence contains neither auth credentials nor actual seat/reconnect identifiers. Auth rate limiting is disabled only for this controlled fixture.',
    ],
    sources: [...sources, { path: spec, sha256: hash(await readFile(join(repo, spec))) }],
    primaryDocumentation: [
      'https://better-auth.com/docs/adapters/sqlite', 'https://better-auth.com/docs/concepts/database',
      'https://better-auth.com/docs/plugins/bearer', 'https://better-auth.com/docs/plugins/jwt',
      'https://better-auth.com/docs/concepts/session-management', 'https://docs.colyseus.io/auth/room',
      'https://docs.colyseus.io/room/reconnection', 'https://docs.colyseus.io/server',
      'https://docs.colyseus.io/server/transport/ws', 'https://docs.colyseus.io/state/schema',
      'https://hono.dev/docs/getting-started/nodejs',
      'https://playwright.dev/docs/api/class-browser', 'https://playwright.dev/docs/api/class-browsercontext',
    ],
  };
  const path = join(repo, '.qa/evidence/stack-migration-prep/pocs', gate.toLowerCase());
  const observation = { schemaVersion: 1, gate, status, executedStatus, runAt: new Date().toISOString(), runtime: { node: process.version, os: platform(), architecture: arch(), kernel: release(), sqlite: hosts.minimal?.config?.sqlite ?? null }, metrics: observations[gate], deterministicReportSha256: reportHash(report) };
  validateObservation(report, observation);
  if (mode === '--write') {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(join(path, 'observations.json'), `${JSON.stringify(observation, null, 2)}\n`);
  } else {
    assert.deepEqual(report, JSON.parse(await readFile(join(path, 'report.json'), 'utf8')), `${gate} deterministic evidence drift; inspect before --write`);
    validateObservation(report, JSON.parse(await readFile(join(path, 'observations.json'), 'utf8')));
  }
  summaries.push({ gate, status, executedStatus, approval: report.approval, passed: executed.filter((entry) => entry.status === 'PASS').length, failed: executed.filter((entry) => entry.status === 'FAIL').length, notRun: entries.filter((entry) => entry.status === 'NOT RUN').length, metrics: observations[gate] });
  if (executedStatus === 'FAIL' || (status === 'FAIL' && mode !== '--check-execution')) process.exitCode = 1;
}
process.stdout.write(`${JSON.stringify({ mode, exitCondition: mode === '--check-execution' ? 'executed assertions and evidence integrity only; required goal failures remain FAIL' : 'executed assertions, evidence integrity and no failed required criteria', results: summaries })}\n`);
