import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

async function wireAudit(context, page) {
  const cdp = await context.newCDPSession(page);
  const requests = new Map(), headers = new Map();
  cdp.on('Network.requestWillBeSent', (event) => requests.set(event.requestId, { method: event.request.method, path: new URL(event.request.url).pathname }));
  cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
    const values = Object.fromEntries(Object.entries(event.headers).map(([key, value]) => [key.toLowerCase(), value]));
    headers.set(event.requestId, { origin: values.origin ?? null, originPresent: Boolean(values.origin), fetchSite: values['sec-fetch-site'] ?? null, cookiePresent: Boolean(values.cookie), authorizationPresent: Boolean(values.authorization) });
  });
  await cdp.send('Network.enable');
  return async (method, path, minimum = 1) => {
    const start = Date.now();
    while (true) {
      const found = [...requests].filter(([id, request]) => request.method === method && request.path === path && headers.has(id)).map(([id, request]) => ({ ...request, ...headers.get(id) }));
      if (found.length >= minimum) return found;
      if (Date.now() - start > 5000) throw new Error(`Missing actual Chromium network ExtraInfo for ${method} ${path}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
}

// Actual Chromium, ordinary fetch and the bundled real browser SDK. No Origin,
// Cookie or Authorization header is injected into the positive browser flow.
export async function cookieBrowserProbe(host, foreignHost, user) {
  const bundle = await build({
    stdin: { contents: "import { Client } from '@colyseus/sdk'; window.ColyseusClient = Client;", resolveDir: dirname(fileURLToPath(import.meta.url)), sourcefile: 'browser-entry.mjs' },
    bundle: true, platform: 'browser', format: 'iife', target: 'chrome140', write: false, logLevel: 'silent',
  });
  for (const candidate of [host, foreignHost]) await candidate.call('browser-assets', { script: bundle.outputFiles[0].text });
  const browser = await chromium.launch({ headless: true, ...(process.env.GATE0203_CHROMIUM ? { executablePath: process.env.GATE0203_CHROMIUM } : {}) });
  const context = await browser.newContext();
  const socketFacts = [];
  let actualSocketUrl;
  try {
    const page = await context.newPage();
    const wire = await wireAudit(context, page);
    page.on('websocket', (socket) => {
      actualSocketUrl = socket.url();
      const url = new URL(socket.url());
      socketFacts.push({ authTokenParameterPresent: url.searchParams.has('_authToken'), seatParameterPresent: url.searchParams.has('sessionId'), parameterNames: [...url.searchParams.keys()].sort() });
    });
    await page.goto(`${host.origin}/__poc/browser`);
    const login = await page.evaluate(async ({ email, password }) => {
      const response = await fetch('/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await response.json();
      window.__pocTokens = { bodyToken: body.token, headerToken: response.headers.get('set-auth-token') };
      return { status: response.status, bodyTokenReadable: typeof body.token === 'string', bearerHeaderReadable: response.headers.has('set-auth-token'), documentCookieEmpty: document.cookie === '' };
    }, { email: user.email, password: user.password });
    assert.equal(login.status, 200);
    assert.equal(login.documentCookieEmpty, true);
    // Cookie-only GATE-02 A: page JS must not receive usable session bearers.
    assert.equal(login.bodyTokenReadable, false);
    assert.equal(login.bearerHeaderReadable, false);
    const cookie = (await context.cookies(host.origin)).find((entry) => entry.name === 'better-auth.session_token');
    assert.ok(cookie); assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'Lax');
    const identity = await page.evaluate(async () => { const response = await fetch('/api/whoami'); return { status: response.status, data: await response.json() }; });
    assert.deepEqual(identity, { status: 200, data: { ok: true, role: 'player', credentialKind: 'cookie' } });
    const joined = await page.evaluate(async (characterId) => {
      window.__pocClient = new window.ColyseusClient(location.origin);
      window.__pocRoom = await window.__pocClient.joinOrCreate('session_room', { sessionId: 'demo', seat: 'player', characterId });
      window.__pocRoom.reconnection.enabled = false;
      window.__pocRoom.onMessage('session.delta', () => {});
      const seat = await window.__pocRoom.request('seat');
      const ack = await window.__pocRoom.request('pingSession', { sessionId: 'demo', commandId: 'browser-real-ws' });
      return { role: seat.role, seat: seat.seat, ack: ack.ok };
    }, user.characterId);
    assert.deepEqual(joined, { role: 'player', seat: 'player', ack: true });
    assert.ok(actualSocketUrl);
    assert.ok(socketFacts.length > 0 && socketFacts.every((socket) => !socket.authTokenParameterPresent && socket.seatParameterPresent));

    // Negative: page JS cannot restore an authenticated session without the cookie
    // using any tokens scraped from the sign-in response (body or set-auth-token).
    const exposure = await page.evaluate(async () => {
      const results = [];
      for (const token of [window.__pocTokens.bodyToken, window.__pocTokens.headerToken]) {
        const headers = typeof token === 'string' && token.length > 0 ? { authorization: `Bearer ${token}` } : {};
        const response = await fetch('/api/auth/get-session', { credentials: 'omit', headers });
        const body = await response.json();
        results.push({
          status: response.status,
          authenticated: typeof body?.user?.id === 'string' && typeof body?.session?.id === 'string',
          scrapedTokenPresent: typeof token === 'string' && token.length > 0,
        });
      }
      return {
        loginBodyTokenReadable: typeof window.__pocTokens.bodyToken === 'string',
        bearerHeaderReadable: typeof window.__pocTokens.headerToken === 'string',
        replayWithoutCookie: results,
        pageJsCannotRestoreSessionWithoutCookie: results.every((entry) => !entry.authenticated && !entry.scrapedTokenPresent),
      };
    });
    assert.equal(exposure.loginBodyTokenReadable, false);
    assert.equal(exposure.bearerHeaderReadable, false);
    assert.ok(exposure.replayWithoutCookie.every((entry) => !entry.authenticated));
    assert.equal(exposure.pageJsCannotRestoreSessionWithoutCookie, true);

    // P1 follow-up (#900 discussion): cookie-only profile must not mint a JS-readable JWT
    // via /api/auth/token using the ambient HttpOnly session cookie.
    const jwtEscape = await page.evaluate(async () => {
      const tokenResponse = await fetch('/api/auth/token', { credentials: 'include' });
      let tokenBody = null;
      try { tokenBody = await tokenResponse.json(); } catch { tokenBody = null; }
      const jwt = typeof tokenBody?.token === 'string' ? tokenBody.token : null;
      let whoamiWithoutCookie = null;
      if (jwt) {
        const response = await fetch('/api/whoami', {
          credentials: 'omit',
          headers: { authorization: `Bearer ${jwt}` },
        });
        whoamiWithoutCookie = { status: response.status, body: await response.json() };
      }
      const authPaths = [
        '/api/auth/get-session',
        '/api/auth/token',
        '/api/auth/ok',
        '/api/auth/session',
      ];
      const scans = [];
      for (const path of authPaths) {
        const response = await fetch(path, { credentials: 'include' });
        let body = null;
        try { body = await response.json(); } catch { body = null; }
        const readableKeys = body && typeof body === 'object'
          ? Object.keys(body).filter((key) => ['token', 'sessionToken', 'accessToken', 'refreshToken', 'idToken'].includes(key) && typeof body[key] === 'string')
          : [];
        scans.push({
          path,
          status: response.status,
          readableCredentialKeys: readableKeys,
          jwtTokenPresent: typeof body?.token === 'string' && path.includes('token'),
        });
      }
      return {
        tokenEndpointStatus: tokenResponse.status,
        tokenEndpointErrorCode: tokenBody?.error?.code ?? null,
        jwtReadableByPageJs: typeof jwt === 'string' && jwt.length > 0,
        whoamiWithoutCookie,
        jwtUsableWithoutCookie: whoamiWithoutCookie?.status === 200 && whoamiWithoutCookie?.body?.ok === true,
        authPathScan: scans,
        noReadableCredentialsOnAuthPaths: scans.every((entry) => entry.readableCredentialKeys.length === 0 && !entry.jwtTokenPresent),
      };
    });
    assert.equal(jwtEscape.tokenEndpointStatus, 404, 'cookie-only profile must hard-deny /api/auth/token');
    assert.equal(jwtEscape.tokenEndpointErrorCode, 'JWT_ISSUANCE_DISABLED');
    assert.equal(jwtEscape.jwtReadableByPageJs, false);
    assert.equal(jwtEscape.jwtUsableWithoutCookie, false);
    assert.equal(jwtEscape.noReadableCredentialsOnAuthPaths, true);

    // Positive: cookie session still authenticates after the JWT-denial probe.
    const postJwtDenyWhoami = await page.evaluate(async () => {
      const response = await fetch('/api/whoami');
      return { status: response.status, data: await response.json() };
    });
    assert.deepEqual(postJwtDenyWhoami, { status: 200, data: { ok: true, role: 'player', credentialKind: 'cookie' } });

    const foreign = await context.newPage();
    const foreignWire = await wireAudit(context, foreign);
    await foreign.goto(`${foreignHost.origin}/__poc/browser`);
    const revisionBefore = (await host.call('stats')).revision;
    const csrfResponse = foreign.waitForResponse((response) => response.url() === `${host.origin}/api/ping-session` && response.request().method() === 'POST');
    const csrf = await foreign.evaluate(async (origin) => {
      try { await fetch(`${origin}/api/ping-session`, { method: 'POST', credentials: 'include', body: JSON.stringify({ sessionId: 'demo', commandId: 'browser-csrf' }) }); return 'readable-response'; }
      catch { return 'browser-denied-response-access'; }
    }, host.origin);
    const deniedPost = await csrfResponse;
    assert.equal(deniedPost.status(), 403);
    const [csrfHeaders] = await foreignWire('POST', '/api/ping-session');
    assert.equal(csrfHeaders.origin, foreignHost.origin);
    assert.equal(csrfHeaders.cookiePresent, true, 'same-site foreign-origin request must actually carry the cookie');
    assert.equal((await host.call('stats')).revision, revisionBefore);
    const wrongOriginSocket = await foreign.evaluate((url) => new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => { socket.close(); reject(new Error('foreign-origin socket timeout')); }, 5000);
      socket.onopen = () => { clearTimeout(timer); socket.close(); resolve('opened'); };
      socket.onerror = () => { clearTimeout(timer); resolve('rejected'); };
    }), actualSocketUrl);
    assert.equal(wrongOriginSocket, 'rejected');
    const postCsrfWhoami = await page.evaluate(async () => { const response = await fetch('/api/whoami'); return response.status; });
    assert.equal(postCsrfWhoami, 200);
    await page.evaluate(() => window.__pocRoom.leave());
    const [ordinaryGet] = await wire('GET', '/api/whoami');
    assert.ok(ordinaryGet); assert.equal(ordinaryGet.originPresent, false); assert.equal(ordinaryGet.fetchSite, 'same-origin'); assert.equal(ordinaryGet.cookiePresent, true);
    // At least two credentials:omit replays from exposure negatives, plus the jwtEscape
    // authPathScan get-session (credentials:include — cookie present).
    const getSessionCalls = await wire('GET', '/api/auth/get-session', 3);
    const tokenReplays = getSessionCalls.filter((request) => !request.cookiePresent);
    assert.equal(tokenReplays.length, 2);
    assert.ok(tokenReplays.every((request) => !request.authorizationPresent), 'cookie-only profile must not leave scraped Authorization credentials for page JS to replay');
    assert.ok(getSessionCalls.some((request) => request.cookiePresent), 'jwtEscape authPathScan must exercise get-session with ambient cookie');
    return {
      evidence: {
        realBrowserLogin: true, browserCookieSetAutomatically: true, documentCookieCannotReadHttpOnlyCookie: true, headerEvidence: 'Chromium CDP Network.requestWillBeSentExtraInfo; not renderer-only request headers',
        ordinaryGetWithoutOrigin: { observed: true, fetchMetadata: 'same-origin', whoamiStatus: 200 },
        realBrowserColyseusWebSocket: true, browserWsCommandAcknowledged: true, injectedOriginOrCookieHeaders: false,
        csrf: { realForeignOrigin: true, ambientCookieActuallyPresent: true, observedHttpStatus: 403, unauthorizedRevisionChanges: 0, responseAccess: csrf },
        wrongOriginWebSocketRejected: true, socketUrlFacts: socketFacts,
        credentialExposure: exposure,
        jwtEscape,
        credentialIsolationSatisfied: !jwtEscape.jwtReadableByPageJs && !jwtEscape.jwtUsableWithoutCookie && jwtEscape.noReadableCredentialsOnAuthPaths,
        requiredCriterionOutcome: (!jwtEscape.jwtReadableByPageJs && !jwtEscape.jwtUsableWithoutCookie && jwtEscape.noReadableCredentialsOnAuthPaths) ? 'PASS' : 'FAIL',
        pageJsCannotRestoreSessionWithoutCookieUsingExtractedTokens: true,
        pageJsCannotObtainReusableJwtViaAuthTokenEndpoint: true,
        cookieAuthStillWorksAfterJwtDeny: true,
        tlsSecureCookieTested: false, tauriTested: false,
      },
      observations: { browser: 'chromium', version: browser.version(), headless: true, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite, secure: cookie.secure, reusedUserProfile: false },
    };
  } finally { await context.close(); await browser.close(); }
}
