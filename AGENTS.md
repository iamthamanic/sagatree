# AGENTS.md - SagaTree Self-Host

## Identity
- **Name:** SagaTree Agent
- **Purpose:** Backend + Frontend Integration Agent
- **Focus:** Self-Hosted TTRPG Platform

## Non-Negotiables
- Security and code reviews **MUST list ALL severities**, including **Low / Info / tech-debt**. Never omit items as “below reporting threshold”, “optional hardening only”, or “not worth listing”. Optional hardening belongs in the findings table as **Severity: Low** (or Info); it may be non-blocking but must remain visible.
- Owner-scoped data stays owner-scoped (RLS + service checks). Client writes must not invent elevated origins or cross-owner foreign keys.

## Project Context
- **Repository:** https://github.com/iamthamanic/SagaTree
- **Branch:** `main` (aktiver Entwicklungsbranch; Feature-Branches von `main` abzweigen)
- **Tech Stack:**
  - **Frontend:** React + Vite + TypeScript + Tailwind CSS + Radix UI
  - **Backend:** Supabase Edge Functions (Deno)
  - **Database:** PostgreSQL (Supabase Self-Host)
  - **AI:** Ollama (LLM)
  - **Knowledge Graph:** Neo4j
  - **Cache:** Redis

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SagaTree Frontend                          │
│                    (React + Vite + TypeScript)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │   Supabase    │
                    │   (Self-Host) │
                    │   - Auth      │
                    │   - Database  │
                    │   - Storage    │
                    │   - Realtime  │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Edge Function │  │ Edge Function │  │ Edge Function │
│   ai-gm       │  │   lorekeeper   │  │   dm-tools    │
│   (Ollama)    │  │   (Neo4j)      │  │   (Redis)     │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Module Structure

### Layered Frontend Architecture (#94)

```
src/
├── domains/           # Business rules & types — NO React, NO Supabase
│   ├── character/     # domain, contracts, use-cases
│   └── rules/
│       └── sagatree/  # UI-independent rules kernel slices
├── infrastructure/    # Supabase adapters — NO UI
├── app/               # Vertical slices (user journeys)
│   └── character/
│       ├── edit/        # CharacterEditor composition root
│       ├── creation/    # species, background, archetype, essence
│       ├── progression/ # skills, abilities, stats, inventory panels
│       └── shared/      # slice-neutral presentation helpers (e.g. RuleHelp)
├── shared/ui/         # Presentation primitives (Radix kit + helpers)
├── lib/               # App-wide helpers (auth context, theme, supabase client)
└── utils/
    └── supabase/
        └── info.tsx   # Project credentials
```

**#94 is the only architecture.** `src/modules/**` and `src/components/**` are eradicated (#164/#175). Recreating them fails `architecture-boundary-check` (wired into `npm run test-gate`). Historical freeze baseline: `.qa/architecture/legacy-freeze-baseline.json`.

**Host modular monolith (Epic #773):** top-level `server/` is a registered host package. Binding contract: `docs/architecture/host-modular-monolith.md` (vertical use-cases, domain modules, public APIs vs private persistence, central bootstrap). First technical enforcement: MIG-010/#789. ORM choice (GATE-01) does not replace module-boundary rules; Drizzle/client import bans are additional.

**Boundary enforcement:** `scripts/architecture-boundary-check.mjs` — layer import rules + legacy eradication gate + registered `server/` host package / module-boundary checks.

**Edge CORS:** Edge Functions MUST use `supabase/functions/_shared/cors.ts` (`corsHeaders` / `handleOptions`). Do not set `Access-Control-Allow-Origin` locally — `scripts/edge-cors-shared-check.mjs` (in `test-gate`) enforces this (dispatcher `main` exempt).

### Backend Functions
```
supabase/functions/
├── ai-gm/              # AI Game Master
├── dm-tools/           # Dice, Combat, Rules
├── sessions/           # Session Management
├── characters/          # Character CRUD
├── lorekeeper/          # Knowledge Graph
├── world/               # World Management
├── npcs/                # NPC Management
├── bestiary/            # Monster Database
├── spellbook/           # Spell Management
├── items/               # Item Database
├── rulesets/            # Ruleset Configuration (PRIMARY)
├── quests/              # Quest Management
├── marketplace/          # Template Marketplace
├── media/                # Media Upload
└── export/               # Export/Import
```

## UI/UX Rules

### Canonical Design Sources

- `src/THEME_GUIDE.md` is the canonical SagaTree design-system reference.
- `src/guidelines/Guidelines.md` contains compact AI/Figma-Make generation rules.
- `src/styles/globals.css` and `src/shared/ui/` are the technical source of truth.
- `docs/concepts/conductor-experience-contract.md` is mandatory for Performance Mode/live interaction work.
- `docs/concepts/imagination-first-visualization-contract.md` is mandatory for Scene/Program/Viewer/3D/visualization work.
- `docs/concepts/adaptive-ui-experience-contract.md` is mandatory for all new user-facing UI (Phone/Tablet/Desktop recomposition, touch, safe areas, a11y).
- Do not introduce local color conventions that conflict with these files.

### Product Experience Contracts

Before implementing any UI feature, classify it as `SETUP`, `PERFORMANCE`, or mixed, **and** classify the adaptive surface as Journey / Workstation / Live / Overlay per the Adaptive UI contract.

For `PERFORMANCE` work, agents MUST read and apply `docs/concepts/conductor-experience-contract.md`. Relevant acceptance criteria must reference its `CE-*` gates.

For visualization work, agents MUST read and apply `docs/concepts/imagination-first-visualization-contract.md`. Relevant acceptance criteria must reference its `IV-*` gates.

For **any new user-facing UI**, agents MUST read and apply `docs/concepts/adaptive-ui-experience-contract.md`. Relevant acceptance criteria must reference its `AU-*` gates (device bands, touch targets, safe areas, recomposition, states). Subjective "responsive" / "mobile-first" / "Apple-like" wording is never enough.

**Content width (not only viewport):** Shell chrome may use the viewport band (`useAdaptiveBand`). Journey / form recomposition MUST also respect **available main-pane width** (`@container/main` on shell `<main>`, `useAdaptiveContentBand`, `AdaptiveJourneyColumn`). Split IDE previews and collapsed sidebars are first-class test surfaces. Do not ship Journey screens that assume a full-monitor width while leaving large empty gutters or clipping primary controls in a narrow main pane. Soft `max-w-*` caps are for readability; columns must still be `w-full min-w-0` inside the main container. See gate **AU-CONTENT-WIDTH** and `docs/ui-styleguide.md` § Page width.

Subjective words such as "premium", "cinematic", "immersive", "smooth", "magical" or "high quality" are never sufficient acceptance criteria. Translate them into observable behavior, quantitative thresholds, state rules and the applicable CE/IV/AU gates.

If a ticket intentionally violates a contract baseline, the deviation and reason MUST be explicit in the ticket/acceptance (Adaptive UI: named `AU-*` Hard Gate + supported device bands).

### Brand Color Roles

1. **Cyan / Teal = selected or most important action**
   - Light: `#0891B2`
   - Dark: `#06B6D4`
   - Primary CTA
   - Active tab / selected segmented control
   - Focus rings, links, navigation, progress/status

2. **Gold / Amber = hover feedback and premium accents**
   - Light: `#E8A641`
   - Dark: `#F59E0B`
   - Hover on primary CTAs and active tabs
   - Hover for secondary, outline and ghost actions

### Public IDs, Saga URLs & Screen vs Modal (#276)

Canonical doc: [`docs/navigation-public-ids.md`](docs/navigation-public-ids.md).

- **Public IDs** (`SA-`/`SE-`/`CH-`/`IT-`/`NPCC-` + reserved `SC-`/`QT-`) are immutable public identifiers — never authorization. Domain contract: `src/domains/resource-id/**`.
- **Saga/Session deep links** live under `/sagas/:sagaPublicId/...` via History API routing (`src/app/shell/routing`). No React Router.
- **`session_number`** = order inside a saga; **`SE-XXXXX`** = session identity. Allocate via DB (`create_project_session`).
- **URL ≠ permission:** `/live/gamemaster` does not grant GM rights; membership/RLS/services do.
- **Screen vs Modal:** shareable / reload / identity / long task → route; ephemeral in-context action → modal.
- Compatibility `/gamemaster` and `/adventure-editor` are not a second source of truth.   - Level, achievement, premium accents

3. **Danger**
   - Light: `#EF4444`
   - Dark: `#F87171`
   - Destructive and invalid states only

4. **Surfaces**
   - Background: `#0F172A` in dark mode
   - Surface/Card: `#1E293B` in dark mode
   - Border: `#334155` in dark mode

**Rule:** Cyan = selected or primary action. Gold = hover and premium accent.

### Typography

- UI and headings: `Darker Grotesque`
- Headings: weight 700
- Body/UI: weight 400-600
- Code/data when needed: `JetBrains Mono`
- Do not introduce serif fonts in product UI.

### Iconography (Phosphor)

Canonical visual rules: [`src/THEME_GUIDE.md`](src/THEME_GUIDE.md) § Iconography. Implementation patterns: [`docs/ui-styleguide.md`](docs/ui-styleguide.md).

- **`@phosphor-icons/react` is mandatory** for general UI icons (chrome, navigation, buttons, forms, status).
- **Do not add `lucide-react`** or reintroduce Lucide imports.
- Follow weight/size defaults: sidebar always `regular` at 20px (active = Cyan primary surface + `currentColor`, not fill); actions/forms 16–20px `regular`; dashboard feature cards `regular` 24–32px.
- Colors via `currentColor` / theme tokens (Cyan active, Gold hover, Danger destructive) — no arbitrary icon colors.
- **RPG / play-world icons** may stay as custom SVGs or local game-icons.net assets (CC-BY-3.0 attribution); do not blindly replace them with Phosphor.
- Before creating a new icon, check existing Phosphor icons and repo assets first. Exceptions need a technical or design rationale.
- Prefer explicit named imports; no full-library namespace imports. No new icon abstraction layer unless shared logic is truly reused.

### Spacing

- Base unit: `4px`
- Small: `8px`
- Medium: `16px`
- Large: `24px`
- XLarge: `32px`

### Border Radius

- Buttons/controls: `6-8px`
- Cards: `8-12px`
- Modals: `12px`
- Keep radius hierarchy consistent within a screen.

### Component Patterns

1. **Buttons**
   - Default `Button` is the primary CTA and uses Cyan/Teal; hover uses Gold/Amber.
   - `outline` and `ghost` are secondary/tertiary actions and use Gold on hover.
   - `destructive` remains red.
   - Do not hardcode standard CTA colors in feature components.

2. **Tabs**
   - Active tab is filled Cyan/Teal with `primary-foreground` text.
   - Inactive tabs are neutral.
   - Inactive hover uses Gold/Amber.
   - Active tabs may shift to Gold on hover.
   - Keyboard focus uses Cyan/Teal.

3. **Forms**
   - Label above input.
   - Input, Textarea and Select have a visible border at rest.
   - Error messages below input.
   - Required fields marked with `*` when required by the flow.
   - Help text in smaller muted text below.
   - Important controls should target at least `44px` height.

4. **CharacterEditor**
   - Card-based layout.
   - Tab navigation.
   - Live avatar preview.
   - Real-time validation.
   - Portrait upload/generation.
   - Attribute sliders.
   - General styling comes from shared UI primitives, not CharacterEditor-only overrides.

5. **Dashboard**
   - Project cards.
   - Quick actions.
   - Recent sessions.
   - Notifications.

6. **Tables**
   - Sortable columns.
   - Search/filter.
   - Pagination.
   - Row actions (edit, delete, view).

7. **Modals**
   - Overlay with backdrop blur when appropriate.
   - Close button top-right.
   - Clear title and action hierarchy.

### Responsive Design

1. **Mobile First**
   - Single column on mobile.
   - Two columns on tablet where useful.
   - Three columns on desktop only when content benefits.

2. **Breakpoints**
   - Mobile: `< 640px`
   - Tablet: `640px - 1024px`
   - Desktop: `> 1024px`

3. **Touch Targets**
   - Minimum `44px` height for primary controls.
   - Minimum `44px` width for icon-only primary controls.

### Accessibility

1. **ARIA Labels**
   - All interactive elements labeled.
   - Screen reader support.
   - Keyboard navigation.

2. **Color Contrast**
   - WCAG AA minimum.
   - Text: `4.5:1`.
   - UI boundaries: `3:1` where applicable.

3. **Focus States**
   - Visible Cyan/Teal focus ring.
   - Logical tab order.
   - Selected, focus, disabled and invalid states remain distinguishable.

## Integration Rules

### Frontend → Infrastructure (Supabase)

**Direkte Supabase-Queries gehören in Infrastructure-Adapter — nicht in App-Slices oder Domains.**

1. **Supabase Client** (nur in `src/lib/supabase.ts` + `src/infrastructure/**`)
   ```typescript
   // src/lib/supabase.ts — client factory; consumed by infrastructure adapters
   import { createClient } from '@supabase/supabase-js';

   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000';
   const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

   export const supabase = createClient(supabaseUrl, supabaseKey);
   ```

2. **Repository / Adapter** (canonical pattern)
   ```typescript
   // src/infrastructure/character/supabase-character.repository.ts
   import { supabase } from '../../lib/supabase';
   import { getAuthenticatedUserId } from '../../lib/authenticatedUser';

   const userId = await getAuthenticatedUserId();
   const { data, error } = await supabase
     .from('characters')
     .select('*')
     .eq('owner_user_id', userId);
   ```

3. **App slices** consume repositories via infrastructure facades — never import `supabase` directly.
   ```typescript
   // src/app/character/edit/CharacterEditor.tsx
   import { characterService } from '../../../infrastructure/character/character-service';
   ```

4. **Edge Functions** (Deno backend — separate from frontend infrastructure)
   ```typescript
   const { data, error } = await supabase.functions.invoke('ai-gm', {
     body: { sessionId, action, context },
   });
   ```

### Rulesets Integration

**Primary:** SagaTree Rulesets (Custom)
**Supplement:** Open5e API (D&D 5e SRD)

```typescript
// Use SagaTree ruleset as primary
const { data: mmsRuleset } = await supabase
  .from('rulesets')
  .select('*')
  .eq('id', 'sagatree-custom')
  .single();

// Enrich with Open5e data
const open5eSpells = await fetch('https://api.open5e.com/spells/');

// Merge in ruleset function
const ruleset = {
  ...mmsRuleset,
  spells: [...mmsRuleset.spells, ...open5eSpells],
};
```

### State Management

1. **React Query** for server state
2. **Zustand** for client state
3. **React Hook Form** for forms

## Development Workflow

### Branch hygiene (mandatory)

- `main` is the only long-lived branch.
- Feature/fix/chore branches are temporary and must represent active work only.
- Create work branches from current `main`; do not reuse a previously merged branch.
- A branch may exist without an open PR only while the linked issue is actively being worked (for example a staged asset-review stop). Open the PR once the change is reviewable.
- Merged same-repository PR head branches are deleted automatically by `.github/workflows/branch-hygiene.yml`.
- Closed/superseded branches must be deleted once their useful work is confirmed in `main` or explicitly replaced elsewhere.
- Never keep historical branches merely as archives; Git history and merged PRs are the archive.
- Never auto-delete a branch with unique unmerged commits unless it is explicitly verified as superseded.
- After a merge, agents should treat the merged branch as disposable and continue from a fresh branch off current `main`.


### Context compact & long queues (mandatory)

Auto-compact mid-ticket is **unreliable**. Do **not** wait for the window to hard-fail, and do **not** stop the queue for a manual `/compact` prompt.

**After every shipped issue** in a multi-ticket loop (`@ecc-runner-loop`, avatar-order, or any N>1 queue):

1. Update the handoff file (default: `/tmp/ecc-runner-loop-avatar-v2-handoff.md` or the path named in the loop prompt) with: last merged issue/PR/SHA, next issue number + title, `paused: false`.
2. **Auto-compact in-session:** treat the handoff as the only resume brief — drop prior issue diffs, CI logs, and tool dumps from working memory; do not re-read them.
3. **Immediately claim the next issue** in the same turn (same session). Do not ask the user to `/compact` between tickets.
4. Only if the platform hard-fails mid-queue (context exhausted / session swap): leave handoff with `paused: false` and end the turn so `@ecc-runner-loop continue` resumes — still not a user-facing pause.

**Never compact mid-implementation** of the current issue (verify → PR → merge must stay in one context).

**Forbidden (hard stop violations if done):**
- Asking the user to run `/compact`, `/strategic-compact`, or “bitte continue”
- Setting `state.json` → `paused: true` because of context size
- Ending a turn after merge with only a status report while queue issues remain
- Stopping after one ticket to “wait for merge” when `@ecc-runner-loop` / merge mode is active

**Allowed exit from a turn mid-queue:** platform context hard-fail only — handoff must say `paused: false` and `resume: @ecc-runner-loop continue` (no user decision required).

**Never** treat leftover CI poll / babysit timeouts as blockers; only open PRs and current `main` HEAD matter.

### Before Starting
1. Read `SOUL.md` (who I am)
2. Read `USER.md` (who is Ben)
3. Read `memory/YYYY-MM-DD.md` (recent context)

### When Adding Features

Neue Features folgen der **#94 Layered Architecture** — nicht dem legacy `src/modules/`-Muster.

1. **Fachliche Domain identifizieren** (character, project, session, …).
2. **User Journey / Use Case** als Vertical Slice unter `src/app/<domain>/<slice>/`.
3. **Pure Business-/Rules-Logik** nach `src/domains/**` (kein React, kein Supabase).
4. **Supabase / Storage / Netzwerk** ausschließlich über `src/infrastructure/**`.
5. **Generic UI** nach `src/shared/ui`.
6. **Andere App-Areas** nur über deren **öffentliche Area-Barrels** (`src/app/<area>/index.ts`) konsumieren — keine privaten Nested-Imports (`hooks/`, `inventory/`, …), auch nicht via `@/app/<area>/…`. Area-`index.ts` darf nur **eigene** Internals re-exportieren. Composition Root (`App.tsx`) zusätzlich `app/<area>/root` für schwere Screens.
7. **`src/modules/**` und `src/components/**` existieren nicht** (#175). Nicht neu anlegen; CI schlägt fehl. Auch keine neuen Feature-Dumping-Roots (`src/features`, `src/services`, …) und keine neuen Top-Level-Feature-Dateien unter `src/` (nur `App.tsx` / `main.tsx`) — nur die #94-Allowlist.
8. **Keine neuen generischen** `services/`, `types/`, `utils/`-Dumping-Folder als Architekturstandard.
9. **Keine Business Rules in React** — Rules-Kernel bleibt UI-frei.
10. **Kein Supabase in Domain/Rules/App-Slices** — nur Infrastructure.

**Character-Slice-Regel:** `edit/` ist der Composition Root; konsumiert `creation/` + `progression/` nur über deren `index.ts`. Slice-`index.ts` darf nur **eigene** Slice-Internals (plus `shared/`) re-exportieren — keine privaten Cross-Slice-Pfade. `creation/` und `progression/` importieren einander nicht privat (öffentliche Barrel nur wo dokumentiert, z. B. `SkillSelectField` in Background).

Vor Commit: `npm run test-gate` (inkl. `architecture-boundary-check`).

### Agent config (Cursor / AgentShield)

- Project rules + secure baseline: [`.cursor/`](.cursor/) (see [`.cursor/README.md`](.cursor/README.md)).
- Before shipping changes that touch `.cursor/`: `npx ecc-agentshield scan --path .cursor` (block on critical/high).

### When Integrating Backend
1. Update Edge Functions first
2. Update frontend services
3. Update TypeScript types
4. Test end-to-end

### When Adding Rulesets
1. Primary: SagaTree custom rules
2. Supplement: Open5e API data
3. Merge in `rulesets` function
4. No full replacement

## Testing Checklist

### Frontend
- [ ] Components render correctly
- [ ] Forms validate input
- [ ] Navigation works
- [ ] Responsive on all breakpoints
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

### Backend
- [ ] All Edge Functions respond
- [ ] Health endpoints work
- [ ] CORS headers correct
- [ ] Error handling works
- [ ] JSON responses valid

### Integration
- [ ] Frontend connects to Edge Functions
- [ ] Supabase client works
- [ ] Auth flow works
- [ ] Realtime subscriptions work
- [ ] File uploads work

## Next Steps

### Priority 1: Frontend Integration
1. Update `src/lib/supabase.ts` to point to self-host URL
2. Update Edge Function URLs in services
3. Test character creation flow
4. Test session management

### Priority 2: Rulesets Enhancement
1. Add Open5e integration to `rulesets` function
2. Create merge logic for custom + SRD data
3. Update frontend ruleset service
4. Test ruleset selection

### Priority 3: UI/UX Polish
1. Ensure consistent styling
2. Add loading states
3. Add error boundaries
4. Add success/error toasts