import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/ui/button';
import { Tabs, TabsContent } from '../../shared/ui/tabs';
import { Input } from '../../shared/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog';
import {
  Plus,
  Search,
  User,
  BookOpen,
  Edit,
  Trash2,
  Loader2,
  Globe2,
  Package,
  Users,
  Palette,
  Copy,
  CopyPlus,
  RotateCcw,
} from 'lucide-react';
import {
  useCharacterSummaries,
  CreateCharacterEntryDialog,
  setCharacterEditorBootstrap,
  getSpeciesSketchUrl,
} from '../character';
import type { CharacterSummaryVm } from '../../domains/character';
import { resolveAvatarSurfaceView } from '../../domains/character/avatar';
import {
  isSagatreeNativePregenName,
  sagatreeNativePregenPortraitUrlByName,
} from '../../domains/character/use-cases/sagatree-native-pregen-portraits';
import { SAGATREE_NATIVE_CHIP } from './libraryNativeBadge';
import {
  getCharacterCreationOptionLabel,
  normalizeSagaTreeRaceKey,
  sagaTreeRaceOptions,
} from '../../domains/rules/sagatree/character-creation';
import {
  sagatreeNativeSagaCoverUrl,
  sagatreeNativeSagaCoverUrlByTitle,
} from '../../domains/saga/use-cases/sagatree-native-saga-covers';
import {
  sagatreeNativeWorldCoverUrlByName,
  sagatreeNativeWorldCoverUrlFromModules,
} from '../../domains/world/use-cases/sagatree-native-world-covers';
import { useProjectSummaries } from '../project';
import type { ProjectSummaryVm } from '../../domains/project/contracts/project.types';
import { projectService } from '../../infrastructure/project/project-service';
import { sagaDefinitionService } from '../../infrastructure/saga/saga-definition-service';
import { useAuth } from '../../lib/auth-context';
import {
  parseLibraryTabFromPathname,
  parseLibraryTabParam,
  pathForLibraryTab,
  pathForSagaNew,
  pathForSagaSection,
  type LibraryTabId,
} from '../shell';
import { EntityBrowser, type EntityBrowserRenderContext } from './EntityBrowser';
import { EntityBrowserCard, type EntityBrowserChip } from './EntityBrowserCard';
import {
  copyPublicIdMenuLabel,
  EntityBrowserCornerMenuPortal,
  EntityBrowserCornerMenuTrigger,
  type EntityBrowserCornerMenuAnchor,
  type EntityBrowserCornerMenuItem,
} from './EntityBrowserCornerMenu';
import { getSpeciesDevelopmentMode } from '../../domains/world/worldModuleRegistry';
import { useWorldProfiles } from '../world';
import type { CreateWorldProfileDto, WorldProfileVm } from '../../domains/world/contracts/world.types';
import { toast } from 'sonner';

const WorldProfileEditorDialog = lazy(() =>
  import('../world').then((module) => ({
    default: module.WorldProfileEditorDialog,
  })),
);

const ItemLibraryBrowser = lazy(() =>
  import('./items').then((module) => ({
    default: module.ItemLibraryBrowser,
  })),
);

const LookLibraryBrowser = lazy(() =>
  import('./looks').then((module) => ({
    default: module.LookLibraryBrowser,
  })),
);

const NpcCreatureLibraryBrowser = lazy(() =>
  import('./npc-creatures').then((module) => ({
    default: module.NpcCreatureLibraryBrowser,
  })),
);

interface LibraryProps {
  /** Shell pathname — keeps tab in sync without remounting on every /library/:tab. */
  pathname?: string;
  onNavigate: (view: string) => void;
  onNavigateToItem: (itemId: string) => void;
  onNavigateToLookCreate?: () => void;
  onNavigateToLookEdit?: (lookId: string) => void;
  onNavigateToNpcCreate?: () => void;
  onNavigateToNpcEdit?: (definitionId: string) => void;
  onNavigateToCharacterEditor?: () => void;
  /** When false, Looks tab hides create/edit/duplicate/archive. Default true. */
  canMutateLooks?: boolean;
}

type LibraryTab = LibraryTabId;

function readLibraryTabFromLocation(): LibraryTab {
  if (typeof window === 'undefined') return 'characters';
  // Legacy `?tab=` wins on bare `/library` bookmarks, then slash segment.
  const fromQuery = parseLibraryTabParam(
    new URLSearchParams(window.location.search).get('tab'),
  );
  if (fromQuery) return fromQuery;
  return parseLibraryTabFromPathname(window.location.pathname) ?? 'characters';
}

const SPECIES_DEVELOPMENT_MODE_LABELS = {
  explicit: 'Explizit',
  progressive: 'Progressiv',
  disabled: 'Deaktiviert',
} as const;

const CHARACTER_VIEW_MODE_STORAGE_KEY = 'sagatree_library_characters_view_mode';
const ADVENTURE_VIEW_MODE_STORAGE_KEY = 'sagatree_library_adventures_view_mode';
const WORLD_VIEW_MODE_STORAGE_KEY = 'sagatree_library_worlds_view_mode';

const PROJECT_STATUS_LABELS: Record<ProjectSummaryVm['status'], string> = {
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
};

async function copyTextToClipboard(value: string): Promise<boolean> {
  const text = value.trim();
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

type LibraryEntityMenuState =
  | {
      kind: 'saga';
      entity: ProjectSummaryVm;
      anchor: EntityBrowserCornerMenuAnchor;
    }
  | {
      kind: 'world';
      entity: WorldProfileVm;
      anchor: EntityBrowserCornerMenuAnchor;
    }
  | {
      kind: 'character';
      entity: CharacterSummaryVm;
      anchor: EntityBrowserCornerMenuAnchor;
    };

const LIBRARY_TAB_BUTTONS: readonly {
  id: LibraryTab;
  label: string;
  icon: typeof User;
}[] = [
  { id: 'characters', label: 'Charaktere', icon: User },
  { id: 'npcs', label: 'NPCs & Kreaturen', icon: Users },
  { id: 'adventures', label: 'Sagas', icon: BookOpen },
  { id: 'worlds', label: 'Welten', icon: Globe2 },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'looks', label: 'Looks', icon: Palette },
];

export function Library({
  pathname: pathnameProp,
  onNavigate,
  onNavigateToItem,
  onNavigateToLookCreate,
  onNavigateToLookEdit,
  onNavigateToNpcCreate,
  onNavigateToNpcEdit,
  onNavigateToCharacterEditor,
  canMutateLooks = true,
}: LibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LibraryTab>(() => readLibraryTabFromLocation());
  const [visitedTabs, setVisitedTabs] = useState<Set<LibraryTab>>(() => {
    const initial = readLibraryTabFromLocation();
    return new Set<LibraryTab>(['characters', initial]);
  });
  const [createCharacterOpen, setCreateCharacterOpen] = useState(false);
  const [worldEditorOpen, setWorldEditorOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<WorldProfileVm | null>(null);
  const { user } = useAuth();

  const {
    characters,
    isLoading,
    error,
    deleteCharacter,
    duplicateCharacter,
    refreshCharacters,
  } = useCharacterSummaries({
    enabled: visitedTabs.has('characters'),
  });
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refreshProjects,
  } = useProjectSummaries({
    enabled: visitedTabs.has('adventures') || visitedTabs.has('npcs'),
  });
  const [sagaMenuBusyId, setSagaMenuBusyId] = useState<string | null>(null);
  const [worldMenuBusyId, setWorldMenuBusyId] = useState<string | null>(null);
  const [characterMenuBusyId, setCharacterMenuBusyId] = useState<string | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectSummaryVm | null>(null);
  const [entityMenu, setEntityMenu] = useState<LibraryEntityMenuState | null>(null);
  const {
    worlds,
    isLoading: worldsLoading,
    error: worldsError,
    reconnectApi,
    createWorld,
    updateWorld,
    duplicateWorld,
    deleteWorld,
  } = useWorldProfiles({ enabled: visitedTabs.has('worlds') });
  const itemsTabVisited = visitedTabs.has('items');
  const looksTabVisited = visitedTabs.has('looks');
  const npcsTabVisited = visitedTabs.has('npcs');

  const gmProjects = projects.filter(
    (project) =>
      project.status === 'active'
      && Boolean(user?.id)
      && project.gmUserId === user?.id,
  );

  // Always re-fetch character summaries when Library mounts so saves from the
  // editor are visible immediately (cache may still look "fresh" otherwise).
  useEffect(() => {
    void refreshCharacters({ force: true });
  }, [refreshCharacters]);

  // Keep tab in sync with shell pathname (deep links, back/forward, sidebar).
  useEffect(() => {
    const path = pathnameProp
      ?? (typeof window !== 'undefined' ? window.location.pathname : '');
    if (parseLibraryTabFromPathname(path) === null && path !== '' && path !== '/library') {
      return;
    }
    const tab = parseLibraryTabFromPathname(path) ?? readLibraryTabFromLocation();
    setActiveTab((current) => (current === tab ? current : tab));
    setVisitedTabs((current) => (current.has(tab) ? current : new Set(current).add(tab)));
  }, [pathnameProp]);

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  // One-shot: normalize bare `/library` / `?tab=` bookmarks onto slash paths.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (parseLibraryTabFromPathname(window.location.pathname) === null) return;
    const tab = readLibraryTabFromLocation();
    const canonical = pathForLibraryTab(tab);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== canonical) {
      onNavigateRef.current(canonical);
    }
  }, []);

  const handleTabChange = (value: string) => {
    const tab = value as LibraryTab;
    setActiveTab(tab);
    setVisitedTabs((current) => new Set(current).add(tab));
    const nextPath = pathForLibraryTab(tab);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      onNavigate(nextPath);
    }
  };

  const handleNpcCreate = () => {
    if (onNavigateToNpcCreate) {
      onNavigateToNpcCreate();
      return;
    }
    onNavigate('npc-creature-create');
  };

  const handleLookCreate = () => {
    if (onNavigateToLookCreate) {
      onNavigateToLookCreate();
      return;
    }
    onNavigate('look-create');
  };

  const handleLookEdit = (lookId: string) => {
    if (onNavigateToLookEdit) {
      onNavigateToLookEdit(lookId);
      return;
    }
    console.warn('[library] onNavigateToLookEdit is not wired; cannot open look', lookId);
  };

  const handleDeleteCharacter = async (char: CharacterSummaryVm) => {
    const label = char.publicId ? `„${char.name}“ (${char.publicId})` : `„${char.name}“`;
    if (!confirm(`Möchtest du ${label} wirklich löschen?`)) {
      return;
    }

    setCharacterMenuBusyId(char.id);
    try {
      const success = await deleteCharacter(char.id);
      if (success) toast.success('Charakter gelöscht');
      else toast.error('Fehler beim Löschen');
    } finally {
      setCharacterMenuBusyId(null);
    }
  };

  const handleDuplicateCharacter = async (char: CharacterSummaryVm) => {
    setCharacterMenuBusyId(char.id);
    try {
      const created = await duplicateCharacter(char.id);
      if (created) {
        toast.success(
          `Charakter dupliziert${created.publicId ? ` (${created.publicId})` : ''}`,
        );
      } else {
        toast.error('Charakter konnte nicht dupliziert werden');
      }
    } finally {
      setCharacterMenuBusyId(null);
    }
  };

  const openCreateWorld = () => {
    setEditingWorld(null);
    setWorldEditorOpen(true);
  };

  const openEditWorld = (world: WorldProfileVm) => {
    setEditingWorld(world);
    setWorldEditorOpen(true);
  };

  const handleSaveWorld = async (payload: CreateWorldProfileDto): Promise<boolean> => {
    const saved = editingWorld
      ? await updateWorld(editingWorld.id, payload)
      : await createWorld(payload);

    if (!saved) {
      toast.error('Welt konnte nicht gespeichert werden');
      return false;
    }

    toast.success(editingWorld ? 'Welt gespeichert' : 'Welt erstellt');
    setEditingWorld(null);
    return true;
  };

  const handleDeleteWorld = async (world: WorldProfileVm) => {
    if (!confirm(`Möchtest du die Welt „${world.name}“ (${world.publicId || world.id}) wirklich löschen?`)) {
      return;
    }

    setWorldMenuBusyId(world.id);
    try {
      const success = await deleteWorld(world.id);
      if (success) {
        toast.success('Welt gelöscht');
      } else {
        toast.error('Welt konnte nicht gelöscht werden');
      }
    } finally {
      setWorldMenuBusyId(null);
    }
  };

  const handleDuplicateWorld = async (world: WorldProfileVm) => {
    setWorldMenuBusyId(world.id);
    try {
      const created = await duplicateWorld(world.id);
      if (created) {
        toast.success(`Welt dupliziert${created.publicId ? ` (${created.publicId})` : ''}`);
      } else {
        toast.error('Welt konnte nicht dupliziert werden');
      }
    } finally {
      setWorldMenuBusyId(null);
    }
  };

  /** #571 — Library primary entry is always saga overview (not Leiten/Teilnehmen). */
  const openSagaOverview = (project: ProjectSummaryVm) => {
    onNavigate(pathForSagaSection(project.publicId, 'overview'));
  };

  const openProject = (project: ProjectSummaryVm) => {
    openSagaOverview(project);
  };

  const runCountBySagaId = (() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      if (!p.sagaId) continue;
      counts.set(p.sagaId, (counts.get(p.sagaId) ?? 0) + 1);
    }
    return counts;
  })();

  const duplicateSagaRun = async (
    project: ProjectSummaryVm,
    mode: 'fresh' | 'with_progress',
  ) => {
    if (!project.sagaId || !project.sagaVersionId) {
      toast.error('Diese Saga hat keine Fassung');
      return;
    }
    if (project.gmUserId !== user?.id) {
      toast.error('Nur der Gamemaster kann eine Saga duplizieren');
      return;
    }
    setSagaMenuBusyId(project.id);
    try {
      const created = await sagaDefinitionService.duplicatePlaythrough({
        projectId: project.id,
        mode,
      });
      setDuplicateTarget(null);
      await refreshProjects({ force: true });
      toast.success(
        mode === 'with_progress'
          ? 'Saga mit aktuellem Stand dupliziert'
          : 'Saga vom Anfang dupliziert',
      );
      if (created.publicId) {
        onNavigate(pathForSagaSection(created.publicId, 'overview'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplizieren fehlgeschlagen');
    } finally {
      setSagaMenuBusyId(null);
    }
  };

  const deleteSagaRun = async (project: ProjectSummaryVm) => {
    if (project.gmUserId !== user?.id) {
      toast.error('Nur der Gamemaster kann eine Saga löschen');
      return;
    }
    const title = project.sagaTitle?.trim() || project.name;
    if (!confirm(`Möchtest du die Saga „${title}“ (${project.publicId}) wirklich löschen?`)) {
      return;
    }
    setSagaMenuBusyId(project.id);
    try {
      await projectService.deleteProject(project.id);
      await refreshProjects({ force: true });
      toast.success('Saga gelöscht');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setSagaMenuBusyId(null);
    }
  };

  const copyField = async (label: string, value: string) => {
    const ok = await copyTextToClipboard(value);
    if (ok) toast.success(`${label} kopiert`);
    else toast.error(`${label} konnte nicht kopiert werden`);
  };

  const closeEntityMenu = useCallback(() => {
    setEntityMenu(null);
  }, []);

  const toggleSagaMenu = useCallback(
    (project: ProjectSummaryVm, rect: DOMRect, triggerEl: HTMLElement) => {
      setEntityMenu((prev) => {
        if (prev?.kind === 'saga' && prev.entity.publicId === project.publicId) return null;
        return {
          kind: 'saga',
          entity: project,
          anchor: {
            menuKey: project.publicId,
            top: rect.bottom + 4,
            left: rect.right - 224,
            triggerEl,
          },
        };
      });
    },
    [],
  );

  const toggleWorldMenu = useCallback(
    (world: WorldProfileVm, rect: DOMRect, triggerEl: HTMLElement) => {
      setEntityMenu((prev) => {
        if (prev?.kind === 'world' && prev.entity.id === world.id) return null;
        return {
          kind: 'world',
          entity: world,
          anchor: {
            menuKey: world.publicId || world.id,
            top: rect.bottom + 4,
            left: rect.right - 224,
            triggerEl,
          },
        };
      });
    },
    [],
  );

  const toggleCharacterMenu = useCallback(
    (char: CharacterSummaryVm, rect: DOMRect, triggerEl: HTMLElement) => {
      setEntityMenu((prev) => {
        if (prev?.kind === 'character' && prev.entity.id === char.id) return null;
        return {
          kind: 'character',
          entity: char,
          anchor: {
            menuKey: char.publicId || char.id,
            top: rect.bottom + 4,
            left: rect.right - 224,
            triggerEl,
          },
        };
      });
    },
    [],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredCharacters = characters.filter((char) => {
    if (!normalizedSearch) return true;
    return (
      char.name.toLowerCase().includes(normalizedSearch)
      || char.class.toLowerCase().includes(normalizedSearch)
      || char.race.toLowerCase().includes(normalizedSearch)
      || (char.publicId ?? '').toLowerCase().includes(normalizedSearch)
      || getCharacterCreationOptionLabel(
        sagaTreeRaceOptions,
        normalizeSagaTreeRaceKey(char.race),
      ).toLowerCase().includes(normalizedSearch)
    );
  });
  const filteredWorlds = worlds.filter((world) =>
    world.name.toLowerCase().includes(normalizedSearch) ||
    world.description.toLowerCase().includes(normalizedSearch) ||
    world.publicId.toLowerCase().includes(normalizedSearch)
  );
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(normalizedSearch) ||
    (project.description ?? '').toLowerCase().includes(normalizedSearch) ||
    project.code.toLowerCase().includes(normalizedSearch) ||
    project.publicId.toLowerCase().includes(normalizedSearch) ||
    (project.sagaTitle ?? '').toLowerCase().includes(normalizedSearch)
  );

  const renderProject = (project: ProjectSummaryVm, context: EntityBrowserRenderContext) => {
    const storyTitle = project.sagaTitle?.trim() || project.name;
    const runCount = project.sagaId ? (runCountBySagaId.get(project.sagaId) ?? 1) : 1;
    const showGroupLabel = runCount > 1;
    const isGm = Boolean(user?.id) && project.gmUserId === user?.id;
    const menuBusy = sagaMenuBusyId === project.id;
    const canDuplicate = isGm && Boolean(project.sagaId && project.sagaVersionId);

    const chips: EntityBrowserChip[] = [];
    if (project.sagaOrigin === 'native') {
      chips.push(SAGATREE_NATIVE_CHIP);
    }
    chips.push({
      label: PROJECT_STATUS_LABELS[project.status],
      tone: project.status === 'active' ? 'success' : 'default',
    });
    chips.push({
      label: `${project.memberCount} Mitglied${project.memberCount !== 1 ? 'er' : ''}`,
      tone: 'muted',
    });
    if (showGroupLabel) {
      chips.push({ label: `Gruppe: ${project.name}`, tone: 'muted' });
    }

    const coverUrl =
      (project.sagaSlug ? sagatreeNativeSagaCoverUrl(project.sagaSlug) : null)
      ?? sagatreeNativeSagaCoverUrlByTitle(storyTitle);

    const stopMenuBubble = (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
    };

    const sagaCornerMenu = (
      <EntityBrowserCornerMenuTrigger
        compact={context.variant === 'list'}
        busy={menuBusy}
        label={`Aktionen für ${storyTitle}`}
        menuKey={project.publicId}
        open={entityMenu?.kind === 'saga' && entityMenu.entity.publicId === project.publicId}
        onToggle={(rect, triggerEl) => toggleSagaMenu(project, rect, triggerEl)}
        dataAttr="library-saga-menu"
      />
    );

    return (
      <EntityBrowserCard
        title={storyTitle}
        meta={project.description || 'Keine Beschreibung'}
        imageUrl={coverUrl ?? undefined}
        imageFallback={storyTitle}
        imageAlt={`Saga ${storyTitle}`}
        imageAspect="landscape"
        imageObjectFit="cover"
        imageObjectPosition="center bottom"
        metaChips={chips}
        metaExtra={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 min-h-7 w-full min-w-0 gap-0.5 px-1.5 font-mono text-[10px]"
            onClick={(event) => {
              stopMenuBubble(event);
              void copyField('Beitrittscode', project.code);
            }}
            aria-label={`Beitrittscode ${project.code} kopieren`}
            data-library-saga-copy-code={project.code}
          >
            <span className="truncate">Code: {project.code}</span>
            <Copy className="size-2.5 shrink-0 opacity-70" aria-hidden="true" />
          </Button>
        }
        variant={context.variant}
        isCenter={context.isCenter}
        onOpen={
          context.variant === 'list' ||
          context.variant === 'grid' ||
          context.isCenter
            ? () => openProject(project)
            : undefined
        }
        cornerAction={sagaCornerMenu}
        actions={
          <Button
            variant="default"
            size="sm"
            className="min-h-11 w-full min-w-0 bg-cyan-600 text-white hover:bg-cyan-500"
            onClick={(event) => {
              stopMenuBubble(event);
              openSagaOverview(project);
            }}
            data-library-saga-open={project.publicId}
          >
            <BookOpen className="mr-1 h-3 w-3 shrink-0" />
            <span className="truncate text-xs">Saga öffnen</span>
          </Button>
        }
      />
    );
  };

  const renderWorld = (world: WorldProfileVm, context: EntityBrowserRenderContext) => {
    const speciesDevelopmentMode = getSpeciesDevelopmentMode(world.modules);
    const coverUrl =
      sagatreeNativeWorldCoverUrlFromModules(world.modules)
      ?? sagatreeNativeWorldCoverUrlByName(world.name);
    const isNativeWorld = Boolean(coverUrl);
    const menuKey = world.publicId || world.id;
    const menuBusy = worldMenuBusyId === world.id;
    const stopMenuBubble = (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
    };
    const worldChips: EntityBrowserChip[] = [
      `Speziesentwicklung: ${SPECIES_DEVELOPMENT_MODE_LABELS[speciesDevelopmentMode]}`,
    ];
    if (isNativeWorld) {
      worldChips.unshift(SAGATREE_NATIVE_CHIP);
    }

    return (
      <EntityBrowserCard
        title={world.name}
        meta={world.description || 'Keine Beschreibung'}
        imageUrl={coverUrl ?? undefined}
        imageFallback={world.name}
        imageAlt={`Welt ${world.name}`}
        imageAspect="landscape"
        imageObjectFit="cover"
        imageObjectPosition="center bottom"
        metaChips={worldChips}
        variant={context.variant}
        isCenter={context.isCenter}
        onOpen={
          context.variant === 'list' ||
          context.variant === 'grid' ||
          context.isCenter
            ? () => openEditWorld(world)
            : undefined
        }
        cornerAction={
          <EntityBrowserCornerMenuTrigger
            compact={context.variant === 'list'}
            busy={menuBusy}
            label={`Aktionen für ${world.name}`}
            menuKey={menuKey}
            open={entityMenu?.kind === 'world' && entityMenu.entity.id === world.id}
            onToggle={(rect, triggerEl) => toggleWorldMenu(world, rect, triggerEl)}
            dataAttr="library-world-menu"
          />
        }
        actions={
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <Button
              variant="default"
              size="sm"
              className="min-h-11 w-full min-w-0 bg-cyan-600 text-white hover:bg-cyan-500"
              onClick={(event) => {
                stopMenuBubble(event);
                if (world.publicId) {
                  onNavigate(`/library/worlds/${encodeURIComponent(world.publicId)}/map`);
                }
              }}
              disabled={!world.publicId}
              data-library-world-map={menuKey}
            >
              <Globe2 className="mr-1 h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate text-xs">Karte</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 w-full min-w-0"
              onClick={(event) => {
                stopMenuBubble(event);
                openEditWorld(world);
              }}
              data-library-world-open={menuKey}
            >
              <Edit className="mr-1 h-3 w-3 shrink-0" />
              <span className="truncate text-xs">Bearbeiten</span>
            </Button>
          </div>
        }
      />
    );
  };

  const renderCharacter = (char: CharacterSummaryVm, context: EntityBrowserRenderContext) => {
    const surface = resolveAvatarSurfaceView({
      surface: 'library',
      ref: {
        characterId: char.id,
        displayName: char.name,
        portraitUrl: char.portraitUrl,
      },
    });
    // Prefer owner portrait → Dornhain native art → Spezies-Skizze.
    const nativePortrait = sagatreeNativePregenPortraitUrlByName(char.name);
    const isNativeCharacter = isSagatreeNativePregenName(char.name);
    const imageUrl =
      surface.portraitUrl ?? nativePortrait ?? getSpeciesSketchUrl(char.race || 'human');
    const imageObjectFit = surface.portraitUrl || nativePortrait ? 'cover' : 'contain';
    const menuKey = char.publicId || char.id;
    const menuBusy = characterMenuBusyId === char.id;
    const openEditor = () => {
      setCharacterEditorBootstrap({ kind: 'character-edit', characterId: char.id });
      onNavigate('character-editor');
    };
    const stopMenuBubble = (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
    };

    return (
    <EntityBrowserCard
      title={char.name}
      meta={`Level ${char.level} · ${getCharacterCreationOptionLabel(sagaTreeRaceOptions, normalizeSagaTreeRaceKey(char.race))} · ${char.class || '—'}`}
      metaChips={isNativeCharacter ? [SAGATREE_NATIVE_CHIP] : undefined}
      badges={
        char.sheetStatus === 'incomplete'
          ? [{ label: 'Unvollständig', variant: 'destructive' }]
          : undefined
      }
      imageUrl={imageUrl}
      imageAlt={`Portrait von ${char.name}`}
      imageFallback={char.name}
      imageObjectFit={imageObjectFit}
      imageObjectPosition={imageObjectFit === 'cover' ? 'center 20%' : undefined}
      variant={context.variant}
      isCenter={context.isCenter}
      onOpen={
        context.variant === 'list' ||
        context.variant === 'grid' ||
        context.isCenter
          ? openEditor
          : undefined
      }
      cornerAction={
        <EntityBrowserCornerMenuTrigger
          compact={context.variant === 'list'}
          busy={menuBusy}
          label={`Aktionen für ${char.name}`}
          menuKey={menuKey}
          open={entityMenu?.kind === 'character' && entityMenu.entity.id === char.id}
          onToggle={(rect, triggerEl) => toggleCharacterMenu(char, rect, triggerEl)}
          dataAttr="library-character-menu"
        />
      }
      actions={
        <Button
          variant="default"
          size="sm"
          className="min-h-11 w-full min-w-0 bg-cyan-600 text-white hover:bg-cyan-500"
          onClick={(event) => {
            stopMenuBubble(event);
            openEditor();
          }}
          data-library-character-open={menuKey}
        >
          <Edit className="mr-1 h-3 w-3 shrink-0" />
          <span className="truncate text-xs">Bearbeiten</span>
        </Button>
      }
    />
  );
  };

  const worldsEmptyState = (
    <div className="text-center py-12">
      <Globe2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground mb-4">
        {searchQuery ? 'Keine Welten gefunden' : 'Noch keine Welten erstellt'}
      </p>
      {!searchQuery && (
        <Button onClick={openCreateWorld}>
          <Plus className="w-4 h-4 mr-2" />
          Erste Welt erstellen
        </Button>
      )}
    </div>
  );

  const charactersEmptyState = (
    <div className="text-center py-12">
      <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground mb-4">
        {searchQuery ? 'Keine Charaktere gefunden' : 'Noch keine Charaktere erstellt'}
      </p>
      {!searchQuery && (
        <Button onClick={() => setCreateCharacterOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ersten Charakter erstellen
        </Button>
      )}
    </div>
  );

  const adventuresEmptyState = (
    <div className="text-center py-12">
      <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground mb-4">
        {searchQuery ? 'Keine Sagas gefunden' : 'Noch keine Sagas gestartet'}
      </p>
      {!searchQuery && (
        <Button className="min-h-11" onClick={() => onNavigate(pathForSagaNew())} data-library-saga-create>
          <Plus className="w-4 h-4 mr-2" />
          Neue Saga
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-w-0 p-4 md:p-8">
      <div className="mx-auto min-w-0 max-w-7xl space-y-4 md:space-y-6">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl">Meine Bibliothek</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Verwalte deine Charaktere, NPCs & Kreaturen, Sagas, Welten, Gegenstände und Looks
          </p>
        </div>

        {activeTab !== 'items' && activeTab !== 'npcs' && activeTab !== 'looks' ? (
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche in deiner Bibliothek..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="@container w-full min-w-0">
          {/*
            Plain buttons (not Radix TabsTrigger): Radix activates on mousedown only.
            Coverflow/Embla and some pointer paths can swallow mousedown before React;
            click remains reliable. Tabs Root still drives TabsContent panels.
          */}
          <div
            role="tablist"
            aria-label="Bibliothek"
            className="bg-muted/60 text-muted-foreground relative z-20 grid h-auto w-full max-w-full min-w-0 grid-cols-2 gap-1 rounded-lg border border-foreground/10 p-1 shadow-sm @[36rem]:grid-cols-3 @[60rem]:grid-cols-6"
          >
            {LIBRARY_TAB_BUTTONS.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  data-state={selected ? 'active' : 'inactive'}
                  data-library-tab={tab.id}
                  className={
                    selected
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-accent hover:border-accent hover:text-accent-foreground inline-flex min-h-11 min-w-0 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-[background-color,border-color,box-shadow,color,transform] duration-150 active:scale-[0.98] sm:text-sm'
                      : 'text-muted-foreground hover:border-accent/40 hover:bg-accent/10 hover:text-accent inline-flex min-h-11 min-w-0 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-medium transition-[background-color,border-color,box-shadow,color,transform] duration-150 active:scale-[0.98] sm:text-sm'
                  }
                  onClick={() => handleTabChange(tab.id)}
                >
                  <Icon className="mr-1.5 size-4 shrink-0 sm:mr-2" aria-hidden />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <TabsContent value="characters" className="min-w-0 space-y-4">
            {error && (
              <div className="min-w-0 overflow-hidden rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="break-words text-sm text-destructive">{error}</p>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <EntityBrowser
                storageKey={CHARACTER_VIEW_MODE_STORAGE_KEY}
                items={filteredCharacters}
                getId={(char) => char.id}
                renderItem={renderCharacter}
                emptyState={charactersEmptyState}
                toolbarLeft={
                  <span>
                    {filteredCharacters.length} Charakter{filteredCharacters.length !== 1 ? 'e' : ''}
                  </span>
                }
                toolbarRight={
                  <Button size="sm" onClick={() => setCreateCharacterOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Neuer Charakter</span>
                    <span className="sm:hidden">Neu</span>
                  </Button>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="npcs" className="min-w-0 space-y-4">
            {npcsTabVisited ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <NpcCreatureLibraryBrowser
                  enabled={npcsTabVisited}
                  onCreateNpc={handleNpcCreate}
                  onEditNpc={onNavigateToNpcEdit}
                  onNavigateToCharacterEditor={
                    onNavigateToCharacterEditor
                      ?? (() => onNavigate('character-editor'))
                  }
                  gmProjects={gmProjects}
                />
              </Suspense>
            ) : null}
          </TabsContent>

          <TabsContent value="adventures" className="min-w-0 space-y-4">
            {projectsError && (
              <div className="min-w-0 overflow-hidden rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="break-words text-sm text-destructive">{projectsError}</p>
              </div>
            )}

            {projectsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <EntityBrowser
                storageKey={ADVENTURE_VIEW_MODE_STORAGE_KEY}
                items={filteredProjects}
                getId={(project) => project.id}
                renderItem={renderProject}
                emptyState={adventuresEmptyState}
                toolbarLeft={
                  <span>
                    {filteredProjects.length} Saga{filteredProjects.length !== 1 ? 's' : ''}
                  </span>
                }
                toolbarRight={
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() => onNavigate(pathForSagaNew())}
                    data-library-saga-create
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Neue Saga
                  </Button>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="worlds" className="min-w-0 space-y-4">
            {worldsError && (
              <div className="min-w-0 space-y-2 overflow-hidden rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="break-words text-sm text-destructive">{worldsError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  data-worlds-api-reconnect
                  onClick={() => {
                    void reconnectApi();
                  }}
                >
                  API verbinden
                </Button>
              </div>
            )}

            {worldsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <EntityBrowser
                storageKey={WORLD_VIEW_MODE_STORAGE_KEY}
                items={filteredWorlds}
                getId={(world) => world.id}
                renderItem={renderWorld}
                emptyState={worldsEmptyState}
                toolbarLeft={
                  <span>
                    {filteredWorlds.length} Welt{filteredWorlds.length !== 1 ? 'en' : ''}
                  </span>
                }
                toolbarRight={
                  <Button size="sm" onClick={openCreateWorld}>
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Neue Welt</span>
                    <span className="sm:hidden">Neu</span>
                  </Button>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="items" className="min-w-0 space-y-4">
            {itemsTabVisited ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <ItemLibraryBrowser
                  enabled={itemsTabVisited}
                  onCreateItem={() => onNavigate('item-create')}
                  onOpenItem={onNavigateToItem}
                />
              </Suspense>
            ) : null}
          </TabsContent>

          <TabsContent value="looks" className="min-w-0 space-y-4">
            {looksTabVisited ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <LookLibraryBrowser
                  enabled={looksTabVisited}
                  canMutate={canMutateLooks}
                  onCreateLook={handleLookCreate}
                  onEditLook={handleLookEdit}
                />
              </Suspense>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>

      {worldEditorOpen && (
        <Suspense fallback={null}>
          <WorldProfileEditorDialog
            open={worldEditorOpen}
            world={editingWorld}
            onOpenChange={(open) => {
              setWorldEditorOpen(open);
              if (!open) setEditingWorld(null);
            }}
            onSave={handleSaveWorld}
          />
        </Suspense>
      )}

      <CreateCharacterEntryDialog
        open={createCharacterOpen}
        onOpenChange={setCreateCharacterOpen}
        onNavigateToEditor={() => onNavigate('character-editor')}
      />

      <Dialog
        open={duplicateTarget !== null}
        onOpenChange={(open) => {
          if (!open && sagaMenuBusyId === null) setDuplicateTarget(null);
        }}
      >
        <DialogContent className="max-w-md" data-library-saga-duplicate-dialog>
          <DialogHeader>
            <DialogTitle>Saga duplizieren</DialogTitle>
            <DialogDescription>
              {duplicateTarget
                ? `„${duplicateTarget.sagaTitle?.trim() || duplicateTarget.name}“ — mit aktuellem Fortschritt oder als frischen Start?`
                : 'Wie soll die Kopie angelegt werden?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              className="min-h-11 w-full justify-start gap-2"
              disabled={!duplicateTarget || sagaMenuBusyId === duplicateTarget.id}
              onClick={() => {
                if (duplicateTarget) void duplicateSagaRun(duplicateTarget, 'with_progress');
              }}
              data-library-saga-duplicate-progress
            >
              <CopyPlus className="size-4 shrink-0" aria-hidden="true" />
              Mit aktuellem Stand
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full justify-start gap-2"
              disabled={!duplicateTarget || sagaMenuBusyId === duplicateTarget.id}
              onClick={() => {
                if (duplicateTarget) void duplicateSagaRun(duplicateTarget, 'fresh');
              }}
              data-library-saga-duplicate-fresh
            >
              <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
              Kopie vom Anfang
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full"
              disabled={Boolean(duplicateTarget && sagaMenuBusyId === duplicateTarget.id)}
              onClick={() => setDuplicateTarget(null)}
            >
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {entityMenu?.kind === 'saga' ? (
        <EntityBrowserCornerMenuPortal
          anchor={entityMenu.anchor}
          busy={sagaMenuBusyId === entityMenu.entity.id}
          dataAttr="library-saga-menu"
          contentDataAttr="library-saga-menu-content"
          onClose={closeEntityMenu}
          items={(() => {
            const project = entityMenu.entity;
            const isGm = Boolean(user?.id) && project.gmUserId === user?.id;
            const canDuplicate = isGm && Boolean(project.sagaId && project.sagaVersionId);
            const items: EntityBrowserCornerMenuItem[] = [
              {
                id: 'copy-id',
                label: copyPublicIdMenuLabel('Saga-ID', project.publicId),
                icon: <Copy className="size-4 shrink-0" aria-hidden="true" />,
                onSelect: () => void copyField('Saga-ID', project.publicId),
              },
            ];
            if (canDuplicate) {
              items.push({
                id: 'duplicate',
                label: 'Saga duplizieren',
                icon: <CopyPlus className="size-4 shrink-0" aria-hidden="true" />,
                onSelect: () => setDuplicateTarget(project),
              });
            }
            if (isGm) {
              items.push({
                id: 'delete',
                label: 'Saga löschen',
                icon: <Trash2 className="size-4 shrink-0" aria-hidden="true" />,
                destructive: true,
                separatorBefore: true,
                onSelect: () => void deleteSagaRun(project),
              });
            }
            return items;
          })()}
        />
      ) : null}

      {entityMenu?.kind === 'world' ? (
        <EntityBrowserCornerMenuPortal
          anchor={entityMenu.anchor}
          busy={worldMenuBusyId === entityMenu.entity.id}
          dataAttr="library-world-menu"
          contentDataAttr="library-world-menu-content"
          onClose={closeEntityMenu}
          items={[
            {
              id: 'copy-id',
              label: copyPublicIdMenuLabel('Welt-ID', entityMenu.entity.publicId),
              icon: <Copy className="size-4 shrink-0" aria-hidden="true" />,
              disabled: !entityMenu.entity.publicId,
              onSelect: () => void copyField('Welt-ID', entityMenu.entity.publicId),
            },
            {
              id: 'duplicate',
              label: 'Welt duplizieren',
              icon: <CopyPlus className="size-4 shrink-0" aria-hidden="true" />,
              onSelect: () => void handleDuplicateWorld(entityMenu.entity),
            },
            {
              id: 'delete',
              label: 'Welt löschen',
              icon: <Trash2 className="size-4 shrink-0" aria-hidden="true" />,
              destructive: true,
              separatorBefore: true,
              onSelect: () => void handleDeleteWorld(entityMenu.entity),
            },
          ]}
        />
      ) : null}

      {entityMenu?.kind === 'character' ? (
        <EntityBrowserCornerMenuPortal
          anchor={entityMenu.anchor}
          busy={characterMenuBusyId === entityMenu.entity.id}
          dataAttr="library-character-menu"
          contentDataAttr="library-character-menu-content"
          onClose={closeEntityMenu}
          items={[
            {
              id: 'copy-id',
              label: copyPublicIdMenuLabel(
                'Charakter-ID',
                entityMenu.entity.publicId,
              ),
              icon: <Copy className="size-4 shrink-0" aria-hidden="true" />,
              disabled: !entityMenu.entity.publicId,
              onSelect: () => void copyField('Charakter-ID', entityMenu.entity.publicId ?? ''),
            },
            {
              id: 'duplicate',
              label: 'Charakter duplizieren',
              icon: <CopyPlus className="size-4 shrink-0" aria-hidden="true" />,
              onSelect: () => void handleDuplicateCharacter(entityMenu.entity),
            },
            {
              id: 'delete',
              label: 'Charakter löschen',
              icon: <Trash2 className="size-4 shrink-0" aria-hidden="true" />,
              destructive: true,
              separatorBefore: true,
              onSelect: () => void handleDeleteCharacter(entityMenu.entity),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
