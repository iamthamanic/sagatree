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
  <a href="#backend--self-host"><img src="https://img.shields.io/badge/Node_Host-0891B2?style=flat-square" alt="Node Host" /></a>
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

Dieses Repo: **React + Vite**-Frontend und **Node/Hono-Host** (Better Auth, Policy Service, SQLite, lokale Assets) mit Schichten `domains` → `infrastructure` → `app` · UI in `shared/ui`.  
Archivierter Supabase-/Edge-Stack: `archive/supabase-legacy/` (nicht Produktpfad; CUT-21/22/23).

| Rolle | Nutzen |
| --- | --- |
| **Gamemaster** | Projekte, Sessions, Bibliothek, Weltprofile, Live-Steuerung |
| **Spieler** | Charaktereditor (SagaTree Core), Inventar, Session-Join, Look / LiveAct |
| **Creator** | Items, NPCs, Avatar-Assets, optional Meshy 2D/3D (BYOK) |

---

## Features

| Bereich | Was drin ist |
| --- | --- |
| **Projekte & Mitgliedschaft** | Sagas anlegen, Join-by-Code, Policy-Service-Rollen (GM / Spieler) |
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
| Backend (Produkt) | Node host (`server/`) · Hono · Better Auth · Policy Service · SQLite · lokale Assets |
| Optional | Ollama / BYOK AI · LiveKit · Meshy (externe Provider; Core bleibt ohne sie nutzbar) |
| Qualität | Playwright · `test-gate` · `composition-gate` · Architecture Boundary Check |
| Deploy | Docker Compose Host (`deployment/docker-compose.host.yml`; Vite-Build → `build/`) |
| Archiv | Supabase/GoTrue/PostgREST/Deno Edge unter `archive/supabase-legacy/` — nicht Produkt |

Frontend-Dev: **`http://localhost:3004`** · Host: **`http://127.0.0.1:8787`** (`GET /health`)

---

## Quick Start

**Voraussetzungen:** Node.js **≥22.13** (siehe `server/package.json` `engines`) · npm 10+

```bash
npm install
# Terminal 1 — Host (SQLite + Better Auth). `host:dev` liest kein .env-File —
# Variablen müssen in der Shell exportiert sein (wie README_SELFHOST solo).
cp .env.example .env   # Vorlage / Notiz; optional
export SAGATREE_DATA_DIR=./.sagatree-data
export SAGATREE_BETTER_AUTH_SECRET="$(openssl rand -base64 48)"
export SAGATREE_HOST_MODE=solo
npm run host:dev
# Terminal 2 — Frontend (Vite /api-Proxy → Host; VITE_SAGATREE_HOST_AUTH_URL=same-origin)
npm run dev
```

Produktions-Build:

```bash
npm run build   # Output: build/
```

Umgebungsvariablen: [`.env.example`](.env.example) · Compose: [`deployment/.env.host.example`](deployment/.env.host.example).  
Secrets nie mit `VITE_` / `NEXT_PUBLIC_` ins Client-Bundle legen.

Self-Host (Docker): → **[`README_SELFHOST.md`](README_SELFHOST.md)**  
`docker compose --env-file deployment/.env.host up -d --build`

---

## Architektur

Modularer Monolith mit harten Importgrenzen (CI-enforced):

```text
src/
├── app/              # Vertikale Slices / User Journeys
├── domains/          # Reine Domain-Verträge & SagaTree-Core-Regeln
├── infrastructure/   # Host-HTTP-, Storage-, Three-/LiveAct-Adapter
├── shared/ui/        # Fachlich neutrale UI-Primitives
├── lib/              # Auth (Better Auth Bridge), Theme, Querschnitt
└── styles/           # Theme-Tokens (globals.css)
server/               # Node/Hono Host (Bootstrap, Module, HTTP)
```

| Layer | Darf importieren | Darf nicht |
| --- | --- | --- |
| `domains/` | stdlib, sibling domains | React, UI, Host-HTTP/SDK, `app/` |
| `infrastructure/` | domains, `lib/*` (Auth-Bridge), Host-HTTP-Helfer | React, `shared/ui`, `app/`, `server/**` |
| `app/<area>/` | domains, infrastructure, `shared/ui`, andere Areas nur über Public Barrel | direkte Persistenz/HTTP-Clients, fremde Private-Dateien |

`src/modules/**` und `src/components/**` sind **entfernt** — Neu anlegen bricht den Architecture Gate. Details: [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) · Host: [`docs/architecture/host-modular-monolith.md`](docs/architecture/host-modular-monolith.md).

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

Optionale Host-Use-Cases (keine produktive Abhängigkeit). Keys nie im Browser.

| Feature | Host / Assets | Hinweis |
| --- | --- | --- |
| Character-Lore | Host application `character-lore` | Provider: `ollama` / `openai-compatible` |
| Portraits / Assets | Lokaler Asset-Store unter `SAGATREE_DATA_DIR` | Owner-scoped; credentialed HTTP |
| Item 2D | Host `item-thumbnail` · Meshy Text-to-Image | Prod: User-BYOK; ohne Key: `not-configured` (fail-closed) |
| Item 3D | Host `item-model3d` · Meshy Image-to-3D | GLB-Limits hostseitig; Bibliothek zeigt Thumbnails |
| Avatar-Katalog | Manifeste + optional `VITE_AVATAR_ASSET_BASE_URL` | Lizenzierte / gepinnte Assets — [`docs/avatar assets.md`](docs/avatar%20assets.md) |

Server-Env (**nicht** im Vite-Bundle). Keys liegen **nie** als `VITE_*MESHY` / `NEXT_PUBLIC_*` im Client:

```bash
CHARACTER_AI_PROVIDER=ollama
CHARACTER_AI_RATE_LIMIT_PER_MINUTE=6
CHARACTER_AI_ALLOWED_ORIGIN=http://localhost:3004
CREDENTIALS_ENCRYPTION_KEY=
# MESHY_API_KEY=                 # nur lokal/CI mit AI_PROVIDER_ALLOW_HOST_KEYS=1
# AI_PROVIDER_ALLOW_HOST_KEYS=1
```

Fehlende Provider-Keys sind fail-closed. Compose-Profile: [`docs/ops/host-compose-profiles.md`](docs/ops/host-compose-profiles.md).

---

## Backend & Self-Host

Produkt-Runtime (CUT-22): **Node Host · Better Auth · SQLite · lokale Assets**  
(`docker compose --env-file deployment/.env.host up -d --build` vom Repo-Root).

Optional: `--profile ai` (Ollama), externe LiveKit/Meshy-Keys — Core bleibt ohne sie nutzbar.  
Runbook: [`docs/ops/host-compose-profiles.md`](docs/ops/host-compose-profiles.md) · Self-Host: [`README_SELFHOST.md`](README_SELFHOST.md)

Archivierter Supabase-Stack (nicht Produkt): `archive/supabase-legacy/docker-compose.supabase.yml`

---

## Quality Gates

Auf Push / PR gegen `main` (siehe auch AGENTS.md „External AI Review Contract“):

```bash
npm run test-gate          # u. a. Architecture, CUT-20..23 Host-Verträge, Secrets-Scan
npm run composition-gate   # Semantische Multi-Hop-Proofs
npm run test:e2e           # Playwright (Chromium)
```

Historische Migrations-Quellverträge (nicht Produkt-Startweg): [`docs/stack-migration-preparation.md`](docs/stack-migration-preparation.md) / `npm run check:stack-migration-prep` (Python + gepinnter Postgres-Parser für Alt-RPC-Inventar).

Lokal:

```bash
npx playwright install chromium
npm run test:e2e
```

Agent-Konfiguration: [`.cursor/`](.cursor/) — vor Änderungen: `npx ecc-agentshield scan --path .cursor`

---

## Projektstruktur

```text
SagaTree/
├── src/                      # Frontend (app · domains · infrastructure · shared · lib)
├── server/                   # Node/Hono Host (bootstrap · modules · http)
├── deployment/               # Dockerfile.host · docker-compose.host.yml · .env.host.example
├── archive/supabase-legacy/  # Historischer Supabase/Edge-Stack (nicht Produkt)
├── public/                   # Favicons, MediaPipe, Item-/NPC-Assets
├── docs/                     # Regeln, Styleguides, Brand, Concepts, Ops
├── e2e/ · scripts/ · assets/
├── docker-compose.yml        # include → deployment/docker-compose.host.yml
├── README.md
└── README_SELFHOST.md
```

---

## Dokumentation

| Thema | Pfad |
| --- | --- |
| Self-Host (aktuell) | [`README_SELFHOST.md`](README_SELFHOST.md) |
| Host Compose | [`docs/ops/host-compose-profiles.md`](docs/ops/host-compose-profiles.md) |
| Host-Modulvertrag | [`docs/architecture/host-modular-monolith.md`](docs/architecture/host-modular-monolith.md) |
| Frontend-Architektur | [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) |
| Agentenregeln | [`AGENTS.md`](AGENTS.md) |
| Items / Inventory | [`docs/items.md`](docs/items.md) · [`docs/inventory-v2.md`](docs/inventory-v2.md) |
| Avatar Assets | [`docs/avatar assets.md`](docs/avatar%20assets.md) |
| World Profiles | [`docs/world profiles.md`](docs/world%20profiles.md) |
| Historisch (nicht Startweg) | [`INTEGRATION.md`](INTEGRATION.md) · [`src/AUTH_SETUP.md`](src/AUTH_SETUP.md) · [`src/SUPABASE_SETUP.md`](src/SUPABASE_SETUP.md) · [`docs/architektur-sqlite-based.md`](docs/architektur-sqlite-based.md) |

Desktop-Installer: Pipeline skizziert in [`docs/ops/desktop-release.md`](docs/ops/desktop-release.md); Produkt-`src-tauri/` ist auf `main` **nicht** vorhanden (PoC/GATE-05; offene PRs ≠ gemergter Stand).

---

## Recent changes

- **CUT-21 / #1156 · CUT-22 / #1157 · CUT-23 / #1158** — Produkt-Runtime host-only (Node/Hono · Better Auth · SQLite); Supabase/Edge archiviert
- **2026-10-22** — UI-Icons: Lucide → Phosphor (`@phosphor-icons/react`); Sidebar Cyan/Gold-Zustände
- Ältere Einträge (Atlas, Lobby, Bibliothek) bleiben in der Git-Historie / gemergten PRs; GoTrue/PostgREST-Hinweise dort beschreiben den **damaligen** Stack

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
