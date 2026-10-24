/**
 * SQLite ruleset catalog store (MIG-309).
 * Location: server/src/modules/rulesets/internal/ruleset-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type RulesetRecord = {
  readonly id: string;
  readonly creatorUserId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly version: string | null;
  readonly attributesConfig: { readonly primary: string[]; readonly derived: string[] };
  readonly skillsConfig: readonly { readonly name: string; readonly ability: string }[];
  readonly classesConfig: readonly { readonly name: string; readonly hit_die: string }[];
  readonly racesConfig: readonly {
    readonly name: string;
    readonly speed: number;
    readonly size: string;
  }[];
  readonly combatRules: Record<string, unknown>;
  readonly diceRules: Record<string, unknown>;
  readonly levelProgression: Record<string, unknown>;
  readonly isOfficial: boolean;
  readonly isPublic: boolean;
  readonly isMarketplaceItem: boolean;
  readonly downloadsCount: number;
  readonly rating: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateRulesetInput = {
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly attributesConfig: RulesetRecord['attributesConfig'];
  readonly skillsConfig?: RulesetRecord['skillsConfig'];
  readonly classesConfig?: RulesetRecord['classesConfig'];
  readonly racesConfig?: RulesetRecord['racesConfig'];
  readonly combatRules?: Record<string, unknown>;
  readonly diceRules?: Record<string, unknown>;
  readonly isPublic?: boolean;
};

export type UpdateRulesetInput = {
  readonly id: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly version?: string | null;
  readonly attributesConfig?: RulesetRecord['attributesConfig'];
  readonly skillsConfig?: RulesetRecord['skillsConfig'];
  readonly classesConfig?: RulesetRecord['classesConfig'];
  readonly racesConfig?: RulesetRecord['racesConfig'];
  readonly combatRules?: Record<string, unknown>;
  readonly diceRules?: Record<string, unknown>;
  readonly isPublic?: boolean;
};

type Row = {
  id: string;
  creator_user_id: string | null;
  name: string;
  description: string | null;
  version: string | null;
  attributes_config_json: string;
  skills_config_json: string;
  classes_config_json: string;
  races_config_json: string;
  combat_rules_json: string;
  dice_rules_json: string;
  level_progression_json: string;
  is_official: number;
  is_public: number;
  is_marketplace_item: number;
  downloads_count: number;
  rating: number | null;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapRow(row: Row): RulesetRecord {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    name: row.name,
    description: row.description,
    version: row.version,
    attributesConfig: parseJson(row.attributes_config_json, { primary: [], derived: [] }),
    skillsConfig: parseJson(row.skills_config_json, []),
    classesConfig: parseJson(row.classes_config_json, []),
    racesConfig: parseJson(row.races_config_json, []),
    combatRules: parseJson(row.combat_rules_json, {}),
    diceRules: parseJson(row.dice_rules_json, {}),
    levelProgression: parseJson(row.level_progression_json, {}),
    isOfficial: row.is_official === 1,
    isPublic: row.is_public === 1,
    isMarketplaceItem: row.is_marketplace_item === 1,
    downloadsCount: row.downloads_count,
    rating: row.rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LIST_ORDER = `ORDER BY is_official DESC, name COLLATE NOCASE ASC`;

export function createRulesetStore(db: HostDatabase) {
  return {
    listAll(): readonly RulesetRecord[] {
      const rows = db
        .prepare(`SELECT * FROM rulesets ${LIST_ORDER}`)
        .all() as Row[];
      return rows.map(mapRow);
    },

    listOfficial(): readonly RulesetRecord[] {
      const rows = db
        .prepare(`SELECT * FROM rulesets WHERE is_official = 1 ${LIST_ORDER}`)
        .all() as Row[];
      return rows.map(mapRow);
    },

    getById(id: string): RulesetRecord | null {
      const row = db.prepare(`SELECT * FROM rulesets WHERE id = ?`).get(id) as Row | undefined;
      return row ? mapRow(row) : null;
    },

    seedOfficial(input: {
      readonly id?: string;
      readonly name: string;
      readonly attributesConfig: RulesetRecord['attributesConfig'];
    }): RulesetRecord {
      const now = new Date().toISOString();
      const id = input.id ?? `RS-OFF-${randomUUID().slice(0, 8)}`;
      db.prepare(
        `INSERT INTO rulesets (
          id, creator_user_id, name, description, version,
          attributes_config_json, skills_config_json, classes_config_json, races_config_json,
          combat_rules_json, dice_rules_json, level_progression_json,
          is_official, is_public, is_marketplace_item, downloads_count, rating, created_at, updated_at
        ) VALUES (?, NULL, ?, NULL, '1.0.0', ?, '[]', '[]', '[]', '{}', '{}', '{}', 1, 1, 0, 0, NULL, ?, ?)`,
      ).run(id, input.name, JSON.stringify(input.attributesConfig), now, now);
      return this.getById(id)!;
    },

    insertCustom(ownerUserId: string, input: CreateRulesetInput): RulesetRecord {
      const now = new Date().toISOString();
      const id = `RS-${randomUUID().slice(0, 12)}`;
      db.prepare(
        `INSERT INTO rulesets (
          id, creator_user_id, name, description, version,
          attributes_config_json, skills_config_json, classes_config_json, races_config_json,
          combat_rules_json, dice_rules_json, level_progression_json,
          is_official, is_public, is_marketplace_item, downloads_count, rating, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 0, ?, 0, 0, NULL, ?, ?)`,
      ).run(
        id,
        ownerUserId,
        input.name,
        input.description ?? null,
        input.version ?? null,
        JSON.stringify(input.attributesConfig),
        JSON.stringify(input.skillsConfig ?? []),
        JSON.stringify(input.classesConfig ?? []),
        JSON.stringify(input.racesConfig ?? []),
        JSON.stringify(input.combatRules ?? {}),
        JSON.stringify(input.diceRules ?? {}),
        input.isPublic === true ? 1 : 0,
        now,
        now,
      );
      return this.getById(id)!;
    },

    updateCustom(input: UpdateRulesetInput): RulesetRecord | null {
      const existing = this.getById(input.id);
      if (!existing || existing.isOfficial) return null;
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE rulesets SET
          name = ?,
          description = ?,
          version = ?,
          attributes_config_json = ?,
          skills_config_json = ?,
          classes_config_json = ?,
          races_config_json = ?,
          combat_rules_json = ?,
          dice_rules_json = ?,
          is_public = ?,
          updated_at = ?
        WHERE id = ? AND is_official = 0`,
      ).run(
        input.name ?? existing.name,
        input.description === undefined ? existing.description : input.description,
        input.version === undefined ? existing.version : input.version,
        JSON.stringify(input.attributesConfig ?? existing.attributesConfig),
        JSON.stringify(input.skillsConfig ?? existing.skillsConfig),
        JSON.stringify(input.classesConfig ?? existing.classesConfig),
        JSON.stringify(input.racesConfig ?? existing.racesConfig),
        JSON.stringify(input.combatRules ?? existing.combatRules),
        JSON.stringify(input.diceRules ?? existing.diceRules),
        input.isPublic === undefined ? (existing.isPublic ? 1 : 0) : input.isPublic ? 1 : 0,
        now,
        input.id,
      );
      return this.getById(input.id);
    },

    deleteCustom(id: string): boolean {
      const existing = this.getById(id);
      if (!existing || existing.isOfficial) return false;
      const result = db.prepare(`DELETE FROM rulesets WHERE id = ? AND is_official = 0`).run(id);
      return Number(result.changes ?? 0) > 0;
    },
  };
}

export type RulesetStore = ReturnType<typeof createRulesetStore>;
