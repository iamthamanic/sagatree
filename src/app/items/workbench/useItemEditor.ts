/**
 * useItemEditor — load/save/dirty/mode state for Item Workbench (#139).
 * Persistence via catalog service only; no backend client in this slice.
 * Location: src/app/items/workbench/useItemEditor.ts
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import type { ItemDefinition } from '../../../domains/character/inventory-v2';
import {
  archiveDefinition,
  createPersonalDefinition,
  createWorldDefinition,
  forkDefinition,
  getItemDefinitionById,
  restoreDefinition,
  updateDefinition,
  type ForkDefinitionTarget,
} from '../../../infrastructure/inventory/item-catalog-service';
import { setNavigationBlocker } from '../../shell';
import { useWorldProfiles } from '../../world';
import {
  applyTypeEntry,
  buildWorkbenchDraft,
  emptyWorkbenchForm,
  formFromDefinition,
  serializeForm,
  type WorkbenchFormState,
  type WorkbenchTypeEntry,
} from './workbenchForm';
import { DIRTY_LEAVE_MESSAGE, workbenchEntryBySlug, WORKBENCH_TYPE_ENTRIES } from './workbenchLabels';

export type WorkbenchEditorMode = 'landing' | 'create' | 'edit' | 'readonly';

export interface UseItemEditorOptions {
  route: 'create' | 'detail';
  itemId: string | null;
  /** When set on create route (`/items/create/new/waffe`), forge opens typed. */
  createTypeSlug?: string | null;
  /** Navigate to `/items/create/new/:slug` after type pick from the entry modal. */
  onNavigateToCreateType?: (typeSlug: string) => void;
  onCreated: (itemId: string) => void;
  onBack: () => void;
}

export function useItemEditor({
  route,
  itemId,
  createTypeSlug = null,
  onNavigateToCreateType,
  onCreated,
  onBack,
}: UseItemEditorOptions) {
  const typedEntry =
    route === 'create' && createTypeSlug ? workbenchEntryBySlug(createTypeSlug) : null;
  const typedCreate = Boolean(typedEntry);
  const invalidCreateSlug = Boolean(route === 'create' && createTypeSlug && !typedEntry);

  const [mode, setMode] = useState<WorkbenchEditorMode>(() => {
    if (route === 'detail') return 'edit';
    if (typedCreate) return 'create';
    return 'landing';
  });
  const [form, setForm] = useState<WorkbenchFormState>(() =>
    typedEntry ? emptyWorkbenchForm(typedEntry) : emptyWorkbenchForm(),
  );
  const [baseline, setBaseline] = useState(() =>
    serializeForm(typedEntry ? emptyWorkbenchForm(typedEntry) : emptyWorkbenchForm()),
  );
  const [definition, setDefinition] = useState<ItemDefinition | null>(null);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(route === 'detail');
  const [loadError, setLoadError] = useState(() =>
    invalidCreateSlug ? 'Unbekannter Item-Typ.' : '',
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [typePickerOpen, setTypePickerOpenState] = useState(
    () => route === 'create' && !typedCreate && !invalidCreateSlug,
  );
  const [forkOpen, setForkOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pendingTypeEntry, setPendingTypeEntry] = useState<WorkbenchTypeEntry | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const formRef = useRef(form);
  formRef.current = form;
  /** After typed URL or first landing pick, the entry modal must never come back this session. */
  const entryTypeChosenRef = useRef(typedCreate);
  /** Blocks ghost reopen of the entry modal right after a selection. */
  const suppressPickerUntilRef = useRef(0);

  const openTypePicker = () => {
    if (Date.now() < suppressPickerUntilRef.current) return;
    if (modeRef.current !== 'landing') return;
    if (entryTypeChosenRef.current) return;
    setTypePickerOpenState(true);
  };

  const closeTypePicker = () => {
    setTypePickerOpenState(false);
  };

  /** Radix may emit onOpenChange(true) during teardown — never honor opens from the dialog. */
  const handleTypePickerOpenChange = (open: boolean) => {
    if (!open) closeTypePicker();
  };

  /** Entry modal only on create landing before a type is chosen. */
  const isTypePickerVisible =
    mode === 'landing' && typePickerOpen && !entryTypeChosenRef.current;

  const { worlds, isLoading: worldsLoading } = useWorldProfiles({ enabled: true });
  const editableWorldIds = worlds.map((world) => world.id);
  const editableWorldKey = editableWorldIds.join('|');

  const dirty = mode !== 'landing' && mode !== 'readonly' && serializeForm(form) !== baseline;

  useEffect(() => {
    if (!dirty) return;
    return setNavigationBlocker(() => DIRTY_LEAVE_MESSAGE);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = DIRTY_LEAVE_MESSAGE;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (route !== 'detail' || !itemId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    void (async () => {
      try {
        const result = await getItemDefinitionById(itemId);
        if (cancelled) return;
        if (!result) {
          setLoadError('Gegenstand wurde nicht gefunden.');
          setDefinition(null);
          setLoading(false);
          return;
        }

        const { definition: loaded, record } = result;
        const isReadonly =
          loaded.scope === 'core' ||
          loaded.origin === 'core-archetype' ||
          loaded.origin === 'builtin-standard';

        let canEdit = false;
        if (!isReadonly && record) {
          if (loaded.scope === 'personal') {
            canEdit = true;
          } else if (loaded.scope === 'world' && record.worldProfileId) {
            if (worldsLoading) {
              // Wait for editable worlds before deciding edit vs readonly.
              return;
            }
            canEdit = editableWorldIds.includes(record.worldProfileId);
          }
        }

        const nextForm = formFromDefinition(loaded, {
          worldProfileId: record?.worldProfileId ?? '',
          availability: loaded.scope === 'world' ? 'world' : 'personal',
        });
        setDefinition(loaded);
        setArchived(record?.status === 'archived');
        setForm(nextForm);
        setBaseline(serializeForm(nextForm));
        setMode(canEdit && !isReadonly ? 'edit' : 'readonly');
        setSaveError('');
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[item-workbench] load failed', err);
        setLoadError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route, itemId, worldsLoading, editableWorldKey]);

  const markClean = (next: WorkbenchFormState) => {
    setForm(next);
    setBaseline(serializeForm(next));
  };

  const confirmLeave = (): boolean => {
    if (!dirty) return true;
    if (typeof window === 'undefined') return true;
    return window.confirm(DIRTY_LEAVE_MESSAGE);
  };

  const handleBack = () => {
    if (!confirmLeave()) return;
    setNavigationBlocker(null);
    onBack();
  };

  const openLanding = () => {
    openTypePicker();
  };

  const selectTypeEntry = (entry: WorkbenchTypeEntry) => {
    const fromLanding = modeRef.current === 'landing';
    suppressPickerUntilRef.current = Date.now() + 1200;

    if (fromLanding) {
      entryTypeChosenRef.current = true;
      // Close modal first, then URL drives forge mount (`/items/create/new/waffe`).
      flushSync(() => {
        setTypePickerOpenState(false);
        setPendingTypeEntry(null);
      });
      if (onNavigateToCreateType) {
        onNavigateToCreateType(entry.slug);
        return;
      }
      // Fallback if navigation is unavailable (tests / partial mounts).
      flushSync(() => {
        const next = emptyWorkbenchForm(entry);
        setForm(next);
        setBaseline(serializeForm(next));
        setMode('create');
        setDefinition(null);
        setArchived(false);
      });
      return;
    }

    // Item-Art dropdown in forge — keep URL, apply template defaults.
    flushSync(() => {
      setTypePickerOpenState(false);
      if (typeChangeLosesValues(form, entry) && !window.confirm('Typabhängige Werte gehen verloren. Fortfahren?')) {
        return;
      }
      setForm(applyTypeEntry(form, entry));
      setPendingTypeEntry(null);
    });
  };

  const requestTypeChange = (entry: WorkbenchTypeEntry) => {
    if (mode === 'landing') {
      selectTypeEntry(entry);
      return;
    }
    if (typeChangeLosesValues(form, entry)) {
      setPendingTypeEntry(entry);
      return;
    }
    selectTypeEntry(entry);
  };

  const requestKindChange = (kindKey: WorkbenchTypeEntry['kindKey']) => {
    const entry = WORKBENCH_TYPE_ENTRIES.find((candidate) => candidate.kindKey === kindKey);
    if (!entry) return;
    requestTypeChange(entry);
  };

  const confirmPendingTypeChange = () => {
    if (!pendingTypeEntry) return;
    suppressPickerUntilRef.current = Date.now() + 1200;
    const next = applyTypeEntry(form, pendingTypeEntry);
    setForm(next);
    setPendingTypeEntry(null);
    closeTypePicker();
  };

  const applyAssetKey = (assetKey: string | undefined) => {
    setDefinition((previous) => {
      if (!previous) return previous;
      if (assetKey) return { ...previous, assetKey };
      const next = { ...previous };
      delete next.assetKey;
      return next;
    });
  };

  const applyModel3d = (model3d: string | undefined) => {
    setDefinition((previous) => {
      if (!previous) return previous;
      if (model3d) return { ...previous, model3d };
      const next = { ...previous };
      delete next.model3d;
      return next;
    });
  };

  /** Auto-create a draft so 2D/3D upload can run before the user hits Speichern. */
  const ensureDraftPromiseRef = useRef<Promise<string | null> | null>(null);
  const ensureDraftId = async (): Promise<string | null> => {
    if (definition?.id) return definition.id;
    if (mode === 'readonly' || mode === 'landing') return null;
    if (ensureDraftPromiseRef.current) return ensureDraftPromiseRef.current;

    ensureDraftPromiseRef.current = (async () => {
      const nameFallback =
        WORKBENCH_TYPE_ENTRIES.find((entry) => entry.kindKey === form.kindKey)?.label ??
        'Neues Item';
      const worldWithoutId =
        form.availability === 'world' && !form.worldProfileId.trim();
      const draftForm: WorkbenchFormState = {
        ...form,
        name: form.name.trim() || nameFallback,
        // World without a chosen world → personal so upload is not blocked.
        availability:
          form.availability === 'world' && form.worldProfileId.trim()
            ? 'world'
            : 'personal',
      };
      if (worldWithoutId) {
        toast.message('Als persönliches Item angelegt', {
          description:
            'Welt-Item braucht eine gewählte Welt. Du kannst Eigentum später vor dem Speichern setzen.',
        });
      }
      const payload = buildWorkbenchDraft(draftForm);
      if (typeof payload === 'string') {
        setSaveError(payload);
        toast.error(payload);
        return null;
      }
      setSaving(true);
      setSaveError('');
      try {
        const record =
          draftForm.availability === 'world'
            ? await createWorldDefinition(draftForm.worldProfileId.trim(), payload)
            : await createPersonalDefinition(payload);

        const fromServer = formFromDefinition(record.definition, {
          worldProfileId: record.worldProfileId ?? '',
          availability: record.definition.scope === 'world' ? 'world' : 'personal',
        });
        // Keep edits made while the draft request was in flight.
        const live = formRef.current;
        const next: WorkbenchFormState = {
          ...fromServer,
          ...live,
          availability: fromServer.availability,
          worldProfileId: fromServer.worldProfileId,
        };
        if (!live.name.trim()) {
          next.name = '';
        }
        setDefinition(record.definition);
        setMode('edit');
        markClean(next);
        setNavigationBlocker(null);
        onCreated(record.definition.id);
        return record.definition.id;
      } catch (err) {
        console.error('[item-workbench] auto-draft failed', err);
        const message = err instanceof Error ? err.message : 'Entwurf konnte nicht angelegt werden.';
        setSaveError(message);
        toast.error(message);
        return null;
      } finally {
        setSaving(false);
      }
    })();

    try {
      return await ensureDraftPromiseRef.current;
    } finally {
      ensureDraftPromiseRef.current = null;
    }
  };

  const handleSave = async () => {
    if (mode === 'readonly' || mode === 'landing') return;
    const payload = buildWorkbenchDraft(form);
    if (typeof payload === 'string') {
      setSaveError(payload);
      return;
    }
    // Preserve thumbnail/icon/3d keys set outside the form (Edge upload/Meshy).
    if (definition?.assetKey) payload.assetKey = definition.assetKey;
    if (definition?.iconKey) payload.iconKey = definition.iconKey;
    if (definition?.model3d) payload.model3d = definition.model3d;
    setSaving(true);
    setSaveError('');
    try {
      if (mode === 'edit' && definition) {
        await updateDefinition(definition.id, payload);
        const refreshed = await getItemDefinitionById(definition.id);
        if (refreshed) {
          const next = formFromDefinition(refreshed.definition, {
            worldProfileId: refreshed.record?.worldProfileId ?? form.worldProfileId,
            availability: refreshed.definition.scope === 'world' ? 'world' : 'personal',
          });
          setDefinition(refreshed.definition);
          markClean(next);
        } else {
          markClean(form);
        }
        toast.success('Item gespeichert');
        return;
      }

      const record =
        form.availability === 'world'
          ? await createWorldDefinition(form.worldProfileId.trim(), payload)
          : await createPersonalDefinition(payload);

      const next = formFromDefinition(record.definition, {
        worldProfileId: record.worldProfileId ?? '',
        availability: record.definition.scope === 'world' ? 'world' : 'personal',
      });
      setDefinition(record.definition);
      setMode('edit');
      markClean(next);
      setNavigationBlocker(null);
      toast.success('Item erstellt');
      onCreated(record.definition.id);
    } catch (err) {
      console.error('[item-workbench] save failed', err);
      setSaveError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleFork = async (target: ForkDefinitionTarget) => {
    if (!definition) return;
    setSaving(true);
    setSaveError('');
    try {
      const record = await forkDefinition(definition.id, target);
      setForkOpen(false);
      setNavigationBlocker(null);
      toast.success('Item erstellt');
      onCreated(record.definition.id);
    } catch (err) {
      console.error('[item-workbench] fork failed', err);
      setSaveError(err instanceof Error ? err.message : 'Kopieren fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!definition || mode !== 'edit') return;
    setSaving(true);
    setSaveError('');
    try {
      await archiveDefinition(definition.id);
      setArchiveOpen(false);
      setArchived(true);
      toast.success('Item archiviert');
      setNavigationBlocker(null);
      onBack();
    } catch (err) {
      console.error('[item-workbench] archive failed', err);
      setSaveError(err instanceof Error ? err.message : 'Archivieren fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!definition || mode !== 'edit') return;
    setSaving(true);
    setSaveError('');
    try {
      await restoreDefinition(definition.id);
      setArchived(false);
      toast.success('Item wiederhergestellt');
    } catch (err) {
      console.error('[item-workbench] restore failed', err);
      setSaveError(err instanceof Error ? err.message : 'Wiederherstellen fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const reload = () => {
    if (route === 'detail' && itemId) {
      setLoadError('');
      setLoading(true);
      // Trigger effect by toggling — worldsLoading already settled; force via state.
      void getItemDefinitionById(itemId)
        .then((result) => {
          if (!result) {
            setLoadError('Gegenstand wurde nicht gefunden.');
            setDefinition(null);
            return;
          }
          const { definition: loaded, record } = result;
          const isReadonly =
            loaded.scope === 'core' ||
            loaded.origin === 'core-archetype' ||
            loaded.origin === 'builtin-standard';
          let canEdit = false;
          if (!isReadonly && record) {
            if (loaded.scope === 'personal') canEdit = true;
            else if (loaded.scope === 'world' && record.worldProfileId) {
              canEdit = editableWorldIds.includes(record.worldProfileId);
            }
          }
          const nextForm = formFromDefinition(loaded, {
            worldProfileId: record?.worldProfileId ?? '',
            availability: loaded.scope === 'world' ? 'world' : 'personal',
          });
          setDefinition(loaded);
          setArchived(record?.status === 'archived');
          markClean(nextForm);
          setMode(canEdit && !isReadonly ? 'edit' : 'readonly');
        })
        .catch((err: unknown) => {
          console.error('[item-workbench] reload failed', err);
          setLoadError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.');
        })
        .finally(() => setLoading(false));
    }
  };

  return {
    mode,
    form,
    setForm,
    definition,
    archived,
    loading,
    loadError,
    saving,
    saveError,
    setSaveError,
    dirty,
    typePickerOpen,
    isTypePickerVisible,
    handleTypePickerOpenChange,
    openTypePicker,
    forkOpen,
    setForkOpen,
    archiveOpen,
    setArchiveOpen,
    pendingTypeEntry,
    setPendingTypeEntry,
    worlds,
    worldsLoading,
    openLanding,
    requestTypeChange,
    requestKindChange,
    confirmPendingTypeChange,
    selectTypeEntry,
    handleSave,
    ensureDraftId,
    handleFork,
    handleArchive,
    handleRestore,
    handleBack,
    reload,
    applyAssetKey,
    applyModel3d,
  };
}

function typeChangeLosesValues(form: WorkbenchFormState, entry: WorkbenchTypeEntry): boolean {
  if (form.type === entry.type && form.kindKey === entry.kindKey) return false;
  if (form.type === 'weapon') return true;
  if (form.type === 'armor') return true;
  if (form.type === 'container') return true;
  // Kind change (e.g. tool→device, document→key) resets traits via emptyWorkbenchForm.
  if (form.traits.trim().length > 0) return true;
  return false;
}
