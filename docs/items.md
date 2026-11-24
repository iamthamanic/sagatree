# Items — Architektur und Content-Grenzen

Canonical architecture doc for the Item Epic (#132 / closed by #144).
Describes how **definitions** (catalog content) relate to **instances** (character
ownership) without introducing marketplace, shops, or loot.

## Definitionen vs. Instanzen

| Schicht | Verantwortung | Ort |
|---|---|---|
| **ItemDefinition** | Mechanik + Taxonomie + Assets (Thumbnails/3D-Refs) | `src/domains/items/**` |
| **World availability** | Welche Definitionen eine Welt freigibt | World module `item-catalog` (`src/domains/items/world-catalog.ts`) |
| **ItemInstance** | Charakter-Besitz (Slots, Stapel, Ausrüstung) | Inventory v2 (`src/domains/character/inventory-v2/**`) |

Definitionen kommen aus Item-Domain, Builtin-Packs und World `item-catalog`.
Instanzen bleiben Character-owned — siehe `docs/inventory-v2.md`.

## Taxonomie & Provenienz (#134)

Stable vocabularies in `src/domains/items/taxonomy.ts`:

- **kindKey** — semantic kind (weapon, tool, device, …) independent of inventory type
- **settingTags** — fantasy / sci-fi / contemporary
- **techLevel**, **contexts**, **capabilities**, **roles**
- **origin** — provenance (`core` | `standard` | `world` | `personal`), not a marketplace source

`normalizeItemDefinition` / `validateItemDefinitionMetadata` fail-closed on unknown tags.
Payload versioning: `src/domains/items/payload.ts` (v2 = taxonomy + asset keys).

## Scopes

| Scope | Meaning | Mutability |
|---|---|---|
| **Core** | 36 mechanical archetypes | Read-only builtin |
| **Standard** | Builtin packs (#137) | Read-only builtin |
| **World** | World-authored defs + pack activation | Owner/world RLS |
| **Personal (Eigen)** | User-owned defs | Owner RLS |

Core remains the **mechanical** kernel. Standard / World / Personal **extend content**
without inventing new rule power — see Core Rules §10.0 / §5.7.

## Packs (#137)

- Pack model: `src/domains/items/pack.ts` — versioned id lists; no marketplace metadata
- Base packs: Fantasy / Sci-Fi / Contemporary Basic (40 defs each)
- Context packs reference existing definition ids only
- Registry: `src/domains/items/packs/**`

## World `item-catalog` (#142)

Module id: `item-catalog` on `world_profiles.modules`.

- Activate base/context packs, include/exclude definition ids, optional personal flag
- Pure resolver: `resolveWorldItemCatalog` / `composeCharacterInventoryAddCatalog`
- Null / unreadable world → Core + Personal only (backward compatible)
- Character Inventory add-catalog (#143) labels: **Core / Standard / Welt / Eigen**

## Assets & Provenienz (#140 / #141)

| Asset | Bucket | Edge function | Client secrets |
|---|---|---|---|
| Thumbnail PNG/JPEG ≤10 MB | `item-thumbnails` | `item-thumbnail` | **none** — no `VITE_*MESHY` / `NEXT_PUBLIC_*MESHY` |
| GLB ≤50 MB | `item-models` | `item-model3d` | **none** — same |

- User Meshy keys: Settings → AI → Bild/3D (`ai-provider-credentials`); encrypted at rest (`CREDENTIALS_ENCRYPTION_KEY`)
- Host `MESHY_API_KEY` is **server-only** and used in prod **only** when `AI_PROVIDER_ALLOW_HOST_KEYS=1` (local/CI); otherwise generate needs a user key
- Missing user key (and no allow-host) → generate returns `not-configured` (**fail-closed**); upload-only remains
- Meshy results are materialized into private storage before `assetKey` / `model3d` is set
- Library + Inventory show **thumbnails only** — no 3D renderer on those surfaces
- CI uses mocks/adapters (`ITEM_THUMBNAIL_MESHY_MOCK` / `ITEM_MODEL3D_MESHY_MOCK`); live Meshy is not required

Env detail: `README.md` sections „Item-Thumbnails“ and „Item-3D“.

### Static SVG item icons (Cursor → VTracer)

Separate from Meshy `assetKey` thumbnails. Production icons are **SVG files** under
`public/assets/items/{slug}.svg`, referenced via definition `iconKey` (= slug).

| Stage | Location |
|---|---|
| Prompt helper | `src/domains/items/icon-assets.ts` (`buildItemIconPrompt`) |
| Manifest | `assets/item-icons.manifest.json` |
| Source PNG (gitignored) | `assets/item-icon-sources/{slug}.png` |
| Production SVG | `public/assets/items/{slug}.svg` |
| Vectorize script | `npm run icons:vectorize` (optional local VTracer) |
| CI | `.github/workflows/vectorize-item-icons.yml` |

Resolution in UI: signed `assetSrc` → `/assets/items/{iconKey}.svg` → type PNG → slot glyph.
SVGs are loaded as `<img src>` — never via `dangerouslySetInnerHTML`.

#### Generate new item icon

1. Add/update the item in `assets/item-icons.manifest.json` (`iconPrompt`, `status: needs-png` or `regenerate`).
2. Ask Cursor Agent to generate the image with the shared SagaTree icon prompt.
3. Save the PNG to `assets/item-icon-sources/{slug}.png`.
4. Run vectorization (`npm run icons:vectorize` if VTracer is installed, or push/force-add the PNG and run the GitHub Action).
5. Commit the resulting SVG under `public/assets/items/`. Set manifest `status: ready`.
6. Set the definition `iconKey` to the slug. SagaTree uses only the SVG.

Valid SVGs are **never** regenerated automatically (`status: ready` skips conversion unless `--force` or `status: regenerate`).

Exact Agent command example:

```text
Generate the SagaTree item icon for `skull-sword`.

Read the shared item icon style prompt from the repository
(`getItemIconStyleTemplate` / `buildItemIconPrompt` in `src/domains/items/icon-assets.ts`).
Use Cursor image generation.
Item description:
"Black cursed longsword with skull-shaped pommel and subtle purple magical runes."

Save the generated source image to the configured item-icon source directory using the correct slug
(`assets/item-icon-sources/skull-sword.png`).
Do not modify any other files.
```

Do **not** install local Flux / Stable Diffusion / Ollama image models for this pipeline.
Raster generation is Cursor Agent image generation; vectorization is VTracer in GitHub Actions
(or optional local VTracer).

## Archive & Fork (#136)

- **Archive**: definition `status: archived` — owned instances stay resolvable; archived defs leave the add-catalog surface
- **Fork**: `buildForkedItemDefinitionDraft` copies mechanics + taxonomy, sets `basedOnDefinitionId`, never reuses source id
- Persistence: `src/infrastructure/inventory/item-catalog-service.ts` + host item catalog routes (owner/world from the Better Auth actor)

## Marketplace — future boundary

Marketplace / shops / loot / crafting are **out of scope**. Packs and `origin` must not
encode storefront source metadata. Character Editor remains **kein Shop**
(`docs/inventory-v2.md` Regel 10). Future marketplace work lands under
`src/modules/marketplace/` without changing Core mechanical power.

## Architecture paths (public surfaces)

```text
  Domain
  src/domains/items/**                  ItemDefinition, taxonomy, packs, world-catalog, assets, icon-assets, fork
  src/domains/character/inventory-v2/** ItemInstance / slots / equip
  src/domains/rules/sagatree/items/**  load / cost / protection / Traglast / tool kernel

Infrastructure
  src/infrastructure/inventory/item-catalog-service.ts
  src/infrastructure/inventory/item-catalog.persistence.ts
  src/infrastructure/inventory/item-thumbnail-service.ts
  src/infrastructure/inventory/item-model3d-service.ts

App / UI
  Library Items browser → /library (Items tab)
  Workbench             → /items/create , /items/:id
  World module UI       → world profile item-catalog
  Character Inventory   → Character Editor Inventar tab (add-catalog)

Static SVG icons
  assets/item-icons.manifest.json
  assets/item-icon-sources/
  public/assets/items/
  scripts/vectorize-item-icons.mjs
  .github/workflows/vectorize-item-icons.yml

Host / storage
  server/src/api/item-model3d-routes.ts  (POST /api/v1/items/model3d)
  server/src/api/item-thumbnail-routes.ts (POST /api/v1/items/thumbnail)
  host SQLite catalog + local asset store (definitions, inventory_v2, thumbnails, models)
```

## QA gates

Child contracts #133–#143 remain wired in `scripts/test-gate.mjs`.
Meta gate: `scripts/item-epic-acceptance-check.mjs` (#144).
E2E: `e2e/item-*.spec.ts`, `e2e/world-item-catalog-module.spec.ts`, `e2e/item-epic-acceptance.spec.ts`.
Evidence: `.qa/evidence/item-epic-acceptance/`.
