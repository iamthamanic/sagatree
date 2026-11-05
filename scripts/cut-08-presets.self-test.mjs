#!/usr/bin/env node
/**
 * cut-08-presets.self-test — Host character preset CRUD / versions / authz.
 * Location: scripts/cut-08-presets.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;

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

function snapshotAt(level, name = 'CUT-08 Held') {
  return {
    schemaVersion: 1,
    name,
    description: 'Self-test',
    class: 'Wanderer',
    race: 'human',
    ruleset_key: 'sagatree-core',
    level,
    appearance: { gender_reading: 'diverse' },
    attributes: {
      strength: 2,
      dexterity: 2,
      endurance: 2,
      mind: 2,
      perception: 2,
      charisma: 2,
    },
    skills: {},
    sagatree_profile: {
      essence: 'forge',
      background: {
        name: 'Dorf',
        milieuAccess: 'Markt',
        contact: 'Händler',
        complication: 'Schuld',
        communication: 'Klar',
      },
      baseAttributes: {
        strength: 2,
        dexterity: 2,
        endurance: 2,
        mind: 2,
        perception: 2,
        charisma: 2,
      },
      speciesTraitInstances: [],
    },
    abilities: [],
    inventory: [],
  };
}

const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);

const work = mkdtempSync(join(tmpdir(), 'cut-08-presets-'));
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

  const ownerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const strangerPassword = `Pw-${randomBytes(12).toString('base64url')}`;
  const ownerCookie = await signIn(baseURL, 'owner@cut08.test', ownerPassword);
  const strangerCookie = await signIn(baseURL, 'stranger@cut08.test', strangerPassword);

  const createdChar = await httpJson(baseURL, '/api/v1/library/characters', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      name: 'CUT-08 Held',
      description: 'Preset source',
      class: 'Wanderer',
      race: 'human',
      level: 1,
      sheet_status: 'draft',
      sheet: {
        class: 'Wanderer',
        race: 'human',
        attributes: snapshotAt(1).attributes,
        skills: {},
        sagatree_profile: snapshotAt(1).sagatree_profile,
      },
    },
  });
  assert(
    createdChar.res.status === 201,
    `create character ${createdChar.res.status} ${createdChar.text}`,
  );
  const characterId = createdChar.json.character.id;
  assert(typeof characterId === 'string', 'character id');

  const created = await httpJson(baseURL, '/api/v1/library/character-presets', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      displayName: 'CUT-08 Preset',
      rulesetKey: 'sagatree-core',
      sourceCharacterId: characterId,
      snapshot: snapshotAt(1),
    },
  });
  assert(created.res.status === 201, `create preset ${created.res.status} ${created.text}`);
  const presetId = created.json.preset.id;
  assert(created.json.preset.versions.length === 1, 'one version');
  assert(created.json.preset.source_character_id === characterId, 'source linked');

  const dupCreate = await httpJson(baseURL, '/api/v1/library/character-presets', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: {
      displayName: 'Dup',
      rulesetKey: 'sagatree-core',
      sourceCharacterId: characterId,
      snapshot: snapshotAt(1),
    },
  });
  assert(dupCreate.res.status === 409, `duplicate create ${dupCreate.res.status}`);

  const byChar = await httpJson(
    baseURL,
    `/api/v1/library/character-presets/by-character/${characterId}`,
    { cookie: ownerCookie, headers: { Origin: baseURL } },
  );
  assert(byChar.res.status === 200, 'by-character');
  assert(byChar.json.preset?.id === presetId, 'by-character id');

  const release2 = await httpJson(baseURL, `/api/v1/library/character-presets/${presetId}/versions`, {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { snapshot: snapshotAt(2) },
  });
  assert(release2.res.status === 201, `release v2 ${release2.res.status} ${release2.text}`);
  assert(release2.json.preset.versions.length === 2, 'two versions');

  const releaseDup = await httpJson(
    baseURL,
    `/api/v1/library/character-presets/${presetId}/versions`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: { snapshot: snapshotAt(2) },
    },
  );
  assert(releaseDup.res.status === 409, `dup level ${releaseDup.res.status}`);

  const badSchema = await httpJson(
    baseURL,
    `/api/v1/library/character-presets/${presetId}/versions`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: { snapshot: { ...snapshotAt(3), schemaVersion: 99 } },
    },
  );
  assert(badSchema.res.status === 400, `bad schema ${badSchema.res.status}`);

  const renamed = await httpJson(baseURL, `/api/v1/library/character-presets/${presetId}`, {
    method: 'PATCH',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
    body: { displayName: 'CUT-08 Renamed' },
  });
  assert(renamed.res.status === 200, `rename ${renamed.res.status}`);
  assert(renamed.json.preset.display_name === 'CUT-08 Renamed', 'rename applied');

  const duplicated = await httpJson(
    baseURL,
    `/api/v1/library/character-presets/${presetId}/duplicate`,
    {
      method: 'POST',
      cookie: ownerCookie,
      headers: { Origin: baseURL },
      body: {},
    },
  );
  assert(duplicated.res.status === 201, `duplicate ${duplicated.res.status}`);
  assert(duplicated.json.preset.source_character_id === null, 'copy clears source');
  assert(/Kopie/.test(duplicated.json.preset.display_name), 'copy suffix');
  const copyId = duplicated.json.preset.id;

  const strangerList = await httpJson(baseURL, '/api/v1/library/character-presets', {
    cookie: strangerCookie,
    headers: { Origin: baseURL },
  });
  assert(strangerList.res.status === 200, 'stranger list');
  assert(
    Array.isArray(strangerList.json.presets) && strangerList.json.presets.length === 0,
    'stranger sees none',
  );

  const strangerMutate = await httpJson(
    baseURL,
    `/api/v1/library/character-presets/${presetId}`,
    {
      method: 'PATCH',
      cookie: strangerCookie,
      headers: { Origin: baseURL },
      body: { displayName: 'Hijack' },
    },
  );
  assert(strangerMutate.res.status === 404 || strangerMutate.res.status === 403, 'stranger rename denied');

  const listed = await httpJson(baseURL, '/api/v1/library/character-presets', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(listed.res.status === 200, 'owner list');
  assert(listed.json.presets.length === 2, 'owner has original + copy');

  // Soft-delete source character → source_character_missing on list
  const deletedChar = await httpJson(baseURL, `/api/v1/library/characters/${characterId}`, {
    method: 'DELETE',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(deletedChar.res.status === 200, `delete char ${deletedChar.res.status}`);
  const afterDelete = await httpJson(baseURL, '/api/v1/library/character-presets', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  const original = afterDelete.json.presets.find((p) => p.id === presetId);
  assert(original?.source_character_missing === true, 'missing source flagged');

  const deleted = await httpJson(baseURL, `/api/v1/library/character-presets/${presetId}`, {
    method: 'DELETE',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(deleted.res.status === 200, `delete preset ${deleted.res.status}`);

  const deletedCopy = await httpJson(baseURL, `/api/v1/library/character-presets/${copyId}`, {
    method: 'DELETE',
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(deletedCopy.res.status === 200, `delete copy ${deletedCopy.res.status}`);

  const empty = await httpJson(baseURL, '/api/v1/library/character-presets', {
    cookie: ownerCookie,
    headers: { Origin: baseURL },
  });
  assert(empty.json.presets.length === 0, 'empty after delete');

  await host.stop();
  console.log('PASS: cut-08-presets.self-test');
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
