/**
 * Contract checks for user AI provider credentials (BYOK).
 * Location: scripts/ai-provider-credentials-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function check(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok: ${message}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const migration = read('supabase/migrations/020_user_ai_provider_credentials.sql');
check(migration.includes('user_ai_provider_credentials'), 'migration creates credentials table');
check(migration.includes('service_role'), 'migration grants service_role only');
check(migration.includes('consume_ai_provider_credential_rate_limit'), 'migration rate-limit RPC');
check(migration.includes('REVOKE ALL ON TABLE public.user_ai_provider_credentials FROM anon, authenticated'), 'revokes client table access');
check(migration.includes('GRANT ALL ON TABLE public.user_ai_provider_credentials TO service_role'), 'grants service_role on credentials');

const applyMigrations = read('scripts/apply-migrations.sh');
check(
  applyMigrations.includes('020_user_ai_provider_credentials.sql'),
  'self-host apply-migrations.sh registers 020',
);

const edge = read('supabase/functions/ai-provider-credentials/index.ts');
check(edge.includes("action === 'upsert'"), 'edge upsert action');
check(edge.includes('validateMeshyApiKey') || edge.includes('validateProviderApiKey'), 'edge validates key');
check(edge.includes('encryptProviderSecret'), 'edge encrypts secret');
check(!edge.includes('VITE_'), 'edge has no VITE_ secrets');

const resolve = read('supabase/functions/_shared/ai-provider-resolve-meshy.ts');
check(resolve.includes('AI_PROVIDER_ALLOW_HOST_KEYS'), 'host keys gated by allow flag');
check(resolve.includes('resolveMeshyApiKeyForUser'), 'user key resolver exists');

const model3d = read('supabase/functions/item-model3d/index.ts');
check(model3d.includes('resolveMeshyApiKeyForUser'), 'item-model3d uses user key resolver');
check(model3d.includes('isMeshyConfiguredForUser'), 'item-model3d config uses user configuration');

const thumb = read('supabase/functions/item-thumbnail/index.ts');
check(thumb.includes('resolveMeshyApiKeyForUser'), 'item-thumbnail uses user key resolver');

const clientSvc = read('src/infrastructure/ai/ai-provider-credentials-service.ts');
const hostInvoke = read('src/infrastructure/ai/host-ai-invoke.ts');
check(
  clientSvc.includes("invokeFn('provider-credentials'") ||
    clientSvc.includes("invoke('ai-provider-credentials'"),
  'client invokes credentials via host dual-path or edge',
);
check(
  hostInvoke.includes("functions.invoke") &&
    hostInvoke.includes('ai-provider-credentials') &&
    hostInvoke.includes('/api/v1/ai/'),
  'host-ai-invoke keeps Edge fallback and host HTTP path',
);
check(!/msy_[A-Za-z0-9]{8,}/.test(clientSvc), 'client service has no hardcoded meshy key');

const panel = read('src/app/profile/AiProviderCredentialsPanel.tsx');
check(panel.includes('aiProviderCredentialsService'), 'settings panel uses infrastructure service');
check(panel.includes('Credits'), 'panel shows credits copy');
const editDialog = read('src/app/profile/AiProviderCredentialsEditDialog.tsx');
check(editDialog.includes('Hinzugefügt'), 'edit dialog shows added_at copy');
check(panel.includes('AiProviderCredentialsEditDialog'), 'panel opens credentials edit dialog');

const profile = read('src/app/profile/Profile.tsx');
check(profile.includes('AiProviderCredentialsPanel'), 'Profile mounts provider panel');

const domain = read('src/domains/ai-providers/contracts.ts');
check(domain.includes('settingsAiTabToModality'), 'domain maps settings tabs to modality');

const envExample = read('.env.example');
check(envExample.includes('CREDENTIALS_ENCRYPTION_KEY'), '.env.example documents encryption key');
check(envExample.includes('AI_PROVIDER_ALLOW_HOST_KEYS'), '.env.example documents host-key allow flag');

if (failed > 0) {
  console.error(`\nai-provider-credentials-check: ${failed} failure(s)`);
  process.exit(1);
}
console.log('\nai-provider-credentials-check: all checks passed');
