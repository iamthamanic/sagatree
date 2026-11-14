/**
 * rulebook-host — load domains/rulebook host-runtime bundle (AIB-04).
 * Location: server/src/modules/ai/internal/rulebook-host.ts
 *
 * Prefers the packaged copy under server/src/modules/ai/internal/generated/
 * (shipped by Dockerfile.host). Falls back to repo domains/generated for monorepo runs.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type HostRulebookSearchHit = {
  sectionId: string;
  title: string;
  number: string | null;
  normativity: string;
  score: number;
  snippet: string;
  source: { path: string; startLine: number; endLine: number };
};

export type HostRulebookIndex = {
  manifest: {
    rulesetId: string;
    schemaVersion: number;
    revisionHash: string;
    sourcePath: string;
    sectionCount: number;
  };
  sections: readonly unknown[];
};

export type RulebookHostApi = {
  readonly getSagaTreeCoreRulebookIndex: () => HostRulebookIndex;
  readonly searchRulebook: (
    index: HostRulebookIndex,
    query: string,
    options?: { limit?: number },
  ) => HostRulebookSearchHit[];
  readonly evidenceGate: (hits: readonly HostRulebookSearchHit[]) =>
    | { ok: true; hits: readonly HostRulebookSearchHit[] }
    | { ok: false; reason: 'no-evidence' };
  readonly extractClaimedCitationIds: (answerText: string) => string[];
  readonly validateCitations: (input: {
    readonly retrievedSectionIds: readonly string[];
    readonly claimedSectionIds: readonly string[];
    readonly pinnedIndexRevision: string;
    readonly responseIndexRevision: string | null | undefined;
    readonly hitMeta?: ReadonlyMap<string, { title: string; number: string | null }>;
  }) => {
    readonly accepted: readonly {
      sectionId: string;
      title?: string;
      number?: string | null;
    }[];
    readonly dropped: readonly string[];
    readonly indexRevisionMatch: boolean;
  };
  readonly formatEvidenceForPrompt: (
    hits: readonly HostRulebookSearchHit[],
    indexRevision: string,
    limit?: number,
  ) => string;
};

let cachedApi: RulebookHostApi | null = null;

function resolveHostRuntimePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const packaged = join(here, 'generated', 'host-runtime.mjs');
  if (existsSync(packaged)) return packaged;
  // Monorepo / worktree fallback when build-rulebook-index has not packaged yet.
  return join(here, '../../../../../src/domains/rulebook/generated/host-runtime.mjs');
}

/** Lazy-load the committed domains/rulebook host runtime. */
export async function loadRulebookHostApi(
  runtimePath: string = resolveHostRuntimePath(),
): Promise<RulebookHostApi> {
  if (cachedApi) return cachedApi;
  const mod = (await import(pathToFileURL(runtimePath).href)) as RulebookHostApi;
  if (typeof mod.getSagaTreeCoreRulebookIndex !== 'function') {
    throw new Error('host-runtime missing getSagaTreeCoreRulebookIndex');
  }
  if (typeof mod.searchRulebook !== 'function') {
    throw new Error('host-runtime missing searchRulebook');
  }
  cachedApi = mod;
  return mod;
}

export function resetRulebookHostApiCache(): void {
  cachedApi = null;
}
