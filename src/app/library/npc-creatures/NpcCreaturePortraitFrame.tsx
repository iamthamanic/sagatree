/**
 * NpcCreaturePortraitFrame — centered 2D icon preview with optional 2D/3D mode toggle
 * for the Library NPC/creature statblock dialog (mirrors item visuals pattern).
 * 2D image click opens reusable image lightbox. 3D is a placeholder until models exist.
 * Location: src/app/library/npc-creatures/NpcCreaturePortraitFrame.tsx
 */
import { useState } from 'react';
import {
  Cube,
  ImageBroken
} from '@phosphor-icons/react';
import {
  buildNpcCreatureIconPublicSrc,
  type NpcCreatureDefinition,
} from '../../../domains/npc-creature';
import { ItemVisualModeToggle, type ItemVisualMode } from '../../items';
import {
  ImageLightboxDialog,
  useImageLightbox,
} from '../../../shared/ui';
import { cn } from '../../../shared/ui/utils';

export interface NpcCreaturePortraitFrameProps {
  definition: NpcCreatureDefinition;
  className?: string;
}

export function NpcCreaturePortraitFrame({
  definition,
  className,
}: NpcCreaturePortraitFrameProps) {
  const [mode, setMode] = useState<ItemVisualMode>('2d');
  const [imageFailed, setImageFailed] = useState(false);
  const lightbox = useImageLightbox();
  const iconSrc = definition.iconKey
    ? buildNpcCreatureIconPublicSrc(definition.iconKey)
    : null;
  const showImage = Boolean(iconSrc) && !imageFailed && mode === '2d';
  const imageAlt = `Portrait von ${definition.name}`;

  return (
    <div
      className={cn(
        'relative mx-auto flex w-full max-w-[14rem] flex-col items-center',
        className,
      )}
      data-npc-creature-portrait-frame
    >
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40"
        data-npc-creature-portrait-stage
      >
        <ItemVisualModeToggle
          mode={mode}
          onModeChange={setMode}
          dataPrefix="npc-creature-portrait"
        />

        {mode === '3d' ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground"
            data-npc-creature-portrait-3d-empty
          >
            <Cube className="size-8 opacity-70" aria-hidden="true" />
            <p>Noch kein 3D-Modell für diese Figur.</p>
          </div>
        ) : showImage ? (
          <button
            type="button"
            className="flex h-full w-full cursor-zoom-in items-center justify-center p-3"
            aria-label={`${imageAlt} vergrößern`}
            data-npc-creature-portrait-2d
            onClick={() =>
              lightbox.openImage({
                src: iconSrc!,
                alt: imageAlt,
                title: definition.name,
              })
            }
          >
            <img
              src={iconSrc!}
              alt={imageAlt}
              className="pointer-events-none max-h-full max-w-full object-contain"
              onError={() => setImageFailed(true)}
            />
          </button>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2 text-muted-foreground"
            data-npc-creature-portrait-fallback
          >
            <ImageBroken className="size-8 opacity-70" aria-hidden="true" />
            <span className="text-xs">{definition.name}</span>
          </div>
        )}
      </div>

      <ImageLightboxDialog
        open={lightbox.open}
        target={lightbox.target}
        onOpenChange={lightbox.onOpenChange}
      />
    </div>
  );
}
