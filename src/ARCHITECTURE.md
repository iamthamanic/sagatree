# SagaTree Frontend Architecture

> **Aktuell (Produkt):** Frontend-Schichten und Importgrenzen (#94). Backend-Runtime ist der Node/Hono-Host — siehe [`docs/architecture/host-modular-monolith.md`](../docs/architecture/host-modular-monolith.md) und [`README_SELFHOST.md`](../README_SELFHOST.md).  
> Abschnitte *Vision* / *Datenmodell* / *Key Features* unten sind Produkt-/Zielvision; sie sind **keine** Betriebsanleitung für den archivierten Supabase-Stack.

## Layered Architecture (#94)

SagaTree uses a **Modular Monolith** with explicit layers:

| Layer | Path | May import | Must NOT import |
|-------|------|------------|-----------------|
| Rules kernel | `src/domains/rules/sagatree/*` | stdlib, sibling rule slices | React, UI, Host/ORM/HTTP SDKs, `app/`, `infrastructure/` |
| Character domain | `src/domains/character/*` | rules kernel (public API) | React, UI, Host/ORM/HTTP SDKs, `shared/ui` |
| Infrastructure | `src/infrastructure/*` | domains, `lib/*` (auth bridge), host HTTP helpers | React, `shared/ui`, `components/`, `app/`, `server/**` |
| App slices | `src/app/<area>/` | domains, infrastructure, `shared/ui`, other areas **only via `app/<area>` public barrel** | Persistenz/Auth-SDKs, other areas' **private** nested files |
| Shared UI | `src/shared/ui/` | React, local utils | domain rules, infrastructure, app slices |

**Character slice boundaries:**

| Slice | Role | May import from |
|-------|------|-----------------|
| `edit/` | Composition root (CharacterEditor) | `creation/index`, `progression/index`, `shared/` |
| `creation/` | Species, background, archetype, essence | `shared/`; `progression/index` only for documented public APIs (e.g. `SkillSelectField`) |
| `progression/` | Skills, abilities, stats, inventory | `shared/` only — not `creation/` or `edit/` privates |
| `shared/` | Slice-neutral presentation (RuleHelp) | UI primitives — no domain/rules |

**Vertical slices (Character, migrated in #94):**

- `app/character/edit/` — CharacterEditor composition root; imports `../creation` + `../progression` public barrels
- `app/character/creation/` — species, background, archetype, essence panels (`creation/index.ts`)
- `app/character/progression/` — skills, abilities, statistics, inventory, presets (`progression/index.ts`)
- `app/character/shared/` — presentation helpers shared across character slices

**Sole target architecture:** #94 layers above. There is no parallel “modules-first” or “components-first” feature architecture.

**Canonical layers only (#94 / #175):**

| Path | Status |
|------|--------|
| `src/domains/**` | Pure domain / contracts / rules |
| `src/infrastructure/**` | Adapters (Host HTTP, storage, Three runtime, …) |
| `src/app/**` | Vertical slices / user journeys |
| `src/shared/ui/**` | Fachlich neutrale UI primitives |

**Forbidden (eradicated):** `src/modules/**`, `src/components/**` — must not exist; recreating fails CI.

**Allowed code-bearing `src/` roots:** `domains/`, `infrastructure/`, `app/`, `shared/`, `lib/`, `utils/`, `assets/`, `styles/` (plus any roots still allowlisted by `scripts/architecture-boundary-check.mjs`). Historical `src/supabase/` was archived under `archive/supabase-legacy/`. Top-level source under `src/` is limited to composition roots `App.tsx` and `main.tsx` — no ad-hoc `src/FooService.ts`.

**Cross-area imports:** relative and `@/` alias paths are checked the same way. Area barrels (`app/<area>/index.ts`) may re-export own-area internals only; other areas still require that area's public barrel.

**Composition root:** `src/App.tsx` / `src/main.tsx` may only import app code via `app/<area>` (public barrel) or `app/<area>/root` (heavy screen entry). `root` is forbidden for everyone else.

Historical freeze baseline (deletion record): `.qa/architecture/legacy-freeze-baseline.json`. No compatibility barrels.

**Validation:** `node scripts/architecture-boundary-check.mjs` enforces import rules **and** legacy eradication (part of `npm run test-gate`).

Design reference: `.qa/design/scalable-domain-vertical-slice-architecture.md`

---


## Vision
**SagaTree** ist die selbst gehostete, werkzeugartige TTRPG-Oberfläche für Spielleitung und Spieler — Kampagnen, Charaktere (SagaTree Core), Live-Sessions — kein generisches Gaming-Dashboard. Flexibel für weitere Regelwerke, mit klarem Stack: React + Vite Frontend und Node/Hono-Host (Better Auth, Policy Service, SQLite, lokale Assets).

---

## 🏗️ Datenmodell-Hierarchie

```
RULESETS (D&D 5e, DSA, Custom Homebrew)
  ├── Attribute-Config (STR, DEX, CON...)
  ├── Skills-Config (Athletics, Stealth...)
  ├── Classes & Races
  └── Combat Rules

WORLDS (Forgotten Realms, Custom Setting)
  ├── Uses Ruleset
  ├── Locations (Cities, Dungeons, Regions)
  ├── NPCs (world-specific)
  ├── Quests (world-specific)
  └── Lore

PROJECTS (Konkrete Kampagne)
  ├── Uses World + Ruleset
  ├── GM + Members (Players mit ihren PCs)
  ├── Sessions (Spieltreffen)
  │   ├── Session 1, 2, 3...
  │   ├── Combat Encounters
  │   ├── Dice Rolls
  │   └── Participants (who attended)
  ├── Project-specific NPCs
  └── Story Progress

CHARACTERS (PC, NPC, Companion, Monster)
  ├── Attributes (based on Ruleset)
  ├── Inventory (Items)
  ├── Spells & Abilities
  └── Combat Stats

ITEMS (Weapons, Armor, Consumables)
  └── Based on Ruleset

SPELLS/ABILITIES (Templates)
  └── Based on Ruleset

BATTLE MAPS
  ├── Grid System
  ├── Tokens (Character positions)
  └── Linked to Combat Encounters

MARKETPLACE
  ├── Rulesets
  ├── Worlds
  ├── Characters (NPCs, Monsters)
  ├── Items
  ├── Spells
  ├── Battle Maps
  └── Complete Adventures
```

---

## 🎯 Key Features

### 1. **Flexible Ruleset System**

**Unterstützte Systeme:**
- D&D 5e (official)
- DSA 5 (official)
- Pathfinder 2e (official)
- Custom Homebrew (user-created)

**Ruleset Configuration:**
```json
{
  "attributes": {
    "primary": ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    "derived": ["hp", "ac", "speed", "initiative"]
  },
  "skills": [
    {"name": "Athletics", "ability": "strength"},
    {"name": "Stealth", "ability": "dexterity"}
  ],
  "classes": [...],
  "races": [...],
  "combat_rules": {
    "initiative": "1d20 + dex_modifier",
    "actions_per_turn": 1,
    "bonus_actions_per_turn": 1
  }
}
```

**Homebrew:**
- User kann D&D 5e als Basis nehmen und modifizieren
- Oder komplett eigenes Ruleset erstellen
- Templates für gängige Systeme

---

### 2. **Character System**

**Character Types:**

| Type | Owner | Use Case | Example |
|------|-------|----------|---------|
| `pc` | User | Spieler-Charakter | "Aria the Elf Wizard" |
| `npc` | World/Project | Questgeber, Händler | "Innkeeper Klaus" |
| `companion` | Character | Begleiter, Haustier | "Wolf companion of Aria" |
| `monster` | Template | Gegner (wiederverwendbar) | "Adult Red Dragon" |

**Flexibility:**
- Alle Stats basieren auf Ruleset
- JSONB für flexible Attribute
- Marketplace: NPCs & Monsters teilbar

**Example PC:**
```json
{
  "name": "Aria Windwhisper",
  "character_type": "pc",
  "ruleset_id": "dnd-5e",
  "race": "Elf",
  "class": "Wizard",
  "level": 5,
  "attributes": {
    "strength": 8,
    "dexterity": 14,
    "constitution": 12,
    "intelligence": 18,
    "wisdom": 13,
    "charisma": 10
  },
  "derived_stats": {
    "hp_current": 28,
    "hp_max": 28,
    "ac": 12,
    "speed": 30,
    "initiative_bonus": 2
  },
  "skills": {
    "arcana": 7,
    "investigation": 7,
    "perception": 4
  }
}
```

---

### 3. **Project → Sessions Hierarchy**

**Beispiel-Kampagne:**

**Projekt:** "Die Helden von Eldoria"
- Welt: "Vergessene Lande"
- Ruleset: D&D 5e
- GM: User A
- Mitglieder:
  - User B (PC: "Thoran der Krieger")
  - User C (PC: "Lyra die Schurkin")

**Sessions:**
1. **Session 1** (02.12.2024, 3h)
   - Teilnehmer: User B, User C
   - Combat: "Goblin Ambush"
   - Summary: "Die Helden trafen sich in der Taverne..."

2. **Session 2** (09.12.2024, 2.5h)
   - Teilnehmer: User B, User C
   - Quest: "Find the Lost Sword"

3. **Session 3** (16.12.2024, geplant)
   - **Neuer Spieler**: User D (PC: "Zara die Klerikerin")
   - User D ist NUR ab Session 3 dabei!

---

### 4. **Combat System**

**Combat Encounter:**
```
1. GM erstellt Combat Encounter
2. Fügt Teilnehmer hinzu (PCs + NPCs/Monsters)
3. Initiative-Reihenfolge wird festgelegt
4. Turn-based Combat:
   - Runde 1, Turn 1: Charakter A
   - Runde 1, Turn 2: Charakter B
   - etc.
5. Combat Log: Alle Aktionen werden gespeichert
```

**Initiative Tracker:**
| Character | Initiative | HP | AC | Conditions |
|-----------|------------|----|----|------------|
| Thoran | 18 | 45/45 | 16 | - |
| Goblin 1 | 15 | 7/7 | 13 | - |
| Lyra | 14 | 28/28 | 14 | - |
| Goblin 2 | 12 | 7/7 | 13 | Poisoned |

---

### 5. **Battle Maps & Grid System**

**Features:**
- Upload custom maps
- Grid overlay (square/hex)
- Drag & drop tokens (characters)
- Fog of War (später)
- Measurements & Distance
- Line of Sight (später)

**Token System:**
```sql
map_tokens
  - battle_map_id
  - character_id
  - grid_x, grid_y
  - is_visible (für GM-only NPCs)
```

---

### 6. **In-App Dice Roller**

**Dice Rolls gespeichert:**
```json
{
  "user_id": "...",
  "character_id": "...",
  "roll_type": "attack",
  "dice_formula": "1d20+5",
  "result": 18,
  "individual_rolls": [
    {"die": "d20", "result": 13},
    {"modifier": 5}
  ],
  "description": "Longsword attack vs Goblin",
  "is_advantage": false
}
```

**Audit Trail:**
- Alle Würfe werden gespeichert
- Transparent für GM & Spieler
- Historie pro Session

---

### 7. **Marketplace**

**Teilbare Content-Typen:**

| Type | Example | Price |
|------|---------|-------|
| Ruleset | "Homebrew Sci-Fi System" | Free/Paid |
| World | "Steampunk City of Gears" | 500 Credits |
| NPC | "Dragon Merchant Pack (10 NPCs)" | 200 Credits |
| Monster | "Undead Horde Bundle" | 300 Credits |
| Item | "Legendary Weapon Pack" | 100 Credits |
| Battle Map | "Dungeon Map Collection" | Free |
| Complete Adventure | "The Lost Temple Campaign" | 1000 Credits |

**Ratings & Reviews:**
- 5-Star System
- Downloads Count
- Tags/Search

---

### 8. **AI Features (Vorbereitet)**

**Use Cases:**
- NPC-Dialoge generieren
- Story-Fortsetzungen vorschlagen
- Beschreibungen für Locations
- Quest-Ideen
- Character Backstories

**Datenstruktur vorhanden:**
```sql
ai_context
  - project_id / character_id
  - context_type
  - prompt
  - response
  - model_used
```

---

### 9. **Voice/Video Integration (Geplant)**

**Möglichkeiten:**
- Jitsi Meet Integration
- Agora.io
- Twilio Video
- Discord Bot Integration

**Features:**
- Video/Audio für Live-Sessions
- Screen Sharing (für Maps)
- Recording Sessions
- Auto-Transcription (später)

---

## 🔐 Security & RLS

**Row Level Security:**
- User sieht nur eigene Charaktere (PCs)
- User sieht nur Projekte, wo er Mitglied ist
- Marketplace-Items sind öffentlich
- Worlds können privat oder öffentlich sein
- GM hat volle Kontrolle über Project-Content

---

## 📊 Performance Optimizations

**Indexes:**
- Alle Foreign Keys
- Marketplace queries (is_marketplace_item)
- Initiative tracker (combat_participants)
- Session participant lookups

**Caching Strategy:**
- Rulesets (rarely change)
- Marketplace featured content
- User characters list

---

## 🚀 Migration Strategy

**Phase 1: Core System**
1. Rulesets (D&D 5e template)
2. Characters (PC/NPC basic)
3. Projects & Sessions
4. Items & Inventory

**Phase 2: Gameplay**
5. Combat Encounters
6. Initiative Tracker
7. Dice Roller
8. Battle Maps

**Phase 3: Content**
9. Worlds & Locations
10. Quests
11. Spells/Abilities
12. Marketplace

**Phase 4: Advanced**
13. Voice/Video
14. AI Features
15. Advanced Combat (AoE, etc.)

---

## 🎨 UI/UX Flow

```
LOGIN
  ↓
DASHBOARD
  ├─→ MY PROJECTS
  │     ├─→ Create New Project
  │     └─→ Join Project (Code)
  │
  ├─→ MY CHARACTERS
  │     └─→ Character Editor
  │
  ├─→ LIBRARY
  │     ├─→ My Worlds
  │     ├─→ My Items
  │     └─→ My Spells
  │
  └─→ MARKETPLACE
        ├─→ Browse Content
        └─→ Download/Purchase

PROJECT VIEW
  ├─→ GM Mode
  │     ├─→ Session Planning
  │     ├─→ Manage Members
  │     ├─→ Combat Encounters
  │     └─→ Battle Maps
  │
  └─→ Player Mode
        ├─→ Character Sheet
        ├─→ Inventory
        └─→ Spells/Abilities

LIVE SESSION
  ├─→ Video/Audio
  ├─→ Battle Map
  ├─→ Initiative Tracker
  ├─→ Dice Roller
  └─→ Chat
```

---

## 📝 Next Steps (historische Planung)

> Die Liste unten stammt aus der frühen Vision und ist **kein** aktueller Sprint-Backlog. Aktuelle Arbeit folgt Issues auf `main` und dem Host-Modulvertrag.

1. **Finalize Schema** (mit deinem Feedback)
2. **Create Migration SQL**
3. **Build Core Services** (Rulesets, Characters, Projects)
4. **UI Components** (Character Editor, Combat Tracker)
5. **Test with D&D 5e**
6. **Add DSA/Pathfinder**
7. **Marketplace**
8. **AI Integration**
