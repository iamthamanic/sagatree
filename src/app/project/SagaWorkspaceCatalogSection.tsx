/**
 * SagaWorkspaceCatalogSection — saga-scoped catalog + Lore (#617 Phase 2).
 * Bindings use Library EntityBrowser (Liste / Grid / Karussell), not plain lists.
 * Location: src/app/project/SagaWorkspaceCatalogSection.tsx
 */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CircleNotch,
  Package,
  Plus,
  Scroll,
  User,
  Users
} from '@phosphor-icons/react';
import {
  resolveSagaBindingImageObjectFit,
  resolveSagaBindingImageSrc,
} from '../../domains/saga/bindings';
import {
  hasSagaPermission,
  revealLabelDe,
  type SagaAssetKind,
  type SagaPermissionKey,
} from '../../domains/saga/permissions';
import {
  sagaPermissionService,
  type SagaAssetBindingVm,
  type SagaMyPermissionsVm,
} from '../../infrastructure/project/saga-permission-service';
import { sagatreeNativePregenIdByName } from '../../domains/character/use-cases/sagatree-native-pregen-portraits';
import { resolveAccountDisplayName } from '../../domains/user-profile';
import { Button } from '../../shared/ui/button';
import { setCharacterEditorBootstrap } from '../character';
import {
  EntityBrowser,
  EntityBrowserCard,
  type EntityBrowserChip,
  type EntityBrowserRenderContext,
} from '../library';
import { pathForLibraryTab, pathForNpcCreatureCreate, type SagaSectionId } from '../shell';
import { sagaOverviewService } from '../../infrastructure/project/saga-overview-service';
import { userProfileService } from '../../infrastructure/user-profile/user-profile-service';
import { SagaBindingRevealControl } from './SagaBindingRevealControl';
import { SagaLoreTimelinePanel } from './SagaLoreTimelinePanel';

type SagaWorkspaceCatalogSectionProps = {
  sagaPublicId: string;
  section: Extract<
    SagaSectionId,
    'characters' | 'npc-creatures' | 'items' | 'quests' | 'lore'
  >;
  onNavigate: (view: string) => void;
};

function sectionToAssetKind(
  section: SagaWorkspaceCatalogSectionProps['section'],
): SagaAssetKind | null {
  switch (section) {
    case 'characters':
      return 'character';
    case 'npc-creatures':
      return 'npc';
    case 'items':
      return 'item';
    case 'quests':
      return 'quest';
    default:
      return null;
  }
}

function createKeyForSection(
  section: SagaWorkspaceCatalogSectionProps['section'],
): SagaPermissionKey | null {
  switch (section) {
    case 'characters':
      return 'saga.characters.create';
    case 'npc-creatures':
      return 'saga.npc.create';
    case 'items':
      return 'saga.items.create';
    case 'quests':
      return 'saga.quests.create';
    default:
      return null;
  }
}

export function SagaWorkspaceCatalogSection({
  sagaPublicId,
  section,
  onNavigate,
}: SagaWorkspaceCatalogSectionProps) {
  const [perms, setPerms] = useState<SagaMyPermissionsVm | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [bindings, setBindings] = useState<SagaAssetBindingVm[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [bindingsError, setBindingsError] = useState<string | null>(null);
  const [playerByCharacterId, setPlayerByCharacterId] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const my = await sagaPermissionService.getMyPermissions(sagaPublicId);
        if (cancelled) return;
        setProjectId(my.projectId);
        setPerms(my);
      } catch {
        if (!cancelled) {
          setPerms(null);
          setProjectId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sagaPublicId]);

  useEffect(() => {
    if (section !== 'characters') {
      setPlayerByCharacterId(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        // Overview ensemble (SECURITY DEFINER) — includes other players' characterId/name.
        // Binding cards key by native asset id (pregen.*) or label, not characters.id.
        const overview = await sagaOverviewService.getOverviewByPublicId(sagaPublicId);
        const withCharacter = overview.ensemble.filter(
          (m) => Boolean(m.characterId) || Boolean(m.characterName?.trim()),
        );
        const userIds = [...new Set(withCharacter.map((m) => m.userId))];
        const labels = new Map<string, string>();
        if (userIds.length > 0) {
          const profiles = await userProfileService.getProfilesByUserIds(userIds);
          const byUser = new Map(
            profiles.map((row) => [
              row.id,
              resolveAccountDisplayName({ profileDisplayName: row.displayName, email: null })
                ?? 'Spieler',
            ]),
          );
          for (const member of withCharacter) {
            const player = byUser.get(member.userId) ?? 'Spieler';
            if (member.characterId) labels.set(member.characterId, player);
            const name = member.characterName?.trim();
            if (name) {
              labels.set(name.toLowerCase(), player);
              const pregenId = sagatreeNativePregenIdByName(name);
              if (pregenId) labels.set(pregenId, player);
            }
          }
        }
        if (!cancelled) setPlayerByCharacterId(labels);
      } catch (err) {
        console.error('Saga character player map failed:', err);
        if (!cancelled) setPlayerByCharacterId(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, sagaPublicId]);

  useEffect(() => {
    const kind = sectionToAssetKind(section);
    if (!kind || section === 'lore') {
      setBindings([]);
      return;
    }
    let cancelled = false;
    setBindingsLoading(true);
    setBindingsError(null);
    void (async () => {
      try {
        const rows = await sagaPermissionService.listBindings(sagaPublicId, kind);
        if (!cancelled) setBindings(rows);
      } catch (err) {
        if (!cancelled) {
          setBindings([]);
          setBindingsError(
            err instanceof Error ? err.message : 'Bindings konnten nicht geladen werden',
          );
        }
      } finally {
        if (!cancelled) setBindingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sagaPublicId, section]);

  const canReveal =
    Boolean(perms?.isGm)
    || hasSagaPermission(perms?.keys, 'saga.secrets.reveal');
  const createKey = createKeyForSection(section);
  const canCreate =
    createKey == null
      ? false
      : Boolean(perms?.isGm) || hasSagaPermission(perms?.keys, createKey);

  if (section === 'lore') {
    return <SagaLoreTimelinePanel sagaPublicId={sagaPublicId} />;
  }

  if (section === 'characters') {
    const openCharacter = (binding: SagaAssetBindingVm) => {
      setCharacterEditorBootstrap({
        kind: 'character-edit',
        characterId: binding.assetId,
      });
      onNavigate('character-editor');
    };

    const createBtn = canCreate ? (
      <Button
        type="button"
        size="sm"
        className="min-h-11"
        onClick={() => onNavigate('character-editor')}
        data-saga-characters-create
      >
        <Plus className="mr-2 size-4" aria-hidden />
        Neuer Charakter
      </Button>
    ) : null;

    const toolbar = (
      <div className="flex flex-wrap items-center gap-2">
        {createBtn}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => onNavigate(pathForLibraryTab('characters'))}
        >
          In Bibliothek anzeigen
        </Button>
      </div>
    );

    return (
      <div className="@container w-full min-w-0 space-y-4" data-saga-catalog="characters">
        <p className="text-sm text-muted-foreground">
          An diese Saga gebundene Spieler-Charaktere. Sichtbarkeit steuert Reveal (Party / nur Gamemaster).
        </p>
        {bindingsError ? (
          <p className="text-sm text-destructive" role="alert">
            {bindingsError}
          </p>
        ) : null}
        {bindingsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" aria-hidden />
            Charaktere werden geladen…
          </div>
        ) : null}
        {!bindingsLoading && bindings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <User className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Noch keine Spieler-Charaktere gebunden.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{toolbar}</div>
          </div>
        ) : (
          <BindingList
            bindings={bindings}
            projectId={projectId}
            canReveal={canReveal}
            storageKey="sagatree_saga_hub_characters_bindings_view_mode"
            toolbarRight={toolbar}
            onOpen={openCharacter}
            openLabel="Öffnen"
            playerLabelByAssetId={playerByCharacterId}
          />
        )}
      </div>
    );
  }

  if (section === 'npc-creatures') {
    return (
      <CatalogWithBindings
        testId="npc-creatures"
        icon={<Users className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />}
        title="NSCs & Kreaturen"
        body="An diese Saga gebundene NSCs. Sichtbarkeit steuert Reveal (Party / nur Gamemaster)."
        bindings={bindings}
        bindingsLoading={bindingsLoading}
        bindingsError={bindingsError}
        projectId={projectId}
        canReveal={canReveal}
        primaryLabel={canCreate ? 'NSC erstellen' : undefined}
        onPrimary={canCreate ? () => onNavigate(pathForNpcCreatureCreate()) : undefined}
        secondaryLabel="Bibliothek · NSCs"
        onSecondary={() => onNavigate(pathForLibraryTab('npcs'))}
      />
    );
  }

  if (section === 'items') {
    return (
      <CatalogWithBindings
        testId="items"
        icon={<Package className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />}
        title="Gegenstände"
        body="Saga-gebundene Items. Ohne Binding bleibt die Bibliothek der Anlege-Ort."
        bindings={bindings}
        bindingsLoading={bindingsLoading}
        bindingsError={bindingsError}
        projectId={projectId}
        canReveal={canReveal}
        primaryLabel="Bibliothek · Items"
        onPrimary={() => onNavigate(pathForLibraryTab('items'))}
      />
    );
  }

  return (
    <CatalogWithBindings
      testId="quests"
      icon={<Scroll className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />}
      title="Quests"
      body="Quests dieser Saga. Dornhain-Starter-Quests kommen mit dem Lern-Seed (Phase 3)."
      bindings={bindings}
      bindingsLoading={bindingsLoading}
      bindingsError={bindingsError}
      projectId={projectId}
      canReveal={canReveal}
    />
  );
}

function assetKindLabelDe(kind: SagaAssetKind | string): string {
  switch (kind) {
    case 'character':
      return 'Charakter';
    case 'npc':
      return 'NSC';
    case 'item':
      return 'Gegenstand';
    case 'quest':
      return 'Quest';
    default:
      return String(kind);
  }
}

function revealChip(reveal: SagaAssetBindingVm['reveal']): EntityBrowserChip {
  if (reveal === 'party') return { label: revealLabelDe(reveal), tone: 'success' };
  if (reveal === 'gm_only') return { label: revealLabelDe(reveal), tone: 'native' };
  return { label: revealLabelDe(reveal), tone: 'muted' };
}

type BindingBrowserItem = SagaAssetBindingVm & { id: string };

function BindingList(props: {
  bindings: SagaAssetBindingVm[];
  projectId: string | null;
  canReveal: boolean;
  storageKey: string;
  toolbarRight?: ReactNode;
  onOpen?: (binding: SagaAssetBindingVm) => void;
  openLabel?: string;
  /** Keys: binding assetId (pregen.*), lowercase character name, or characters.id → player label */
  playerLabelByAssetId?: ReadonlyMap<string, string>;
}) {
  const items = useMemo<BindingBrowserItem[]>(
    () => props.bindings.map((b) => ({ ...b, id: b.id })),
    [props.bindings],
  );

  if (items.length === 0) {
    return null;
  }

  const renderItem = (binding: BindingBrowserItem, context: EntityBrowserRenderContext) => {
    const title = binding.label.trim() || binding.assetId;
    const isCharacter = binding.assetKind === 'character';
    const playerLabel = isCharacter
      ? props.playerLabelByAssetId?.get(binding.assetId)
        ?? props.playerLabelByAssetId?.get(binding.label.trim().toLowerCase())
        ?? null
      : null;
    const chips: EntityBrowserChip[] = isCharacter
      ? [revealChip(binding.reveal)]
      : [
          { label: assetKindLabelDe(binding.assetKind), tone: 'muted' },
          revealChip(binding.reveal),
        ];
    const meta = isCharacter
      ? playerLabel
        ? `Gespielt von ${playerLabel}`
        : 'Nicht zugewiesen'
      : assetKindLabelDe(binding.assetKind);
    const imageUrl = resolveSagaBindingImageSrc(binding.assetKind, binding.assetId) ?? undefined;
    const hasReveal = props.canReveal && Boolean(props.projectId);
    const hasOpen = Boolean(props.onOpen);
    return (
      <EntityBrowserCard
        title={title}
        meta={meta}
        metaChips={chips}
        imageUrl={imageUrl}
        imageFallback={title}
        imageAlt={`${assetKindLabelDe(binding.assetKind)} ${title}`}
        imageAspect="square"
        imageObjectFit={resolveSagaBindingImageObjectFit(binding.assetKind)}
        variant={context.variant}
        isCenter={context.isCenter}
        onOpen={
          props.onOpen &&
          (context.variant === 'list' ||
            context.variant === 'grid' ||
            context.isCenter)
            ? () => props.onOpen?.(binding)
            : undefined
        }
        actions={
          hasReveal || hasOpen ? (
            <div
              className="flex w-full flex-col gap-2"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {hasOpen ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11 w-full"
                  onClick={() => props.onOpen?.(binding)}
                  data-saga-binding-open={binding.id}
                >
                  {props.openLabel ?? 'Öffnen'}
                </Button>
              ) : null}
              {hasReveal && props.projectId ? (
                <SagaBindingRevealControl
                  projectId={props.projectId}
                  bindingId={binding.id}
                  reveal={binding.reveal}
                />
              ) : null}
            </div>
          ) : undefined
        }
      />
    );
  };

  return (
    <div data-saga-bindings-list>
      <EntityBrowser
        storageKey={props.storageKey}
        items={items}
        getId={(item) => item.id}
        renderItem={renderItem}
        toolbarLeft={
          <span>
            {items.length === 1 ? '1 Eintrag' : `${items.length} Einträge`}
          </span>
        }
        toolbarRight={props.toolbarRight}
      />
    </div>
  );
}

function CatalogWithBindings(props: {
  icon: ReactNode;
  title: string;
  body: string;
  testId: string;
  bindings: SagaAssetBindingVm[];
  bindingsLoading: boolean;
  bindingsError: string | null;
  projectId: string | null;
  canReveal: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const actionButtons = (
    <>
      {props.primaryLabel && props.onPrimary ? (
        <Button type="button" size="sm" className="min-h-11" onClick={props.onPrimary}>
          <Plus className="mr-2 size-4" aria-hidden />
          {props.primaryLabel}
        </Button>
      ) : null}
      {props.secondaryLabel && props.onSecondary ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={props.onSecondary}
        >
          {props.secondaryLabel}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="@container w-full min-w-0 space-y-4" data-saga-catalog={props.testId}>
      {props.bindingsError ? (
        <p className="text-sm text-destructive" role="alert">
          {props.bindingsError}
        </p>
      ) : null}
      {props.bindingsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleNotch className="size-4 animate-spin" aria-hidden />
          Katalog wird geladen…
        </div>
      ) : null}
      {!props.bindingsLoading && props.bindings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          {props.icon}
          <p className="text-sm font-medium text-foreground">{props.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{props.body}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">{actionButtons}</div>
        </div>
      ) : (
        <BindingList
          bindings={props.bindings}
          projectId={props.projectId}
          canReveal={props.canReveal}
          storageKey={`sagatree_saga_hub_${props.testId}_view_mode`}
          toolbarRight={<div className="flex flex-wrap items-center gap-2">{actionButtons}</div>}
        />
      )}
    </div>
  );
}
