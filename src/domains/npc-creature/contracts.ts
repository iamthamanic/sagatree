/**
 * Use-case contracts for NPC/creature definition CRUD (#196).
 * Location: src/domains/npc-creature/contracts.ts
 *
 * Infrastructure implements these; app slices consume via infrastructure.
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { NpcCreatureDefinition, NpcCreatureDefinitionWriteDraft } from './definition';
import type { NpcCreatureCatalogRecord } from './policy';
import type { NpcCreatureScope } from './taxonomy';

/** Trusted create target — world id never comes from draft. */
export type CreateNpcCreatureDefinitionTarget =
  | { scope: 'personal' }
  | { scope: 'world'; worldProfileId: string };

export interface CreateNpcCreatureDefinitionInput {
  target: CreateNpcCreatureDefinitionTarget;
  draft: NpcCreatureDefinitionWriteDraft;
}

export interface UpdateNpcCreatureDefinitionInput {
  definitionId: string;
  draft: NpcCreatureDefinitionWriteDraft;
}

export interface NpcCreatureDefinitionRepository {
  listDefinitions(options?: {
    scope?: NpcCreatureScope;
    worldProfileId?: string | null;
    includeArchived?: boolean;
  }): Promise<NpcCreatureCatalogRecord[]>;

  getDefinitionById(definitionId: string): Promise<NpcCreatureCatalogRecord | null>;

  createDefinition(
    input: CreateNpcCreatureDefinitionInput,
  ): Promise<NpcCreatureCatalogRecord>;

  updateDefinition(
    input: UpdateNpcCreatureDefinitionInput,
  ): Promise<NpcCreatureCatalogRecord>;

  /** Soft-delete: status → archived. Hard delete is not offered while instances may appear later. */
  archiveDefinition(definitionId: string): Promise<NpcCreatureCatalogRecord>;

  restoreDefinition(definitionId: string): Promise<NpcCreatureCatalogRecord>;
}

/** View model helpers for later UI — definition + derived machtgrad label. */
export interface NpcCreatureDefinitionSummary {
  definition: NpcCreatureDefinition;
  machtgradLabel: string;
  status: NpcCreatureCatalogRecord['status'];
  scope: NpcCreatureScope;
  worldProfileId: string | null;
}
