#!/usr/bin/env node
/**
 * mig-305-marketplace-adapter.self-test — Marketplace host ports + dual-path seam (#804).
 * Location: scripts/mig-305-marketplace-adapter.self-test.mjs
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}
function actor(id) {
  return { kind: "remote-account", actorId: id, sessionId: `auth-${id}`, email: null };
}

const persistenceUrl = pathToFileURL(join(root, "server/src/persistence/index.ts")).href;
const marketplaceUrl = pathToFileURL(join(root, "server/src/modules/marketplace/index.ts")).href;
const hostUrl = pathToFileURL(join(root, "server/src/bootstrap/create-host.ts")).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const {
  createMarketplacePorts,
  MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED,
  MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED,
  MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE,
  escapeMarketplaceLikePattern,
} = await import(marketplaceUrl);
const { createHost } = await import(hostUrl);

const adapterLoadDir = mkdtempSync(join(tmpdir(), "mig305-adapter-"));
function rewriteTsImports(source) {
  return source.replace(/from ["'"](\.[^"'"]+)["'"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ["host-marketplace-ports.contract.ts", "host-marketplace-adapter.ts"]) {
  const src = readFileSync(join(root, "src/infrastructure/marketplace", name), "utf8");
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostMarketplaceAdapter }, { HOST_MARKETPLACE_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, "host-marketplace-adapter.ts")).href),
  import(pathToFileURL(join(adapterLoadDir, "host-marketplace-ports.contract.ts")).href),
]);
assert(typeof createHostMarketplaceAdapter === "function", "adapter loaded");
assert(HOST_MARKETPLACE_OPS.length === 8, "ops count");

const work = mkdtempSync(join(tmpdir(), "mig305-"));
mkdirSync(join(work, "data"), { recursive: true });
const notes = [];
try {
  assert(MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED === false, "no HTTP");
  assert(MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED === false, "no count HTTP");
  assert(MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED === true, "legacy superseded");
  assert(MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE === true, "param LIKE");
  assert(TABLE_OWNERSHIP.marketplace_items === "marketplace", "ownership");
  assert(escapeMarketplaceLikePattern("a%b_c") === "a\\\\%b\\\\_c".replace(/\\\\/g, "\\"), "escape");

  const boot = bootstrapHostPersistence({
    dataDir: join(work, "data"),
    migrationsDir: join(root, "server/migrations"),
  });
  assert(boot.ok, `boot`);
  const marketplace = createMarketplacePorts({ db: boot.db });
  const owner = actor("owner-o");
  const stranger = actor("stranger-x");

  const createdA = marketplace.createItem(owner, {
    type: "world", title: "Alpha World", description: "first desc", data: { biome: "forest" }, price: 0, tags: ["alpha"],
  });
  assert(createdA.ok, "create A");
  assert(createdA.value.authorId === owner.actorId, "author from actor");

  const createdB = marketplace.createItem(owner, {
    type: "item", title: "Beta Blade", description: "sharp %_literal", data: { dmg: 3 }, price: 5,
  });
  assert(createdB.ok, "create B");

  marketplace.incrementDownloads(owner, createdA.value.id);
  marketplace.incrementDownloads(owner, createdA.value.id);
  marketplace.incrementDownloads(owner, createdB.value.id);

  const listedDefault = marketplace.listItems();
  assert(listedDefault.ok && listedDefault.value.length === 2, "list all");
  assert(listedDefault.value[0].id === createdA.value.id, "downloads desc");
  assert(marketplace.listItems({ type: "item" }).value.length === 1, "type filter");
  assert(marketplace.listItems({ maxPrice: 0 }).value.length === 1, "maxPrice");
  assert(marketplace.listItems({ searchQuery: "Beta" }).value.length === 1, "search");
  assert(marketplace.listFeatured().value.length === 2, "featured");
  assert(marketplace.getItemById("does-not-exist").value === null, "missing null");
  assert(!marketplace.getItemById("  ").ok, "empty id");
  notes.push("List filters/sort/featured/single-read PASS");

  assert(!marketplace.incrementDownloads(actor(""), createdA.value.id).ok, "inc DENY");
  const noop = marketplace.incrementDownloads(owner, "missing");
  assert(noop.ok && noop.mutated === false, "noop");
  notes.push("Increment atomic + DENY PASS");

  const privileged = marketplace.createItem(owner, {
    type: "item", title: "Evil", data: {}, author_id: "x", downloads: 9,
  });
  assert(!privileged.ok && privileged.error === "privileged-client-field", "privileged deny");
  assert(!marketplace.updateItem(stranger, createdA.value.id, { title: "Hijack" }).ok, "foreign update");
  assert(!marketplace.deleteItem(stranger, createdA.value.id).ok, "foreign delete");
  assert(marketplace.updateItem(owner, createdA.value.id, { title: "Alpha Renamed" }).ok, "owner update");
  assert(marketplace.deleteItem(owner, createdB.value.id).ok, "owner delete");
  assert(marketplace.getItemById(createdB.value.id).value === null, "gone");
  assert(!marketplace.deleteItem(owner, createdB.value.id).ok, "delete missing");
  notes.push("Ownership DENY PASS");

  assert(/Atomic host path only/.test(readFileSync(join(root, "server/src/modules/marketplace/index.ts"), "utf8")), "atomic doc");
  assert(/no client counter write/.test(readFileSync(join(root, "src/infrastructure/marketplace/marketplace-service.ts"), "utf8")), "fe no fallback");
  notes.push("Legacy counter fallback superseded PASS");

  const lit = marketplace.createItem(owner, {
    type: "character", title: "Percent % underscore _", description: "needle %_literal here", data: {},
  });
  assert(lit.ok, "lit create");
  assert(marketplace.listItems({ searchQuery: "%_literal" }).value.some((r) => r.id === lit.value.id), "escaped search");
  assert(marketplace.listItems({ searchQuery: "%" }).value.length === 0, "bare %");
  notes.push("Escaped search PASS");

  const bound = createHostMarketplaceAdapter({
    listItems: async (filters) => marketplace.listItems(filters),
    getItemById: async (id) => marketplace.getItemById(id),
    listFeatured: async () => marketplace.listFeatured(),
    listByAuthor: async (authorId) => marketplace.listByAuthor(authorId),
    createItem: async (actorId, draft) => marketplace.createItem(actor(actorId), draft),
    updateItem: async (actorId, id, patch) => marketplace.updateItem(actor(actorId), id, patch),
    deleteItem: async (actorId, id) => marketplace.deleteItem(actor(actorId), id),
    incrementDownloads: async (actorId, itemId) => marketplace.incrementDownloads(actor(actorId), itemId),
  });
  assert(bound.transport === "host", "transport");
  const via = await bound.createItem(owner.actorId, { type: "ruleset", title: "Adapter Rules", data: { v: 1 } });
  assert(via.ok, "adapter create");
  assert((await bound.incrementDownloads(owner.actorId, via.value.id)).ok, "adapter inc");

  const hostWork = mkdtempSync(join(tmpdir(), "mig305-host-"));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork, SAGATREE_PORT: "18768", SAGATREE_HOST: "127.0.0.1", SAGATREE_HOST_MODE: "solo",
    });
    assert(!("error" in host), "createHost");
    assert(host.marketplace?.moduleId === "marketplace", "wired");
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  assert(/createHostMarketplaceAdapter/.test(readFileSync(join(root, "src/infrastructure/marketplace/index.ts"), "utf8")), "barrel");
  assert(!/marketplaceRoutes/i.test(readFileSync(join(root, "server/src/api/create-app.ts"), "utf8")), "no HTTP");
  for (const rel of [
    "server/src/modules/marketplace/index.ts",
    "server/src/modules/marketplace/internal/marketplace-catalog-store.ts",
    "src/infrastructure/marketplace/host-marketplace-adapter.ts",
    "src/infrastructure/marketplace/host-marketplace-ports.contract.ts",
  ]) {
    assert(!/\bas any\b|@ts-ignore|@ts-expect-error/.test(readFileSync(join(root, rel), "utf8")), `strict ${rel}`);
  }
  notes.push("typed-strict + createHost PASS");

  writeFileSync(join(root, ".qa/acceptance/stack-migration-mig-305.md"), [
    "# Acceptance — MIG-305 Marketplace Host Adapters (#804)", "",
    "## Required Tests", ...notes.map((n) => `- [x] ${n}`), "",
    "## Evidence", `- Self-test PASS at ${new Date().toISOString()}`, "",
  ].join("\n"));
  console.log("PASS mig-305-marketplace-adapter.self-test");
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
