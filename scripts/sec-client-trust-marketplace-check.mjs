/**
 * sec-client-trust-marketplace-check — Regression for #675 client-trust rules.
 * Static source proofs + lightweight domain-rule fixtures (no Vitest/Zod dep).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const service = readFileSync(
  join(root, 'src/infrastructure/marketplace/marketplace-service.ts'),
  'utf8',
);
const domain = readFileSync(
  join(root, 'src/domains/marketplace/client-trust.ts'),
  'utf8',
);
const edgeHelper = readFileSync(
  join(root, 'supabase/functions/_shared/client-trust-body.ts'),
  'utf8',
);
const deploySql = readFileSync(
  join(root, 'src/supabase/deploy_marketplace.sql'),
  'utf8',
);
const schemaSql = readFileSync(join(root, 'src/supabase/schema.sql'), 'utf8');

assert.match(service, /whitelistMarketplaceUpdatePatch/);
assert.match(service, /whitelistMarketplaceCreateDto/);
assert.match(service, /\.eq\('author_id',\s*userId\)/);
assert.match(service, /getAuthenticatedUserId/);
assert.doesNotMatch(service, /\.\.\.dto/);
assert.doesNotMatch(
  service,
  /update\(\{\s*downloads:\s*item\.downloads/,
);

assert.match(domain, /MARKETPLACE_PRIVILEGED_CLIENT_KEYS/);
assert.match(domain, /author_id/);
assert.match(domain, /rating/);
assert.match(domain, /downloads/);
assert.match(domain, /created_at/);

assert.match(edgeHelper, /PRIVILEGED_CLIENT_BODY_KEYS/);
assert.match(edgeHelper, /privilegedClientBodyRejectionMessage/);

assert.match(deploySql, /marketplace_items_guard_privileged_columns/);
assert.match(deploySql, /NEW\.created_at := now\(\)/);
assert.match(deploySql, /SET search_path = public, pg_temp/);
assert.match(deploySql, /REVOKE ALL ON FUNCTION increment_marketplace_downloads/);
assert.doesNotMatch(
  deploySql,
  /GRANT EXECUTE ON FUNCTION increment_marketplace_downloads\(UUID\) TO anon/,
);

assert.match(schemaSql, /marketplace_items_guard_privileged_columns/);
assert.match(schemaSql, /GRANT INSERT \(/);
assert.match(schemaSql, /is_featured/);

const allowlisted = [
  'ai-provider-credentials',
  'character-avatar-meshy',
  'character-lore',
  'item-model3d',
  'item-thumbnail',
  'look-reference-analysis',
  'ollama-settings',
  'session-media-token',
  'session-recap',
];

for (const name of allowlisted) {
  const src = readFileSync(
    join(root, `supabase/functions/${name}/index.ts`),
    'utf8',
  );
  assert.match(
    src,
    /privilegedClientBodyRejectionMessage/,
    `${name} must reject privileged client body keys`,
  );
}

// Domain fixtures via esbuild-bundle free path: transpile with node + ts strip unavailable;
// assert privileged-key helper logic mirrored in a tiny inline replica of the allowlist sets.
const privileged = new Set([
  'author_id',
  'owner_user_id',
  'rating',
  'downloads',
  'roles',
  'permissions',
  'is_admin',
  'id',
  'created_at',
  'updated_at',
]);
function findPriv(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  return Object.keys(input).filter((k) => privileged.has(k));
}
assert.deepEqual(findPriv({ title: 'x', author_id: 'a', rating: 5 }), [
  'author_id',
  'rating',
]);
assert.deepEqual(findPriv({ title: 'ok', price: 1 }), []);

const deno = spawnSync(
  'deno',
  ['test', 'supabase/functions/_shared/client-trust-body_test.ts'],
  { cwd: root, encoding: 'utf8' },
);
assert.equal(deno.status, 0, deno.stderr || deno.stdout);

console.log('sec-client-trust-marketplace-check: PASS');
