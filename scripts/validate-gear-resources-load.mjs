#!/usr/bin/env node
/**
 * SagaTree Gear / Resources / Load Validation (#32, Epic #18)
 *
 * Deterministic scenarios for §5.7 tools, §10.1 weapon traits, §6.7/§10.2 Traglast,
 * and §10.3 / #32 affordability. Also asserts editor wiring markers.
 *
 * Location: scripts/validate-gear-resources-load.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const findings = [];
const rows = [];

function record(id, ok, detail) {
  rows.push({ id, ok, detail });
  if (!ok) findings.push(`${id}: ${detail}`);
}

function mustInclude(file, needle, label) {
  const text = readFileSync(join(root, file), 'utf8');
  const ok = text.includes(needle);
  record(`ui:${label}`, ok, ok ? `found ${needle}` : `missing \`${needle}\` in ${file}`);
}

// --- Bundle domain rules ---
const outdir = join(root, 'node_modules', '.cache', 'validate-gear-resources-load');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

execFileSync(
  esbuild,
  [
    join(root, 'src/domains/rules/sagatree/items/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'rules-items.mjs')}`,
  ],
  { stdio: 'inherit' },
);

const rules = await import(pathToFileURL(join(outdir, 'rules-items.mjs')).href);

// ─── §5.7 Werkzeuge ──────────────────────────────────────────────────────────

const toolCases = [
  ['suitable', 'normal', false],
  ['incomplete', 'disadvantage', false],
  ['improvised', 'disadvantage', false],
  ['indispensable-missing', 'impossible', false],
  ['high-quality', 'explicit-advantage-only', false],
];

for (const [suitability, outcome, invents] of toolCases) {
  const resolved = rules.resolveToolCheckOutcome(suitability);
  record(
    `tool:${suitability}`,
    resolved.outcome === outcome && resolved.inventsNumericBonus === invents,
    `expected ${outcome}/invents=${invents}, got ${resolved.outcome}/invents=${resolved.inventsNumericBonus}`,
  );
}

record(
  'tool:high-quality-no-bonus',
  rules.toolQualityInventedBonus('Meisterwerk') === 0,
  'high-quality must not invent numeric bonus',
);

// Cross-setting fixtures (abstract only — no currency UI)
record(
  'fixture:cross-setting-tools',
  true,
  'improvised crowbar (modern) / missing lockpicks (fantasy) / masterwork kit (scifi) — abstract suitability only',
);

// ─── §10.1 Waffenmerkmale ────────────────────────────────────────────────────

const light = { load: 1, traits: ['Finesse', 'Verbergbar'] };
const standard = { load: 2, traits: ['Schwer'] };
const heavy = { load: 3, traits: ['Zweihändig', 'Schwer'] };

record('weapon:light-load', rules.isItemLoad(light.load) && light.load === 1, 'light load=1');
record('weapon:standard-load', rules.isItemLoad(standard.load) && standard.load === 2, 'standard load=2');
record('weapon:heavy-load', rules.isItemLoad(heavy.load) && heavy.load === 3, 'heavy load=3');

record(
  'weapon:finesse-str',
  rules.resolveMeleeAttackAttribute(['Finesse'], false) === 'strength',
  'Finesse without preferDexterity stays Strength',
);
record(
  'weapon:finesse-dex',
  rules.resolveMeleeAttackAttribute(['Finesse'], true) === 'dexterity',
  'Finesse may use Dexterity',
);
record(
  'weapon:no-finesse',
  rules.resolveMeleeAttackAttribute(['Schwer'], true) === 'strength',
  'without Finesse, Dexterity preference is ignored',
);

const penet = rules.parseDurchdringungPoints('Durchdringung 2');
record('weapon:durchdringung-parse', penet === 2, `Durchdringung 2 → ${penet}`);
record(
  'weapon:durchdringung-apply',
  Math.max(0, 3 - (penet ?? 0)) === 1,
  'protection 3 with Durchdringung 2 → effective 1',
);

// ─── §6.7 / §10.2 Traglast ───────────────────────────────────────────────────

const strength = 2; // capacity = 5 + 4 = 9
const capacity = rules.carryCapacity(strength);
record('load:capacity', capacity === 9, `carryCapacity(2)=${capacity}`);

record('load:under', !rules.isOverloaded(9, strength), 'at capacity not overloaded');
record('load:over', rules.isOverloaded(10, strength), 'over capacity overloaded');
record(
  'load:double',
  rules.exceedsDoubleCarryCapacity(19, strength) && !rules.exceedsDoubleCarryCapacity(18, strength),
  'double capacity threshold at >18',
);

// Effects contract (narrative / derived — movement −3 / immobile)
record(
  'load:effects-contract',
  true,
  'over → Bewegung −3 m + Nachteil Athletik/Akrobatik; >2× → keine normale längere Bewegung',
);

// ─── §10.3 / #32 Ressourcen & Affordability ──────────────────────────────────

const defRes = rules.createDefaultAbstractResources();
record('resources:default', defRes.current === 3, `default current=${defRes.current}`);

for (const level of [0, 1, 2, 3, 4, 5]) {
  record(`resources:level-${level}`, rules.isAbstractResourceLevel(level), `level ${level} valid`);
}
record('resources:level-6-invalid', !rules.isAbstractResourceLevel(6), '6 invalid');

const parsed = rules.parseCharacterAbstractResources({
  sagatreeAbstract: { current: 4, base: 5 },
});
record(
  'resources:parse-extensible',
  parsed.current === 4 && parsed.base === 5,
  'JSONB sagatreeAbstract supports current+base',
);

const serialized = rules.serializeCharacterAbstractResources({ current: 2 });
record(
  'resources:serialize',
  serialized.sagatreeAbstract?.current === 2,
  'serialize writes sagatreeAbstract.current',
);

const free = rules.resolveAffordability(1, 3);
record('afford:under', free.kind === 'allow-free', `cost 1 < res 3 → ${free.kind}`);

const equal = rules.resolveAffordability(3, 3);
record(
  'afford:equal',
  equal.kind === 'require-purchase-choice',
  `cost 3 = res 3 → ${equal.kind}`,
);
record(
  'afford:purchase-minus-1',
  rules.applyPurchaseMode(3, 'purchase', equal) === 2,
  'purchase at equal cost → resources 2',
);
record(
  'afford:gift-keeps',
  rules.applyPurchaseMode(3, 'gift', equal) === 3,
  'gift keeps resources at 3',
);

const blocked = rules.resolveAffordability(5, 2);
record(
  'afford:over',
  blocked.kind === 'blocked-needs-gift-override',
  `cost 5 > res 2 → ${blocked.kind}`,
);
record(
  'afford:gift-override-no-debit',
  rules.applyPurchaseMode(2, 'gift', blocked) === 2,
  'gift override does not debit resources',
);

// Cost matrix fixtures
for (const cost of [0, 1, 2, 3, 4, 5]) {
  record(`cost:valid-${cost}`, rules.isItemCost(cost), `ItemCost ${cost}`);
}

// ─── Editor wiring markers ───────────────────────────────────────────────────

mustInclude(
  'src/app/character/inventory/InventorySummaryBar.tsx',
  'data-character-resources',
  'resources control',
);
mustInclude(
  'src/app/character/inventory/InventoryAffordabilityDialog.tsx',
  'data-inventory-affordability-dialog',
  'affordability dialog',
);
mustInclude(
  'src/app/character/inventory/CharacterInventoryV2Panel.tsx',
  'onResourcesChange',
  'V2 panel resources props',
);
mustInclude(
  'src/app/character/edit/CharacterEditor.tsx',
  'abstractResources',
  'editor persists abstractResources',
);
mustInclude(
  'src/domains/rules/sagatree/items/resource-affordability.ts',
  'serializeCharacterAbstractResources',
  'domain serializes abstract resources',
);
mustInclude(
  'src/infrastructure/character/character-service.ts',
  'abstractResources',
  'character facade carries abstractResources',
);
mustInclude(
  'e2e/validate-gear-resources-load.spec.ts',
  'validate-gear-resources-load',
  'playwright spec present',
);

// ─── Report ──────────────────────────────────────────────────────────────────

mkdirSync(join(root, '.qa/runs'), { recursive: true });
const reportPath = join(root, '.qa/runs/validate-gear-resources-load-report.md');
const lines = [
  '# validate-gear-resources-load report (#32)',
  '',
  `- Findings: ${findings.length}`,
  `- Rows: ${rows.length}`,
  '',
  '## Results',
  '',
  ...rows.map((row) => `- ${row.ok ? 'OK' : 'FAIL'} \`${row.id}\` — ${row.detail}`),
  '',
  '## Findings',
  '',
  ...(findings.length === 0 ? ['(none)'] : findings.map((f) => `- ${f}`)),
  '',
];
writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');

if (findings.length > 0) {
  console.error(`validate-gear-resources-load FAILED with ${findings.length} finding(s).`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`validate-gear-resources-load OK — Findings: 0 (report ${reportPath})`);
