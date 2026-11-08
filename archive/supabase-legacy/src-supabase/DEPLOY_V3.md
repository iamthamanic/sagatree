# 🚀 Schema V3 Deployment Guide

## Schritt 1: Supabase SQL Editor öffnen

1. Gehe zu deinem Supabase Dashboard
2. Klicke auf **SQL Editor** (linke Sidebar)
3. Klicke auf **+ New Query**

---

## Schritt 2: Schema erstellen

Kopiere den kompletten Inhalt von `/supabase/schema_v3_complete.sql` und führe ihn aus.

**Wichtig:** Das erstellt alle Tabellen!

---

## Schritt 3: RLS Policies hinzufügen

Kopiere den kompletten Inhalt von `/supabase/schema_v3_rls.sql` und führe ihn aus.

**Wichtig:** Das aktiviert Row Level Security und enthält bereits die gehärteten Projektmitgliedschafts-Policies/RPCs für neue Schema-V3-Installationen.

---

## Schritt 4: Character- und Security-Migrationen anwenden

Führe die Migrationen in dieser Reihenfolge aus:

1. `supabase/migrations/002_character_trait_arrays.sql`
2. `supabase/migrations/003_character_lore_rate_limits.sql`
3. `supabase/migrations/004_project_membership_security.sql`
4. `supabase/migrations/005_character_ruleset_metadata.sql`
5. `supabase/migrations/006_character_portrait_storage.sql`
6. `supabase/migrations/007_sagatree_character_profile.sql`

Auf dem Self-Host-Stack (`docker compose`, Container `sagatree-db`) Migrationen **nicht** über `/docker-entrypoint-initdb.d` mounten (das überschreibt das Image-Bootstrap). Stattdessen:

```bash
docker compose up -d supabase-db
./scripts/apply-migrations.sh                 # 001–007
./scripts/apply-migrations.sh 007_sagatree_character_profile.sql  # nur 007
```

`002_character_trait_arrays.sql` ist sowohl für bestehende als auch für frisch angelegte SagaTree-Datenbanken vorgesehen. Sie stellt `personality_traits`, `ideals`, `bonds` und `flaws` auf die vom CharacterEditor verwendeten Textbaustein-Arrays um und bewahrt vorhandene Einzelwerte als Ein-Element-Arrays.

`003_character_lore_rate_limits.sql` legt den persistenten Character-Lore-Rate-Limiter an. Die Tabelle ist nicht direkt für `anon` oder `authenticated` zugänglich; konsumiert wird das atomare Minutenkontingent ausschließlich über die `service_role`-RPC `consume_character_lore_rate_limit`. Die Migration muss vor dem produktiven Deploy der `character-lore` Edge Function aktiv sein, da die Funktion bei fehlendem persistentem Limiter bewusst fail-closed reagiert.

`004_project_membership_security.sql` härtet bestehende Installationen nach: Browser dürfen `project_id`, `user_id`, `role` und `status` einer Mitgliedschaft nicht mehr als Autorisierungsgrant selbst schreiben. Beitritt per Geheimcode läuft über `join_project_by_code`, die eigene Charakterzuordnung über `set_my_project_character`. Gekickte Mitgliedschaften bleiben als server-/GM-kontrollierte Sperrdatensätze erhalten und können nicht selbst reaktiviert oder gelöscht werden. Die Migration normalisiert außerdem die Projekt-Sichtbarkeit auf GM oder aktive Mitgliedschaft, ersetzt Legacy-Ressourcen-Policies durch aktive Membership-Semantik und erzwingt eine case-insensitiv eindeutige Projektcode-Identität.

`005_character_ruleset_metadata.sql` persistiert das im CharacterEditor ausgewählte Regelset separat als `ruleset_key` und den D&D-5.5e-Hintergrund als `dnd_background`. Bestehende Charaktere werden rückwärtskompatibel als `sagatree-core` behandelt. Beim Wechsel zurück auf SagaTree Core (`sagatree-core`) wird ein eventuell vorhandener D&D-Hintergrund entfernt, damit keine regelsetfremden Metadaten erhalten bleiben.

`006_character_portrait_storage.sql` richtet den privaten Storage-Bucket `character-portraits` ein. Upload und Lesen sind für `authenticated` nur im eigenen User-ID-Unterordner erlaubt; der Bucket begrenzt Portraits auf 5 MB und die unterstützten Bild-MIME-Typen. Der Browser lädt Portraits über denselben konfigurierten Supabase-Client hoch, sodass der dokumentierte Self-Host-Stack denselben Pfad verwendet.

`007_sagatree_character_profile.sql` ergänzt `characters.sagatree_profile` (JSONB) und persistente `characters.notes` für den SagaTree-Core Character Editor.

---

## Schritt 5: D&D 5e Ruleset erstellen (Seed Data)

```sql
INSERT INTO rulesets (
  id,
  name,
  description,
  version,
  is_official,
  is_public,
  attributes_config,
  skills_config,
  classes_config,
  races_config,
  combat_rules,
  dice_rules
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'D&D 5e',
  'Dungeons & Dragons 5th Edition',
  '5.0',
  true,
  true,
  '{
    "primary": ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    "derived": ["hp", "ac", "speed", "initiative", "proficiency_bonus"]
  }'::jsonb,
  '[
    {"name": "Athletics", "ability": "strength"},
    {"name": "Acrobatics", "ability": "dexterity"},
    {"name": "Sleight of Hand", "ability": "dexterity"},
    {"name": "Stealth", "ability": "dexterity"},
    {"name": "Arcana", "ability": "intelligence"},
    {"name": "History", "ability": "intelligence"},
    {"name": "Investigation", "ability": "intelligence"},
    {"name": "Nature", "ability": "intelligence"},
    {"name": "Religion", "ability": "intelligence"},
    {"name": "Animal Handling", "ability": "wisdom"},
    {"name": "Insight", "ability": "wisdom"},
    {"name": "Medicine", "ability": "wisdom"},
    {"name": "Perception", "ability": "wisdom"},
    {"name": "Survival", "ability": "wisdom"},
    {"name": "Deception", "ability": "charisma"},
    {"name": "Intimidation", "ability": "charisma"},
    {"name": "Performance", "ability": "charisma"},
    {"name": "Persuasion", "ability": "charisma"}
  ]'::jsonb,
  '[
    {"name": "Barbarian", "hit_die": "d12"},
    {"name": "Bard", "hit_die": "d8"},
    {"name": "Cleric", "hit_die": "d8"},
    {"name": "Druid", "hit_die": "d8"},
    {"name": "Fighter", "hit_die": "d10"},
    {"name": "Monk", "hit_die": "d8"},
    {"name": "Paladin", "hit_die": "d10"},
    {"name": "Ranger", "hit_die": "d10"},
    {"name": "Rogue", "hit_die": "d8"},
    {"name": "Sorcerer", "hit_die": "d6"},
    {"name": "Warlock", "hit_die": "d8"},
    {"name": "Wizard", "hit_die": "d6"}
  ]'::jsonb,
  '[
    {"name": "Human", "speed": 30, "size": "Medium"},
    {"name": "Elf", "speed": 30, "size": "Medium"},
    {"name": "Dwarf", "speed": 25, "size": "Medium"},
    {"name": "Halfling", "speed": 25, "size": "Small"},
    {"name": "Dragonborn", "speed": 30, "size": "Medium"},
    {"name": "Gnome", "speed": 25, "size": "Small"},
    {"name": "Half-Elf", "speed": 30, "size": "Medium"},
    {"name": "Half-Orc", "speed": 30, "size": "Medium"},
    {"name": "Tiefling", "speed": 30, "size": "Medium"}
  ]'::jsonb,
  '{
    "initiative": "1d20 + dex_modifier",
    "actions_per_turn": 1,
    "bonus_actions_per_turn": 1,
    "reactions_per_round": 1,
    "movement": "speed",
    "death_saves": {
      "successes_needed": 3,
      "failures_needed": 3
    }
  }'::jsonb,
  '{
    "standard_set": ["d4", "d6", "d8", "d10", "d12", "d20", "d100"],
    "advantage": "roll_twice_take_higher",
    "disadvantage": "roll_twice_take_lower",
    "critical_hit": "natural_20",
    "critical_miss": "natural_1"
  }'::jsonb
);
```

---

## Schritt 6: Verifizieren

Gehe zu **Table Editor** und prüfe, ob alle Tabellen existieren:

- ✅ rulesets
- ✅ worlds
- ✅ locations
- ✅ characters
- ✅ spells_abilities
- ✅ character_spells_abilities
- ✅ items
- ✅ character_inventory
- ✅ projects
- ✅ project_members
- ✅ sessions
- ✅ session_participants
- ✅ combat_encounters
- ✅ combat_participants
- ✅ battle_maps
- ✅ map_tokens
- ✅ dice_rolls
- ✅ quests
- ✅ marketplace_categories
- ✅ ai_context
- ✅ character_lore_rate_limits

Prüfe bei `characters` zusätzlich:

- `personality_traits`, `ideals`, `bonds` und `flaws` sind Text-Arrays.
- `ruleset_key` existiert, ist nicht `NULL` und enthält nur `sagatree-core` oder `dnd-5.5e`.
- `dnd_background` existiert als separates optionales Textfeld und wird nicht mit `background_story` vermischt.

Prüfe anschließend:

- `consume_character_lore_rate_limit` existiert; `anon`/`authenticated` dürfen sie nicht ausführen, `service_role` darf es.
- `join_project_by_code` und `set_my_project_character` existieren und sind für `authenticated`, nicht für `anon`, freigegeben.
- Es existiert keine RLS-Policy mehr, mit der ein User seinen eigenen `project_members.status`, `role` oder `project_id` direkt aktualisieren kann.
- Projektzugriff für Spieler basiert auf `status = 'active'`; eine gekickte/inaktive Mitgliedschaft ist kein Autorisierungsgrant.
- Projektcodes sind nach `UPPER(BTRIM(code))` eindeutig.
- Storage-Bucket `character-portraits` ist privat, hat 5 MB Limit und erlaubt `authenticated` nur den eigenen User-ID-Pfad.

---

## Schritt 7: Test

1. Reload die App
2. Gehe zu Dashboard
3. Öffne den CharacterEditor und den BG-Tab
4. Prüfe, dass `Kampagnen-Lore` ohne Auswahl setting-neutral bleibt und ein berechtigtes aktives Projekt auswählbar ist
5. Wechsle im Info-Tab auf D&D 5.5e, wähle Klasse, Spezies und Hintergrund und speichere den Charakter. Prüfe, dass `ruleset_key = dnd-5.5e` und `dnd_background` separat gespeichert werden.
6. Erzeuge oder lade ein Portrait hoch und prüfe, dass das Objekt in `character-portraits/<user-id>/...` landet und eine signierte URL zurückkommt.
7. Teste Beitritt per Projektcode und stelle sicher, dass `project_members` nicht direkt vom Browser geschrieben werden muss
8. Fehler sollten weg sein! ✅

---

## 🎉 Fertig!

Du hast jetzt:
- ✅ Komplettes D&D-System
- ✅ Flexible Rulesets
- ✅ Regelset- und D&D-Hintergrund-Persistenz pro Charakter
- ✅ Character System (PC/NPC/Companion/Monster)
- ✅ Privaten, Self-Host-kompatiblen Character-Portrait-Storage
- ✅ Projects & Sessions
- ✅ Server-/GM-kontrollierte Projektmitgliedschaft
- ✅ Persistentes, instanzübergreifendes Character-Lore-Rate-Limit
- ✅ Autorisierten Projekt-/Welt-Lore-Kontext im CharacterEditor
- ✅ Combat Tracking (vorbereitet)
- ✅ Battle Maps (vorbereitet)
- ✅ Marketplace (vorbereitet)
- ✅ AI Integration (vorbereitet)

---

## Nächste Schritte

Siehe `/ARCHITECTURE.md` für die komplette Roadmap!