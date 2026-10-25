import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { planContracts, typedStrictAcceptance } from './stack-migration-plan-contracts.mjs';
import { migrationIssueIdentities, migrationRepository } from './stack-migration-identities.mjs';
import { dependencyResolver } from './stack-migration-dependencies.mjs';

export const baselineSha = '3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248';
export const waveNames = ['migration-wave-0-evidence', 'migration-wave-1-host-auth', 'migration-wave-2-api-realtime', 'migration-wave-3-edge-services', 'migration-wave-4-adapter-ports', 'migration-wave-5-storage-export', 'migration-wave-6-security-ops', 'migration-wave-7-cutover-tauri'];
const unique = (values) => [...new Set(values)];
const text = (value) => typeof value === 'string' ? value : JSON.stringify(value);
const code = (value) => `\`${value}\``;
export const featureSlug = (id) => `stack-migration-${id.toLowerCase()}`;
const evidenceRoot = '.qa/evidence/stack-migration-prep';
const contractRoot = '.qa/design/migration-issues';

const ATLAS_E2E_EXECUTION_BLOCKER =
  'Atlas live product E2E CI remains not-passing on the isolated baseline workflow; known red must be fixed with real evidence before READY/DONE (do not skip or greenwash).';

/**
 * True execution locks (keep ticket blocked) vs inventory legacyDefects
 * (mandatory in-ticket acceptance / negative regressions — must NOT block READY).
 */
export function isExecutionBlockerText(value) {
  const s = text(value);
  if (s === ATLAS_E2E_EXECUTION_BLOCKER || s.startsWith('Atlas live product E2E CI remains not-passing')) return true;
  if (/platform-qualification-pending|NEEDS_HUMAN|human architecture approval pending|cutover.*freigabe|supabase shutdown.*freigabe/i.test(s)) return true;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && parsed.executionLock === true) return true;
  } catch {
    /* plain text */
  }
  return false;
}

/**
 * Positively identified legacy-defect payloads only. Unknown plain-text or
 * novel structured locks must remain execution blockers (fail-closed) unless
 * they exactly match current inventory `legacyDefects` text.
 */
export function isLegacyDefectPayload(value) {
  if (isExecutionBlockerText(value)) return false;
  const s = text(value);
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object') {
      if (parsed.status === 'blocked-successor-acceptance') return true;
      if (typeof parsed.requiredSuccessorAcceptance === 'string') return true;
      if (typeof parsed.id === 'string' && /^(RPC-|EDGE-|INFRA-)/.test(parsed.id)) return true;
    }
  } catch {
    /* plain text is not auto-legacy — require inventory match at call site */
  }
  return false;
}

/** Every inventoried requiredTest becomes a binding assertion — no bullet-count truncation. */
function checksForTests(name, tests, sources) {
  return (tests ?? []).map((test) => ({ given: `Der eingefrorene Quellvertrag für ${name} und isolierte positive/negative Fixtures`, when: `Der Nachfolger den dokumentierten Fall für ${name} ausführt`, then: test, sourceRefs: sources }));
}

export function buildMigrationPlan({ previous, registry, rpcInventory, edgeInventory, splits }) {
  if (registry.repository !== migrationRepository || JSON.stringify(Object.entries(registry.issues).sort()) !== JSON.stringify(Object.entries(migrationIssueIdentities).sort())) throw new Error('Published registry differs from the reviewed 90 issue identities');
  const original = previous.issues.filter((issue) => !issue.localId.startsWith('RPC-'));
  const previousByLocalId = new Map((previous.issues ?? []).map((issue) => [issue.localId, issue]));
  const byNumber = new Map(original.map((issue) => [issue.githubIssue, issue.localId]));
  const rpcByName = new Map(rpcInventory.rpcs.map((row) => [row.rpc, row]));
  const edgesByNumber = new Map();
  for (const row of edgeInventory.edges) {
    const list = edgesByNumber.get(row.implementationIssue) ?? [];
    list.push(row);
    edgesByNumber.set(row.implementationIssue, list);
  }
  const infraByNumber = new Map(edgeInventory.infrastructure.map((row) => [row.implementationIssue, row]));
  // Preserve prior RPC child status/completionEvidence — splits.groups alone has no DONE state.
  const all = [
    ...original,
    ...splits.groups.map((group) => {
      const prior = previousByLocalId.get(group.id) ?? {};
      return {
        localId: group.id,
        githubIssue: registry.issues[group.id],
        title: prior.title ?? group.title,
        priority: prior.priority ?? 'P1',
        dependsOn: [],
        status: prior.status,
        completionEvidence: prior.completionEvidence,
        verification: prior.verification,
        labels: prior.labels,
      };
    }),
  ];
  if (all.length !== 90 || new Set(all.map((issue) => issue.localId)).size !== 90 || all.some((issue) => migrationIssueIdentities[issue.localId] !== issue.githubIssue)) throw new Error('Intake or split groups omit or replace a reviewed migration identity');
  const resolveDependencies = dependencyResolver({ issues: all, rpcGroups: splits.groups, edgeInventory });
  const issues = all.map((old) => {
    const id = old.localId;
    const manual = planContracts[id];
    const edges = edgesByNumber.get(old.githubIssue) ?? [];
    const edge = edges[0];
    const infra = infraByNumber.get(old.githubIssue);
    const group = splits.groups.find((entry) => entry.id === id);
    const ownedGroups = splits.groups.filter((entry) => entry.parentIssue === old.githubIssue);
    let definition;
    let sourceContracts = [];
    let inventoryLegacyDefects = [];
    let dependsOn = [];
    let rpcNames;
    let integrationWith = [];
    let ownedPrerequisites = [];
    let kind = 'implementation';
    if (manual) {
      definition = { ...manual, assertions: manual.checks.map(([given, when, then]) => ({ given, when, then, sourceRefs: manual.sources })) };
      dependsOn = manual.dependsOn ?? old.dependsOn;
      kind = id.startsWith('GATE-') ? 'architecture-evidence' : ['MIG-001', 'MIG-002', 'ATLAS-LIVE-E2E'].includes(id) ? 'evidence' : 'implementation';
    } else if (group) {
      rpcNames = group.rpcNames;
      sourceContracts = rpcNames.map((rpc) => `.qa/intake/rpc-contracts/${rpc}.md`);
      inventoryLegacyDefects = rpcNames.flatMap((rpc) => (rpcByName.get(rpc)?.legacyDefects ?? []).map(text));
      definition = {
        intent: `${group.title}: ${rpcNames.join(', ')} als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.`,
        sources: group.sourcePaths,
        targets: group.targetPaths,
        security: 'Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.',
        assertions: checksForTests(rpcNames.join(', '), group.acceptanceCriteria, group.sourcePaths),
      };
      dependsOn = unique(['MIG-020', 'MIG-013', 'MIG-022', 'MIG-024', ...group.dependencies]);
    } else if (ownedGroups.length) {
      kind = 'coordination';
      rpcNames = ownedGroups.flatMap((entry) => entry.rpcNames);
      sourceContracts = rpcNames.map((rpc) => `.qa/intake/rpc-contracts/${rpc}.md`);
      const sources = unique(ownedGroups.flatMap((entry) => entry.sourcePaths));
      definition = {
        intent: `Die ${rpcNames.length} RPCs dieses Bereichs über ${ownedGroups.length} einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets.`,
        sources,
        targets: unique(ownedGroups.flatMap((entry) => entry.targetPaths)),
        security: 'Die zentrale Policy bleibt obligatorisch. Jeder Teilvertrag trennt sichere Parität von explizit zu korrigierenden Legacy-Defekten. Der Koordinator erteilt keine Architekturfreigabe.',
        assertions: [
          { given: `Die RPC-Liste ${rpcNames.join(', ')}`, when: 'Die implementierten Untertickets werden gegen das AST-Inventar abgeglichen', then: `Alle ${rpcNames.length} RPCs sind genau einem dieser Untertickets zugeordnet: ${ownedGroups.map((entry) => entry.id).join(', ')}; kein RPC wird doppelt implementiert oder ausgelassen.`, sourceRefs: ['.qa/intake/rpc-contracts/split-groups.json'] },
          { given: 'Abgeschlossene einzelne RPC-Ports', when: 'Die bereichsübergreifende Alt/Neu-Suite mit echter Persistenz läuft', then: 'Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.', sourceRefs: sourceContracts },
          { given: 'Ein offenes Unterticket oder fehlender DB-/Transportnachweis', when: 'Der Koordinator geschlossen werden soll', then: 'Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.', sourceRefs: ['.qa/intake/rpc-contracts/split-groups.json'] },
        ],
      };
      dependsOn = ownedGroups.map((entry) => entry.id);
    } else if (edges.length) {
      sourceContracts = unique(edges.flatMap((entry) => [
        `.qa/intake/edge-infra-contracts/edge-${entry.function}.md`,
        entry.sourceContract,
      ].filter(Boolean)));
      inventoryLegacyDefects = edges.flatMap((entry) => (entry.legacyDefects ?? []).map(text));
      const names = edges.map((entry) => entry.function).sort();
      const behaviorParts = edges.map((entry) => {
        const behavior = entry.exposure?.dispatcherAllowed
          ? 'Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.'
          : entry.exposure?.kind === 'dispatcher'
            ? 'Nur die aktuell eingebundenen Worker über den zentralen Dispatcher erreichbar machen.'
            : 'Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.';
        return `${entry.function}: ${behavior}`;
      });
      // Co-owned Edge workers (e.g. MIG-402 + ollama-settings): preserve ALL requiredTests from EVERY sibling.
      const coOwnedAssertions = edges.flatMap((entry) => checksForTests(
        entry.function,
        entry.requiredTests ?? [],
        [
          `.qa/intake/edge-infra-contracts/edge-${entry.function}.md`,
          entry.sourceContract,
        ].filter(Boolean),
      ));
      definition = {
        intent: behaviorParts.join(' '),
        sources: unique(edges.flatMap((entry) => entry.verification?.sourceFiles?.map((file) => file.path) ?? entry.files)),
        targets: unique(edges.map((entry) => entry.proposedService).filter(Boolean)),
        security: edges.map((entry) => `${entry.function}: ${text(entry.authz)} Dispatcher-Status: ${text(entry.exposure)}.`).join(' ')
          + ' Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.',
        assertions: coOwnedAssertions,
      };
      ownedPrerequisites = [];
      dependsOn = ['MIG-020', 'MIG-013', 'MIG-014'];
      for (const entry of edges) {
        const declared = resolveDependencies(entry, id);
        ownedPrerequisites = unique([...ownedPrerequisites, ...declared.ownedPrerequisites]);
        dependsOn = unique([...dependsOn, ...declared.dependsOn]);
        if (/media|avatar|item-|look-reference|export|ollama-settings/.test(entry.function)) dependsOn.push('MIG-500');
        if (['character-avatar-meshy', 'item-model3d', 'item-thumbnail'].includes(entry.function)) dependsOn.push('MIG-402');
        if (entry.function === 'main') {
          dependsOn.push(...edgeInventory.edges
            .filter((row) => row.exposure?.dispatcherAllowed && row.function !== 'main')
            .map((row) => byNumber.get(row.implementationIssue)));
        }
      }
      // Keep titles stable for the original 24 single-function tickets; co-owned extras stay in contracts.
      if (names.length > 1 && !String(old.title).includes(names.join('+'))) {
        // Title remains the published GitHub title; body/intent lists every co-owned function.
      }
    } else if (infra) {
      sourceContracts = [`.qa/intake/edge-infra-contracts/infra-${infra.area}.md`, infra.sourceContract].filter(Boolean);
      inventoryLegacyDefects = (infra.legacyDefects ?? []).map(text);
      definition = {
        intent: `src/infrastructure/${infra.area}: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.`,
        sources: infra.verification?.sourceFiles?.map((entry) => entry.path) ?? infra.files,
        targets: [infra.proposedFacade],
        security: 'Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.',
        assertions: checksForTests(infra.area, infra.requiredTests, sourceContracts),
      };
      const declared = resolveDependencies(infra, id);
      integrationWith = declared.integrationWith;
      ownedPrerequisites = declared.ownedPrerequisites;
      dependsOn = unique(['MIG-012', 'MIG-013', 'MIG-020', ...declared.dependsOn]);
      if ((infra.storageBuckets ?? []).length) dependsOn.push('MIG-500');
      if ((infra.realtime ?? []).length) dependsOn.push('MIG-021');
    } else throw new Error(`No source-specific contract for ${id}`);

    const slug = featureSlug(id);
    const inventoryStates = rpcNames
      ? rpcNames.map((rpc) => rpcByName.get(rpc)?.verification?.status)
      : edges.length
        ? edges.map((entry) => entry.verification?.status)
        : infra
          ? [infra.verification?.status]
          : [];
    const sourceStatus = inventoryStates.some((state) => state !== 'source-verified') ? 'source-blocked' : sourceContracts.length ? 'source-verified' : 'specified';
    // Preserve recorded completionEvidence / accepted implementation; validator rejects forged READY/DONE without hashed checks.
    // Architecture freigabe alone is never DONE. Closed GitHub alone is never DONE. Source fingerprint alone is never DONE.
    // GATE-05 target is chosen but platform qualification is deferred → blocked until browser-host + ops acceptance.
    // Fully specified work with every predecessor DONE (+ completionEvidence) becomes READY; otherwise WAITING_DEPENDENCY.
    // Legacy defects are required in-ticket regressions — never execution blockers (queue deadlock after 25/90).
    const priorBlockers = Array.isArray(old.verification?.blockers) ? old.verification.blockers.map(text) : [];
    const priorRegressions = Array.isArray(old.verification?.requiredRegressions)
      ? old.verification.requiredRegressions.map(text)
      : [];
    const inventoryLegacySet = new Set(inventoryLegacyDefects.map(text));
    const requiredRegressions = unique([
      ...inventoryLegacyDefects,
      ...priorRegressions,
      ...priorBlockers.filter((entry) => isLegacyDefectPayload(entry)),
    ]);
    const blockers = unique([
      ...priorBlockers.filter((entry) => {
        const s = text(entry);
        if (isExecutionBlockerText(s)) return true;
        if (isLegacyDefectPayload(s)) return false;
        if (inventoryLegacySet.has(s)) return false;
        // Unknown prior blocker wording → keep as execution lock (fail-closed).
        return true;
      }),
      ...(id === 'ATLAS-LIVE-E2E' && previous.meta?.atlasLiveE2e?.ciAcceptance === 'not-passing'
        ? [ATLAS_E2E_EXECUTION_BLOCKER]
        : []),
    ]);
    const regressionAssertions = requiredRegressions.map((defect) => ({
      given: 'Der eingefrorene Legacy-Defekt aus dem Quellinventar',
      when: 'Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt',
      then: `Verpflichtende Legacy-Regression: ${defect}`,
      sourceRefs: sourceContracts.length ? sourceContracts : definition.sources,
    }));
    definition.assertions = [...definition.assertions, ...regressionAssertions];
    const acceptance = [...definition.assertions.map((entry) => entry.then), typedStrictAcceptance];
    const previousById = new Map((previous.issues ?? []).map((issue) => [issue.localId, issue]));
    const predecessorsDone = unique(dependsOn).every((dep) => {
      const predecessor = previousById.get(dep);
      return predecessor?.status === 'done' && typeof predecessor.completionEvidence === 'string' && predecessor.completionEvidence.length > 0;
    });
    let status;
    if (old.status === 'done') {
      status = 'done';
    } else if (id === 'GATE-05' || blockers.length > 0 || sourceStatus === 'source-blocked') {
      status = 'blocked';
    } else if (predecessorsDone) {
      status = 'ready';
    } else {
      status = 'waiting';
    }
    const priority = old.priority ?? 'P1';
    return {
      localId: id, githubIssue: registry.issues[id], title: old.title, priority, kind, status, featureSlug: slug,
      designFile: `${contractRoot}/${slug}.md`, dependsOn: unique(dependsOn), sourceContracts, integrationWith, ownedPrerequisites,
      ...(rpcNames ? { rpcNames } : {}), ...(group ? { parentIssue: group.parentIssue } : {}),
      before: { paths: unique(definition.sources), baselineSha, scope: 'Source-verified repository baseline; isolated DB evidence is separate from a deployed production inventory.' },
      after: { paths: unique(definition.targets.filter(Boolean)), behavior: definition.intent,
        architecture: 'Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending.' },
      behavior: definition.intent,
      security: definition.security,
      scope: { mayChange: unique(definition.targets.filter(Boolean)), mustNotChange: ['production data', 'unrelated product flows'], nonGoals: ['Unapproved framework substitution', 'Production cutover or Supabase shutdown', 'Retirement of any reachable legacy behavior without owner sign-off'] },
      acceptance, assertions: definition.assertions,
      ...(old.completionEvidence ? { completionEvidence: old.completionEvidence } : {}),
      verification: {
        sourceStatus,
        implementationStatus: old.status === 'done' || old.verification?.implementationStatus === 'accepted' ? 'accepted' : 'not-accepted',
        blockers: unique(blockers),
        requiredRegressions: unique(requiredRegressions),
        approvalRequired: id === 'GATE-05' ? 'platform-qualification-pending' : null,
      },
      contractSections: {
        vorher: `Baseline ${baselineSha}; Quellpfade: ${definition.sources.join(', ')}. Detaillierte Aufruf-/SQL-Nachweise: ${sourceContracts.length ? sourceContracts.join(', ') : 'die unten referenzierten Anforderungen'}.`,
        nachher: `${definition.intent} Zielpfade: ${definition.targets.filter(Boolean).join(', ')}.`,
        verhalten: definition.intent, sicherheit: definition.security, tests: acceptance, abhaengigkeiten: unique(dependsOn),
        grenzen: 'Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.',
      },
    };
  });

  const byId = new Map(issues.map((issue) => [issue.localId, issue]));
  const ports = issues.filter((issue) => /^(?:MIG-3\d\d|MIG-4\d\d|RPC-)/.test(issue.localId)).map((issue) => issue.localId);
  byId.get('MIG-600').dependsOn = unique(['MIG-021', 'MIG-023', 'MIG-024', 'MIG-500', ...ports]);
  byId.get('MIG-601').dependsOn = ['MIG-010', 'MIG-014', 'MIG-015', 'MIG-500', 'MIG-414'];
  byId.get('MIG-602').dependsOn = unique(['MIG-600', 'MIG-601', 'ATLAS-LIVE-E2E', ...ports]);
  byId.get('MIG-603').dependsOn = ['MIG-502', 'MIG-503', 'MIG-601'];
  const baseWave = (id) => /^(?:GATE-0[1-4]|ATLAS|MIG-00)/.test(id) ? 0 : /^MIG-01/.test(id) || id === 'MIG-500' ? 1 : /^(?:MIG-02|RPC-|MIG-35)/.test(id) || id === 'MIG-503' ? 2 : /^MIG-4/.test(id) ? 3 : /^MIG-3/.test(id) ? 4 : /^MIG-5/.test(id) ? 5 : /^MIG-6/.test(id) ? 6 : 7;
  // Optional tus is a post-core enhancement, explicitly excluded from cutover by the owner.
  byId.get('MIG-700').dependsOn = issues.filter((issue) => baseWave(issue.localId) <= 6 && issue.localId !== 'MIG-501').map((issue) => issue.localId);
  const pending = new Set(issues.map((issue) => issue.localId));
  const topo = [];
  while (pending.size) {
    const ready = [...pending].filter((id) => byId.get(id).dependsOn.every((dep) => topo.includes(dep))).sort((a, b) => baseWave(a) - baseWave(b) || a.localeCompare(b));
    if (!ready.length) throw new Error(`Dependency cycle or missing ID: ${[...pending].join(', ')}`);
    const id = ready[0]; pending.delete(id); topo.push(id);
    const issue = byId.get(id);
    issue.order = topo.length;
    issue.waveNumber = Math.max(baseWave(id), ...issue.dependsOn.map((dep) => byId.get(dep).waveNumber));
    issue.wave = waveNames[issue.waveNumber];
    const runnerLabel = issue.status === 'ready' ? 'agent-ready' : issue.status === 'done' ? 'agent-done' : 'agent-blocked';
    issue.labels = [
      issue.priority,
      issue.wave,
      `migration-order-${String(issue.order).padStart(3, '0')}`,
      runnerLabel,
      ...(issue.status === 'waiting' ? ['waiting-dependency'] : []),
      ...(issue.status === 'needs-design' ? ['needs-design'] : []),
      ...(issue.localId.startsWith('GATE-') ? ['gate-issue'] : []),
    ];
    issue.contractSections.abhaengigkeiten = issue.dependsOn;
  }
  const ordered = topo.map((id) => byId.get(id));
  const meta = {
    generatedAt: '2026-10-21', baselineSha, sourceDoc: 'docs/architektur-sqlite-based.md', githubIssuesPublished: true, githubIssueMapPartial: false, githubIssueMappedCount: ordered.length,
    note: 'Published contracts; source verification, isolated integration evidence, implementation acceptance and human architecture approval are separate states.',
    atlasLiveE2e: { githubIssue: 770, design: '.qa/design/atlas-live-e2e-cutover-gate.md', ciEnabled: true, workflow: '.github/workflows/stack-migration-baseline.yml', ciAcceptance: 'not-passing', implementationIssueRemainsOpen: true },
  };
  const nonExecutable = (status) => ['blocked', 'needs-design', 'waiting'].includes(status);
  const intake = { meta, coverage: { legacyMigrations: 106, legacyEdgeFunctions: edgeInventory.edges.length, legacyFrontendRpcs: rpcInventory.rpcs.length, originalLiteralFrontendRpcs: 55, infraAreas: edgeInventory.infrastructure.length, issuesTotal: ordered.length, originalMigrationIssues: 71, existingAtlasIssue: 1, rpcChildIssues: splits.groups.length, issuesReady: ordered.filter((issue) => issue.status === 'ready').length, issuesBlockedOrNeedsDesign: ordered.filter((issue) => nonExecutable(issue.status)).length, gateIssues: 5, openArchitectureDecisions: 1 }, waves: waveNames, topoOrder: topo, issues: ordered };
  const dependencyPlan = { schemaVersion: 2, baselineSha, topo, plan: ordered.map((issue) => ({ localId: issue.localId, githubIssue: issue.githubIssue, order: issue.order, wave: issue.waveNumber, status: issue.status, dependsOnGithub: issue.dependsOn.map((id) => byId.get(id).githubIssue), runnerBlock: nonExecutable(issue.status), labels: issue.labels })) };
  return { intake, dependencyPlan };
}

/** First non-empty path list for SLICE DONE wording (empty [] must not win). */
function sliceDeliverablePaths(issue) {
  const candidates = [issue.scope?.mayChange, issue.after?.paths, issue.before?.paths];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length > 0) return list.slice(0, 3);
  }
  return ['(see Scope)'];
}

/** Optional audit-matrix deferred/feature owners (same commit tree). */
function matrixOwnersById() {
  const matrixPath = '.qa/audits/migration-90-coverage-matrix-2026-10-24.json';
  if (!existsSync(matrixPath)) return new Map();
  try {
    const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
    return new Map(
      (matrix.rows || []).map((row) => [
        row.localId,
        {
          deferred: row.deferredIntegrationOwner,
          feature: row.featureVerificationOwner,
          featureBucket: row.feature,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Explicit slice vs deferred integration vs feature verification owners.
 * Prevents equating SLICE DONE with FEATURE VERIFIED / RELEASE APPROVED.
 */
function acceptanceTierBlock(issue, byId) {
  const ID = issue.localId;
  const link = (id) => {
    const peer = byId.get(id);
    return peer ? `${id}/#${peer.githubIssue}` : id;
  };
  const paths = sliceDeliverablePaths(issue);
  const matrixRow = matrixOwnersById().get(ID);
  const defaults = {
    slice: `Isolated deliverable under \`${paths.join('`, `')}\` with Required Tests / Edge Cases PASS at this issue's acceptance tier.`,
    deferred:
      matrixRow?.deferred && matrixRow.deferred !== '—'
        ? matrixRow.deferred
        : 'none — later consumers must not silently assume host activation beyond this slice without their own evidence.',
    feature:
      matrixRow?.feature && matrixRow.feature !== '—'
        ? matrixRow.feature
        : `${link('MIG-600')} (security parity) and ${link('MIG-602')} (host/DB/transport/browser integration); release cutover remains ${link('MIG-700')} + human approval.`,
    tier: 'isolated-contract',
  };
  const special = {
    'MIG-014': {
      slice: 'Cookie session resolution, revoke, and WS probe auth parity helpers on the host.',
      deferred: `${link('MIG-020')} / ${link('MIG-021')} transport entrypoints consume this identity; browser product E2E is ${link('MIG-602')}.`,
      tier: 'host-integration-partial',
    },
    'MIG-015': {
      slice: 'Solo local identity file + account-link boundaries without elevating client claims.',
      deferred: `${link('MIG-020')} remote auth paths; feature verify ${link('MIG-602')}.`,
      tier: 'host-integration-partial',
    },
    'MIG-020': {
      slice: 'Typed Hono HTTP command/query pipeline with revision/idempotency and role-scoped transport projection of gmNotes.',
      deferred: `Realtime room join/resync/fan-out is ${link('MIG-021')}; Colyseus Room product surface + browser E2E ${link('MIG-602')}.`,
      tier: 'host-integration',
    },
    'MIG-021': {
      slice: '`server/src/realtime` authorized join/resync with server-derived roles, durable event catch-up, commit fan-out hook, and host HTTP mount via createHost.',
      deferred: `Full Colyseus Room schema/transport adapter packaging remains activation work before FEATURE VERIFIED (${link('MIG-602')}); legacy Supabase channel adapters ${link('MIG-311')}. Slice does not equal browser E2E.`,
      feature: `${link('MIG-600')} + ${link('MIG-602')}; release ${link('MIG-700')}.`,
      tier: 'host-integration',
    },
    'MIG-022': {
      slice: 'SQLite SessionRuntimeState CAS, events, idempotency, and post-commit publisher semantics (ADR-ST-08).',
      deferred: `${link('MIG-021')} realtime consumers; ${link('MIG-311')} legacy adapters.`,
      tier: 'host-integration',
    },
    'MIG-023': {
      slice: 'Invite/join codes create player membership only; never GM proof; redeem limits and deny paths.',
      deferred: `Product UX adapters ${link('MIG-311')}; feature verify ${link('MIG-602')}.`,
      tier: 'host-integration',
    },
    'MIG-024': {
      slice: 'Recursive GM/player/spectator projection filter in `server/src/projections` + transport gmNotes stripping.',
      deferred: `Realtime object/event envelopes with reveal grants: ${link('MIG-021')}; legacy atlas/session adapters: ${link('MIG-311')}. Spectator path FEATURE VERIFIED only after consumer wiring + ${link('MIG-600')}.`,
      tier: 'isolated-contract',
    },
    'MIG-311': {
      slice: 'Legacy frontend session adapter ports against host contracts.',
      deferred: `none for adapter wiring; feature/browser verification ${link('MIG-602')}.`,
      feature: `${link('MIG-602')} + ${link('MIG-600')}.`,
      tier: 'adapter-integration',
    },
    'MIG-600': {
      slice: 'Cross-cutting permission/security parity suite across migrated host surfaces.',
      deferred: 'none for security parity scope; release still MIG-700 human gate.',
      feature: 'self (FEATURE VERIFIED for security parity when suite PASS).',
      tier: 'feature-security',
    },
    'MIG-602': {
      slice: 'Host/DB/transport/browser integration tests for migrated stacks.',
      deferred: `none for integration scope; cutover ${link('MIG-700')}.`,
      feature: 'self (FEATURE VERIFIED for covered journeys when suite PASS).',
      tier: 'feature-e2e',
    },
    'MIG-700': {
      slice: 'Cutover prerequisites checklist and evidence aggregation.',
      deferred: 'Production cutover + Supabase shutdown require independent human RELEASE APPROVED.',
      feature: 'human release approval (not agent-mergeable).',
      tier: 'release-gate',
    },
    'ATLAS-LIVE-E2E': {
      slice: 'Isolated Atlas product journey CI gate.',
      deferred: 'Known-red until suite PASS; not greenwashed.',
      feature: 'self when CI acceptance passes.',
      tier: 'feature-e2e',
    },
  };
  const row = { ...defaults, ...(special[ID] || {}) };
  return `## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | ${row.slice} |
| **Acceptance tier** | \`${row.tier}\` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | ${row.deferred} |
| **FEATURE VERIFIED** | ${row.feature} |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |
`;
}

export function renderIssue(issue, byId) {
  const refs = (paths) => paths.map(code).join(', ');
  const ID = issue.localId;
  const type = ID === 'ATLAS-LIVE-E2E' ? 'bug'
    : issue.kind === 'coordination' || /^GATE-/.test(ID) || /^MIG-00/.test(ID) ? 'chore'
    : 'feature';
  const isUserFacing = ID === 'ATLAS-LIVE-E2E'
    || /^(?:RPC-|MIG-0[12][0-9]|MIG-3[0-9]{2}|MIG-4[0-9]{2})/.test(ID);
  const targets = issue.scope.mayChange ?? issue.after.paths;
  const forbidden = issue.scope.mustNotChange ?? [];
  const sources = issue.sourceContracts.length ? issue.sourceContracts : issue.before.paths;
  const architecture = 'docs/architecture/migration-owner-decisions-2026-10-23.md';
  const blocks = issue.dependsOn.map((id) => `- Depends on #${byId.get(id)?.githubIssue ?? 'unpublished'} (${id})`).join('\n') || '- Keine Vorgänger.';
  const detailedCases = issue.assertions.map((entry, index) =>
    `### Fall ${index + 1}\n\n- Gegeben: ${entry.given}\n- Wenn: ${entry.when}\n- Dann: ${entry.then}\n- Quelle: ${refs(entry.sourceRefs)}\n`).join('\n');
  const regressions = issue.verification.requiredRegressions ?? [];
  const executionLocks = issue.verification.blockers ?? [];
  const knownDefects = regressions.length || executionLocks.length
    ? `\n### Bekannte Legacy-Defekte / negative Regressionen\n\n${[
        ...regressions.map((entry) => `- (Acceptance/Regression, sperrt READY nicht) ${entry}`),
        ...executionLocks.map((entry) => `- (Ausführungssperre) ${entry}`),
      ].join('\n')}\n`
    : '';
  const runtime = ID === 'MIG-703' || ID === 'GATE-05'
    ? '| Desktop macOS/Windows/Linux | Tauri+Node-Sidecar; echte Plattformtests erforderlich |\n| Browser/VPS | bestehender gemeinsamer Host unverändert; keine zweite Runtime |'
    : '| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |\n| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |\n| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |';
  const journey = isUserFacing
    ? `## User Journey\n\n1. Der berechtigte Nutzer startet den bereits vorhandenen SagaTree-Vorgang (keine neuen UX-Flows oder UI-Varianten erfinden).\n2. Der bestehende UI-/Service-Adapter erreicht den benannten Host-Use-Case unter unveränderten DTO-/Fehler- und Rollenverträgen.\n3. Die UI zeigt denselben fachlichen Zustand und die erlaubte Projektion; Lade-, Fehler-, Reload- und Reconnect-Verhalten bleibt äquivalent.\n4. Bei einem Fremdbesitzer, fehlender Membership oder nicht veröffentlichter GM-Information liefert der Host einen nachgewiesenen DENY statt nur versteckter UI.\n\nUI-Parität, soweit betroffen: \`src/THEME_GUIDE.md\`, \`docs/ui-styleguide.md\`, \`docs/concepts/adaptive-ui-experience-contract.md\`, \`docs/concepts/conductor-experience-contract.md\` und \`docs/concepts/imagination-first-visualization-contract.md\`.\n\n`
    : '';
  // Public GitHub Acceptance may summarize (≤5). Full binding tests stay in Edge Cases + Required Tests;
  // intake.acceptance / assertions remain 1:1 and are what validators enforce.
  const publicAcceptance = issue.acceptance.length <= 5 ? issue.acceptance : [
    `Alle ${issue.assertions.length} quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.`,
    'Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.',
    'Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.',
    'Touched files: zero type escape hatches (typed-strict / Boy Scout).',
  ];
  const requiredTestsBlock = issue.acceptance.map((entry, index) => `${index + 1}. ${entry}`).join('\n');
  const peers = issue.integrationWith?.length ? `## Integration peers\n\n${issue.integrationWith.map((id) => `- #${byId.get(id)?.githubIssue} (${id})`).join('\n')}\n\nGemeinsame Ports bleiben stabil, Integrationsabnahme in MIG-600; keine zyklischen Startverbote.\n\n` : '';
  const owned = issue.ownedPrerequisites?.length ? `## Owned internal prerequisites\n\n${issue.ownedPrerequisites.map((name) => `- ${code(name)}`).join('\n')}\n\nDiese Helper sind vollständig Teil dieses Tickets und benötigen eigene Sicherheits-/Atomizitätsnachweise.\n\n` : '';
  return `<!-- migration-contract:v2 localId=${ID} -->
# ${ID}: ${issue.title}

## Type

${type}

## Intent

${issue.behavior}

## Goal

${issue.contractSections.nachher}

## Non-Goals

${issue.scope.nonGoals.map((entry) => `- ${entry}`).join('\n')}

## Context

- Epic: #773; historische Baseline: ${code(baselineSha)}; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: ${code(architecture)}.
- Quellpfade und bestehende Adapter: ${refs(issue.before.paths)}.
- Source Contracts: ${refs(sources)}.
- Zielverhalten: ${issue.after.architecture}.
${issue.parentIssue ? `- RPC-Koordinator: #${issue.parentIssue}.\n` : ''}
## Scope

In:
${targets.map((entry) => `- ${code(entry)}`).join('\n')}

Out:
${forbidden.map((entry) => `- ${entry}`).join('\n')}
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

${journey}## Runtime

| Axis | This slice |
| --- | --- |
${runtime}

## Security & Data

- ${issue.security}
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.
${knownDefects}
## Edge Cases

${detailedCases}
## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake \`acceptance\` / \`assertions\`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

${requiredTestsBlock}

## Acceptance

${publicAcceptance.map((entry) => `- [ ] ${entry}`).join('\n')}

${acceptanceTierBlock(issue, byId)}
## Blockers

${blocks}

Status: **${issue.status}**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: ${code(issue.featureSlug)}
- Design: ${code(issue.designFile)}
- Status: ${issue.status}
- Reihenfolge: ${issue.order}; Welle: ${issue.waveNumber}
- Labels: ${issue.labels.map(code).join(', ')}
- Checks: ${code('npm run test-gate')}; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

${code(issue.designFile)}

${issue.contractSections.grenzen}

## Verification state

- Source: ${issue.verification.sourceStatus}
- Implementation acceptance: ${issue.verification.implementationStatus}
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

${peers}${owned}`;
}

export const bodyHash = (body) => createHash('sha256').update(body).digest('hex');
export function publishEntry(issue, byId, repository = migrationRepository) {
  const entry = { localId: issue.localId, issueNumber: issue.githubIssue, title: `${issue.localId}: ${issue.title}`, labels: issue.labels, bodyFile: issue.designFile, sha256: bodyHash(renderIssue(issue, byId)) };
  return { ...entry, payloadSha256: bodyHash(JSON.stringify({ repository, ...entry })) };
}
export { evidenceRoot, contractRoot };
