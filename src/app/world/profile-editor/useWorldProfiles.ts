/**
 * useWorldProfiles — App hook for world profile list/CRUD.
 * Location: src/app/world/profile-editor/useWorldProfiles.ts
 *
 * Waits for a GoTrue JWT (`hasJwtSession`) before listing — offline Local Admin
 * UI alone cannot pass world_profiles RLS. Host Library cutover skips JWT
 * (`VITE_SAGATREE_HOST_LIBRARY`) and reads via host HTTP instead.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { API_AUTH_REQUIRED_DE } from '../../../lib/authenticatedUser';
import { ENTITY_CACHE_KEYS, entityCache } from '../../../lib/entityCache';
import { useCachedEntityList } from '../../../lib/useCachedEntityList';
import { isHostLibraryEnabled } from '../../../infrastructure/host/host-library-http';
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
  const hostLibrary = isHostLibraryEnabled();
  const canListWorlds = hostLibrary || hasJwtSession;

  useEffect(() => {
    if (!enabled || !user || canListWorlds || authLoading) return;
    let cancelled = false;
    void (async () => {
      const ok = await ensureJwtSession();
      if (cancelled) return;
      setApiAuthError(ok ? null : API_AUTH_REQUIRED_DE);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user, canListWorlds, authLoading, ensureJwtSession]);

  const fetcher = useCallback(async () => {
    if (!user) return [] as WorldProfileVm[];
    return worldProfileService.getUserWorldProfiles(user.id);
  }, [user]);

  const { items, isLoading, error, refresh } = useCachedEntityList<WorldProfileVm[]>(
    ENTITY_CACHE_KEYS.worldSummaries,
    fetcher,
    [],
    { enabled: enabled && Boolean(user) && canListWorlds },
  );

  useEffect(() => {
    if (!user) {
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
    }
  }, [user]);

  useEffect(() => {
    if (canListWorlds) {
      setApiAuthError(null);
      void refresh();
    }
  }, [canListWorlds, refresh]);

  const reconnectApi = useCallback(async () => {
    setReconnecting(true);
    setApiAuthError(null);
    try {
      if (!hostLibrary) {
        const ok = await ensureJwtSession();
        if (!ok) {
          setApiAuthError(API_AUTH_REQUIRED_DE);
          return;
        }
      }
      entityCache.invalidate(ENTITY_CACHE_KEYS.worldSummaries);
      await refresh();
    } finally {
      setReconnecting(false);
    }
  }, [ensureJwtSession, hostLibrary, refresh]);

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

  const combinedError = hostLibrary ? error : (apiAuthError ?? error);
  const apiAuthPending = Boolean(user && !canListWorlds && !authLoading);

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
