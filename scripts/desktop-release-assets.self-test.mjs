/**
 * Self-test: desktop release asset classification + public download paths.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const domainUrl = pathToFileURL(
  join(root, 'src/domains/desktop-release/index.ts'),
).href;

const {
  classifyDesktopAssetName,
  isPublicDownloadPath,
  pickDesktopAssetsByPlatform,
  guessClientOs,
  pathForDownload,
} = await import(domainUrl);

assert.equal(classifyDesktopAssetName('SagaTree_0.2.0_aarch64.dmg'), 'macos');
assert.equal(classifyDesktopAssetName('SagaTree_0.2.0_x64_en-US.msi'), 'windows');
assert.equal(classifyDesktopAssetName('SagaTree_0.2.0_amd64.AppImage'), 'linux');
assert.equal(classifyDesktopAssetName('latest.json'), null);
assert.equal(classifyDesktopAssetName('SagaTree.app.tar.gz.sig'), null);

const picked = pickDesktopAssetsByPlatform([
  {
    name: 'SagaTree_0.2.0_x64-setup.exe',
    browserDownloadUrl: 'https://example.test/exe',
  },
  {
    name: 'SagaTree_0.2.0_x64_en-US.msi',
    browserDownloadUrl: 'https://example.test/msi',
  },
  {
    name: 'SagaTree_0.2.0_aarch64.dmg',
    browserDownloadUrl: 'https://example.test/dmg-arm',
  },
  {
    name: 'SagaTree_0.2.0_universal.dmg',
    browserDownloadUrl: 'https://example.test/dmg-universal',
  },
  {
    name: 'SagaTree_0.2.0_amd64.AppImage',
    browserDownloadUrl: 'https://example.test/appimage',
  },
  {
    name: 'latest.json',
    browserDownloadUrl: 'https://example.test/json',
  },
]);

assert.equal(picked.windows?.browserDownloadUrl, 'https://example.test/msi');
assert.equal(picked.macos?.browserDownloadUrl, 'https://example.test/dmg-universal');
assert.equal(picked.linux?.browserDownloadUrl, 'https://example.test/appimage');

assert.equal(isPublicDownloadPath('/download'), true);
assert.equal(isPublicDownloadPath('/get'), true);
assert.equal(isPublicDownloadPath('/download/'), true);
assert.equal(isPublicDownloadPath('/library'), false);
assert.equal(pathForDownload(), '/download');

assert.equal(guessClientOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'macos');
assert.equal(
  guessClientOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', { maxTouchPoints: 5 }),
  'unknown',
);
assert.equal(guessClientOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows');
assert.equal(guessClientOs('Mozilla/5.0 (X11; Linux x86_64)'), 'linux');
assert.equal(guessClientOs('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'unknown');
assert.equal(guessClientOs('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'unknown');

// Infrastructure parse is Vite-bundled; assert the source contract instead of
// directory-importing TS under plain Node.
const require = createRequire(import.meta.url);
const { readFileSync } = require('node:fs');
const infraSrc = readFileSync(
  join(root, 'src/infrastructure/desktop-release/github-desktop-releases.ts'),
  'utf8',
);
assert.match(infraSrc, /export function parseGitHubLatestRelease/);
assert.match(infraSrc, /pickDesktopAssetsByPlatform/);
assert.match(infraSrc, /releases\/latest/);

console.log('desktop-release-assets.self-test: PASS');
