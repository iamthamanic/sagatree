/** Pure migration-contract validation. Structure is not a semantic or release approval. */
import { createHash } from 'node:crypto';
import { migrationIssueIds, migrationIssueIdentities, migrationRepository, preparationAuthority } from './stack-migration-identities.mjs';
import { dependencyResolver } from './stack-migration-dependencies.mjs';

const SECTIONS = ['vorher', 'nachher', 'verhalten', 'sicherheit', 'tests', 'abhaengigkeiten', 'grenzen'];
const REQUIRED_IDS = migrationIssueIds;
const STATUSES = new Set(['ready', 'blocked', 'needs-design', 'done']);
const GENERIC = /^(?:no (?:new )?(?:typescript )?escape hatches?|touched files:|production migration remains|composition\/docs|explicit human approved|no silent library choice)/i;
const PLACEHOLDER = /\b(?:TBD|TODO:|lorem ipsum|parametersGuess|returnsGuess|tablesGuess)\b|extract (?:exact |the )?.*before port|document .*from source before coding/i;
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const strings = (value, allowEmpty = false) => Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(text);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const setEqual = (left, right) => left.length === right.length && new Set(left).size === left.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);

export function validateMigrationPlan({ intake, issueMap, dependencyPlan, registry, rpcInventory, edgeInventory, approvals }, io) {
  const errors = [];
  const warnings = [];
  const error = (message) => errors.push(message);
  const issues = intake?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return { errors: ['intake.issues must be a non-empty array'], warnings, readiness: [] };
  const ids = issues.map((issue) => issue.localId);
  const byId = new Map(issues.map((issue) => [issue.localId, issue]));
  if (!strings(ids) || new Set(ids).size !== ids.length) error('duplicate or invalid local issue identity');
  for (const id of REQUIRED_IDS) if (!byId.has(id)) error(`missing required issue ${id}`);
  if (!setEqual(ids, REQUIRED_IDS)) error('inventory must retain exactly the 90 reviewed issue identities');
  if (registry?.repository !== migrationRepository) error('registry repository differs from the reviewed publication target');
  if (!plain(issueMap) || !setEqual(ids, Object.keys(issueMap ?? {}))) error('intake and GitHub issue-map must contain exactly the same IDs');
  if (!plain(registry?.issues) || !setEqual(ids, Object.keys(registry?.issues ?? {}))) error('intake differs from the published issue registry');
  if (intake.meta?.githubIssuesPublished !== true || intake.meta?.githubIssueMapPartial !== false) error('publication metadata must reflect the complete published inventory');
  if (intake.meta?.githubIssueMappedCount !== issues.length || intake.coverage?.issuesTotal !== issues.length) error('issue count metadata differs from the inventory');
  const actualReady = issues.filter((issue) => issue.status === 'ready').length;
  if (actualReady > 0 && !preparationAuthority.runnerExecution) error('Migration runner execution is not authorized by this preparation contract');
  if (intake.coverage?.issuesReady !== actualReady || intake.coverage?.issuesBlockedOrNeedsDesign !== issues.filter((issue) => ['blocked', 'needs-design'].includes(issue.status)).length) error('readiness counts differ from actual issue states');
  if (!setEqual(ids, intake.topoOrder ?? [])) error('topoOrder must include every issue exactly once');
  if (!Array.isArray(dependencyPlan?.plan) || !setEqual(ids, (dependencyPlan?.plan ?? []).map((entry) => entry.localId))) error('dependency plan must include every issue exactly once');
  if (!setEqual(ids, dependencyPlan?.topo ?? [])) error('dependency-plan topo must include every issue exactly once');
  if (!same(intake.topoOrder, dependencyPlan?.topo)) error('intake and dependency-plan ordering differ');
  const positions = new Map((intake.topoOrder ?? []).map((id, index) => [id, index]));
  const planById = new Map((dependencyPlan?.plan ?? []).map((entry) => [entry.localId, entry]));
  const githubNumbers = issues.map((issue) => issue.githubIssue);
  if (githubNumbers.some((number) => !Number.isSafeInteger(number) || number <= 0) || new Set(githubNumbers).size !== githubNumbers.length) error('GitHub issue numbers must be unique positive safe integers');
  const slugs = issues.map((issue) => issue.featureSlug);
  if (slugs.some((slug) => !text(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) || new Set(slugs).size !== slugs.length) error('Feature slugs must be valid and globally unique');

  // Approval data is validated even when every implementation ticket is blocked.
  // A local actorType string or an arbitrary URL is not external authorization.
  const gates = REQUIRED_IDS.filter((id) => id.startsWith('GATE-'));
  if (approvals?.schemaVersion !== 1 || !plain(approvals?.decisions) || !setEqual(Object.keys(approvals?.decisions ?? {}), gates)) error('architecture decisions must contain exactly the five reviewed gates');
  for (const gate of gates) {
    const approval = approvals?.decisions?.[gate];
    if (!plain(approval) || !['UNDECIDED', 'DEFERRED_UNTIL_BROWSER_HOST_COMPLETE', 'APPROVED', 'REJECTED'].includes(approval.status)) { error(`${gate}: invalid architecture decision`); continue; }
    if (approval.status === 'APPROVED') {
      if (!preparationAuthority.architectureApproval) error(`${gate}: architecture approval is not authorized by the preparation workflow`);
      let sourceIsValid = false;
      try {
        const url = new URL(approval.sourceUrl);
        sourceIsValid = url.protocol === 'https:' && url.hostname === 'github.com' && url.username === '' && url.password === '' && url.pathname === `/${migrationRepository}/issues/${migrationIssueIdentities[gate]}` && /^#issuecomment-[1-9][0-9]*$/.test(url.hash);
      } catch { /* A missing or malformed URL is rejected below. */ }
      if (approval.actorType !== 'human' || !text(approval.actor) || /\[bot\]$/i.test(approval.actor) || !sourceIsValid || !text(approval.evidenceFile) || !io.exists(approval.evidenceFile)) error(`${gate}: missing explicit human architecture approval with verifiable source and evidence`);
    }
  }

  const hasCompletionEvidence = (issue) => {
    if (!text(issue.completionEvidence) || !io.exists(issue.completionEvidence)) return false;
    try {
      const proof = JSON.parse(io.read(issue.completionEvidence).toString());
      if (proof.schemaVersion !== 1 || proof.kind !== 'migration-acceptance' || proof.localId !== issue.localId || proof.result !== 'PASS' || !COMMIT.test(proof.testedCommit ?? '') || !Array.isArray(proof.checks) || proof.checks.length === 0) return false;
      return proof.checks.every((check) => text(check.command) && check.result === 'PASS' && text(check.evidenceFile) && SHA.test(check.sha256 ?? '') && io.exists(check.evidenceFile) && createHash('sha256').update(io.read(check.evidenceFile)).digest('hex') === check.sha256);
    } catch { return false; }
  };

  const ancestorCache = new Map();
  const ancestors = (id, active = new Set()) => {
    if (active.has(id)) { error(`dependency cycle at ${id}`); return []; }
    if (ancestorCache.has(id)) return ancestorCache.get(id);
    const next = new Set(active).add(id);
    const result = [...new Set(array(byId.get(id)?.dependsOn).flatMap((dep) => [dep, ...ancestors(dep, next)]))];
    ancestorCache.set(id, result);
    return result;
  };

  for (const issue of issues) {
    const id = issue.localId;
    if (issueMap?.[id] !== issue.githubIssue || registry?.issues?.[id] !== issue.githubIssue) error(`${id}: GitHub identity differs from authoritative registry`);
    if (migrationIssueIdentities[id] !== issue.githubIssue) error(`${id}: GitHub identity differs from the reviewed publication boundary`);
    if (!STATUSES.has(issue.status)) error(`${id}: invalid status`);
    if (!strings(issue.dependsOn, true) || new Set(issue.dependsOn).size !== issue.dependsOn.length) { error(`${id}: dependsOn must contain unique nonempty IDs`); continue; }
    if (!strings(issue.labels)) error(`${id}: labels must be a non-empty string array`);
    if (array(issue.labels).includes('agent-ready') !== (issue.status === 'ready')) error(`${id}: agent-ready label must match ready status`);
    if (['blocked', 'needs-design'].includes(issue.status) && !array(issue.labels).includes('agent-blocked')) error(`${id}: blocked work must carry the runner execution lock`);
    if (array(issue.labels).includes('agent-ready') && array(issue.labels).includes('agent-blocked')) error(`${id}: contradictory runner labels`);
    if (!text(issue.designFile) || !io.exists(issue.designFile)) error(`${id}: designFile must resolve to an existing contract`);
    for (const key of SECTIONS) {
      const value = issue.contractSections?.[key];
      if (key === 'tests' || key === 'abhaengigkeiten') {
        if (!strings(value, key === 'abhaengigkeiten')) error(`${id}: contractSections.${key} must be a valid string array`);
      } else if (!text(value)) error(`${id}: contractSections.${key} must be nonblank text`);
    }
    if (!same(issue.contractSections?.abhaengigkeiten, issue.dependsOn)) error(`${id}: dependency copies disagree`);
    if (!same(issue.contractSections?.tests, issue.acceptance)) error(`${id}: acceptance and contract tests disagree`);
    // Minimum counts only — never truncate inventoried requiredTests to fit a bullet-count cap.
    if (!strings(issue.acceptance) || issue.acceptance.length < 3) error(`${id}: acceptance must have at least 3 nonempty entries`);
    const substantive = array(issue.acceptance).filter((value) => text(value) && !GENERIC.test(value));
    if (substantive.length < 2) error(`${id}: acceptance contains insufficient operation-specific criteria`);
    if (!array(issue.acceptance).some((value) => value === 'Touched files: zero type escape hatches (typed-strict / Boy Scout).')) error(`${id}: missing typed-strict acceptance`);
    if (PLACEHOLDER.test(JSON.stringify(issue))) error(`${id}: unresolved placeholder or guessed contract`);
    if (!Array.isArray(issue.assertions) || issue.assertions.length < 2) error(`${id}: requires at least 2 explicit behavior assertions`);
    for (const [index, assertion] of array(issue.assertions).entries()) {
      if (!plain(assertion) || !text(assertion.given) || !text(assertion.when) || !text(assertion.then)) error(`${id}: assertion ${index + 1} requires given/when/then`);
      if (!strings(assertion?.sourceRefs)) error(`${id}: assertion ${index + 1} has no source reference`);
      for (const reference of array(assertion?.sourceRefs)) if (!io.exists(reference)) error(`${id}: assertion source not found: ${reference}`);
      const groupedCases = issue.acceptance.length <= 5 && issue.assertions.length > 4
        && issue.acceptance.some((item) => item.startsWith(`Alle ${issue.assertions.length} quellenabgeleiteten Given/When/Then-Fälle`));
      if (!groupedCases && !array(issue.acceptance).includes(assertion?.then))
        error(`${id}: behavior assertion is absent from acceptance`);
    }
    for (const dep of issue.dependsOn) {
      if (!byId.has(dep)) error(`${id}: unknown predecessor ${dep}`);
      if ((positions.get(dep) ?? Infinity) >= (positions.get(id) ?? -1)) error(`${id}: predecessor ${dep} does not precede it`);
    }
    const plan = planById.get(id);
    if (plan?.githubIssue !== issue.githubIssue || plan?.order !== issue.order || plan?.wave !== issue.waveNumber || plan?.status !== issue.status) error(`${id}: plan identity/order/wave/status drift`);
    if (!same(plan?.dependsOnGithub, issue.dependsOn.map((dep) => byId.get(dep)?.githubIssue))) error(`${id}: plan predecessor IDs drift`);
    if (plan?.runnerBlock !== ['blocked', 'needs-design'].includes(issue.status)) error(`${id}: plan execution lock drift`);
    if (issue.order !== (positions.get(id) ?? -1) + 1) error(`${id}: numerical order does not match topological position`);
    if (!Number.isInteger(issue.waveNumber) || issue.waveNumber < 0 || issue.waveNumber > 7 || !text(issue.wave) || !issue.wave.startsWith(`migration-wave-${issue.waveNumber}-`)) error(`${id}: invalid wave identity`);
    if (!array(issue.labels).includes(issue.wave) || !array(issue.labels).includes(`migration-order-${String(issue.order).padStart(3, '0')}`)) error(`${id}: wave/order labels differ from plan`);
    if (!same(plan?.labels, issue.labels)) error(`${id}: plan labels drift`);
    if (issue.status === 'done' && !hasCompletionEvidence(issue)) error(`${id}: done without completion evidence for this issue and checked test artifacts`);
    if (issue.status === 'ready' || issue.status === 'done') {
      for (const dep of ancestors(id)) {
        const predecessor = byId.get(dep);
        if (predecessor?.status !== 'done' || !hasCompletionEvidence(predecessor)) error(`${id}: ${issue.status} despite incomplete predecessor ${dep}`);
        if (/^GATE-\d+$/.test(dep)) {
          const approval = approvals?.decisions?.[dep];
          if (approval?.status !== 'APPROVED' || approval?.actorType !== 'human' || !text(approval?.actor) || !text(approval?.sourceUrl) || !text(approval?.evidenceFile) || !io.exists(approval.evidenceFile)) error(`${id}: missing explicit human architecture approval for ${dep}`);
        }
      }
      if (id.startsWith('GATE-') && approvals?.decisions?.[id]?.status !== 'APPROVED') error(`${id}: ${issue.status} without its own architecture decision`);
      if ((issue.sourceContracts ?? []).length && issue.verification?.sourceStatus !== 'source-verified') error(`${id}: source contracts not verified for execution`);
      if ((issue.verification?.blockers ?? []).length) error(`${id}: ${issue.status} with unresolved verification blockers`);
    }
    if (issue.status !== 'ready' && issue.status !== 'done') warnings.push(`${id}: execution remains blocked`);
  }
  for (const id of ids) ancestors(id);
  const cutover = byId.get('MIG-700');
  if (cutover) {
    const required = issues.filter((issue) => issue.localId !== 'MIG-700' && issue.waveNumber <= 6).map((issue) => issue.localId);
    for (const id of required) if (!array(cutover.dependsOn).includes(id)) error(`MIG-700: missing required predecessor ${id}`);
  }
  if (!array(byId.get('MIG-702')?.dependsOn).includes('ATLAS-LIVE-E2E') || !array(byId.get('MIG-702')?.dependsOn).includes('MIG-701')) error('Supabase shutdown must retain Atlas and observation-window predecessors');
  if (byId.get('ATLAS-LIVE-E2E')?.githubIssue !== 770) error('Atlas live proof must remain issue #770');
  if (!array(byId.get('GATE-05')?.dependsOn).includes('MIG-602') || !array(byId.get('GATE-05')?.dependsOn).includes('MIG-603')) error('Desktop PoC must be deferred until browser host CI and ops are complete');

  const rpcRows = rpcInventory?.rpcs;
  const edgeRows = edgeInventory?.edges;
  const infraRows = edgeInventory?.infrastructure;
  // Edge count tracks live supabase/functions/* (includes #879 ollama-settings → 25).
  for (const [kind, rows, count, name] of [['RPC', rpcRows, 57, 'rpc'], ['Edge', edgeRows, 25, 'function'], ['Infrastructure', infraRows, 13, 'area']]) {
    if (!Array.isArray(rows) || rows.length !== count || new Set((rows ?? []).map((row) => row[name])).size !== count) { error(`${kind}: inventory coverage must be exactly ${count} distinct entries`); continue; }
    for (const row of rows) {
      if (!text(row[name]) || !strings(row.requiredTests)) error(`${kind} ${row[name]}: missing operation-specific tests`);
      if (PLACEHOLDER.test(JSON.stringify(row))) error(`${kind} ${row[name]}: unresolved guessed contract`);
      if (!['source-verified', 'source-blocked'].includes(row.verification?.status)) error(`${kind} ${row[name]}: explicit source verification status required`);
      const proofs = row.verification?.sourceFiles ?? [];
      if (!Array.isArray(proofs) || proofs.length === 0) error(`${kind} ${row[name]}: source fingerprints missing`);
      for (const proof of array(proofs)) {
        if (!plain(proof)) { error(`${kind} ${row[name]}: malformed source fingerprint`); continue; }
        if (!text(proof.path) || !SHA.test(proof.sha256 ?? '') || !io.exists(proof.path)) { error(`${kind} ${row[name]}: invalid source fingerprint`); continue; }
        if (createHash('sha256').update(io.read(proof.path)).digest('hex') !== proof.sha256) error(`${kind} ${row[name]}: source changed since verification: ${proof.path}`);
      }
    }
  }
  if (Array.isArray(rpcRows)) {
    const assigned = issues.filter((issue) => ['MIG-350', 'MIG-351', 'MIG-352', 'MIG-353'].includes(issue.localId)).flatMap((issue) => issue.rpcNames ?? []);
    if (!setEqual(assigned, rpcRows.map((row) => row.rpc))) error('RPC cluster ownership must cover every RPC exactly once');
    const children = issues.filter((issue) => issue.localId.startsWith('RPC-'));
    if (children.length !== 18 || !setEqual(children.flatMap((issue) => issue.rpcNames ?? []), rpcRows.map((row) => row.rpc))) error('18 RPC child issues must own all 57 RPCs exactly once');
  }
  if (Array.isArray(edgeRows) && Array.isArray(infraRows)) {
    try {
      const resolveDependencies = dependencyResolver({ issues, rpcGroups: issues.filter((issue) => issue.localId.startsWith('RPC-')), edgeInventory });
      // Co-owned Edge rows (e.g. MIG-402 + ollama-settings after #879) must be covered by the union on the issue.
      const edgeRowsByIssue = new Map();
      for (const row of edgeRows) {
        const list = edgeRowsByIssue.get(row.implementationIssue) ?? [];
        list.push(row);
        edgeRowsByIssue.set(row.implementationIssue, list);
      }
      for (const row of [...edgeRows, ...infraRows]) {
        const owner = issues.find((issue) => issue.githubIssue === row.implementationIssue);
        if (!owner) { error(`Unmapped Edge/Infrastructure implementation issue #${row.implementationIssue}`); continue; }
        const siblings = edgeRowsByIssue.get(row.implementationIssue) ?? [row];
        const unionPeers = new Set();
        const unionOwned = new Set();
        const unionHard = new Set();
        for (const sibling of (row.function ? siblings : [row])) {
          const declared = resolveDependencies(sibling, owner.localId);
          for (const dep of declared.dependsOn) unionHard.add(dep);
          for (const peer of declared.integrationWith) unionPeers.add(peer);
          for (const owned of declared.ownedPrerequisites) unionOwned.add(owned);
        }
        for (const dep of unionHard) if (!array(owner.dependsOn).includes(dep)) error(`${owner.localId}: missing inventoried prerequisite ${dep}`);
        if (!setEqual(array(owner.integrationWith), [...unionPeers])) error(`${owner.localId}: integration peer inventory drift`);
        if (!setEqual(array(owner.ownedPrerequisites), [...unionOwned])) error(`${owner.localId}: owned internal prerequisite inventory drift`);
      }
      // Binding coverage: every inventoried Edge/Infra requiredTest must appear on the owning issue acceptance.
      for (const [issueNumber, siblings] of edgeRowsByIssue) {
        const owner = issues.find((issue) => issue.githubIssue === issueNumber);
        if (!owner) continue;
        for (const sibling of siblings) {
          for (const required of array(sibling.requiredTests)) {
            if (!array(owner.acceptance).includes(required)) {
              error(`${owner.localId}: missing binding Edge requiredTest from ${sibling.function}: ${required.slice(0, 80)}`);
            }
          }
        }
      }
      for (const row of infraRows) {
        const owner = issues.find((issue) => issue.githubIssue === row.implementationIssue);
        if (!owner) continue;
        for (const required of array(row.requiredTests)) {
          if (!array(owner.acceptance).includes(required)) {
            error(`${owner.localId}: missing binding Infrastructure requiredTest from ${row.area}: ${required.slice(0, 80)}`);
          }
        }
      }
    } catch (cause) { error(`Dependency resolution failed: ${cause.message}`); }
  }
  const readiness = issues.map((issue) => ({ localId: issue.localId, sourceStatus: issue.verification?.sourceStatus ?? 'unspecified', execution: issue.status, blockers: issue.verification?.blockers ?? [] }));
  return { errors: [...new Set(errors)], warnings, readiness };
}

export const contractValidationConstants = { SECTIONS, REQUIRED_IDS };
