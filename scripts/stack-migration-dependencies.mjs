/** Resolve every inventoried prerequisite; unknown dependency kinds/names must fail closed. */
const helperOwners = Object.freeze({ sagatree_upsert_session_recap: 'RPC-SESSION-RECAP' });
const kinds = new Set(['rpc', 'internal-rpc', 'table', 'storage', 'auth', 'http-host', 'realtime', 'edge', 'infra']);

export function dependencyResolver({ issues, rpcGroups, edgeInventory }) {
  const byNumber = new Map(issues.map((issue) => [issue.githubIssue, issue.localId]));
  const rpcOwners = new Map(rpcGroups.flatMap((group) => group.rpcNames.map((name) => [name, group.id ?? group.localId])));
  const edges = new Map(edgeInventory.edges.map((row) => [row.function, row.implementationIssue]));
  const issueId = (number) => {
    const id = byNumber.get(number);
    if (!id) throw new Error(`Unmapped dependency issue #${number}`);
    return id;
  };
  return (row, currentId) => {
    const dependencies = row.dependencies;
    if (!Array.isArray(dependencies)) throw new Error(`${currentId}: dependency inventory must be an array`);
    const hard = new Set();
    const peers = new Set();
    const owned = new Set();
    const rpcOwner = (name) => {
      const owner = rpcOwners.get(name) ?? helperOwners[name];
      if (owner && issues.some((issue) => issue.localId === owner)) return owner;
      const local = dependencies.find((entry) => entry.kind === 'internal-rpc' && entry.name === name);
      if (local && issueId(local.issueNumber) === currentId) return currentId;
      throw new Error(`${currentId}: unmapped RPC dependency ${name}`);
    };
    for (const entry of dependencies) {
      if (!entry || !kinds.has(entry.kind) || typeof entry.name !== 'string' || !entry.name.trim()) throw new Error(`${currentId}: invalid dependency kind/name`);
      if (entry.kind === 'rpc') {
        hard.add(rpcOwner(entry.name));
      } else if (entry.kind === 'infra') {
        const peer = issueId(entry.issueNumber);
        if (peer !== currentId) peers.add(peer);
      } else if (entry.kind === 'internal-rpc') {
        const owner = issueId(entry.issueNumber);
        if (owner === currentId) {
          if (typeof entry.scope !== 'string' || !entry.scope.trim()) throw new Error(`${currentId}: own internal helper lacks explicit scope`);
          owned.add(entry.name);
        } else hard.add(owner);
      } else {
        if (entry.kind === 'edge' && edges.get(entry.name) !== entry.issueNumber) throw new Error(`${currentId}: Edge name and issue identity disagree`);
        hard.add(issueId(entry.issueNumber));
        if (entry.kind === 'table') hard.add(issueId(entry.policyIssueNumber));
      }
    }
    for (const name of row.rpcUsed ?? []) {
      const owner = rpcOwner(name);
      if (owner === currentId) owned.add(name);
      else hard.add(owner);
    }
    for (const name of row.edgeInvokes ?? []) hard.add(issueId(edges.get(name)));
    if (hard.has(currentId)) throw new Error(`${currentId}: undeclared self dependency`);
    return { dependsOn: [...hard], integrationWith: [...peers], ownedPrerequisites: [...owned] };
  };
}
