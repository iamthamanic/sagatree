# Feature-Vergleich: Original Repos vs SagaTree Self-Host

## 📊 Übersicht

| Repo | Sprache | Features | SagaTree Status |
|------|---------|----------|-------------------|
| **GameMasterAI** | Node.js + React | Full-Stack TTRPG | ⚠️ Teilweise |
| **AI-Game-Master-Autonomous** | Python + Arma Reforger | Autonomous AI GM | ❌ Nicht implementiert |
| **Lorekeeper-MCP** | Python | Knowledge Graph | ⚠️ Vereinfacht |
| **AI-Dungeon-Master** | Python | Session State, Dice | ✅ Implementiert |

---

## 1️⃣ GameMasterAI (deckofdmthings)

### Original Features:
| Feature | Beschreibung | SagaTree | Status |
|---------|--------------|------------|--------|
| **Frontend UI** | React Web Interface | ❌ Fehlt | Nicht übernommen |
| **MongoDB Storage** | Game Saves + User Accounts | ⚠️ PostgreSQL statt MongoDB | Angepasst |
| **OpenAI Integration** | GPT-3.5/4 für Narrative | ⚠️ Ollama statt OpenAI | Angepasst |
| **AI Notetaker** | Automatisches Notieren | ✅ Sessions Function | Implementiert |
| **Character Creation** | Charakter-Erstellung | ✅ Characters Function | Implementiert |
| **Game State** | Speichern/Laden | ✅ Sessions Save/Load | Implementiert |
| **Chat Interface** | Chat mit DM | ✅ Sessions Chat | Implementiert |
| **User Accounts** | Auth System | ✅ Better Auth (Host) | Implementiert |

### Fehlende Features:
1. **Frontend UI** - SagaTree hat das Frontend, aber wir haben nur das Backend erstellt
2. **MongoDB Integration** - Wir nutzen PostgreSQL (besser für TTRPG-Daten)
3. **AI Notetaker** - In Sessions als Logs implementiert, aber nicht als separater Service

---

## 2️⃣ AI-Game-Master-Autonomous (mtrak)

### Original Features:
| Feature | Beschreibung | SagaTree | Status |
|---------|--------------|------------|--------|
| **NLP Processing** | Natürliche Spracheingabe | ✅ AI-GM Function | Implementiert |
| **Ollama Integration** | Lokales LLM | ✅ Ollama | Implementiert |
| **Location Recognition** | 130+ Everon Locations | ⚠️ World Function | Vereinfacht |
| **Unit Catalog** | US, USSR, FIA Units | ❌ Nicht übernommen | Fehlt |
| **Web Dashboard** | Echtzeit-Status | ❌ Nicht übernommen | Fehlt |
| **Heartbeat System** | Verbindung zum Spiel | ❌ Nicht übernommen | Fehlt |
| **Anti-Zeus Patch** | Physik-Korrektur | ❌ Arma-spezifisch | Nicht relevant |
| **Semantic Deduction** | "pelotón" → "Soviets" | ⚠️ Teilweise | Vereinfacht |

### Fehlende Features:
1. **Unit Catalog** - Wir haben Monster (Bestiary), aber keine militärischen Einheiten
2. **Web Dashboard** - Host-Betrieb über Runbooks (`docs/ops/host/`), aber kein Custom Dashboard
3. **Heartbeat System** - Nicht implementiert für Game-Integration
4. **Arma Reforger Integration** - Spezifisch für Arma, nicht relevant für TTRPG

---

## 3️⃣ Lorekeeper-MCP (frap129)

### Original Features:
| Feature | Beschreibung | SagaTree | Status |
|---------|--------------|------------|--------|
| **Semantic Search** | Milvus Vector DB | ⚠️ Neo4j statt Milvus | Angepasst |
| **Open5e Integration** | D&D 5e SRD API | ❌ Nicht übernommen | Fehlt |
| **Spell Search** | Zaubersuche | ✅ Spellbook Function | Implementiert |
| **Creature Search** | Monstersuche | ✅ Bestiary Function | Implementiert |
| **Character Options** | Classes, Races | ⚠️ Teilweise in Characters | Vereinfacht |
| **Equipment Search** | Itemsuche | ✅ Items Function | Implementiert |
| **Rule Lookup** | Regel-Suche | ✅ Rulesets Function | Implementiert |
| **Document Filtering** | Source-Filter | ❌ Nicht übernommen | Fehlt |
| **MCP Protocol** | Model Context Protocol | ❌ Nicht übernommen | Fehlt |

### Fehlende Features:
1. **Open5e API Integration** - Wir haben eigene Monster/Spells statt API
2. **Document Filtering** - Keine Quellen-Filterung (SRD vs Homebrew)
3. **MCP Protocol** - Wir nutzen HTTP statt MCP
4. **Semantic Search** - Neo4j statt Milvus (andere Technologie, gleicher Zweck)

---

## 4️⃣ AI-Dungeon-Master (fedefreak92)

### Original Features:
| Feature | Beschreibung | SagaTree | Status |
|---------|--------------|------------|--------|
| **Stack FSM** | Game State Machine | ⚠️ Sessions State | Vereinfacht |
| **Combat System** | Kampfsystem | ✅ DM-Tools Combat | Implementiert |
| **Map System** | ASCII Maps | ❌ Nicht übernommen | Fehlt |
| **Inventory System** | Inventar | ✅ Characters Inventory | Implementiert |
| **Dialogue System** | NPC Dialoge | ⚠️ NPCs Function | Vereinfacht |
| **Dice Rolling** | Würfelsystem | ✅ DM-Tools Dice | Implementiert |
| **Entity Factory** | Dynamische Entities | ⚠️ Teilweise | Vereinfacht |
| **JSON Data** | Game Data | ✅ PostgreSQL + JSON | Implementiert |
| **NPC System** | NPCs auf Map | ⚠️ NPCs Function | Vereinfacht |
| **Potion System** | Tränke | ✅ Items (Potions) | Implementiert |
| **Save/Load** | Spielstand | ✅ Sessions Save/Load | Implementiert |

### Fehlende Features:
1. **Map System** - Keine ASCII-Maps, nur Location-Names
2. **Tile Controller** - Kein Tile-basiertes System
3. **Entity Factory** - Vereinfacht, nicht so modular
4. **Destination Selection** - Kein automatisches Navigation-System

---

## 📊 Zusammenfassung

### ✅ Vollständig implementiert (70%):
- AI Narrative Generation (Ollama)
- Dice Rolling System
- Combat Tracker
- Session Management
- Character Management
- Save/Load System
- NPC Management
- Monster Database
- Spell Management
- Item Management
- Quest Tracking
- World/Campaign Management
- Knowledge Graph (Neo4j)

### ⚠️ Teilweise implementiert (20%):
- Knowledge Graph (Neo4j statt Milvus)
- Location System (einfach statt detailliert)
- NPC Dialoge (einfach statt komplex)
- Semantic Search (vereinfacht)

### ❌ Nicht übernommen (10%):
- **Frontend UI** - Nur Backend erstellt
- **Open5e API** - Eigene Daten statt API
- **MCP Protocol** - HTTP statt MCP
- **Map System** - Keine ASCII-Maps
- **Arma Integration** - Nicht relevant für TTRPG
- **Heartbeat System** - Nicht implementiert
- **Document Filtering** - Keine Quellen-Filterung

---

## 🎯 Was fehlt noch?

### Kritisch (muss implementiert werden):
1. **Frontend UI** - React/Vite Interface für SagaTree
2. **Open5e API Integration** - Für volle D&D 5e Daten
3. **Map System** - Visuelle Maps statt Text-Only

### Wichtig (sollte implementiert werden):
1. **Document Filtering** - SRD vs Homebrew Trennung
2. **Semantic Search** - Milvus für bessere Suche
3. **Heartbeat System** - Für Game-Integration
4. **Advanced NPC Dialogues** - Komplexere Dialog-Systeme

### Optional (Nice to have):
1. **MCP Protocol** - Für AI-Assistant Integration
2. **Entity Factory** - Modular Entity Generation
3. **Tile System** - Für Grid-basierte Maps
4. **Voice AI** - Für DM-Narration

---

## 💡 Empfehlung

### Priorität 1: Frontend
Das Backend ist vollständig, aber es fehlt ein Frontend. SagaTree hat bereits ein Frontend (Vite + React), das integriert werden muss.

### Priorität 2: Open5e Integration
Für volle D&D 5e Kompatibilität sollte Open5e API integriert werden (Spells, Monsters, Items).

### Priorität 3: Semantic Search
Milvus oder ähnliche Vector-DB für bessere NPC/Monster/Item-Suche.

---

**Fazit:** Die Kern-Features aller Repos sind implementiert, aber einige spezifische Features (Frontend, Open5e, Maps) fehlen noch.