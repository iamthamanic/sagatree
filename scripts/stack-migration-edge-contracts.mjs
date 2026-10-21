/** Render reviewed Edge/infra semantics plus complete AST evidence. Default is a drift check. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const dir = '.qa/intake/edge-infra-contracts';
const baselineSha = '3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248';
const sha256 = (x) => createHash('sha256').update(x).digest('hex');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const unique = (xs) => [...new Set(xs)].sort();
const semantics = read(`${dir}/semantics.json`);
const intake = read('.qa/intake/local-first-stack-migration-issues.json');
const groups = read('.qa/intake/rpc-contracts/split-groups.json').groups;
const issue = (id) => {
  const found = intake.issues.find((x) => x.localId === id);
  if (!found?.githubIssue) throw new Error(`Missing implementation issue ${id}`);
  return found.githubIssue;
};
const snapshots = readdirSync(`${dir}/source-contracts`).sort().map((name) => {
  const path = `${dir}/source-contracts/${name}`;
  return { data: read(path), path, sha256: sha256(readFileSync(path)) };
});
const edgeSnapshots = snapshots.filter((x) => x.data.function);
const infraSnapshots = snapshots.filter((x) => x.data.area);
const main = edgeSnapshots.find((x) => x.data.function === 'main').data;
const allowlist = main.declarations.find((d) => d.name === 'EDGE_DISPATCHER_ALLOWLIST');
if (!allowlist) throw new Error('Dispatcher allowlist evidence missing');
const allowed = [...allowlist.text.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((m) => m[1]).sort();
if (allowed.length !== 8) throw new Error(`Review changed dispatcher allowlist (${allowed.length})`);
const edgeIssue = new Map(edgeSnapshots.map((x, i) => [x.data.function, issue(`MIG-${401 + i}`)]));
const infraIssue = new Map(infraSnapshots.map((x, i) => [x.data.area, issue(`MIG-${301 + i}`)]));
const rpcGroups = new Map();
for (const group of groups) for (const name of group.rpcNames) {
  if (rpcGroups.has(name)) throw new Error(`Duplicate primary RPC binding ${name}`);
  rpcGroups.set(name, { issueNumber: group.parentIssue, groupId: group.id });
}

function verification(sourceFiles) {
  const byPath = new Map(sourceFiles.map((s) => [s.path, s]));
  for (const s of byPath.values()) {
    if (!existsSync(s.path) || sha256(readFileSync(s.path)) !== s.sha256) throw new Error(`Source drift ${s.path}; regenerate/review source contracts`);
  }
  return { status: 'source-verified', baselineSha, sourceFiles: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    liveBackendVerified: false, successorParityVerified: false, testStatus: 'required-not-executed' };
}
const commonDependency = (kind, name, issueNumber, extra = {}) => ({ kind, name, issueNumber, ...extra });
const compactOp = ({ exactBranch, ...x }) => x;
const outputs = new Map();

const edges = edgeSnapshots.map(({ data: s, path, sha256: snapshotSha }) => {
  const name = s.function; const m = semantics.edges[name];
  if (!m?.requiredTests?.length) throw new Error(`Missing reviewed semantics ${name}`);
  const callers = infraSnapshots.flatMap(({ data }) => data.calls.filter((c) => c.kind === 'edge' && c.name === name)
    .map((c) => ({ area: data.area, ...c })));
  const callerPaths = unique(callers.map((c) => c.path));
  const exposure = { kind: name === 'main' ? 'dispatcher' : allowed.includes(name) ? 'allowlisted-worker' : 'legacy-unmounted',
    dispatcherAllowed: allowed.includes(name), publicActivationAuthorized: false,
    decision: name === 'main' ? 'Preserve exact dispatch boundary until host cutover.' : allowed.includes(name)
      ? 'Current branch mount; a successor cutover still requires gates and contract tests.' : 'Preserve external 404; no automatic host route or public activation.' };
  const methods = name === 'main' ? ['ANY allowlisted dispatch'] : unique(['OPTIONS',
    ...s.handler.flatMap((h) => [...h.text.matchAll(/\b(?:req|request)\.method\s*(?:===|!==)\s*['"]([A-Z]+)['"]/g)].map((x) => x[1]))]);
  const deps = [commonDependency('http-host', 'authenticated HTTP transport', issue('MIG-020'))];
  if (exposure.kind !== 'legacy-unmounted') deps.push(commonDependency('auth', 'account identity', issue('MIG-014')));
  if (s.environment.includes('CREDENTIALS_ENCRYPTION_KEY') && name !== 'ai-provider-credentials') {
    deps.push(commonDependency('edge', 'ai-provider-credentials', edgeIssue.get('ai-provider-credentials')));
  }
  if (name === 'session-recap') deps.push(commonDependency('rpc', 'sagatree_upsert_session_recap', 814, { scope: 'internal helper used by recap service' }));
  if (m.rateLimits.rpc) deps.push(commonDependency('internal-rpc', m.rateLimits.rpc, edgeIssue.get(name), { scope: 'quota prerequisite owned by this Edge port' }));
  const allSource = [...s.declarations.map((x) => x.text), ...s.handler.map((x) => x.text)].join('\n');
  const rpcUsed = unique([...allSource.matchAll(/\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)/g)].map((x) => x[1]));
  const tablesTouched = exposure.kind === 'legacy-unmounted' && name !== 'ai-gm' ? [] : unique([...allSource.matchAll(/\/rest\/v1\/(?!rpc\/)([a-z_][a-z0-9_]*)/g)].map((x) => x[1]));
  const storageBuckets = ({ 'character-avatar-meshy': ['character-avatars'], 'item-thumbnail': ['item-thumbnails'],
    'item-model3d': ['item-models', 'item-thumbnails'], 'look-reference-analysis': ['LOOK_REFERENCE_STORAGE_BUCKET (default media)'] })[name] ?? [];
  for (const table of tablesTouched) deps.push(commonDependency('table', table, issue('MIG-012'), { policyIssueNumber: issue('MIG-013') }));
  for (const bucket of storageBuckets) deps.push(commonDependency('storage', bucket, issue('MIG-500')));
  return {
    function: name, implementationIssue: edgeIssue.get(name), files: [`supabase/functions/${name}/index.ts`],
    verification: verification([...s.sourceFiles, ...main.sourceFiles, ...callerPaths.map((p) => ({ path: p, sha256: sha256(readFileSync(p)) }))]),
    sourceContract: path, sourceContractSha256: snapshotSha, exposure, methods,
    hasAuthSignals: exposure.kind !== 'legacy-unmounted' || name === 'ai-gm', usesSharedCors: name !== 'main',
    envSecrets: s.environment, environment: s.environment, sharedModules: s.sourceFiles.filter((f) => f.path.includes('/_shared/')).map((f) => basename(f.path)),
    configurationSources: s.declarations.filter((d) => /(?:Deno\.env\.(?:get|toObject)|\benv\.get\(|\breadEnv\()/.test(d.text) || /^(?:CORS_OPTS|DEFAULT_)/.test(d.name)),
    cors: name === 'main' ? { kind: 'dispatcher', behavior: 'No dispatcher CORS rewrite; allowed OPTIONS forwarded, denied names remain404.' }
      : { kind: 'shared', options: s.declarations.find((d) => d.name === 'CORS_OPTS'),
        behavior: 'handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.' },
    callSites: callerPaths, adapterCalls: callers, operations: s.operations.map(compactOp), rpcUsed, tablesTouched, storageBuckets,
    payloadContract: m.payloadContract, successContract: m.successContract, errorContract: m.failureSemantics,
    responseSites: s.responseSites, authz: m.authz, sideEffects: m.sideEffects, rateLimits: m.rateLimits,
    timeoutSites: s.timeoutSites, transportSemantics: m.transportSemantics, dependencies: deps,
    requiredTests: m.requiredTests, legacyDefects: m.knownGaps, purpose: m.purpose,
    proposedService: exposure.kind === 'legacy-unmounted' ? null : name === 'main' ? 'server/src/http/route-registry.ts'
      : `server/src/application/${name}/`,
    dependsOnGates: ['GATE-02', 'GATE-03'], status: 'SPEC',
  };
});

const infrastructure = infraSnapshots.map(({ data: s, path, sha256: snapshotSha }) => {
  const m = semantics.infrastructure[s.area];
  if (!m?.tests?.length) throw new Error(`Missing reviewed infrastructure semantics ${s.area}`);
  const named = (kind) => unique(s.calls.filter((c) => c.kind === kind).map((c) => c.name).filter(Boolean));
  const unresolved = s.calls.filter((c) => ['rpc', 'edge', 'table', 'storage'].includes(c.kind) && !c.name);
  if (unresolved.length) throw new Error(`Unresolved named backend call ${s.area}: ${unresolved[0].expression}`);
  const rpcUsed = named('rpc'), tablesTouched = named('table'), storageBuckets = named('storage'), edgeInvokes = named('edge');
  const dependencies = [];
  for (const name of rpcUsed) {
    const g = rpcGroups.get(name); if (!g) throw new Error(`Unmapped RPC ${name}`);
    dependencies.push(commonDependency('rpc', name, g.issueNumber, { groupId: g.groupId }));
  }
  for (const name of edgeInvokes) dependencies.push(commonDependency('edge', name, edgeIssue.get(name)));
  for (const name of tablesTouched) dependencies.push(commonDependency('table', name, issue('MIG-012'), { policyIssueNumber: issue('MIG-013'),
    scope: 'Repository/table transport plus exact effective RLS policy; adapter filters alone do not prove server authorization.' }));
  for (const name of storageBuckets) dependencies.push(commonDependency('storage', name, issue('MIG-500')));
  const realtime = s.calls.filter((c) => c.kind.startsWith('realtime') || c.kind === 'channel');
  if (realtime.length) dependencies.push(commonDependency('realtime', 'postgres_changes channels and cleanup', issue('MIG-021')));
  const authCalls = s.calls.filter((c) => c.kind.startsWith('auth'));
  if (authCalls.length || rpcUsed.length || edgeInvokes.length || tablesTouched.length || storageBuckets.length) {
    dependencies.push(commonDependency('auth', 'authenticated account/session transport', issue('MIG-014')));
  }
  const importedInfra = unique(s.imports.map((x) => x.resolvedPath?.match(/^src\/infrastructure\/([^/]+)\//)?.[1])
    .filter((x) => x && x !== s.area));
  for (const name of importedInfra) dependencies.push(commonDependency('infra', name, infraIssue.get(name)));
  return { area: s.area, implementationIssue: infraIssue.get(s.area), files: s.sourceFiles.map((x) => x.path),
    verification: verification([...s.sourceFiles, ...s.supportingSourceFiles]), sourceContract: path, sourceContractSha256: snapshotSha,
    rpcUsed, tablesTouched, storageBuckets, edgeInvokes, realtime, authCalls,
    externalFetches: s.calls.filter((c) => c.kind === 'fetch'), importedInfrastructure: importedInfra,
    providerSdkCalls: s.calls.filter((c) => c.kind === 'provider-sdk'),
    backendCalls: s.calls, dependencies, behavior: m.behavior, authz: m.security, legacyDefects: m.knownGaps ?? [],
    publicOperationSources: s.operationDeclarations.filter((o) => o.name !== 'callback').map(({ text, ...x }) => x),
    requiredTests: [...m.tests, ...rpcUsed.map((name) => `Contract fixture for ${name}: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.`)],
    status: 'SPEC', dependsOnGates: ['GATE-01', 'GATE-02', 'GATE-04'],
  };
});

const inventory = { schemaVersion: 2, prepIssue: 778, epicIssue: 773, edgeCount: edges.length, infraCount: infrastructure.length,
  verification: { status: 'source-verified', baselineSha, liveBackendVerified: false, successorParityVerified: false },
  evidenceMeaning: 'Exact current-branch source and adapter contracts. No live backend, successor implementation, security remediation, PoC or architecture approval is claimed.',
  sourceCheckCommand: 'node scripts/stack-migration-edge-source-contracts.mjs', renderCheckCommand: 'node scripts/stack-migration-edge-contracts.mjs',
  bindingSource: '.qa/intake/rpc-contracts/split-groups.json',
  sharedModules: readdirSync('supabase/functions/_shared').filter((x) => x.endsWith('.ts')).sort(),
  dispatcher: { allowedWorkers: allowed, unmountedWorkers: edges.filter((e) => e.exposure.kind === 'legacy-unmounted').map((e) => e.function), dispatcher: 'main' },
  edges, infrastructure,
  notes: ['There are 8 allowlisted workers, 15 unmounted workers and one dispatcher.',
    'All 57 called RPC names are mapped, including two typed-dynamic saga outcome promotion calls.',
    'No generic membership rule is applied to owner-only AI credentials.',
    'Current-source defects are explicit test/decision requirements, never a reason to activate a legacy worker.'] };
outputs.set(`${dir}/inventory.json`, `${JSON.stringify(inventory, null, 2)}\n`);

const mdText = (x) => String(x).replaceAll('|', '\\|').replaceAll('\n', ' ');
const section = (title, body) => `## ${title}\n\n${body}\n\n`;
const bullets = (xs) => xs.length ? xs.map((x) => `- ${x}`).join('\n') : 'None in the reviewed source.';
const objectBullets = (o) => bullets(Object.entries(o).map(([k, v]) => `**${k}:** ${v}`));
const fence = (x, lang = 'ts') => `\n\`\`\`${lang}\n${x}\n\`\`\`\n`;
const sourceTable = (v) => '| Path | SHA-256 |\n|---|---|\n' + v.sourceFiles.map((x) => `| \`${x.path}\` | \`${x.sha256}\` |`).join('\n');
const depsTable = (ds) => '| Kind | Contract dependency | Implementation issue | Additional policy/group |\n|---|---|---|---|\n' +
  ds.map((x) => `| ${x.kind} | \`${mdText(x.name)}\` | #${x.issueNumber} | ${x.groupId ?? (x.policyIssueNumber ? `Policy #${x.policyIssueNumber}` : x.scope ?? '')} |`).join('\n');
function header(title, v, snapshot, snapshotSha, implementationIssue) {
  return `# ${title}\n\n**Status: SPEC; current branch source verified.** Implementation issue: **#${implementationIssue}**.\n\n` +
    `Source baseline: \`${v.baselineSha}\`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.\n\n` +
    `Exact AST snapshot: [${basename(snapshot)}](source-contracts/${basename(snapshot)}) (SHA-256 \`${snapshotSha}\`). The snapshot includes complete source declarations and operation expressions; no list is truncated.\n\n`;
}

for (const e of edges) {
  const s = edgeSnapshots.find((x) => x.data.function === e.function).data;
  let md = header(`Edge contract: ${e.function}`, e.verification, e.sourceContract, e.sourceContractSha256, e.implementationIssue);
  md += section('Exposure and purpose', `**${e.exposure.kind}** — ${e.exposure.decision}\n\n${e.purpose}\n\n${e.authz}`);
  md += section('Request variants, fields and defaults', objectBullets(e.payloadContract));
  md += section('Success and error contracts', objectBullets(e.successContract) + '\n\n' + bullets(e.errorContract));
  md += section('Side effects and transaction boundaries', bullets(e.sideEffects));
  md += section('Quota, environment and transport', fence(JSON.stringify(e.rateLimits, null, 2), 'json') + '\n' + e.transportSemantics + '\n\n' +
    bullets(e.environment.map((x) => `\`${x}\``)) + '\n\nExplicit abort call sites (dynamic values resolve in the linked helper declaration):\n\n' +
    bullets(e.timeoutSites.map((x) => `\`${x.path}:${x.line}\` — \`${x.expression}\``)));
  md += section('Exact environment defaults and configuration resolution', e.configurationSources.map((x) => `### ${x.name}\n\n\`${x.path}:${x.line}\`\n${fence(x.text)}`).join('\n') || 'No environment lookup in this worker or its local imports.');
  md += section('Dependencies', depsTable(e.dependencies));
  md += section('CORS transport', e.cors.behavior + (e.cors.options ? '\n' + fence(e.cors.options.text) : ''));
  md += section('Acceptance and negative tests (required, not executed)', bullets(e.requiredTests));
  md += section('Observed legacy defects and explicit successor decisions', bullets(e.legacyDefects));
  md += section('All adapter call sites', e.adapterCalls.length ? e.adapterCalls.map((c) => `### ${c.path}:${c.line}\n\n${fence(c.enclosingOperation?.text ?? c.chain)}`).join('\n') : 'No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.');
  md += section('Exact ordered operations', s.operations.map((o) => `### ${o.id}\n\nPredicate: \`${mdText(o.condition)}\`. Source: \`${o.path}:${o.line}\`.\n\n${fence(o.exactBranch)}`).join('\n'));
  const schemas = s.declarations.filter((x) => ['InterfaceDeclaration', 'TypeAliasDeclaration', 'EnumDeclaration'].includes(x.kind));
  md += section('Exact type declarations', schemas.map((x) => `### ${x.name}\n\n\`${x.path}:${x.line}\`\n${fence(x.text)}`).join('\n') || 'Handler uses inline JSON records; full expressions are above.');
  const helpers = s.declarations.filter((x) => e.exposure.kind === 'legacy-unmounted'
    ? x.path === `supabase/functions/${e.function}/index.ts` && x.kind === 'FunctionDeclaration'
    : /^(?:parse|validate|build.*(?:Prompt|StoragePath|AssetKey)|assertSafeUserExtra|getDefault|DEFAULT_|RATE_|MAX_|IMAGE_|MESHY_MODEL_IDS|GEOMETRY|TEXTURE|POSE|TOPOLOGY|PRESET_IDS|SIGNED_URL|CORS_OPTS)/.test(x.name));
  md += section('Exact validation, defaults and helper behavior', helpers.map((x) => `### ${x.name}\n\n\`${x.path}:${x.line}\`\n${fence(x.text)}`).join('\n') || 'All inline guards are in the ordered handler; remaining imported helpers are complete in the AST snapshot.');
  md += section('Verification source manifest', sourceTable(e.verification));
  outputs.set(`${dir}/edge-${e.function}.md`, md);
}

for (const i of infrastructure) {
  const s = infraSnapshots.find((x) => x.data.area === i.area).data;
  let md = header(`Infrastructure contract: ${i.area}`, i.verification, i.sourceContract, i.sourceContractSha256, i.implementationIssue);
  md += section('Facade behavior and authorization boundary', `${i.behavior}\n\n${i.authz}\n\nThe adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.`);
  md += section('Complete backend inventory', `RPCs (${i.rpcUsed.length}): ${i.rpcUsed.map((x) => `\`${x}\``).join(', ') || 'none'}.\n\nTables (${i.tablesTouched.length}): ${i.tablesTouched.map((x) => `\`${x}\``).join(', ') || 'none'}.\n\nStorage buckets (${i.storageBuckets.length}): ${i.storageBuckets.map((x) => `\`${x}\``).join(', ') || 'none'}.\n\nEdge invokes (${i.edgeInvokes.length}): ${i.edgeInvokes.map((x) => `\`${x}\``).join(', ') || 'none'}.\n\nRealtime call sites: ${i.realtime.length}. Direct fetch sites: ${i.externalFetches.length}. Explicit auth/helper sites: ${i.authCalls.length}.`);
  md += section('Complete implementation dependencies', depsTable(i.dependencies));
  md += section('Acceptance and negative tests (required, not executed)', bullets(i.requiredTests));
  md += section('Observed source defects and explicit successor decisions', bullets(i.legacyDefects));
  md += section('All backend calls, arguments, filters and result handling', i.backendCalls.length ? i.backendCalls.map((c) =>
    `### ${c.kind}: ${c.name ?? c.arguments[0] ?? 'session identity'}\n\n\`${c.path}:${c.line}\` — ${c.resolution}.\n\nExact call/query chain:${fence(c.chain)}\nEnclosing operation: \`${c.enclosingOperation?.path ?? c.path}:${c.enclosingOperation?.line ?? c.line}\`; complete request/default/result/error logic is in the declarations below and the snapshot.`).join('\n')
    : 'This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.');
  md += section('Complete public declarations and facade operation contracts', s.publicDeclarations.map((x) => `### ${x.path}:${x.line}\n${fence(x.text)}`).join('\n'));
  const enclosed = new Map(i.backendCalls.map((c) => c.enclosingOperation).filter(Boolean).map((o) => [`${o.path}:${o.line}:${o.endLine}`, o]));
  const helpers = [...enclosed.values()].filter((o) => !s.publicDeclarations.some((p) => p.path === o.path && p.line <= o.line && p.endLine >= o.endLine));
  md += section('Remaining backend helper operations', helpers.map((x) => `### ${x.path}:${x.line}\n${fence(x.text)}`).join('\n') || 'All backend operations are included in the public declarations above.');
  md += section('Verification source manifest', sourceTable(i.verification));
  outputs.set(`${dir}/infra-${i.area}.md`, md);
}

let readme = '# Edge and infrastructure contracts (PREP-05 #778)\n\n';
readme += '**24 Edge entries = 8 allowlisted workers + 15 unmounted workers + 1 dispatcher. 13 infrastructure areas. 57 distinct called RPC names.**\n\n';
readme += 'Status is **SPEC with current-branch source verification**. This is neither live-backend evidence nor a passed successor parity suite. GATE-01/02/03/04/05 statuses are unchanged.\n\n';
readme += section('Reproduce and review', 'Run `node scripts/stack-migration-edge-source-contracts.mjs` and `node scripts/stack-migration-edge-contracts.mjs` to check snapshots/rendering. A deliberate reviewed update uses `--write` on the source extractor, edits `semantics.json`, then uses `--write` on the renderer. Both default commands fail on drift. Source code is parsed, never executed.\n\n`inventory.json` is schema v2. Each contract contains source SHA-256 paths, exact AST snapshot reference/hash, its own acceptance/negative tests and implementation issue. RPC primary binding comes from `../rpc-contracts/split-groups.json`, which is an exclusive 57-name partition.\n\nEvery source snapshot includes complete operation branches/types/helper bodies; infrastructure snapshots include full query chains, caller argument objects, decoders/error handling and imported type declarations. Dynamic finite RPC unions and class-field table constants are resolved. Auth, storage and realtime are separate from table counts.');
readme += section('Edge entries', '| Contract | Exposure | Implementation | Client caller files | Quota |\n|---|---|---|---|---|\n' + edges.map((e) => `| [${e.function}](edge-${e.function}.md) | ${e.exposure.kind} | #${e.implementationIssue} | ${e.callSites.length} | ${e.rateLimits.kind}${e.rateLimits.defaultLimit ? ` ${e.rateLimits.defaultLimit}/${e.rateLimits.windowSeconds}s` : ''} |`).join('\n'));
readme += section('Infrastructure areas', '| Contract | RPCs | Tables | Storage buckets | Edge names | Implementation |\n|---|---|---|---|---|---|\n' + infrastructure.map((i) => `| [${i.area}](infra-${i.area}.md) | ${i.rpcUsed.length} | ${i.tablesTouched.length} | ${i.storageBuckets.length} | ${i.edgeInvokes.length} | #${i.implementationIssue} |`).join('\n'));
readme += section('Decisions already fixed by source evidence', bullets([
  'AI credentials remain owner-only BYOK; project membership or GM status does not authorize another account key.',
  'main is a dispatcher, never one of the 15 unmounted workers. ai-gm is unmounted even though its isolated implementation has a membership gate and persistent quota.',
  'session-media-token reads active project_members only; its session_players fallback comment does not describe executable behavior.',
  'Avatar and look analysis rate limits are process-memory counters. Credentials, thumbnail, model3d, character lore and recap use persistent RPC quotas.',
  'Legacy Maps are historical source behavior, not DB/RLS guarantees. Their external routes remain404 and no successor public activation is approved.',
  'Provider/storage/DB multi-request sequences and ignored persistence responses are called out explicitly. Current source defects are required successor decisions, not validated safe parity.',
]));
outputs.set(`${dir}/README.md`, readme);
let split = '# Edge / infrastructure implementation mapping\n\n';
split += 'One exact parent ticket exists for every Edge entry and every infrastructure area. This table supersedes the earlier broad suggested clusters. It is a contract map, not approval to implement or expose a route.\n\n';
split += section('Edge mapping', '| Contract | Parent | Disposition |\n|---|---|---|\n' + edges.map((e) => `| [${e.function}](edge-${e.function}.md) | #${e.implementationIssue} | ${e.exposure.decision} |`).join('\n'));
split += section('Infrastructure mapping and complete dependency list', infrastructure.map((i) => `### ${i.area} — #${i.implementationIssue}\n\n${depsTable(i.dependencies)}\n`).join('\n'));
split += section('RPC binding rule', 'Use the exclusive groups in `../rpc-contracts/split-groups.json`: world/atlas #813; session lifecycle/runtime/invites/recap #814; saga/project including both outcome promotions #815; NPC/controller plus marketplace #816. No name-prefix heuristic and no duplicate primary parent.\n\nInternal quota RPCs remain explicit prerequisites of their owning Edge issue; they are not silently dropped because they are outside the 57 browser-call RPC names.');
split += section('Implementation exit conditions', bullets(['Architecture decisions and host dependencies must be accepted before successor implementation.', 'Every exact request/result/error and side-effect fixture must pass against the source-backed contract; live and successor parity evidence are recorded separately.', 'Unmounted workers keep404. Removing a legacy file or adding an internal replacement requires the corresponding ticket decision; this contract does not create a new public API.', 'No owner key access broadening, speculative RLS, silent provider retries, untested partial persistence guarantees or changed secret exposure.']));
outputs.set(`${dir}/SPLIT_TICKETS.md`, split);
let stale = 0;
for (const [path, content] of outputs) {
  if (process.argv.includes('--write')) writeFileSync(path, content);
  else if (!existsSync(path) || readFileSync(path, 'utf8') !== content) { console.error(`Stale Edge/infra contract: ${path}`); stale++; }
}
console.log(`Edge/infra contracts: ${edges.length} Edge, ${infrastructure.length} infrastructure, ${unique(infrastructure.flatMap((i) => i.rpcUsed)).length} RPCs; ${stale} stale.`);
if (stale) process.exitCode = 1;
