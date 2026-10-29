/**
 * sec-client-trust-marketplace-check — Regression for #675 client-trust rules.
 * Mirrors domain whitelist semantics without a TS test runner.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

assert.match(edgeHelper, /PRIVILEGED_CLIENT_BODY_KEYS/);
assert.match(edgeHelper, /privilegedClientBodyRejectionMessage/);

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

console.log('sec-client-trust-marketplace-check: PASS');
