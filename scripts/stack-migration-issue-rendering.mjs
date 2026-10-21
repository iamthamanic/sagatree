import { createHash } from 'node:crypto';
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

function checksForTests(name, tests, sources) {
  return tests.slice(0, 4).map((test) => ({ given: `Der eingefrorene Quellvertrag für ${name} und isolierte positive/negative Fixtures`, when: `Der Nachfolger den dokumentierten Fall für ${name} ausführt`, then: test, sourceRefs: sources }));
}

export function buildMigrationPlan({ previous, registry, rpcInventory, edgeInventory, splits }) {
  if (registry.repository !== migrationRepository || JSON.stringify(Object.entries(registry.issues).sort()) !== JSON.stringify(Object.entries(migrationIssueIdentities).sort())) throw new Error('Published registry differs from the reviewed 90 issue identities');
  const original = previous.issues.filter((issue) => !issue.localId.startsWith('RPC-'));
  const byNumber = new Map(original.map((issue) => [issue.githubIssue, issue.localId]));
  const rpcByName = new Map(rpcInventory.rpcs.map((row) => [row.rpc, row]));
  const edgesByNumber = new Map();
  for (const row of edgeInventory.edges) {
    const list = edgesByNumber.get(row.implementationIssue) ?? [];
    list.push(row);
    edgesByNumber.set(row.implementationIssue, list);
  }
  const infraByNumber = new Map(edgeInventory.infrastructure.map((row) => [row.implementationIssue, row]));
  const all = [...original, ...splits.groups.map((group) => ({ localId: group.id, githubIssue: registry.issues[group.id], title: group.title, priority: 'P1', dependsOn: [] }))];
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
    let blockers = [];
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
      blockers = rpcNames.flatMap((rpc) => (rpcByName.get(rpc)?.legacyDefects ?? []).map(text));
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
      blockers = edges.flatMap((entry) => (entry.legacyDefects ?? []).map(text));
      const names = edges.map((entry) => entry.function).sort();
      const behaviorParts = edges.map((entry) => {
        const behavior = entry.exposure?.dispatcherAllowed
          ? 'Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.'
          : entry.exposure?.kind === 'dispatcher'
            ? 'Nur die aktuell eingebundenen Worker über den zentralen Dispatcher erreichbar machen.'
            : 'Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.';
        return `${entry.function}: ${behavior}`;
      });
      // Keep 2..4 assertions / 3..5 acceptance even when multiple Edge workers share one issue identity.
      const perEdgeCap = edges.length > 1 ? 2 : 4;
      const coOwnedAssertions = edges.flatMap((entry) => checksForTests(
        entry.function,
        (entry.requiredTests ?? []).slice(0, perEdgeCap),
        [
          `.qa/intake/edge-infra-contracts/edge-${entry.function}.md`,
          entry.sourceContract,
        ].filter(Boolean),
      )).slice(0, 4);
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
      blockers = (infra.legacyDefects ?? []).map(text);
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
    const acceptance = [...definition.assertions.map((entry) => entry.then), typedStrictAcceptance];
    const inventoryStates = rpcNames
      ? rpcNames.map((rpc) => rpcByName.get(rpc)?.verification?.status)
      : edges.length
        ? edges.map((entry) => entry.verification?.status)
        : infra
          ? [infra.verification?.status]
          : [];
    const sourceStatus = inventoryStates.some((state) => state !== 'source-verified') ? 'source-blocked' : sourceContracts.length ? 'source-verified' : 'specified';
    const status = id.startsWith('GATE-') ? 'needs-design' : 'blocked';
    const priority = old.priority ?? 'P1';
    return {
      localId: id, githubIssue: registry.issues[id], title: old.title, priority, kind, status, featureSlug: slug,
      designFile: `${contractRoot}/${slug}.md`, dependsOn: unique(dependsOn), sourceContracts, integrationWith, ownedPrerequisites,
      ...(rpcNames ? { rpcNames } : {}), ...(group ? { parentIssue: group.parentIssue } : {}),
      before: { paths: unique(definition.sources), baselineSha, scope: 'Source-verified repository baseline; isolated DB evidence is separate from a deployed production inventory.' },
      after: { paths: unique(definition.targets.filter(Boolean)), behavior: definition.intent, architecture: 'Concrete libraries remain subject to GATE decisions.' },
      behavior: definition.intent,
      security: definition.security,
      scope: { mayChange: unique(definition.targets.filter(Boolean)), mustNotChange: ['production data', 'unrelated product flows'], nonGoals: ['Unapproved framework choice', 'Production cutover', 'Silent retirement of an operation'] },
      acceptance, assertions: definition.assertions,
      verification: { sourceStatus, implementationStatus: 'not-accepted', blockers: unique(blockers), approvalRequired: id.startsWith('GATE-') ? 'human-architecture-decision' : null },
      contractSections: {
        vorher: `Baseline ${baselineSha}; Quellpfade: ${definition.sources.join(', ')}. Detaillierte Aufruf-/SQL-Nachweise: ${sourceContracts.length ? sourceContracts.join(', ') : 'die unten referenzierten Anforderungen'}.`,
        nachher: `${definition.intent} Zielpfade: ${definition.targets.filter(Boolean).join(', ')}.`,
        verhalten: definition.intent, sicherheit: definition.security, tests: acceptance, abhaengigkeiten: unique(dependsOn),
        grenzen: 'Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.',
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
  byId.get('MIG-700').dependsOn = issues.filter((issue) => baseWave(issue.localId) <= 6).map((issue) => issue.localId);
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
    issue.labels = [issue.priority, issue.wave, `migration-order-${String(issue.order).padStart(3, '0')}`, issue.status === 'ready' ? 'agent-ready' : 'agent-blocked', ...(issue.status === 'needs-design' ? ['needs-design', 'gate-issue'] : [])];
    issue.contractSections.abhaengigkeiten = issue.dependsOn;
  }
  const ordered = topo.map((id) => byId.get(id));
  const meta = {
    generatedAt: '2026-10-21', baselineSha, sourceDoc: 'docs/architektur-sqlite-based.md', githubIssuesPublished: true, githubIssueMapPartial: false, githubIssueMappedCount: ordered.length,
    note: 'Published contracts; source verification, isolated integration evidence, implementation acceptance and human architecture approval are separate states.',
    atlasLiveE2e: { githubIssue: 770, design: '.qa/design/atlas-live-e2e-cutover-gate.md', ciEnabled: true, workflow: '.github/workflows/stack-migration-baseline.yml', ciAcceptance: 'not-passing', implementationIssueRemainsOpen: true },
  };
  const intake = { meta, coverage: { legacyMigrations: 106, legacyEdgeFunctions: edgeInventory.edges.length, legacyFrontendRpcs: rpcInventory.rpcs.length, originalLiteralFrontendRpcs: 55, infraAreas: edgeInventory.infrastructure.length, issuesTotal: ordered.length, originalMigrationIssues: 71, existingAtlasIssue: 1, rpcChildIssues: splits.groups.length, issuesReady: ordered.filter((issue) => issue.status === 'ready').length, issuesBlockedOrNeedsDesign: ordered.filter((issue) => ['blocked', 'needs-design'].includes(issue.status)).length, gateIssues: 5, openArchitectureDecisions: 5 }, waves: waveNames, topoOrder: topo, issues: ordered };
  const dependencyPlan = { schemaVersion: 2, baselineSha, topo, plan: ordered.map((issue) => ({ localId: issue.localId, githubIssue: issue.githubIssue, order: issue.order, wave: issue.waveNumber, status: issue.status, dependsOnGithub: issue.dependsOn.map((id) => byId.get(id).githubIssue), runnerBlock: ['blocked', 'needs-design'].includes(issue.status), labels: issue.labels })) };
  return { intake, dependencyPlan };
}

export function renderIssue(issue, byId) {
  const refs = (paths) => paths.map(code).join(', ');
  const blocks = issue.dependsOn.map((id) => `- Depends on #${byId.get(id)?.githubIssue ?? 'unpublished'} (${id})`).join('\n') || '- Keine Vorgänger.';
  const assertions = issue.assertions.map((entry, index) => `### Fall ${index + 1}\n\n- Gegeben: ${entry.given}\n- Wenn: ${entry.when}\n- Dann: ${entry.then}\n- Quelle: ${refs(entry.sourceRefs)}\n`).join('\n');
  const defects = issue.verification.blockers.length ? `\n### Bekannte Legacy-Defekte / offene Verifikation\n\n${issue.verification.blockers.map((entry) => `- ${entry}`).join('\n')}\n` : '';
  const rendered = `<!-- migration-contract:v2 localId=${issue.localId} -->\n# ${issue.localId}: ${issue.title}\n\n## Type\n\n${issue.kind === 'coordination' ? 'Coordination' : 'Task'}\n\n## Intent\n\n${issue.behavior}\n\n## Goal\n\n${issue.contractSections.nachher}\n\n## Non-Goals\n\n${issue.scope.nonGoals.map((entry) => `- ${entry}`).join('\n')}\n\n## Context\n\nEpic #773. Baseline: ${code(baselineSha)}. ${issue.parentIssue ? `Koordinator: #${issue.parentIssue}. ` : ''}\n\n### Vorher\n\n${issue.contractSections.vorher}\n\n### Nachher und Verhalten\n\n${issue.contractSections.nachher}\n\n## Scope\n\n- Quellpfade: ${refs(issue.before.paths)}\n- Änderbare Zielpfade: ${refs(issue.after.paths)}\n- Quellverträge: ${issue.sourceContracts.length ? refs(issue.sourceContracts) : refs(issue.before.paths)}\n\n## Security & Data\n\n${issue.security}\n${defects}\n## Edge Cases\n\n${assertions}\n## Acceptance\n\n${issue.acceptance.map((entry) => `- [ ] ${entry}`).join('\n')}\n\n## Blockers\n\n${blocks}\n\nStatus: **${issue.status}**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.\n\n## Runner\n\n- Feature slug: ${code(issue.featureSlug)}\n- Design: ${code(issue.designFile)}\n- Status: ${issue.status}\n- Reihenfolge: ${issue.order}; Welle: ${issue.waveNumber}\n- Labels: ${issue.labels.map(code).join(', ')}\n- Checks: ${code('npm run test-gate')}; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.\n\n## Design\n\n${code(issue.designFile)}\n\n${issue.contractSections.grenzen}\n\n## Verification state\n\n- Source: ${issue.verification.sourceStatus}\n- Implementation acceptance: ${issue.verification.implementationStatus}\n- Human architecture approval: **not granted by this contract**\n`;
  const peers = issue.integrationWith?.length ? `## Integration peers\n\n${issue.integrationWith.map((id) => `- #${byId.get(id)?.githubIssue} (${id})`).join('\n')}\n\nDiese Adapter interagieren über die in MIG-012 fixierten Ports. Bestehende Signaturen bleiben beim einzelnen Port stabil; die gemeinsame Abnahme erfolgt in MIG-600. Ihre gegenseitigen Imports erzeugen kein zyklisches Startverbot.\n\n` : '';
  const owned = issue.ownedPrerequisites?.length ? `## Owned internal prerequisites\n\n${issue.ownedPrerequisites.map((name) => `- ${code(name)}`).join('\n')}\n\nDiese internen Helper gehören zum Implementierungsumfang dieses Tickets. Ihre sichere Policy und Atomizität müssen mit dem Edge-Port abgenommen werden; sie sind kein ausgelassener oder selbst erfüllter Vorgänger.\n\n` : '';
  return rendered.replace('## Security & Data', `${peers}${owned}## Security & Data`);
}

export const bodyHash = (body) => createHash('sha256').update(body).digest('hex');
export function publishEntry(issue, byId, repository = migrationRepository) {
  const entry = { localId: issue.localId, issueNumber: issue.githubIssue, title: `${issue.localId}: ${issue.title}`, labels: issue.labels, bodyFile: issue.designFile, sha256: bodyHash(renderIssue(issue, byId)) };
  return { ...entry, payloadSha256: bodyHash(JSON.stringify({ repository, ...entry })) };
}
export { evidenceRoot, contractRoot };
