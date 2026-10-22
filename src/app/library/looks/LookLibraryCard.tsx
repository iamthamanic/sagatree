/**
 * LookLibraryCard — card for a LookProfile in Bibliothek › Looks (#343).
 * Location: src/app/library/looks/LookLibraryCard.tsx
 */
import { useCallback, useState } from 'react';
import {
  Archive,
  Copy,
  CopySimple,
  PencilSimple,
  Palette
} from '@phosphor-icons/react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import {
  lookPreviewUri,
  lookStatusLabel,
  lookStyleFamilyLabel,
  type LookProfileRecord,
} from '../../../domains/look';
import {
  copyPublicIdMenuLabel,
  EntityBrowserCornerMenuPortal,
  EntityBrowserCornerMenuTrigger,
  type EntityBrowserCornerMenuAnchor,
} from '../EntityBrowserCornerMenu';
import { copyLibraryField } from '../copyLibraryField';

export interface LookLibraryCardProps {
  look: LookProfileRecord;
  canMutate: boolean;
  onEdit: (profileId: string) => void;
  onDuplicate: (profileId: string) => void;
  onArchive: (profileId: string) => void;
}

export function LookLibraryCard({
  look,
  canMutate,
  onEdit,
  onDuplicate,
  onArchive,
}: LookLibraryCardProps) {
  const preview = lookPreviewUri(look);
  const isArchived = look.status === 'archived';
  const publicId = look.profile.publicId;
  const menuKey = publicId || look.profile.id;
  const [menuAnchor, setMenuAnchor] = useState<EntityBrowserCornerMenuAnchor | null>(null);

  const toggleMenu = useCallback(
    (rect: DOMRect, triggerEl: HTMLElement) => {
      setMenuAnchor((prev) =>
        prev?.menuKey === menuKey && prev.triggerEl === triggerEl
          ? null
          : { menuKey, top: rect.bottom + 4, left: rect.right - 224, triggerEl },
      );
    },
    [menuKey],
  );

  return (
    <article
      className="relative flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4"
      data-look-library-card={look.profile.id}
    >
      <div className="absolute right-3 top-3 z-10">
        <EntityBrowserCornerMenuTrigger
          compact
          label={`Aktionen für ${look.current.displayName}`}
          menuKey={menuKey}
          open={menuAnchor?.menuKey === menuKey}
          onToggle={toggleMenu}
          dataAttr="library-look-menu"
        />
      </div>

      <div className="flex min-h-28 items-center justify-center overflow-hidden rounded-md bg-muted">
        {preview && /^https?:\/\//i.test(preview) ? (
          <img
            src={preview}
            alt={`Vorschau ${look.current.displayName}`}
            width={320}
            height={112}
            loading="lazy"
            className="max-h-28 w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Palette className="size-8" aria-hidden="true" />
            <span className="text-xs">Keine Vorschau</span>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <h3 className="truncate text-base font-medium">{look.current.displayName}</h3>
        <p className="text-sm text-muted-foreground">
          {lookStyleFamilyLabel(look.current.source)} · v{look.profile.currentVersion}
        </p>
        <Badge variant={isArchived ? 'secondary' : 'default'}>
          {lookStatusLabel(look.status)}
        </Badge>
      </div>

      {canMutate ? (
        <Button
          type="button"
          size="sm"
          className="min-h-11 w-full bg-cyan-600 text-white hover:bg-cyan-500"
          onClick={() => onEdit(look.profile.id)}
          data-look-action="edit"
        >
          <PencilSimple className="mr-1.5 size-4" />
          Bearbeiten
        </Button>
      ) : null}

      {menuAnchor ? (
        <EntityBrowserCornerMenuPortal
          anchor={menuAnchor}
          dataAttr="library-look-menu"
          contentDataAttr="library-look-menu-content"
          onClose={() => setMenuAnchor(null)}
          items={[
            {
              id: 'copy-id',
              label: copyPublicIdMenuLabel('Look-ID', publicId),
              icon: <Copy className="size-4 shrink-0" aria-hidden="true" />,
              disabled: !publicId,
              onSelect: () => void copyLibraryField('Look-ID', publicId ?? ''),
            },
            ...(canMutate
              ? [
                  {
                    id: 'duplicate',
                    label: 'Look duplizieren',
                    icon: <CopySimple className="size-4 shrink-0" aria-hidden="true" />,
                    onSelect: () => onDuplicate(look.profile.id),
                  },
                  ...(!isArchived
                    ? [
                        {
                          id: 'archive',
                          label: 'Look archivieren',
                          icon: <Archive className="size-4 shrink-0" aria-hidden="true" />,
                          destructive: true,
                          separatorBefore: true,
                          onSelect: () => onArchive(look.profile.id),
                        },
                      ]
                    : []),
                ]
              : []),
          ]}
        />
      ) : null}

      {/* Stable hooks for look-library-check / e2e (actions live in ⋮ menu). */}
      {canMutate ? (
        <>
          <span className="sr-only" data-look-action="duplicate" />
          {!isArchived ? <span className="sr-only" data-look-action="archive" /> : null}
        </>
      ) : null}
    </article>
  );
}
