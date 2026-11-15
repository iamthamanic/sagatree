/**
 * atl2-h01-cleanup — Browser proof for the non-destructive atlas cleanup (#1234).
 * Location: e2e/atl2-h01-cleanup.spec.ts
 *
 * On the real product route (Host + SQLite, software WebGL in CI): one productive
 * Custom-WebGL 3D runtime, no Three inventory viewport, no double toolbar in either
 * surface, and the legacy HTML prototype is no longer served — desktop/tablet/phone.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { atlasBridgeState, openDornhainAtlas3d } from './helpers/atlas-host';

const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';

const VIEWPORTS = [
  { band: 'desktop', width: 1280, height: 800 },
  { band: 'tablet', width: 820, height: 1180 },
  { band: 'phone', width: 390, height: 844 },
] as const;

test.describe('ATL2-H01 atlas cleanup', () => {
  test('self-test PASS (one renderer / writer, quarantine, no legacy bundle paths)', () => {
    const out = execFileSync(process.execPath, [join(process.cwd(), 'scripts/atl2-h01-cleanup.self-test.mjs')], {
      encoding: 'utf8',
    });
    expect(out).toContain('atl2-h01-cleanup self-test: PASS');
  });

  for (const vp of VIEWPORTS) {
    test(`browser-host: single Custom-WebGL renderer + single tool chrome (${vp.band})`, async ({ page }) => {
      test.skip(!HOST, 'requires browser-e2e-with-host');
      test.setTimeout(180_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openDornhainAtlas3d(page);

      // 3D surface: exactly one productive host + runtime, no Three inventory, no 2D rail.
      await expect(page.locator('[data-atlas-native-3d-host]')).toHaveCount(1);
      await expect(page.locator('[data-atlas-native-3d]')).toHaveCount(1);
      // Controlled (generator_meta SoT, no localStorage world state) on the wrapper and its host.
      await expect(page.locator('[data-atlas-native-3d][data-atlas-controlled="true"]')).toHaveCount(1);
      await expect(page.locator('[data-atlas-native-3d-host][data-atlas-controlled="true"]')).toHaveCount(1);
      await expect(page.locator('[data-atlas-spatial-viewport]')).toHaveCount(0);
      await expect(page.locator('[data-atlas-tool-rail]')).toHaveCount(0);
      await expect(page.locator('[data-atlas-panel-fold="tools"]')).toHaveCount(1);
      expect((await atlasBridgeState(page))?.mode).toBe('webgl');

      // 2D surface (Draufsicht): one tool rail, 3D runtime unmounted — no parallel renderer.
      await page.locator('[data-atlas-surface-toggle]').first().click();
      await expect(page.locator('[data-atlas-surface-mode="2d"]').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-atlas-tool-rail]')).toHaveCount(1);
      await expect(page.locator('[data-atlas-native-3d]')).toHaveCount(0);
      await expect(page.locator('[data-atlas-native-3d-host]')).toHaveCount(0);
      await expect(page.locator('[data-atlas-spatial-viewport]')).toHaveCount(0);
    });
  }

  test('browser-host: legacy HTML prototype is not served from the product bundle', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    const res = await page.request.get('/atlas-prototype-3d.html');
    const body = await res.text();
    expect(body).not.toContain('Unified 3D Atlas · Embedded');
  });
});
