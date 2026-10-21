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

    // Known failing goal: the combined bearer/JWT profile exposes usable auth
    // credentials to page JS even though document.cookie cannot read its cookie.
    const exposure = await page.evaluate(async () => {
      const results = [];
      for (const token of [window.__pocTokens.bodyToken, window.__pocTokens.headerToken]) {
        const response = await fetch('/api/auth/get-session', { credentials: 'omit', headers: { authorization: `Bearer ${token}` } });
        const body = await response.json();
        results.push({ status: response.status, authenticated: typeof body?.user?.id === 'string' && typeof body?.session?.id === 'string' });
      }
      return { loginBodyTokenReadable: typeof window.__pocTokens.bodyToken === 'string', bearerHeaderReadable: typeof window.__pocTokens.headerToken === 'string', replayWithoutCookie: results };
    });
    assert.equal(exposure.loginBodyTokenReadable, true); assert.equal(exposure.bearerHeaderReadable, true);
    assert.deepEqual(exposure.replayWithoutCookie, [{ status: 200, authenticated: true }, { status: 200, authenticated: true }]);

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
    const tokenReplays = await wire('GET', '/api/auth/get-session', 2);
    assert.equal(tokenReplays.length, 2); assert.ok(tokenReplays.every((request) => !request.cookiePresent));
    assert.ok(tokenReplays.every((request) => request.authorizationPresent));
    return {
      evidence: {
        realBrowserLogin: true, browserCookieSetAutomatically: true, documentCookieCannotReadHttpOnlyCookie: true, headerEvidence: 'Chromium CDP Network.requestWillBeSentExtraInfo; not renderer-only request headers',
        ordinaryGetWithoutOrigin: { observed: true, fetchMetadata: 'same-origin', whoamiStatus: 200 },
        realBrowserColyseusWebSocket: true, browserWsCommandAcknowledged: true, injectedOriginOrCookieHeaders: false,
        csrf: { realForeignOrigin: true, ambientCookieActuallyPresent: true, observedHttpStatus: 403, unauthorizedRevisionChanges: 0, responseAccess: csrf },
        wrongOriginWebSocketRejected: true, socketUrlFacts: socketFacts,
        credentialExposure: exposure, credentialIsolationSatisfied: false, requiredCriterionOutcome: 'FAIL',
        tlsSecureCookieTested: false, tauriTested: false,
      },
      observations: { browser: 'chromium', version: browser.version(), headless: true, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite, secure: cookie.secure, reusedUserProfile: false },
    };
  } finally { await context.close(); await browser.close(); }
}
