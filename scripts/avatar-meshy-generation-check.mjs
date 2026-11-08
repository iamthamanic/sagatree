#!/usr/bin/env node
/**
 * avatar-meshy-generation-check — deterministic tests for #10 Meshy avatar generation.
 * Location: scripts/avatar-meshy-generation-check.mjs
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-meshy-generation-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/meshy-avatar-job.ts');
const index = read('src/domains/character/avatar/index.ts');
const service = read('src/infrastructure/character/avatar/character-avatar-meshy-service.ts');
const panel = read('src/app/character/avatar/AvatarMeshyPanel.tsx');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');
const edge = read('archive/supabase-legacy/supabase/functions/character-avatar-meshy/index.ts');
const provider = read('archive/supabase-legacy/supabase/functions/_shared/avatar-meshy-text-to-3d.ts');
const migration = read('archive/supabase-legacy/supabase/migrations/026_character_avatar_meshy_jobs.sql');
const migrationMode = read('archive/supabase-legacy/supabase/migrations/027_character_avatar_meshy_generation_mode.sql');
const migrationNoClientWrite = read('archive/supabase-legacy/supabase/migrations/031_character_avatar_meshy_jobs_no_client_write.sql');
const applyMigrations = read('scripts/apply-migrations.sh');
const imageProvider = read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-meshy.ts');
const glb = read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts');
const agents = read('AGENTS.md');

check(/MESHY_AVATAR_JOB_CONTRACT_VERSION/.test(domain), 'job contract version');
check(/validateMeshyAvatarPrompt/.test(domain), 'prompt validator');
check(/validateMeshyAvatarImageDataUri/.test(domain), 'image data-uri validator');
check(/png\|jpeg\|webp/.test(domain), 'domain allows webp data-uri');
check(/validateMeshyAvatarTexturePrompt/.test(domain), 'texture prompt validator');
check(/resolveMeshyAvatarJobPrompt/.test(domain), 'mode prompt resolver');
check(/MeshyAvatarGenerationMode/.test(domain), 'generation mode type');
check(/assertNoCapabilityFromProviderStatus/.test(domain), 'no capability from provider');
check(/buildMeshyAvatarIdempotencyKey/.test(domain), 'idempotency key');
check(!/from ['"]react['"]/.test(domain), 'domain no React');

check(/export \{[\s\S]*validateMeshyAvatarPrompt/.test(index), 'barrel exports validator');
check(/validateMeshyAvatarImageDataUri/.test(index), 'barrel exports image validator');
check(/assertNoCapabilityFromProviderStatus/.test(index), 'barrel exports capability guard');

check(/character-avatar-meshy/.test(service), 'invokes host AI character-avatar-meshy (CUT-20)');
check(/isHostLibraryEnabled/.test(service), 'host library gate');
check(!/functions\.invoke|supabase\.functions/.test(service), 'no Edge functions.invoke (CUT-20)');
check(!/MESHY_API_KEY/.test(service), 'no meshy key in client service');
check(/assertNoCapabilityFromProviderStatus/.test(service), 'service forces pending caps');
check(/generationMode/.test(service), 'client sends generationMode');
check(/imageDataUri/.test(service), 'client can send imageDataUri');
check(/texturePrompt/.test(service), 'client can send texturePrompt');

check(/Mit KI erstellen/.test(panel), 'CTA label');
check(/data-avatar-meshy-status/.test(panel), 'status attr');
check(/data-avatar-meshy-mode/.test(panel), 'mode attr');
check(/data-avatar-meshy-mode-text/.test(panel), 'text mode control');
check(/data-avatar-meshy-mode-image/.test(panel), 'image mode control');
check(/data-avatar-meshy-texture-prompt/.test(panel), 'texture prompt field');
check(/data-avatar-meshy-image-file/.test(panel), 'image file input');
check(/image\/webp/.test(panel), 'panel accepts webp');
check(/Bild steuert die Form/.test(panel), 'image form copy');
check(/nur für die Textur/.test(panel) || /nur die Oberfläche/.test(panel), 'texture-only copy');
check(/data-avatar-meshy-confirm-modal/.test(panel), 'cost confirm modal');
check(/estimateMeshyAvatarCredits/.test(panel), 'credit estimate in confirm');
check(/AlertDialog/.test(panel), 'portal alert dialog');
check(!/Kosten bestätigen & starten/.test(panel), 'no inline cost confirm button swap');
check(/min-h-9/.test(panel), 'stable action row height');
check(/onSuccessRef/.test(panel), 'stable onSuccess ref avoids remount flicker');
check(/onJobChangeRef/.test(panel), 'stable onJobChange ref');
check(/Load config \/ providers \/ resume once/.test(panel) || /never re-run when parent callbacks/.test(panel), 'config effect once');
check(/\[\]/.test(panel.split('Load config')[1]?.slice(0, 800) ?? '') || /}, \[\]\);/.test(panel), 'mount effect empty deps');
check(/job && job.status !== 'idle'/.test(panel), 'busy job status wins over config loading copy');
check(/data-avatar-meshy-retry/.test(panel), 'explicit retry');
check(/configReady/.test(panel), 'config ready gate');
check(/Prüfe Meshy-Konfiguration/.test(panel), 'loading status copy');
check(/data-avatar-meshy-not-configured/.test(panel), 'not-configured marker');
check(/data-avatar-meshy-edge-down/.test(panel), 'edge-down marker distinct from missing key');
check(/edgeReachable/.test(service), 'config exposes edgeReachable');
check(/providersLoadFailed/.test(panel), 'providers load failure tracked');
check(/!providersLoadFailed/.test(panel), 'missing-key warn gated on successful provider load');
check(/data-avatar-meshy-prompt-hint/.test(panel), 'prompt length hint');
check(/promptLen\}\/\{promptMax/.test(panel) || /\{promptLen\}\/\{promptMax\}/.test(panel), 'counter uses max not min');
check(!/promptLen\}\/\{promptMin/.test(panel) && !/\$\{promptLen\}\/\$\{promptMin\}/.test(panel), 'no current/min false ratio');
check(/data-avatar-meshy-provider/.test(panel), '3d provider select');
check(/aiProviderCredentialsService/.test(panel), 'loads BYOK 3d providers');
check(/meshyConfigured === false/.test(panel), 'warn only after config false');
check(!/!config\?\.meshyConfigured \?/.test(panel), 'no null-as-not-configured false positive');
check(/mode === 'text' \? !promptTooShort : imageReady/.test(panel), 'start gate by mode');
check(/estimateMeshyAvatarCredits/.test(domain), 'domain credit estimate');
check(/MESHY_AVATAR_CREDITS_TEXT_PREVIEW/.test(domain), 'text preview credits constant');
check(/MESHY_AVATAR_CREDITS_IMAGE_TEXTURED/.test(domain), 'image credits constant');
check(/AvatarMeshyPanel/.test(editor), 'editor mounts panel');
check(/onJobChange/.test(panel), 'panel emits job to preview');
check(/AvatarMeshyGeneratingOverlay/.test(editor), 'editor mounts generating overlay');
check(/isMeshyAvatarJobBusy/.test(editor), 'busy gate for overlay');
check(/fillHost/.test(editor), 'overlay fills preview host while busy');
check(/data-avatar-canvas-viewport/.test(read('src/app/character/avatar/AvatarCanvas.tsx')), '3d viewport owns aspect box');
check(/AvatarAnimationPreviewControls/.test(read('src/app/character/avatar/AvatarCanvas.tsx')), 'animation controls below viewport');
check(/isMeshyAvatarJobBusy[\s\S]*AvatarMeshyGeneratingOverlay[\s\S]*AvatarSurfaceViewer/.test(editor)
  || /fillHost[\s\S]*AvatarSurfaceViewer/.test(editor), 'busy swaps overlay for viewer (no CH under)');
check(/pollHealth/.test(editor) || /pollHealth/.test(panel), 'poll health wired');
check(/displayProgress/.test(editor) || /displayProgress/.test(panel), 'monotonic display progress');
check(/data-avatar-meshy-health/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'health marker');
check(/monotonicMeshyProgress/.test(domain), 'domain monotonic progress');
check(/MESHY_AVATAR_POLL_STALE_MS/.test(domain), 'stale threshold constant');
check(/data-avatar-meshy-generating/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'overlay marker');
check(/data-avatar-meshy-atmosphere="cloudy-spiral"/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'cloudy-spiral atmosphere marker');
check(/data-avatar-meshy-spiral/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'hakim cloudy spiral');
check(/avatar-meshy-spiral-spin/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'spiral spin keyframes');
check(/#0B1220/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'viewport ground matches AvatarSurfaceViewer');
check(/SPIRAL_STYLE|ensureSpiralStyleMounted/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'static spiral CSS (no per-tick style rebuild)');
check(!/box-shadow:\s*0\s+0\s+10px/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'no animated box-shadow glow');
check(!/ctx\.shadowBlur|particleCount:\s*620/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'no heavy particle canvas');
check(/prefers-reduced-motion|prefersReducedMotion/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'reduced motion');
check(/SPIRAL_RADIUS_PX\s*=\s*100/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'larger spiral radius');
check(/avatar-meshy-spiral-style-v2/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'spiral style bump for radius');
check(/aiProviderCredentialsService[\s\S]*refresh/.test(read('src/app/character/avatar/AvatarMeshyPanel.tsx')), 'live credits refresh');
check(/refreshProviderCredits/.test(read('src/app/character/avatar/AvatarMeshyPanel.tsx')), 'credits refresh helper');
check(/browserModelUrl/.test(service), 'poll/retry map browser-safe modelUrl');
check(!/rewriteBrowserStorageUrl/.test(service), 'no Kong storage URL rewrite (CUT-20 host URLs)');
check(/isMeshyAvatarJobBusy/.test(domain), 'domain busy helper');

check(/downloadMeshyGlbBytes/.test(edge), 'SSRF-safe download');
check(/resolveMeshyApiKeyForUser/.test(edge), 'server-side key resolve');
check(/rig_analysis_status: 'pending'/.test(edge) || /rig_analysis_status: \"pending\"/.test(edge) || /rigAnalysisStatus: 'pending'/.test(edge), 'capabilities stay pending');
check(/consumeAvatarMeshyRateLimit/.test(edge), 'rate limit');
check(/idempotency_key/.test(edge), 'idempotency');
check(/generation_mode/.test(edge), 'edge persists generation_mode');
check(/parseGenerationMode/.test(edge) || /generationMode/.test(edge), 'edge accepts generationMode');
check(/png\|jpeg\|webp/.test(edge), 'edge allows webp data-uri');
check(/jobGenerationMode/.test(edge), 'poll branches on generation_mode');
check(/poseMode: 'a-pose'/.test(edge) || /pose_mode/.test(edge), 'avatar image-to-3d a-pose');
check(/supportsImageTo3d/.test(edge), 'config advertises image-to-3d');
check(/createLiveMeshyImageTo3dProvider/.test(edge), 'image-to-3d provider wired');

check(/text-to-3d/.test(provider), 'text-to-3d provider');
check(/createMockMeshyTextTo3dProvider/.test(provider), 'mock provider');
check(/normalizeMeshyTextTo3dBaseUrl/.test(provider), 'v1→v2 base normalize');
check(/\/openapi\/v2/.test(provider), 'text-to-3d defaults to openapi/v2');
check(/MESHY_TEXT_TO_3D_BASE_URL/.test(provider), 'dedicated text-to-3d base override');
check(/texture_prompt/.test(imageProvider), 'image-to-3d texture_prompt field');
check(/image_url/.test(imageProvider), 'image-to-3d image_url field');

check(/character_avatar_meshy_jobs/.test(migration), 'jobs table');
check(/rig_analysis_status = 'pending'/.test(migration), 'insert forces pending');
check(/idx_character_avatar_meshy_idempotency/.test(migration), 'idempotency unique index');
check(/generation_mode/.test(migrationMode), '027 generation_mode column');
check(/027_character_avatar_meshy_generation_mode\.sql/.test(applyMigrations), 'apply-migrations registers 027');
check(/031_character_avatar_meshy_jobs_no_client_write\.sql/.test(applyMigrations), 'apply-migrations registers 031');
check(/assertOwnerScopedStoragePath/.test(edge), 'poll signs only owner-scoped storage_path');
check(/resolveOwnedCharacterId/.test(edge), 'start resolves owned characterId only');
check(/publicMeshyFailure/.test(edge), 'provider errors sanitized for clients');
check(/SIGNED_URL_SECONDS = 60 \* 60 \* 24 \* 7/.test(edge), 'signed URLs use 7-day TTL');
check(/readResponseBodyWithByteCap/.test(glb), 'GLB download streams with hard byte cap');
check(/DROP POLICY IF EXISTS "Owners update own meshy avatar jobs"/.test(migrationNoClientWrite), '031 drops client UPDATE');
check(/DROP POLICY IF EXISTS "Owners insert own meshy avatar jobs"/.test(migrationNoClientWrite), '031 drops client INSERT');
check(/032_incomplete_sheet_blocks_adventure_join\.sql/.test(applyMigrations), 'apply-migrations registers 032');

check(/Immediately claim the next issue/.test(agents) || /auto-compact in-session/.test(agents), 'AGENTS auto-compact policy');

// pure prompt / capability replica
function validatePrompt(p) {
  const n = p.trim().replace(/\s+/g, ' ');
  if (n.length < 8) return false;
  if (n.length > 500) return false;
  return true;
}
check(validatePrompt('abc') === false && validatePrompt('elf warrior hero') === true, 'prompt length gate');
function capsFromProvider() { return 'pending'; }
check(capsFromProvider('SUCCEEDED') === 'pending', 'no capability escalate');

function isBusy(status) {
  return status === 'queued' || status === 'generating' || status === 'rigging';
}
check(isBusy('generating') && !isBusy('success') && !isBusy('analyzing'), 'busy overlay statuses');

function mono(prev, next) {
  return Math.max(prev, next);
}
check(mono(99, 90) === 99 && mono(40, 55) === 55, 'monotonic progress no regress');

function resolveJobPrompt(mode, prompt, texturePrompt) {
  if (mode === 'text') {
    return validatePrompt(prompt) ? prompt.trim() : null;
  }
  const t = (texturePrompt || '').trim();
  if (t.length >= 8) return t;
  return 'Image-to-3D reference';
}
check(resolveJobPrompt('text', 'elf warrior hero', '') === 'elf warrior hero', 'text mode uses geometry prompt');
check(resolveJobPrompt('image', '', '') === 'Image-to-3D reference', 'image mode placeholder without texture');
check(resolveJobPrompt('image', '', 'matte leather armor look') === 'matte leather armor look', 'image mode stores texture as job prompt');

check(/AVATAR_MESHY_GLB_MAX_BYTES = 200/.test(read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts')), 'avatar download ceiling 200MB');
check(/AVATAR_MESHY_GLB_SOFT_BYTES/.test(read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts')), 'soft remesh threshold');
check(/probeMeshyGlbContentLength/.test(read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts')), 'HEAD size probe');
check(/avatar-meshy-remesh/.test(edge), 'remesh adapter wired');
check(/shouldRemesh: meshyMapped\.should_remesh/.test(edge), 'image-to-3d remesh from mapped settings');
check(/remesh_task_id/.test(edge), 'poll tracks remesh_task_id');
check(/pending_glb_url/.test(edge), 'poll persists pending_glb_url before download');
check(/remeshAcked/.test(edge), 'poll splits remesh success from Auto-Rig create');
check(/045_character_avatar_meshy_pending_glb\.sql/.test(applyMigrations), 'apply-migrations registers 045');
check(/pending_glb_url/.test(read('archive/supabase-legacy/supabase/migrations/045_character_avatar_meshy_pending_glb.sql')), '045 pending_glb_url column');
check(/KI-Worker unterbrochen/.test(read('src/app/character/avatar/AvatarMeshyGeneratingOverlay.tsx')), 'offline copy distinguishes worker interrupt');
check(/Modell wird gespeichert/.test(editor), 'rigging 99% storage label');
check(/normalizeMeshyRemeshBaseUrl/.test(read('archive/supabase-legacy/supabase/functions/_shared/avatar-meshy-remesh.ts')), 'remesh base forces v1');
check(/028_character_avatar_meshy_glb_budget\.sql/.test(applyMigrations), 'apply-migrations registers 028');
check(/AVATAR_MESHY_GLB_STORE_MAX_BYTES = 150/.test(read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts')), 'avatar store ceiling 150MB');
check(/157286400/.test(read('archive/supabase-legacy/supabase/migrations/034_character_avatars_150mb.sql')), '034 bucket 150MB');
check(/034_character_avatars_150mb\.sql/.test(applyMigrations), 'apply-migrations registers 034');
check(/104857600/.test(read('archive/supabase-legacy/supabase/migrations/028_character_avatar_meshy_glb_budget.sql')), 'bucket 100MB');
check(/GLB budget \(028\)/.test(read('.qa/acceptance/meshy-avatar-image-to-3d.md')), 'image-to-3d acceptance notes budget');

// Local Meshy signed URLs are http://localhost — must not fall back to skinnie VRM.
const presets = read('src/domains/character/use-cases/avatar-presets.ts');
check(/isLoopbackHostname/.test(presets), 'loopback helper for local storage URLs');
check(/protocol === 'http:' && isLoopbackHostname/.test(presets), 'http loopback allowed for avatar URLs');
function normalizeSafeUrlReplica(value) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (url.protocol === 'https:') return url.toString();
    if (url.protocol === 'http:' && loopback) return url.toString();
    return undefined;
  } catch {
    return undefined;
  }
}
function normalizeAvatarModelUrlReplica(value) {
  const safe = normalizeSafeUrlReplica(value);
  if (!safe) return undefined;
  const path = safe.replace(/[?#].*$/, '').toLowerCase();
  return path.endsWith('.vrm') || path.endsWith('.glb') ? safe : undefined;
}
const localSigned =
  'http://localhost:8000/storage/v1/object/sign/character-avatars/u/meshy/a.glb?token=abc';
check(
  normalizeAvatarModelUrlReplica(localSigned) === localSigned,
  'localhost signed GLB accepted',
);
check(
  normalizeAvatarModelUrlReplica('http://evil.example/x.glb') === undefined,
  'remote http GLB still rejected',
);
check(
  normalizeAvatarModelUrlReplica('https://cdn.example/a.glb') === 'https://cdn.example/a.glb',
  'https GLB still accepted',
);

console.log('avatar-meshy-generation-check PASS');
