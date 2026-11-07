/**
 * CUT-20 Browser E2E — mock Host `/api/v1/library/*` instead of PostgREST.
 * Location: e2e/helpers/host-route-mocks.ts
 */
import type { Page, Route } from '@playwright/test';

export const E2E_HOST_USER_ID = '00000000-0000-4000-8000-000000000001';

export type HostMockProject = {
  readonly id: string;
  readonly publicId?: string;
  readonly code?: string;
  readonly name: string;
  readonly description?: string | null;
  readonly gmUserId: string;
  readonly status?: string;
  readonly memberCount?: number;
  readonly sessionCount?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type HostMockCharacter = {
  readonly id: string;
  readonly publicId?: string;
  readonly name: string;
  readonly description?: string;
  readonly class?: string;
  readonly race?: string;
  readonly level?: number;
  readonly portraitUrl?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

function json(route: Route, value: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });
}

/** No-op ensure-starter so mocks are not raced by Dornhain provisioning. */
export async function stubHostEnsureStarter(page: Page): Promise<void> {
  await page.route('**/api/v1/projects/ensure-starter**', async (route) => {
    if (route.request().method() === 'POST') {
      await json(route, { ok: true });
      return;
    }
    await route.fallback();
  });
}

export async function mockHostLibraryProjects(
  page: Page,
  projects: readonly HostMockProject[],
): Promise<void> {
  await stubHostEnsureStarter(page);
  await page.route('**/api/v1/library/projects**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await json(route, { projects });
  });
}

export async function mockHostLibraryCharacters(
  page: Page,
  characters: readonly HostMockCharacter[],
): Promise<void> {
  await page.route('**/api/v1/library/characters**', async (route) => {
    const url = route.request().url();
    // Detail GET /characters/:id — leave to host unless exact list.
    if (/\/api\/v1\/library\/characters\/[^/?]+/.test(url) && !url.includes('?')) {
      await route.fallback();
      return;
    }
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await json(route, { characters });
  });
}

export async function mockHostLibraryWorlds(
  page: Page,
  worlds: readonly { id: string; title: string; createdAt: string; publicId?: string | null }[],
): Promise<void> {
  await page.route('**/api/v1/library/worlds**', async (route) => {
    const url = route.request().url();
    if (/\/api\/v1\/library\/worlds\/[^/?]+/.test(url)) {
      await route.fallback();
      return;
    }
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await json(route, { worlds });
  });
}

export const MOCK_ADVENTURE_PROJECTS: readonly HostMockProject[] = [
  {
    id: 'proj-1',
    publicId: 'SA-K7M4Q',
    code: 'ABCD12',
    name: 'Das vergessene Königreich',
    description: 'Eine Kampagne um einen versunkenen Thron.',
    gmUserId: E2E_HOST_USER_ID,
    status: 'active',
    memberCount: 2,
    sessionCount: 0,
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
  },
  {
    id: 'proj-2',
    publicId: 'SA-X8D4Q',
    code: 'EFGH34',
    name: 'Schatten über Nehren',
    description: null,
    gmUserId: 'other-user',
    status: 'paused',
    memberCount: 1,
    sessionCount: 0,
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
  },
];

export const MOCK_LIBRARY_CHARACTERS: readonly HostMockCharacter[] = [
  {
    id: 'char-1',
    name: 'Kara Sturmklinge',
    description: undefined,
    class: 'Wanderer',
    race: 'Mensch',
    level: 3,
    portraitUrl: 'http://localhost:3004/test-assets/portrait-kara.png',
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
  },
  {
    id: 'char-2',
    name: 'Bror Steinfuss',
    class: 'Schmied',
    race: 'Zwerg',
    level: 1,
    portraitUrl: null,
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
  },
];
