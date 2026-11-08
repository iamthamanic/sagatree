#!/usr/bin/env node
/**
 * fe-host-08-catalog-http.self-test — marketplace / rulesets / user-profile product HTTP.
 * Location: scripts/fe-host-08-catalog-http.self-test.mjs
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;

/** Minimal valid 1×1 PNG. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function cookieHeaderFromResponse(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length > 0) return raw.map((c) => c.split(';')[0]).join('; ');
  const single = res.headers.get('set-cookie');
  if (!single) return '';
  return single.split(',').map((part) => part.trim().split(';')[0]).join('; ');
}

async function httpJson(base, path, { method = 'GET', headers = {}, body, cookie } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, text, cookie: cookieHeaderFromResponse(res) };
}

async function signIn(baseURL, email, password) {
  const signUp = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email, password, name: email },
  });
  let cookie = signUp.cookie;
  if (!cookie || signUp.res.status >= 400) {
    const signInRes = await httpJson(baseURL, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { email, password },
    });
    assert(signInRes.res.status < 400, `sign-in ${email}: ${signInRes.res.status}`);
    cookie = signInRes.cookie;
  }
  assert(cookie && cookie.includes('='), `cookie for ${email}`);
  return cookie;
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'fe-host-08-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const port = 19800 + Math.floor(Math.random() * 1000);
const authSecret = generateAuthSecret();
const baseURL = `http://127.0.0.1:${port}`;

try {
  const host = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: baseURL,
    SAGATREE_AUTH_TRUSTED_ORIGINS: baseURL,
  });
  assert(!('error' in host), `host create: ${JSON.stringify(host)}`);
  await host.start();
  assert(host.isReady(), 'ready');

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@fehost08.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@fehost08.test', strangerPassword);

  // Fall 2 — unauthenticated marketplace create DENY
  const unauthCreate = await httpJson(baseURL, '/api/v1/marketplace/items', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { type: 'item', title: 'Nope', data: {} },
  });
  assert(unauthCreate.res.status === 401, `unauth create ${unauthCreate.res.status}`);

  // Fall 1 — marketplace create / list / featured / get / update / download
  const created = await httpJson(baseURL, '/api/v1/marketplace/items', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      type: 'item',
      title: 'Host Blade',
      description: 'sharp',
      data: { dmg: 3 },
      price: 0,
      tags: ['blade'],
    },
  });
  assert(created.res.status === 201, `create ${created.res.status} ${created.text}`);
  assert(typeof created.json?.item?.id === 'string', 'item id');
  assert(created.json.item.title === 'Host Blade', 'title');
  assert(typeof created.json.item.author_id === 'string', 'author_id from session');
  const itemId = created.json.item.id;

  const listed = await httpJson(baseURL, '/api/v1/marketplace/items', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(listed.res.status === 200, `list ${listed.res.status}`);
  assert(Array.isArray(listed.json?.items) && listed.json.items.some((i) => i.id === itemId), 'list contains');

  const featured = await httpJson(baseURL, '/api/v1/marketplace/items/featured', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(featured.res.status === 200, `featured ${featured.res.status}`);
  assert(Array.isArray(featured.json?.items), 'featured items');

  const got = await httpJson(baseURL, `/api/v1/marketplace/items/${itemId}`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(got.res.status === 200 && got.json?.item?.id === itemId, 'get item');

  const patched = await httpJson(baseURL, `/api/v1/marketplace/items/${itemId}`, {
    method: 'PATCH',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { title: 'Host Blade+', price: 1 },
  });
  assert(patched.res.status === 200 && patched.json?.item?.title === 'Host Blade+', 'owner update');

  // Fall 2 — stranger cannot mutate foreign item
  const hijack = await httpJson(baseURL, `/api/v1/marketplace/items/${itemId}`, {
    method: 'PATCH',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { title: 'Stolen' },
  });
  assert(hijack.res.status === 403, `stranger update ${hijack.res.status}`);

  const dl = await httpJson(baseURL, `/api/v1/marketplace/items/${itemId}/download`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(dl.res.status === 200 && typeof dl.json?.downloads === 'number', `download ${dl.res.status}`);

  // Fall 3 — missing marketplace item
  const missingItem = await httpJson(baseURL, '/api/v1/marketplace/items/does-not-exist', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    missingItem.res.status === 404 && missingItem.json?.error === 'not-found',
    `missing item ${missingItem.res.status}`,
  );

  // Rulesets — create / list / get / update / foreign DENY / missing
  const rsCreated = await httpJson(baseURL, '/api/v1/rulesets', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'Host Homebrew',
      attributes_config: { primary: ['STR'], derived: ['HP'] },
      skills_config: [{ name: 'Athletik', ability: 'STR' }],
      classes_config: [{ name: 'Krieger', hit_die: 'd10' }],
      races_config: [{ name: 'Mensch', speed: 30, size: 'medium' }],
      combat_rules: { initiative: 'dex' },
      dice_rules: { explode: false },
      is_public: false,
    },
  });
  assert(rsCreated.res.status === 201, `ruleset create ${rsCreated.res.status} ${rsCreated.text}`);
  const rulesetId = rsCreated.json?.ruleset?.id;
  assert(typeof rulesetId === 'string', 'ruleset id');
  assert(rsCreated.json.ruleset.is_official === false, 'custom not official');
  assert(
    Array.isArray(rsCreated.json.ruleset.skills_config) &&
      rsCreated.json.ruleset.skills_config[0]?.name === 'Athletik',
    'skills preserved',
  );
  assert(rsCreated.json.ruleset.combat_rules?.initiative === 'dex', 'combat_rules preserved');

  const rsList = await httpJson(baseURL, '/api/v1/rulesets', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    rsList.res.status === 200 &&
      Array.isArray(rsList.json?.rulesets) &&
      rsList.json.rulesets.some((r) => r.id === rulesetId),
    'ruleset list',
  );

  const rsGot = await httpJson(baseURL, `/api/v1/rulesets/${rulesetId}`, {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(rsGot.res.status === 200 && rsGot.json?.ruleset?.id === rulesetId, 'ruleset get');

  const rsPatch = await httpJson(baseURL, `/api/v1/rulesets/${rulesetId}`, {
    method: 'PATCH',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'Host Homebrew+',
      is_public: true,
      attributes_config: { primary: ['STR', 'DEX'], derived: ['HP'] },
      skills_config: [
        { name: 'Athletik', ability: 'STR' },
        { name: 'Akrobatik', ability: 'DEX' },
      ],
    },
  });
  assert(rsPatch.res.status === 200 && rsPatch.json?.ruleset?.name === 'Host Homebrew+', 'ruleset update');
  assert(
    Array.isArray(rsPatch.json.ruleset.attributes_config?.primary) &&
      rsPatch.json.ruleset.attributes_config.primary.includes('DEX'),
    'attributes_config patch',
  );
  assert(rsPatch.json.ruleset.skills_config?.length === 2, 'skills_config patch');

  const rsHijack = await httpJson(baseURL, `/api/v1/rulesets/${rulesetId}`, {
    method: 'PATCH',
    cookie: strangerCookie,
    headers: { Origin: baseURL },
    body: { name: 'Hijack' },
  });
  assert(rsHijack.res.status === 403, `stranger ruleset ${rsHijack.res.status}`);

  const rsMissing = await httpJson(baseURL, '/api/v1/rulesets/does-not-exist', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(
    (rsMissing.res.status === 404 || rsMissing.res.status === 403) &&
      typeof rsMissing.json?.error === 'string',
    `missing ruleset ${rsMissing.res.status}`,
  );

  // User profile — ensure + get + avatar upload
  const profile = await httpJson(baseURL, '/api/v1/user-profile/me', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(profile.res.status === 200, `profile ${profile.res.status} ${profile.text}`);
  assert(profile.json?.profile && typeof profile.json.profile.id === 'string', 'profile id');

  const unauthProfile = await httpJson(baseURL, '/api/v1/user-profile/me', {
    headers: { Origin: baseURL },
  });
  assert(unauthProfile.res.status === 401, `unauth profile ${unauthProfile.res.status}`);

  const avatar = await httpJson(baseURL, '/api/v1/user-profile/me/avatars', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      contentType: 'image/png',
      base64: PNG_BYTES.toString('base64'),
    },
  });
  assert(avatar.res.status === 200, `avatar ${avatar.res.status} ${avatar.text}`);
  assert(
    avatar.json?.profile?.avatarPath !== null && avatar.json.profile.avatarPath !== undefined,
    'avatar path stored',
  );
  assert(
    typeof avatar.json.profile.avatarUrl === 'string' &&
      avatar.json.profile.avatarUrl.includes('/api/v1/user-profile/me/avatar'),
    `avatarUrl display ${avatar.json.profile.avatarUrl}`,
  );
  const avatarGet = await fetch(avatar.json.profile.avatarUrl, {
    headers: { cookie: ownerCookie, Origin: baseURL },
  });
  assert(avatarGet.status === 200, `avatar get ${avatarGet.status}`);
  assert((avatarGet.headers.get('content-type') || '').startsWith('image/png'), 'avatar content-type');
  const avatarBytes = Buffer.from(await avatarGet.arrayBuffer());
  assert(avatarBytes.equals(PNG_BYTES), 'avatar bytes round-trip');

  // Claimed foreign owner id DENY
  const claimed = await httpJson(baseURL, '/api/v1/user-profile/me/avatars', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      contentType: 'image/png',
      base64: PNG_BYTES.toString('base64'),
      claimedOwnerUserId: 'not-me',
    },
  });
  assert(claimed.res.status === 403, `claimed owner ${claimed.res.status}`);

  // Owner deletes own marketplace item; stranger delete DENY already covered via update
  const deleted = await httpJson(baseURL, `/api/v1/marketplace/items/${itemId}`, {
    method: 'DELETE',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(deleted.res.status === 200 && deleted.json?.ok === true, `delete ${deleted.res.status}`);

  // FE host-only catalog / profile wiring (CUT-20)
  const marketplaceSrc = readFileSync(
    join(root, 'src/infrastructure/marketplace/marketplace-service.ts'),
    'utf8',
  );
  const rulesetSrc = readFileSync(join(root, 'src/infrastructure/rulesets/ruleset-service.ts'), 'utf8');
  const profileSrc = readFileSync(
    join(root, 'src/infrastructure/user-profile/user-profile-service.ts'),
    'utf8',
  );
  const stripCode = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const loreSrc = readFileSync(
    join(root, 'src/infrastructure/character/character-lore-service.ts'),
    'utf8',
  );
  const recapAiSrc = readFileSync(
    join(root, 'src/infrastructure/session/session-recap-ai-service.ts'),
    'utf8',
  );
  assert(/isHostLibraryEnabled/.test(marketplaceSrc), 'marketplace host gate');
  assert(/isHostLibraryEnabled/.test(rulesetSrc), 'ruleset host gate');
  assert(/isHostLibraryEnabled/.test(profileSrc), 'profile host gate');
  for (const [label, src] of [
    ['marketplace', marketplaceSrc],
    ['ruleset', rulesetSrc],
    ['profile', profileSrc],
  ]) {
    const code = stripCode(src);
    assert(!/supabase\.(from|rpc)|functions\.invoke/.test(code), `${label} no supabase in facade`);
  }
  assert(/\/api\/v1\/ai\/character-lore/.test(loreSrc), 'CUT-13 lore host HTTP');
  assert(!/Host-Modus noch nicht verfügbar/.test(loreSrc), 'lore Soft-DENY removed');
  assert(/generateHostSessionRecapDraft/.test(recapAiSrc), 'CUT-14 recap host HTTP');
  assert(!/Host-Modus noch nicht verfügbar/.test(recapAiSrc), 'recap Soft-DENY removed');
  assert(
    /mountCatalogHttpRoutes/.test(readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8')),
    'catalog routes mounted',
  );

  await host.stop?.();
  console.log('OK: fe-host-08-catalog-http.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
