import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.ATLAS_ISOLATED_FRONTEND_URL;
if (!baseURL || !process.env.ATLAS_ISOLATED_FIXTURE) throw new Error('Run product-run.mjs to provision the required isolated real services');

export default defineConfig({
  testDir: here,
  testMatch: 'atlas-product.spec.ts',
  outputDir: process.env.ATLAS_ISOLATED_EVIDENCE,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: join(process.env.ATLAS_ISOLATED_EVIDENCE!, 'playwright-report.json') }]],
  use: {
    ...devices['Desktop Chrome'], baseURL,
    actionTimeout: 15_000, navigationTimeout: 30_000,
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.ATLAS_ISOLATED_CHROMIUM ? { executablePath: process.env.ATLAS_ISOLATED_CHROMIUM } : {}),
      args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${new URL(baseURL).port} --strictPort`,
    cwd: join(here, '../..'), url: baseURL, reuseExistingServer: false, timeout: 120_000,
  },
});
