#!/usr/bin/env node
/**
 * architecture-boundary-check — Enforces Modular Monolith layer import rules (#94),
 * eradicated legacy roots (#175), cross-area public APIs, and src/ code-root allowlist.
 * Location: scripts/architecture-boundary-check.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const srcRoot = join(root, 'src');
const DEFAULT_LEGACY_BASELINE = join(root, '.qa/architecture/legacy-freeze-baseline.json');

/** Source extensions counted as legacy freeze paths (not vendor/build). */
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;

/**
 * Directories under src/ that may contain feature/product TypeScript.
 * Anything else with .ts/.tsx is a dumping-ground violation.
 */
export const ALLOWED_SRC_CODE_ROOTS = new Set([
  'domains',
  'infrastructure',
  'app',
  'shared',
  'lib',
  'utils',
  'supabase',
  'assets',
  'styles',
]);

/** Composition-root TS/JS files allowed directly under src/ (not feature dumping). */
export const ALLOWED_SRC_TOP_LEVEL_FILES = new Set(['App.tsx', 'main.tsx']);

/**
 * Registered non-src host package roots (Epic #773 modular monolith).
 * Presence is required; layout rules apply once TypeScript appears under them.
 * See docs/architecture/host-modular-monolith.md.
 */
export const REGISTERED_HOST_PACKAGE_ROOTS = new Set(['server']);

/**
 * Composition entries that may wire private module constructors once at start.
 * Documented in docs/architecture/host-modular-monolith.md §3 / §7.
 * Do NOT blanket-allow all of server/src/http/**.
 */
export const SERVER_COMPOSITION_ENTRY_RELS = [
  /^server\/src\/bootstrap\//,
  /^server\/src\/http\/route-registry(?:\.[cm]?[jt]sx?)?$/,
];

const SERVER_MODULE_PATH_RE = /^server\/src\/modules\/([^/]+)(?:\/(.*))?$/;
const SERVER_PRIVATE_SEGMENT_RE = /(?:^|\/)(?:internal|persistence)(?:\/|$)/;

const IMPORT_PATH_RULES = {
  domains: [
    { label: 'React', test: (p) => /^react(?:\/|$)/.test(p) },
    { label: 'React DOM', test: (p) => p.startsWith('react-dom') },
    { label: 'UI components', test: (p) => p.includes('/components/') },
    { label: 'Shared UI', test: (p) => /(?:^|\/)shared\/ui(?:\/|$)/.test(p) || p.includes('@/shared/ui') },
    { label: 'App slices', test: (p) => p.includes('/app/') },
    { label: 'Supabase client', test: (p) => p.includes('supabase') },
    { label: 'Infrastructure internals', test: (p) => p.includes('/infrastructure/') },
  ],
  'domains/rules': [
    { label: 'React', test: (p) => /^react(?:\/|$)/.test(p) },
    { label: 'React DOM', test: (p) => p.startsWith('react-dom') },
    { label: 'UI components', test: (p) => p.includes('/components/') },
    { label: 'Shared UI', test: (p) => /(?:^|\/)shared\/ui(?:\/|$)/.test(p) || p.includes('@/shared/ui') },
    { label: 'App slices', test: (p) => p.includes('/app/') },
    { label: 'Supabase client', test: (p) => p.includes('supabase') },
    { label: 'Infrastructure internals', test: (p) => p.includes('/infrastructure/') },
    { label: 'Character module legacy', test: (p) => p.includes('/modules/characters/') },
  ],
  infrastructure: [
    { label: 'React', test: (p) => /^react(?:\/|$)/.test(p) },
    { label: 'App slices', test: (p) => p.includes('/app/') },
    { label: 'Shared UI', test: (p) => /(?:^|\/)shared\/ui(?:\/|$)/.test(p) || p.includes('@/shared/ui') },
    { label: 'UI components folder', test: (p) => p.includes('/components/') },
  ],
  app: [
    { label: 'Supabase client', test: (p) => p.includes('supabase') },
    { label: 'Supabase lib', test: (p) => /(?:^|\/)lib\/supabase(?:\.|$)/.test(p) },
  ],
  'shared/ui': [
    { label: 'Domain layer', test: (p) => p.includes('/domains/') },
    { label: 'Infrastructure layer', test: (p) => p.includes('/infrastructure/') },
    { label: 'App slices', test: (p) => p.includes('/app/') },
    { label: 'Legacy rules modules', test: (p) => p.includes('/modules/rulesets/') },
    { label: 'Legacy character modules', test: (p) => p.includes('/modules/characters/') },
  ],
};

const CHARACTER_SLICE_PUBLIC = {
  edit: new Set(['creation', 'progression', 'shared']),
  creation: new Set(['shared', 'progression']),
  progression: new Set(['shared']),
};

export function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) acc.push(full);
  }
  return acc;
}

export function extractImportPaths(content) {
  const paths = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Static template literals only (no ${...} interpolation).
    /\bimport\s*\(\s*`([^`${]*)`\s*\)/g,
    // CommonJS / createRequire bypasses for package specs.
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bcreateRequire\s*\([^)]*\)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      paths.add(match[1]);
    }
  }

  return [...paths];
}

/** Strip // and /* *\/ comments so proof tokens cannot hide in comments. */
export function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function resolveRelativeImport(filePath, importPath) {
  if (!importPath.startsWith('.')) return importPath.replace(/\\/g, '/');

  const absolute = normalize(join(dirname(filePath), importPath)).replace(/\\/g, '/');
  const srcMarker = '/src/';
  const srcIndex = absolute.indexOf(srcMarker);
  if (srcIndex >= 0) return absolute.slice(srcIndex + srcMarker.length);

  const bareSrcIndex = absolute.indexOf('src/');
  if (bareSrcIndex >= 0) return absolute.slice(bareSrcIndex + 'src/'.length);

  return absolute.replace(/^\/+/, '');
}

/**
 * Resolve relative (./) and Vite/TS alias (@/) imports to a path under src/.
 * Example: `@/app/project/hooks/useProjects` → `app/project/hooks/useProjects`
 */
export function resolveSrcImport(filePath, importPath) {
  const normalized = importPath.replace(/\\/g, '/');
  if (normalized.startsWith('@/')) {
    return normalized.slice(2).replace(/\.tsx?$/, '');
  }
  if (normalized.startsWith('.')) {
    return resolveRelativeImport(filePath, normalized).replace(/\.tsx?$/, '');
  }
  return normalized.replace(/\.tsx?$/, '');
}

export function getCharacterSliceFromPath(normalizedPath) {
  const match = normalizedPath.replace(/\\/g, '/').match(/app\/character\/(edit|creation|progression)(?:\/|$)/);
  return match?.[1];
}

function getCharacterSliceFromResolvedImport(resolvedImportPath) {
  const match = resolvedImportPath.match(/^app\/character\/(edit|creation|progression|shared)(?:\/|$)/);
  return match?.[1];
}

function isSlicePublicBarrel(resolvedImportPath, targetSlice) {
  const barrelPattern = new RegExp(`^app/character/${targetSlice}(?:/index(?:\\.ts)?)?$`);
  return barrelPattern.test(resolvedImportPath.replace(/\\/g, '/'));
}

export function checkCharacterCrossSliceImports(filePath, content) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fromSlice = getCharacterSliceFromPath(normalizedPath);
  if (!fromSlice) return [];
  // Slice public barrels may re-export own-slice + shared internals; other slices
  // still require an allowed public barrel (no private cross-slice re-export).

  const displayPath = normalizedPath.includes('/src/')
    ? normalizedPath.slice(normalizedPath.indexOf('src/'))
    : normalizedPath.includes('src/')
      ? normalizedPath.slice(normalizedPath.indexOf('src/'))
      : normalizedPath;

  const violations = [];
  for (const importPath of extractImportPaths(content)) {
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;

    const resolved = resolveSrcImport(filePath, importPath);
    const targetSlice = getCharacterSliceFromResolvedImport(resolved);
    if (!targetSlice || targetSlice === 'shared' || targetSlice === fromSlice) continue;

    const publicAllowed = CHARACTER_SLICE_PUBLIC[fromSlice]?.has(targetSlice) ?? false;
    const isPublicBarrel = isSlicePublicBarrel(resolved, targetSlice);

    if (isPublicBarrel && publicAllowed) continue;

    violations.push({
      file: displayPath,
      rule: isPublicBarrel
        ? `non-public cross-slice import (${fromSlice} → ${importPath})`
        : `private cross-slice import (${fromSlice} → ${importPath})`,
      scope: 'app/character',
    });
  }

  return violations;
}

export function getAppAreaFromPath(normalizedPath) {
  const match = normalizedPath.replace(/\\/g, '/').match(/(?:^|\/)app\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
}

export function isAppAreaPublicApi(resolvedImportPath, targetArea) {
  const normalized = resolvedImportPath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
  return normalized === `app/${targetArea}` || normalized === `app/${targetArea}/index`;
}

/** Composition-root mount entry for heavy screens (kept off the light public barrel). */
export function isAppAreaRootEntry(resolvedImportPath, targetArea) {
  const normalized = resolvedImportPath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
  return normalized === `app/${targetArea}/root`;
}

export function isAppAreaCompositionEntry(resolvedImportPath, targetArea) {
  return isAppAreaPublicApi(resolvedImportPath, targetArea) || isAppAreaRootEntry(resolvedImportPath, targetArea);
}

export function isSrcCompositionRootFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return /(?:^|\/)src\/(?:App|main)\.tsx?$/.test(normalized);
}

/**
 * Composition root (src/App.tsx, src/main.tsx) may only reach app areas via
 * `app/<area>` public barrels or `app/<area>/root` screen entries.
 */
export function checkCompositionRootImports(filePath, content) {
  if (!isSrcCompositionRootFile(filePath)) return [];

  const normalizedPath = filePath.replace(/\\/g, '/');
  const displayPath = normalizedPath.includes('/src/')
    ? normalizedPath.slice(normalizedPath.indexOf('src/'))
    : normalizedPath.includes('src/')
      ? normalizedPath.slice(normalizedPath.indexOf('src/'))
      : normalizedPath;

  const violations = [];
  for (const importPath of extractImportPaths(content)) {
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;

    const resolved = resolveSrcImport(filePath, importPath);
    if (!resolved.startsWith('app/')) continue;

    const resolvedArea = resolved.match(/^app\/([^/]+)/)?.[1];
    if (!resolvedArea) continue;
    if (isAppAreaCompositionEntry(resolved, resolvedArea)) continue;

    violations.push({
      file: displayPath,
      rule: `composition root private app import (${importPath}; use app/${resolvedArea} or app/${resolvedArea}/root)`,
      scope: 'composition-root',
    });
  }

  return violations;
}

/**
 * `app/<area>/root` is reserved for the composition root — other files must use
 * the area public barrel (or stay inside the same area without using /root).
 */
export function checkAppRootEntryConsumers(filePath, content) {
  if (isSrcCompositionRootFile(filePath)) return [];

  const normalizedPath = filePath.replace(/\\/g, '/');
  const displayPath = normalizedPath.includes('/src/')
    ? normalizedPath.slice(normalizedPath.indexOf('src/'))
    : normalizedPath.includes('src/')
      ? normalizedPath.slice(normalizedPath.indexOf('src/'))
      : normalizedPath;

  // Area root.ts itself re-exports internals — allow.
  if (/\/app\/[^/]+\/root\.tsx?$/.test(normalizedPath)) return [];

  const violations = [];
  for (const importPath of extractImportPaths(content)) {
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;

    const resolved = resolveSrcImport(filePath, importPath);
    const match = resolved.match(/^app\/([^/]+)\/root$/);
    if (!match) continue;

    violations.push({
      file: displayPath,
      rule: `app/${match[1]}/root is composition-root only (${importPath})`,
      scope: 'composition-root',
    });
  }

  return violations;
}

/**
 * Cross-area rule: app/<areaA> may only import app/<areaB> via that area's public barrel
 * (`app/<areaB>` or `app/<areaB>/index`). Private nested paths are forbidden.
 * Area public barrels (`app/<area>/index.ts`) may re-export **own-area** internals only;
 * they must still use other areas' public barrels (no private cross-area re-export).
 * Relative and `@/` alias imports are both checked.
 */
export function checkAppCrossAreaImports(filePath, content) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fromArea = getAppAreaFromPath(normalizedPath);
  if (!fromArea) return [];

  const displayPath = normalizedPath.includes('/src/')
    ? normalizedPath.slice(normalizedPath.indexOf('src/'))
    : normalizedPath.includes('src/')
      ? normalizedPath.slice(normalizedPath.indexOf('src/'))
      : normalizedPath;

  const violations = [];
  for (const importPath of extractImportPaths(content)) {
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;

    const resolved = resolveSrcImport(filePath, importPath);
    const resolvedArea = resolved.match(/^app\/([^/]+)/)?.[1];
    if (!resolvedArea || resolvedArea === fromArea) continue;
    if (isAppAreaPublicApi(resolved, resolvedArea)) continue;

    violations.push({
      file: displayPath,
      rule: `private cross-area import (${fromArea} → ${importPath}; use app/${resolvedArea} public barrel)`,
      scope: 'app-cross-area',
    });
  }

  return violations;
}

function directoryContainsSource(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (directoryContainsSource(full)) return true;
        continue;
      }
      if (SOURCE_EXT.test(entry)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Resolve a host (server/) import to a repo-relative path under server/ when possible.
 * Supports relative imports and documented aliases `#server/` and bare `server/`.
 * `@/` maps to frontend src/ and is intentionally ignored here.
 */
export function resolveServerImport(fromRelPath, importPath, rootDir = root) {
  const normalized = importPath.replace(/\\/g, '/');
  const fromAbs = join(rootDir, fromRelPath);

  let candidate;
  if (normalized.startsWith('.')) {
    candidate = normalize(join(dirname(fromAbs), normalized)).replace(/\\/g, '/');
  } else if (normalized.startsWith('#server/')) {
    candidate = join(rootDir, 'server', normalized.slice('#server/'.length)).replace(/\\/g, '/');
  } else if (normalized.startsWith('server/')) {
    candidate = join(rootDir, normalized).replace(/\\/g, '/');
  } else if (normalized.startsWith('@/')) {
    return null;
  } else {
    return null;
  }

  const rootNorm = rootDir.replace(/\\/g, '/').replace(/\/$/, '');
  let rel = candidate.startsWith(`${rootNorm}/`)
    ? candidate.slice(rootNorm.length + 1)
    : candidate.replace(/^\/+/, '');
  rel = rel.replace(/\\/g, '/').replace(/\.(?:js|jsx|mjs|cjs|ts|tsx)$/, '');

  if (!SOURCE_EXT.test(candidate)) {
    const base = join(rootDir, rel);
    for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.jsx', '/index.ts', '/index.js']) {
      const tryPath = base + ext;
      if (existsSync(tryPath)) {
        return relative(rootDir, tryPath).replace(/\\/g, '/').replace(/\.(?:js|jsx|mjs|cjs|ts|tsx)$/, '');
      }
    }
  }
  return rel;
}

/** Module id for a repo-relative server path, or null if outside modules/. */
export function getServerModuleId(relPath) {
  const match = relPath.replace(/\\/g, '/').match(SERVER_MODULE_PATH_RE);
  return match?.[1] ?? null;
}

/** True when the resolved path points at a module's private internal/persistence tree. */
export function isServerModulePrivatePath(relPath) {
  const match = relPath.replace(/\\/g, '/').match(SERVER_MODULE_PATH_RE);
  if (!match) return false;
  const rest = match[2] ?? '';
  return SERVER_PRIVATE_SEGMENT_RE.test(rest);
}

/** True when the path is a module public barrel (…/modules/<id> or …/index). */
export function isServerModulePublicBarrel(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/\.(?:js|jsx|mjs|cjs|ts|tsx)$/, '');
  return /^server\/src\/modules\/[^/]+(?:\/index)?$/.test(normalized);
}

export function isServerCompositionEntry(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return SERVER_COMPOSITION_ENTRY_RELS.some((re) => re.test(normalized));
}

/**
 * Detect cycles in a directed adjacency map (module id → Set of imported module ids).
 */
export function findDirectedCycles(adjacency) {
  const nodes = [...adjacency.keys()].sort();
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function dfs(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      if (start >= 0) cycles.push([...stack.slice(start), node]);
      return;
    }
    visiting.add(node);
    stack.push(node);
    for (const child of [...(adjacency.get(node) ?? [])].sort()) dfs(child);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of nodes) dfs(node);
  return cycles;
}

const DEFAULT_HOST_DRIZZLE_EXCEPTIONS = join(
  root,
  '.qa/architecture/host-drizzle-exceptions.json',
);

/** Glob-ish match: `*` = one path segment, `**` = any depth (including empty). */
export function matchPathPattern(path, pattern) {
  const norm = path.replace(/\\/g, '/');
  const escaped = pattern
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => {
      if (seg === '**') return '§DS§';
      if (seg === '*') return '§SS§';
      return seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/')
    .replace(/\/?§DS§/g, '(?:/.*)?')
    .replace(/§SS§/g, '[^/]+');
  // Leading ** without slash: allow prefix-less match
  const body = escaped.startsWith('(?:/.*)?') ? escaped.replace(/^\(\?:\/\.\*\)\?/, '(?:.*)?') : escaped;
  return new RegExp(`^${body}$`).test(norm);
}

export function loadHostDrizzleExceptions(path = DEFAULT_HOST_DRIZZLE_EXCEPTIONS) {
  if (!existsSync(path)) {
    return { missing: true, config: null, path };
  }
  const config = JSON.parse(readFileSync(path, 'utf8'));
  return { missing: false, config, path };
}

function isNodeSqliteImport(spec) {
  return spec === 'node:sqlite' || spec.startsWith('node:sqlite/');
}

function isDrizzleOrmImport(spec) {
  return spec === 'drizzle-orm' || spec.startsWith('drizzle-orm/');
}

/**
 * GATE-01 CI guard (#1044): ban raw node:sqlite / drizzle-orm imports outside
 * documented allowlists; require real HostDatabase Drizzle wiring.
 */
export function checkHostDrizzlePersistenceBoundaries(rootDir = root, options = {}) {
  const violations = [];
  const exceptionsPath =
    options.exceptionsPath ?? join(rootDir, '.qa/architecture/host-drizzle-exceptions.json');
  const loaded = loadHostDrizzleExceptions(exceptionsPath);
  if (loaded.missing || !loaded.config) {
    violations.push({
      file: relative(rootDir, exceptionsPath).replace(/\\/g, '/') || exceptionsPath,
      rule: 'missing host drizzle exceptions policy (.qa/architecture/host-drizzle-exceptions.json)',
      scope: 'host-drizzle-boundary',
    });
    return violations;
  }
  const config = loaded.config;
  const allowNode = config.nodeSqliteImportAllow ?? [];
  const allowDrizzle = config.drizzleOrmImportAllow ?? [];
  const forbiddenZones = config.forbiddenImportZones ?? [];
  const proof = config.requiredRuntimeProof;
  if (!proof || typeof proof !== 'object') {
    violations.push({
      file: relative(rootDir, exceptionsPath).replace(/\\/g, '/') || exceptionsPath,
      rule: 'requiredRuntimeProof missing from host drizzle exceptions policy (fail-closed)',
      scope: 'host-drizzle-boundary',
    });
    return violations;
  }
  if (
    typeof proof.serverPackageDependency !== 'string' ||
    typeof proof.hostDrizzleModule !== 'string' ||
    !Array.isArray(proof.mustContainImports) ||
    !Array.isArray(proof.mustContainExports)
  ) {
    violations.push({
      file: relative(rootDir, exceptionsPath).replace(/\\/g, '/') || exceptionsPath,
      rule: 'requiredRuntimeProof incomplete (need serverPackageDependency, hostDrizzleModule, mustContainImports, mustContainExports)',
      scope: 'host-drizzle-boundary',
    });
    return violations;
  }

  const serverPkgPath = join(rootDir, 'server', 'package.json');
  if (!existsSync(serverPkgPath)) {
    violations.push({
      file: 'server/package.json',
      rule: 'server package.json missing — cannot prove drizzle-orm runtime dependency',
      scope: 'host-drizzle-boundary',
    });
  } else {
    const pkg = JSON.parse(readFileSync(serverPkgPath, 'utf8'));
    const depName = proof.serverPackageDependency;
    // Production runtime only — omit=dev installs must still have the ORM.
    if (!pkg.dependencies?.[depName]) {
      violations.push({
        file: 'server/package.json',
        rule: `missing runtime dependency ${depName} in dependencies (not only devDependencies)`,
        scope: 'host-drizzle-boundary',
      });
    }
  }

  const hostDrizzleRel = proof.hostDrizzleModule;
  const hostDrizzleAbs = join(rootDir, hostDrizzleRel);
  if (!existsSync(hostDrizzleAbs)) {
    violations.push({
      file: hostDrizzleRel,
      rule: 'missing HostDatabase Drizzle module — product adapters lack real ORM wiring',
      scope: 'host-drizzle-boundary',
    });
  } else {
    const code = stripJsComments(readFileSync(hostDrizzleAbs, 'utf8'));
    const importSpecs = extractImportPaths(code);
    for (const needle of proof.mustContainImports) {
      if (!importSpecs.some((spec) => spec === needle || spec.startsWith(`${needle}/`))) {
        violations.push({
          file: hostDrizzleRel,
          rule: `HostDatabase module missing required import: ${needle}`,
          scope: 'host-drizzle-boundary',
        });
      }
    }
    for (const needle of proof.mustContainExports) {
      const exportRe = new RegExp(
        String.raw`\b(?:export\s+(?:async\s+)?function\s+${needle}\b|export\s*\{[^}]*\b${needle}\b)`,
      );
      if (!exportRe.test(code)) {
        violations.push({
          file: hostDrizzleRel,
          rule: `HostDatabase module missing required export: ${needle}`,
          scope: 'host-drizzle-boundary',
        });
      }
    }
  }

  const scanRoots = [join(rootDir, 'server', 'src')];
  for (const name of ALLOWED_SRC_CODE_ROOTS) {
    const abs = join(rootDir, 'src', name);
    if (existsSync(abs)) scanRoots.push(abs);
  }

  for (const scanRoot of scanRoots) {
    for (const file of walkFiles(scanRoot).filter((f) => SOURCE_EXT.test(f))) {
      const rel = relative(rootDir, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const importPath of extractImportPaths(content)) {
        const isSqlite = isNodeSqliteImport(importPath);
        const isDrizzle = isDrizzleOrmImport(importPath);
        if (!isSqlite && !isDrizzle) continue;

        const inForbidden = forbiddenZones.some((pat) => matchPathPattern(rel, pat));
        if (inForbidden) {
          violations.push({
            file: rel,
            rule: `forbidden ${isSqlite ? 'node:sqlite' : 'drizzle-orm'} import in zone (${importPath})`,
            scope: 'host-drizzle-boundary',
          });
          continue;
        }

        if (isSqlite) {
          const allowed = allowNode.some((pat) => matchPathPattern(rel, pat));
          if (!allowed) {
            violations.push({
              file: rel,
              rule: `node:sqlite / DatabaseSync import outside documented exceptions (${importPath})`,
              scope: 'host-drizzle-boundary',
            });
          }
        }

        if (isDrizzle) {
          const allowed = allowDrizzle.some((pat) => matchPathPattern(rel, pat));
          if (!allowed) {
            violations.push({
              file: rel,
              rule: `drizzle-orm import outside owning persistence/repository allowlist (${importPath})`,
              scope: 'host-drizzle-boundary',
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Ensure registered host package roots exist and enforce modular-monolith
 * import rules once server/src TypeScript is present.
 * Module-boundary checks are ADDITIONAL to ORM/client import bans (#1044).
 */
export function checkRegisteredHostPackages(rootDir = root) {
  const violations = [];
  for (const name of REGISTERED_HOST_PACKAGE_ROOTS) {
    const abs = join(rootDir, name);
    if (!existsSync(abs)) {
      violations.push({
        file: name,
        rule: 'registered host package root missing (host modular monolith)',
        scope: 'host-package-registry',
      });
      continue;
    }
    const readme = join(abs, 'README.md');
    if (!existsSync(readme)) {
      violations.push({
        file: `${name}/README.md`,
        rule: 'registered host package requires README anchoring the module contract',
        scope: 'host-package-registry',
      });
    } else {
      const text = readFileSync(readme, 'utf8');
      if (!text.includes('host-modular-monolith')) {
        violations.push({
          file: `${name}/README.md`,
          rule: 'host package README must reference docs/architecture/host-modular-monolith.md',
          scope: 'host-package-registry',
        });
      }
    }
  }

  const serverSrc = join(rootDir, 'server', 'src');
  if (!existsSync(serverSrc)) return violations;

  const serverFiles = walkFiles(serverSrc).filter((file) => SOURCE_EXT.test(file));
  /** @type {Map<string, Set<string>>} */
  const moduleDeps = new Map();

  for (const file of serverFiles) {
    const rel = relative(rootDir, file).replace(/\\/g, '/');
    const content = readFileSync(file, 'utf8');
    const fromModule = getServerModuleId(rel);
    if (fromModule && !moduleDeps.has(fromModule)) moduleDeps.set(fromModule, new Set());

    for (const importPath of extractImportPaths(content)) {
      const resolved = resolveServerImport(rel, importPath, rootDir);
      if (!resolved || !resolved.startsWith('server/')) continue;

      const targetModule = getServerModuleId(resolved);
      const targetPrivate = isServerModulePrivatePath(resolved);
      const composition = isServerCompositionEntry(rel);

      if (targetPrivate) {
        const sameModule = Boolean(fromModule && targetModule && fromModule === targetModule);
        if (sameModule || composition) continue;
        violations.push({
          file: rel,
          rule: targetModule && fromModule && targetModule !== fromModule
            ? `module ${fromModule} imports private path of ${targetModule} (${importPath} → ${resolved})`
            : `forbidden private module import (${importPath} → ${resolved})`,
          scope: 'host-module-boundary',
        });
        continue;
      }

      if (fromModule && targetModule && fromModule !== targetModule) {
        moduleDeps.get(fromModule).add(targetModule);
      }
    }
  }

  for (const cycle of findDirectedCycles(moduleDeps)) {
    violations.push({
      file: `server/src/modules/${cycle[0]}`,
      rule: `forbidden module dependency cycle: ${cycle.join(' → ')}`,
      scope: 'host-module-boundary',
    });
  }

  return violations;
}

/**
 * Reject unknown src/* dumping grounds: non-allowlisted directories with TS/JS,
 * and non-allowlisted top-level source files (e.g. src/NewCharacterService.ts).
 */
export function checkAllowedSrcCodeRoots(rootDir = root) {
  const srcDir = join(rootDir, 'src');
  if (!existsSync(srcDir)) return [];

  const violations = [];
  for (const entry of readdirSync(srcDir)) {
    const full = join(srcDir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (ALLOWED_SRC_CODE_ROOTS.has(entry)) continue;
      if (!directoryContainsSource(full)) continue;
      violations.push({
        file: `src/${entry}`,
        rule: 'unknown feature code root (not in #94 allowlist)',
        scope: 'src-root-allowlist',
      });
      continue;
    }
    if (!SOURCE_EXT.test(entry)) continue;
    if (ALLOWED_SRC_TOP_LEVEL_FILES.has(entry)) continue;
    violations.push({
      file: `src/${entry}`,
      rule: 'unknown top-level feature file (use domains|infrastructure|app|shared|lib)',
      scope: 'src-root-allowlist',
    });
  }
  return violations;
}

export function checkContentImportPaths(content, rules, scopeLabel, fileLabel = 'inline') {
  const violations = [];
  for (const importPath of extractImportPaths(content)) {
    for (const rule of rules) {
      if (rule.test(importPath)) {
        violations.push({ file: fileLabel, rule: rule.label, scope: scopeLabel });
        break;
      }
    }
  }
  return violations;
}

export function checkFileImportPaths(filePath, rules, scopeLabel, rootDir = root) {
  const content = readFileSync(filePath, 'utf8');
  const rel = relative(rootDir, filePath);
  return checkContentImportPaths(content, rules, scopeLabel, rel);
}

function collectUnder(subpath, baseSrc = srcRoot) {
  const dir = join(baseSrc, subpath);
  try {
    return walkFiles(dir);
  } catch {
    return [];
  }
}

/**
 * Rel paths under src/modules/** and src/components/** (fully eradicated after #175).
 * Any file under these roots is a hard failure — baseline deletions are historical only.
 */
export function collectLegacyFreezePaths(rootDir = root) {
  const paths = [];
  const modulesDir = join(rootDir, 'src', 'modules');
  const componentsDir = join(rootDir, 'src', 'components');

  if (existsSync(modulesDir)) {
    for (const file of walkFiles(modulesDir)) {
      if (!SOURCE_EXT.test(file)) continue;
      paths.push(relative(rootDir, file).replace(/\\/g, '/'));
    }
  }

  if (existsSync(componentsDir)) {
    for (const file of walkFiles(componentsDir)) {
      if (!SOURCE_EXT.test(file)) continue;
      paths.push(relative(rootDir, file).replace(/\\/g, '/'));
    }
  }

  return [...new Set(paths)].sort();
}

/** Hard fail if eradicated roots exist (even empty or with non-source files). */
export function checkEradicatedLegacyRoots(rootDir = root) {
  const violations = [];
  for (const rel of ['src/modules', 'src/components']) {
    const abs = join(rootDir, rel);
    if (existsSync(abs)) {
      violations.push({
        file: rel,
        rule: 'eradicated legacy root must not exist (#175)',
        scope: 'legacy-eradicate',
      });
    }
  }
  return violations;
}

export function loadLegacyFreezeBaseline(baselinePath = DEFAULT_LEGACY_BASELINE) {
  if (!existsSync(baselinePath)) {
    return { version: 0, paths: [], missing: true, path: baselinePath };
  }
  const raw = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const paths = Array.isArray(raw.paths) ? raw.paths.map((p) => String(p).replace(/\\/g, '/')) : [];
  return { version: raw.version ?? 1, paths: [...new Set(paths)].sort(), missing: false, path: baselinePath };
}

/**
 * New legacy paths vs baseline → violations. Deletions (baseline − current) are allowed.
 */
export function checkLegacyFreeze(currentPaths, baselinePaths) {
  const allowed = new Set(baselinePaths);
  const violations = [];
  for (const file of currentPaths) {
    if (!allowed.has(file)) {
      violations.push({
        file,
        rule: 'new legacy path (not in freeze baseline)',
        scope: 'legacy-freeze',
      });
    }
  }
  return violations;
}

export function runArchitectureBoundaryCheck(options = {}) {
  const rootDir = options.root ?? root;
  const src = options.srcRoot ?? join(rootDir, 'src');
  const baselinePath = options.legacyBaselinePath ?? join(rootDir, '.qa/architecture/legacy-freeze-baseline.json');
  const skipLegacyFreeze = options.skipLegacyFreeze === true;

  const domainFiles = collectUnder('domains', src);
  const rulesFiles = domainFiles.filter((file) => file.includes('domains/rules/'));
  const nonRulesDomainFiles = domainFiles.filter((file) => !file.includes('domains/rules/'));
  const infrastructureFiles = collectUnder('infrastructure', src);
  const appFiles = collectUnder('app', src);
  const sharedUiFiles = collectUnder('shared/ui', src);

  const violations = [
    ...nonRulesDomainFiles.flatMap((file) =>
      checkFileImportPaths(file, IMPORT_PATH_RULES.domains, 'domains', rootDir),
    ),
    ...rulesFiles.flatMap((file) =>
      checkFileImportPaths(file, IMPORT_PATH_RULES['domains/rules'], 'domains/rules', rootDir),
    ),
    ...infrastructureFiles.flatMap((file) =>
      checkFileImportPaths(file, IMPORT_PATH_RULES.infrastructure, 'infrastructure', rootDir),
    ),
    ...appFiles.flatMap((file) => checkFileImportPaths(file, IMPORT_PATH_RULES.app, 'app', rootDir)),
    ...sharedUiFiles.flatMap((file) =>
      checkFileImportPaths(file, IMPORT_PATH_RULES['shared/ui'], 'shared/ui', rootDir),
    ),
    ...appFiles.flatMap((file) => checkCharacterCrossSliceImports(file, readFileSync(file, 'utf8'))),
    ...appFiles.flatMap((file) => checkAppCrossAreaImports(file, readFileSync(file, 'utf8'))),
  ];

  const allSrcFiles = walkFiles(src);
  for (const file of allSrcFiles) {
    const content = readFileSync(file, 'utf8');
    violations.push(...checkAppRootEntryConsumers(file, content));
  }

  for (const compositionName of ['App.tsx', 'main.tsx']) {
    const compositionFile = join(src, compositionName);
    if (!existsSync(compositionFile)) continue;
    violations.push(...checkCompositionRootImports(compositionFile, readFileSync(compositionFile, 'utf8')));
  }

  let legacyCurrent = [];
  let legacyBaseline = [];
  let legacyRemoved = 0;

  violations.push(...checkRegisteredHostPackages(rootDir));
  violations.push(...checkHostDrizzlePersistenceBoundaries(rootDir));

  if (!skipLegacyFreeze) {
    violations.push(...checkEradicatedLegacyRoots(rootDir));
    violations.push(...checkAllowedSrcCodeRoots(rootDir));
    const baseline = loadLegacyFreezeBaseline(baselinePath);
    if (baseline.missing) {
      violations.push({
        file: relative(rootDir, baselinePath).replace(/\\/g, '/') || baselinePath,
        rule: 'missing legacy freeze baseline',
        scope: 'legacy-freeze',
      });
    } else {
      legacyCurrent = collectLegacyFreezePaths(rootDir);
      legacyBaseline = baseline.paths;
      violations.push(...checkLegacyFreeze(legacyCurrent, legacyBaseline));
      const currentSet = new Set(legacyCurrent);
      legacyRemoved = legacyBaseline.filter((p) => !currentSet.has(p)).length;
    }
  }

  return {
    violations,
    counts: {
      domain: domainFiles.length,
      infrastructure: infrastructureFiles.length,
      app: appFiles.length,
      sharedUi: sharedUiFiles.length,
      legacyCurrent: legacyCurrent.length,
      legacyBaseline: legacyBaseline.length,
      legacyRemoved,
    },
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { violations, counts } = runArchitectureBoundaryCheck();

  if (violations.length > 0) {
    console.error('Architecture boundary check failed:');
    for (const violation of violations) {
      console.error(`- [${violation.scope}] ${violation.file}: forbidden ${violation.rule}`);
    }
    process.exit(1);
  }

  console.log(
    `Architecture boundary check passed (${counts.domain} domain, ${counts.infrastructure} infrastructure, ${counts.app} app, ${counts.sharedUi} shared/ui; legacy eradicated ${counts.legacyRemoved}/${counts.legacyBaseline} baseline paths removed, current=${counts.legacyCurrent}).`,
  );
}
