<div align="center">
<img src="docs/brand/logo.png" width="148" alt="SagaTree Logo" />

# SagaTree

**Die Open-Source-Plattform für immersive Pen-&-Paper Abenteuer .**

Charaktere · Sessions · Welten — für Gamemaster und Spieler
</div>

<p align="center">
  <a href="#tech-stack"><img src="https://img.shields.io/badge/React_18-0891B2?style=flat-square" alt="React" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Vite_6-E8A641?style=flat-square" alt="Vite" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/TypeScript-0891B2?style=flat-square" alt="TypeScript" /></a>
  <a href="#backend--self-host"><img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square" alt="Supabase" /></a>
  <a href="#design--uiux"><img src="https://img.shields.io/badge/Tailwind_4-06B6D4?style=flat-square" alt="Tailwind" /></a>
</p>

<p align="center">
  <a href="https://www.figma.com/design/XyboDSHba8TNFw0Bb5uUs4/SagaTree">Figma Design</a> ·
  <a href="src/THEME_GUIDE.md">Theme Guide</a> ·
  <a href="README_SELFHOST.md">Self-Host</a> ·
  <a href="src/ARCHITECTURE.md">Architektur</a>
</p>

<p align="center">
  <img src="docs/screenshots/carousel.gif" alt="SagaTree Screens: Login, Dashboard, Bibliothek, Charakter-Editor, Marktplatz, Session" width="720" />
</p>

<p align="center">
  <a href="docs/screenshots/01-login.png">Login</a> ·
  <a href="docs/screenshots/02-dashboard.png">Dashboard</a> ·
  <a href="docs/screenshots/03-bibliothek.png">Bibliothek</a> ·
  <a href="docs/screenshots/04-character-editor.png">Charakter-Editor</a> ·
  <a href="docs/screenshots/05-marktplatz.png">Marktplatz</a> ·
  <a href="docs/screenshots/06-session-join.png">Session</a>
</p>

---

## Überblick

### Elevator Pitch

**SagaTree** verbindet Gamemaster und Spieler in einer App: Charaktere bauen, Sessions live führen, Kampagne und Welt behalten.

- **Für Gamemaster** — Session vorbereiten und am Tisch steuern; Welten, Bibliothek und Live-Runtime an einem Ort.
- **Für Spieler** — Charakter mit SagaTree Core erstellen, der Gruppe beitreten, Inventar und Look dort haben, wo gespielt wird.

### Produkt & Stack

Marke und Regelwerk: **SagaTree** / **SagaTree Core** (Ruleset-ID `sagatree-core`).

Dieses Repo: **React + Vite**-Frontend mit **selbst gehostetem Supabase-Stack** (Auth, Postgres, Storage, Realtime, Edge) und Schichten `domains` → `infrastructure` → `app` · UI in `shared/ui`.

| Rolle | Nutzen |
| --- | --- |
| **Gamemaster** | Projekte, Sessions, Bibliothek, Weltprofile, Live-Steuerung |
| **Spieler** | Charaktereditor (SagaTree Core), Inventar, Session-Join, Look / LiveAct |
| **Creator** | Items, NPCs, Avatar-Assets, optional Meshy 2D/3D (BYOK) |

---

## Features

| Bereich | Was drin ist |
| --- | --- |
| **Projekte & Mitgliedschaft** | Sagas anlegen, Join-by-Code, RLS-gesicherte Rollen (GM / Spieler) |
| **SagaTree Core Editor** | Spezies · Parameter · Look · Inventar · Einstellungen / Presets |
| **Live Sessions** | Lobby, GM- und Player-Panel, Realtime Session-Runtime |
| **Bibliothek & Welten** | Abenteuer, World Profiles, Maps |
| **Inventar & Items** | Inventory v2, Item-Workbench, Thumbnails & optional GLB |
| **LiveAct** | MediaPipe Face Tracking, Avatar-Capabilities, Kalibrierung |
| **KI (optional)** | Character-Lore, Portraits, Meshy Text-to-Image / Image-to-3D |
| **Marketplace & Rulesets** | Erweiterbare Inhalte und Regelwerke |
| **Adaptive UI** | Phone / Tablet / Desktop-Rekomposition (`AU-*` Experience Contract) |

---

## Design & UI/UX

SagaTree folgt einer klaren Markenidentität aus dem Logo: **Teal für Auswahl & CTA**, **Gold für Hover & Premium**. Surfaces bleiben dunkel und ruhig — professionell und fokussiert.

| | Primär | Akzent | Surface |
| :---: | :---: | :---: | :---: |
| **Dark** | `#06B6D4` | `#F59E0B` | `#0F172A` |
| **Light** | `#0891B2` | `#E8A641` | `#FFFFFF` |

<p align="center"><img src="docs/brand/mark.png" width="56" alt="SagaTree Mark" /></p>

**Gestaltungsprinzipien**

- **Werkzeug zuerst** — klare Hierarchie, wenig Dekoration, hohe Lesbarkeit
- **Zwei Markenrollen** — Cyan = Auswahl / primäre Aktion · Gold = Hover / Premium
- **Imagination First** — Visualisierung unterstützt das Spiel, ersetzt es nicht
- **Adaptive Content Width** — Journey/Session folgt der Main-Pane (`@container/main`)
- **Radix + Tailwind** — zugängliche Primitives, Tokens in `src/styles/globals.css`

| Dokument | Inhalt |
| --- | --- |
| [`src/THEME_GUIDE.md`](src/THEME_GUIDE.md) | Kanonische CI, Farbrollen, Control-Affordances |
| [`docs/ui-styleguide.md`](docs/ui-styleguide.md) | UI-Komponenten & Patterns |
| [`docs/concepts/adaptive-ui-experience-contract.md`](docs/concepts/adaptive-ui-experience-contract.md) | Mobile / Touch / Safe Areas / `AU-*` |
| [`docs/concepts/conductor-experience-contract.md`](docs/concepts/conductor-experience-contract.md) | Performance Mode, Live-Steuerung, Motion |
| [`docs/concepts/imagination-first-visualization-contract.md`](docs/concepts/imagination-first-visualization-contract.md) | Scenes, 2D/3D, Visual Authority |

---

## Tech Stack

| Schicht | Technologie |
| --- | --- |
| Frontend | React 18 · Vite 6 · TypeScript · Tailwind CSS 4 |
| UI | Radix UI · shadcn-basierte Primitives (`src/shared/ui`) |
| 3D / Avatar | Three.js · `@pixiv/three-vrm` · MediaPipe Face Landmarker |
| Backend | Self-hosted Supabase: Postgres · GoTrue · PostgREST · Storage · Realtime · Kong · Deno Edge |
| Qualität | Playwright · `test-gate` · `composition-gate` · Architecture Boundary Check |
| Deploy | Docker Compose Self-Host (Vite-Build → `build/`) |

Dev-Server: **`http://localhost:3004`** (`vite.config.ts` → `server.port = 3004`)

---

## Quick Start

**Voraussetzungen:** Node.js 20+ · npm 10+ · für Edge-Diffs im Gate: Deno LTS

```bash
npm install
npm run dev
```

Produktions-Build:

```bash
npm run build   # Output: build/
```

Umgebungsvariablen: siehe [`.env.example`](.env.example). Secrets nie mit `VITE_` / `NEXT_PUBLIC_` ins Client-Bundle legen.

Self-Host-Stack (Docker): → **[`README_SELFHOST.md`](README_SELFHOST.md)**  
Migrationen anwenden: `bash scripts/apply-migrations.sh <migration.sql>`

---

## Architektur

Modularer Monolith mit harten Importgrenzen (CI-enforced):

```text
src/
├── app/              # Vertikale Slices / User Journeys
├── domains/          # Reine Domain-Verträge & SagaTree-Core-Regeln
├── infrastructure/   # Supabase-, Storage-, Three-/LiveAct-Adapter
├── shared/ui/        # Fachlich neutrale UI-Primitives
├── lib/              # Auth, Supabase-Client, Querschnitt
└── styles/           # Theme-Tokens (globals.css)
```

| Layer | Darf importieren | Darf nicht |
| --- | --- | --- |
| `domains/` | stdlib, sibling domains | React, UI, Supabase, `app/` |
| `infrastructure/` | domains, `lib/supabase` | React, `shared/ui`, `app/` |
| `app/<area>/` | domains, infrastructure, `shared/ui`, andere Areas nur über Public Barrel | direkte Supabase-Calls, fremde Private-Dateien |

`src/modules/**` und `src/components/**` sind **entfernt** — Neu anlegen bricht den Architecture Gate. Details: [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md).

---

## SagaTree Core Character Editor

„Charakter erstellen“ öffnet einen Zwei-Karten-Chooser (eigener Charakter vs. Preset). Der Editor hat fünf Haupttabs:

**Spezies** · **Parameter** · **Look** · **Inventar** · **Einstellungen** (`Statistik` / `Preset`)

SagaTree Core ist kein umbenanntes D&D: Begriffe wie **Spezies**, **Archetyp**, **Essenz**, **Ausdauer**, **Verstand**, **Wahrnehmung**; Startverteilung `4,3,3,2,2,1`; 18 Core-Fertigkeiten; Speziesmerkmale `3/3` Punkte. Inventar v2: **20 Basisplätze** + Ausrüstung, Traglast `5 + 2 × Stärke`.

Persistenz (Auszug): `attributes` · `skills` · `sagatree_profile` · `background_story` · `notes`  
Legacy-Keys (`constitution` → Ausdauer usw.) werden beim Lesen normalisiert.

Regeln & Validierung: [`docs/sagatree core rules.md`](docs/sagatree%20core%20rules.md) · [`docs/inventory-v2.md`](docs/inventory-v2.md)

---

## KI, Portraits & Meshy

| Feature | Edge / Storage | Hinweis |
| --- | --- | --- |
| Character-Lore | `character-lore` | Provider: `ollama` / `openai-compatible`; Keys nie im Browser |
| Portraits | Bucket `character-portraits` | Owner-scoped, signierte URLs |
| Item 2D | Edge `item-thumbnail` · Meshy Text-to-Image → `item-thumbnails` | Prod: User-BYOK; ohne Key: `not-configured` (fail-closed) |
| Item 3D | Edge `item-model3d` · Meshy Image-to-3D → `item-models` | GLB max. 50 MB; Bibliothek zeigt nur Thumbnails |
| Avatar-Katalog | Manifeste + optional `VITE_AVATAR_ASSET_BASE_URL` | Lizenzierte / gepinnte Assets — siehe [`docs/avatar assets.md`](docs/avatar%20assets.md) |

Wichtige Server-Env (Edge / Host — **nicht** im Vite-Bundle). Keys liegen **nie** als `VITE_*MESHY` / `NEXT_PUBLIC_*` im Client:

```bash
CHARACTER_AI_PROVIDER=ollama
CHARACTER_AI_RATE_LIMIT_PER_MINUTE=6
CHARACTER_AI_ALLOWED_ORIGIN=http://localhost:3004
CREDENTIALS_ENCRYPTION_KEY=
# MESHY_API_KEY=                 # nur lokal/CI mit AI_PROVIDER_ALLOW_HOST_KEYS=1
# AI_PROVIDER_ALLOW_HOST_KEYS=1
```

CORS und fehlende Provider-Keys sind fail-closed (kein Default `*`). Rate-Limits laufen persistent über Postgres-RPCs.

---

## Backend & Self-Host

Kern-Services für den Produktbetrieb:

**Postgres · Auth · PostgREST · Storage · Realtime · Kong · Edge · Redis**  
(`docker compose up -d` = dieses Core-Profil; gut für ~8 GB-VPS + Cloud-LLM.)  
Ollama / Neo4j / Studio sind **Compose-Profile** (`ai-local` / `graph` / `dev-tools` / `full`) — siehe [`docs/ops/compose-profiles.md`](docs/ops/compose-profiles.md). Meshy bleibt optional (BYOK).

Relevante Character-/Asset-Migrationen (Reihenfolge):

```text
002_character_trait_arrays.sql
003_character_lore_rate_limits.sql
004_project_membership_security.sql
005_character_ruleset_metadata.sql
006_character_portrait_storage.sql
007_sagatree_character_profile.sql
008_world_profiles.sql
009_character_adventure_arcs.sql
010_characters_v3_columns.sql
011_seed_local_admin.sql
012_character_presets.sql
013_character_presets_rls_hardening.sql
014_character_abilities_emotion_profiles.sql
015_inventory_item_definitions.sql
016_character_inventory_v2.sql
017_item_thumbnail_assets.sql
018_item_model3d_assets.sql
020_user_ai_provider_credentials.sql
```

Bei Schema V3 zuerst die kanonischen RLS-Policies aus `src/supabase/schema_v3_rls.sql` anwenden, danach die Migrationen oben.  
Self-Host: [`README_SELFHOST.md`](README_SELFHOST.md) · Deploy: [`src/supabase/DEPLOY_V3.md`](src/supabase/DEPLOY_V3.md)

---

## Quality Gates

Auf Push / PR gegen `main`:

```bash
npm run test-gate          # Lint, Typecheck, Build, Deno, Contracts, Secrets-Scan, Architecture
npm run composition-gate   # Semantische Multi-Hop-Proofs
npm run test:e2e           # Playwright (Chromium)
```

Lokal:

```bash
npx playwright install chromium
npm run test:e2e
```

Agent-Konfiguration: [`.cursor/`](.cursor/) — vor Änderungen: `npx ecc-agentshield scan --path .cursor`

---

## Projektstruktur

```text
SagaTree/                 # Repo (historisch auch sagatree/ lokal)
├── src/                 # Frontend (app · domains · infrastructure · shared · lib)
├── supabase/            # migrations · functions · config
├── public/              # Favicons, MediaPipe, Item-/NPC-Assets
├── docs/                # Regeln, Styleguides, Brand, Concepts
│   └── brand/           # SagaTree Logo & Mark für Doku / README
├── e2e/ · scripts/ · assets/
├── docker-compose*.yml
├── README.md
└── README_SELFHOST.md
```

---

## Dokumentation

| Thema | Pfad |
| --- | --- |
| Self-Host | [`README_SELFHOST.md`](README_SELFHOST.md) |
| Integration | [`INTEGRATION.md`](INTEGRATION.md) |
| Feature-Vergleich | [`FEATURE_COMPARISON.md`](FEATURE_COMPARISON.md) |
| Architektur | [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) |
| Auth / Supabase Setup | [`src/AUTH_SETUP.md`](src/AUTH_SETUP.md) · [`src/SUPABASE_SETUP.md`](src/SUPABASE_SETUP.md) |
| Items | [`docs/items.md`](docs/items.md) |
| Inventory v2 | [`docs/inventory-v2.md`](docs/inventory-v2.md) |
| Avatar Assets | [`docs/avatar assets.md`](docs/avatar%20assets.md) |
| World Profiles | [`docs/world profiles.md`](docs/world%20profiles.md) |
| Deploy V3 | [`src/supabase/DEPLOY_V3.md`](src/supabase/DEPLOY_V3.md) |

---

## Recent changes

- **2026-10-18** — Weltatlas 3D: native Prototype-Mount, Länder-Hierarchie, Suche/Filter, editierbare/verschiebbare Kartenlabels (`feat/donalu-world-workspace`)
- **2026-10-17** — Donalu-Weltworkspace: Places + Map-Links (`WO-9FFK6`), Orte-Panel, Dungeon Confirm/`manualDirty`, Player-Reveal-RPC; Hybrid 2D/3D Atlas
- **2026-10-17** — Local Admin: Timeout-Fallback übernimmt späten GoTrue-JWT (PostgREST/RLS); Logout bleibt anti-Resurrection
- **2026-10-17** — Weltatlas: Unified Canvas (Multi-Scale-Zoom, Pinsel/Stempel, Demo Eldoria); Speichern in `generator_meta.unifiedCanvas` (`#702`)
- **2026-10-15** — Session-Lobby: Cover-Meta + Meet-Device-Bar; Account-Avatar in Shell/Lobby; Settings-Routen `/settings/*`; Avatar-Upload mit Auto-Downscale
- **2026-10-14** — Bibliothek: ⋮-Menüs (Copy Public-ID / Duplizieren), Liste·Grid·Karussell für alle Tabs, WO-/LK-Public-IDs, SagaTree-Native-Badge
- **2026-10-13** — Bibliothek: Slash-Routen (`/library/player-characters`, `/library/sagas`, …); Karussell-Karten breiter + portrait-/cover-sichere Bildframes
- **2026-10-12** — Saga-Workspace: Lobby direkt nach Create mit großem Join-Code; Bibliothek-Tab Sagas; Spieler-Charaktere + Lore; local `player` Demo-Login (`074`)
- **2026-10-11** — Backend-Audit: Variant A (Supabase-Stack optimieren); Realtime/`SECRET_KEY_BASE` & Footprint dokumentiert
- **2026-10-10** — Adaptive Content-Width: Journey/Session Join folgt Main-Pane (`AdaptiveJourneyColumn`, AU-CONTENT-WIDTH)

---

## Lizenz

**SagaTree** trennt Softwarecode und Rollenspielregeln: Eigener Plattformcode steht unter **AGPL-3.0-only** ([LICENSE](LICENSE)); das schriftliche [SagaTree Core Regelwerk](docs/sagatree%20core%20rules.md) stellt sein regeltechnisches Licensed Material unter die **ORC License**. Für spätere eigenständige SDKs ist **Apache-2.0** vorgesehen; aktuell ist noch kein SDK unter dieser Lizenz veröffentlicht. Drittmaterial, Creator-Inhalte, Marken und Medien behalten separate Rechte.

Details: [LICENSES.md](LICENSES.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [TRADEMARKS.md](TRADEMARKS.md) · [docs/licensing/](docs/licensing/) (Provenienz, Asset-Inventar, Attest-Vorlagen). Open-Source-Release erst wenn `docs/licensing/status.json` → `open_source_release_ready: true`.

---

## Hinweise

- `npm run dev` öffnet den Browser automatisch (`server.open = true`).
- Port `3004` belegt → Prozess beenden oder Port in `vite.config.ts` anpassen.
- Original Design-Basis: [Figma](https://www.figma.com/design/XyboDSHba8TNFw0Bb5uUs4/SagaTree)

<p align="center">
  <img src="docs/brand/mark.png" width="40" alt="SagaTree" /><br />
  <sub>SagaTree · Teal <code>#0891B2</code> · Gold <code>#E8A641</code></sub>
</p>
