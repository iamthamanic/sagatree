/**
 * ruleset-service — Ruleset catalog service (Supabase + host dual-path).
 * Location: src/infrastructure/rulesets/ruleset-service.ts
 *
 * Dual-path (FE-HOST-08): Host HTTP when `VITE_SAGATREE_HOST_LIBRARY=1`.
 */
import { supabase } from '../../lib/supabase';
import type { CreateRulesetDTO, Ruleset, UpdateRulesetDTO } from '../../domains/rules/ruleset-catalog';
import {
  createHostRuleset,
  deleteHostRuleset,
  fetchHostRuleset,
  fetchHostRulesets,
  isHostLibraryEnabled,
  updateHostRuleset,
} from '../host/host-catalog-http';

export const rulesetService = {
  async getAll(): Promise<Ruleset[]> {
    if (isHostLibraryEnabled()) {
      return fetchHostRulesets(false);
    }
    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .order('is_official', { ascending: false })
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getOfficial(): Promise<Ruleset[]> {
    if (isHostLibraryEnabled()) {
      return fetchHostRulesets(true);
    }
    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('is_official', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Ruleset | null> {
    if (isHostLibraryEnabled()) {
      return fetchHostRuleset(id);
    }
    const { data, error } = await supabase.from('rulesets').select('*').eq('id', id).single();

    if (error) throw error;
    return data;
  },

  async create(dto: CreateRulesetDTO): Promise<Ruleset> {
    if (isHostLibraryEnabled()) {
      return createHostRuleset(dto);
    }
    const { data, error } = await supabase
      .from('rulesets')
      .insert({
        ...dto,
        is_official: false,
        is_marketplace_item: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(dto: UpdateRulesetDTO): Promise<Ruleset> {
    if (isHostLibraryEnabled()) {
      return updateHostRuleset(dto);
    }
    const { id, ...updates } = dto;
    const { data, error } = await supabase
      .from('rulesets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (isHostLibraryEnabled()) {
      await deleteHostRuleset(id);
      return;
    }
    const { error } = await supabase.from('rulesets').delete().eq('id', id);

    if (error) throw error;
  },
};
