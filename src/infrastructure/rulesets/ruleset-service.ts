/**
 * ruleset-service — Ruleset catalog via host HTTP (CUT-20).
 * Location: src/infrastructure/rulesets/ruleset-service.ts
 */
import type { CreateRulesetDTO, Ruleset, UpdateRulesetDTO } from '../../domains/rules/ruleset-catalog';
import {
  createHostRuleset,
  deleteHostRuleset,
  fetchHostRuleset,
  fetchHostRulesets,
  isHostLibraryEnabled,
  updateHostRuleset,
} from '../host/host-catalog-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

export const rulesetService = {
  async getAll(): Promise<Ruleset[]> {
    assertHost();
    return fetchHostRulesets(false);
  },

  async getOfficial(): Promise<Ruleset[]> {
    assertHost();
    return fetchHostRulesets(true);
  },

  async getById(id: string): Promise<Ruleset | null> {
    assertHost();
    return fetchHostRuleset(id);
  },

  async create(dto: CreateRulesetDTO): Promise<Ruleset> {
    assertHost();
    return createHostRuleset(dto);
  },

  async update(dto: UpdateRulesetDTO): Promise<Ruleset> {
    assertHost();
    return updateHostRuleset(dto);
  },

  async delete(id: string): Promise<void> {
    assertHost();
    await deleteHostRuleset(id);
  },
};
