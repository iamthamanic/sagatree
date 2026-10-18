/**
 * useWorldProfiles — App hook for world profile list/CRUD.
 * Location: src/app/world/profile-editor/useWorldProfiles.ts
 *
 * Waits for a GoTrue JWT (`hasJwtSession`) before listing — offline Local Admin
 * UI alone cannot pass world_profiles RLS.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { API_AUTH_REQUIRED_DE } from '../../../lib/authenticatedUser';
import { ENTITY_CACHE_KEYS, entityCache } from '../../../lib/entityCache';
import { useCachedEntityList } from '../../../lib/useCachedEntityList';
import { worldProfileService } from '../../../infrastructure/world/world-profile-service';
import type {
  CreateWorldProfileDto,
  UpdateWorldProfileDto,
  WorldProfileVm,
} from '../../../domains/world/contracts/world.types';

interface UseWorldProfilesOptions {
  enabled?: boolean;
}

interface UseWorldProfilesReturn {
  worlds: WorldProfileVm[];
  isLoading: boolean;
  error: string | null;
  apiAuthPending: boolean;
  reconnectApi: () => Promise<void>;
  createWorld: (payload: CreateWorldProfileDto) => Promise<WorldProfileVm | null>;
  updateWorld: (id: string, payload: UpdateWorldProfileDto) => Promise<WorldProfileVm | null>;
  duplicateWorld: (id: string) => Promise<WorldProfileVm | null>;
  deleteWorld: (id: string) => Promise<boolean>;
  refreshWorlds: () => Promise<void>;
}

export function useWorldProfiles(options: UseWorldProfilesOptions = {}): UseWorldProfilesReturn {
  const { enabled = true } = options;
  const { user, hasJwtSession, ensureJwtSession, isLoading: authLoading } = useAuth();
  const [apiAuthError, setApiAuthError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!enabled || !user || hasJwtSession || authLoading) return;
    let cancelled = false;
    void (async () => {
      const ok = await ensureJwtSession();
      if (cancelled) return;
      setApiAuthError(ok ? null : API_AUTH_REQUIRED_DE);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user, hasJwtSession, authLoading, ensureJwtSession]);

  const fetcher = useCallback(async () => {
    if (!user) return [] as WorldProfileVm[];
    return worldProfileService.getUserWorldProfiles(user.id);
  }, [user]);

  const { items, isLoading, error, refresh } = useCachedEntityList<WorldProfileVm[]>(
    ENTITY_CACHE_KEYS.worldSummaries,
    fetcher,
    [],
    { enabled: enabled && Boolean(user) && hasJwtSession },
  );

  useEffect(() => {
    if (!user) {
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
    }
  }, [user]);

  useEffect(() => {
    if (hasJwtSession) {
      setApiAuthError(null);
      void refresh();
    }
  }, [hasJwtSession, refresh]);

  const reconnectApi = useCallback(async () => {
    setReconnecting(true);
    setApiAuthError(null);
    try {
      const ok = await ensureJwtSession();
      if (!ok) {
        setApiAuthError(API_AUTH_REQUIRED_DE);
        return;
      }
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
      await refresh();
    } finally {
      setReconnecting(false);
    }
  }, [ensureJwtSession, refresh]);

  const createWorld = useCallback(async (payload: CreateWorldProfileDto): Promise<WorldProfileVm | null> => {
    if (!user) {
      return null;
    }

    try {
      const world = await worldProfileService.createWorldProfile(user.id, payload);
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
      await refresh();
      return world;
    } catch (err) {
      console.error('Error creating world:', err);
      return null;
    }
  }, [refresh, user]);

  const updateWorld = useCallback(async (
    id: string,
    payload: UpdateWorldProfileDto,
  ): Promise<WorldProfileVm | null> => {
    if (!user) {
      return null;
    }

    try {
      const world = await worldProfileService.updateWorldProfile(user.id, id, payload);
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
      await refresh();
      return world;
    } catch (err) {
      console.error('Error updating world:', err);
      return null;
    }
  }, [refresh, user]);

  const duplicateWorld = useCallback(async (id: string): Promise<WorldProfileVm | null> => {
    if (!user) {
      return null;
    }

    try {
      const world = await worldProfileService.duplicateWorldProfile(user.id, id);
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
      await refresh();
      return world;
    } catch (err) {
      console.error('Error duplicating world:', err);
      return null;
    }
  }, [refresh, user]);

  const deleteWorld = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      await worldProfileService.deleteWorldProfile(user.id, id);
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
      await refresh();
      return true;
    } catch (err) {
      console.error('Error deleting world:', err);
      return false;
    }
  }, [refresh, user]);

  const combinedError = apiAuthError ?? error;
  const apiAuthPending = Boolean(user && !hasJwtSession && !authLoading);

  return {
    worlds: items,
    isLoading: isLoading || authLoading || reconnecting || (apiAuthPending && !apiAuthError),
    error: combinedError,
    apiAuthPending,
    reconnectApi,
    createWorld,
    updateWorld,
    duplicateWorld,
    deleteWorld,
    refreshWorlds: refresh,
  };
}
