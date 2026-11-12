# Self-Hosted Backend Integration

> **HISTORISCH / ARCHIVIERT** — Dieses Dokument beschreibt den ehemaligen Supabase-/Edge-Integrationsweg.  
> **Aktueller Produktpfad:** [`README_SELFHOST.md`](README_SELFHOST.md) · [`.env.example`](.env.example) · [`docs/ops/host-compose-profiles.md`](docs/ops/host-compose-profiles.md) (Node/Hono · Better Auth · SQLite).  
> Die Beispiele unten (`VITE_SUPABASE_*`, Edge URLs, `src/modules/…`) sind **keine** gültige Startanleitung mehr.

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Self-Hosted Supabase (archived — not product)
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your-anon-key-from-setup

# Edge Functions (archived)
VITE_FUNCTIONS_URL=http://localhost:9998

# Ollama
VITE_OLLAMA_URL=http://localhost:11434

# Neo4j
VITE_NEO4J_URL=bolt://localhost:7687
VITE_NEO4J_USER=neo4j
VITE_NEO4J_PASSWORD=your-neo4j-password

# Redis
VITE_REDIS_URL=redis://localhost:6379
```

## Usage in Components

```typescript
// src/modules/characters/services/character.service.ts
import { characters } from '../../../lib/supabase-client';

export const characterService = {
  async createCharacter(data: CreateCharacterDTO) {
    const { data: character, error } = await characters.create(data);
    if (error) throw error;
    return character;
  },

  async getCharacter(id: string) {
    const { data: character, error } = await characters.get(id);
    if (error) throw error;
    return character;
  },

  async levelUp(id: string, choice?: any) {
    const { data: character, error } = await characters.levelUp(id, choice);
    if (error) throw error;
    return character;
  },
};
```

## API Endpoints

### AI Game Master
```typescript
import { aiGM } from '@/lib/supabase-client';

// Generate narrative
const { data, error } = await aiGM.generateNarrative(
  sessionId,
  'I attack the goblin',
  { characters: [...], npcs: [...], location: 'Dark Cave' }
);
```

### DM Tools
```typescript
import { dmTools } from '@/lib/supabase-client';

// Roll dice
const { data: roll } = await dmTools.rollDice({ notation: 'd20', modifier: 5 });

// Initialize combat
const { data: combat } = await dmTools.initCombat({
  sessionId: 'session-123',
  participants: [
    { id: 'char-1', name: 'Aragorn', type: 'player', hp: 45, maxHp: 45, ac: 16 },
    { id: 'monster-1', name: 'Goblin', type: 'monster', hp: 7, maxHp: 7, ac: 15 },
  ],
});
```

### Characters
```typescript
import { characters } from '@/lib/supabase-client';

// Create character
const { data: character } = await characters.create({
  ownerId: 'user-123',
  name: 'Aragorn',
  race: 'Human',
  class: 'Ranger',
  level: 5,
  attributes: {
    strength: 16,
    dexterity: 14,
    constitution: 12,
    intelligence: 10,
    wisdom: 14,
    charisma: 12,
  },
});

// Level up
const { data: updated } = await characters.levelUp(character.id, {
  hpIncrease: 'average',
  abilityScoreImprovement: { dexterity: 2 },
});
```

### Rulesets (with Open5e)
```typescript
import { rulesets } from '@/lib/supabase-client';

// Get D&D 5e with Open5e enrichment
const { data: dnd5e } = await rulesets.get('dnd5e-srd', true);

// Get all spells
const { data: spells } = await rulesets.getSpells('dnd5e-srd', {
  level: 3,
  class: 'wizard',
});

// Get monsters
const { data: monsters } = await rulesets.getMonsters('dnd5e-srd', {
  type: 'dragon',
});
```

### Sessions
```typescript
import { sessions } from '@/lib/supabase-client';

// Create session
const { data: session } = await sessions.create({
  projectId: 'project-123',
  name: 'The Lost Mine of Phandelver',
  description: 'Our first adventure!',
});

// Join session
await sessions.join(session.id, 'user-123', 'character-456');

// Save game state
await sessions.save(session.id, 'Before the boss fight', { ...worldState });
```

### NPCs
```typescript
import { npcs } from '@/lib/supabase-client';

// Generate random NPC
const { data: npc } = await npcs.generate({
  type: 'npc',
  location: 'Tavern',
});

// Add memory
await npcs.addMemory(npc.id, 'Met the party and told them about the dragon');
```

### Bestiary
```typescript
import { bestiary } from '@/lib/supabase-client';

// Search monsters
const { data: monsters } = await bestiary.listMonsters({ type: 'undead' });

// Generate encounter
const { data: encounter } = await bestiary.generateEncounter('medium', 4, 5);
```

### World
```typescript
import { world } from '@/lib/supabase-client';

// Create world
const { data: worldData } = await world.create({
  projectId: 'project-123',
  name: 'Forgotten Realms',
});

// Add location
await world.addLocation(worldData.id, {
  name: 'Phandalin',
  type: 'town',
  description: 'A small mining town',
});
```

### Lorekeeper
```typescript
import { lorekeeper } from '@/lib/supabase-client';

// Create knowledge graph
const { data: graph } = await lorekeeper.createGraph('project-123', 'Main Campaign');

// Add NPC node
await lorekeeper.createNode(graph.id, {
  type: 'npc',
  name: 'Sildar Hallwinter',
  description: 'A grizzled veteran of the Lord\'s Alliance',
});

// Add relationship
await lorekeeper.createRelationship(npc1Id, npc2Id, 'KNOWS');
```

## Testing

```typescript
// __tests__/integration/characters.test.ts
import { characters } from '@/lib/supabase-client';

describe('Characters API', () => {
  it('should create a character', async () => {
    const { data, error } = await characters.create({
      ownerId: 'test-user',
      name: 'Test Character',
      race: 'Human',
      class: 'Fighter',
    });

    expect(error).toBeNull();
    expect(data.name).toBe('Test Character');
  });
});
```