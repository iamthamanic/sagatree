/**
 * EntityBrowserCard — shared card body for EntityBrowser carousel and list views.
 * Carousel: square hero by default (portrait-safe); optional landscape for covers.
 * List: compact horizontal row with square thumbnail.
 * Thumbnail/portrait click opens a reusable image lightbox when an image URL is present.
 * Location: src/app/library/EntityBrowserCard.tsx
 */
import { useState, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react';
import {
  ImageBroken
} from '@phosphor-icons/react';
import { Badge } from '../../shared/ui/badge';
import { Card, CardContent } from '../../shared/ui/card';
import {
  ImageLightboxDialog,
  useImageLightbox,
} from '../../shared/ui';
import { cn } from '../../shared/ui/utils';

/** Tone for status/origin chips (Native gold, Aktiv green, …). */
export type EntityBrowserChipTone = 'default' | 'native' | 'success' | 'muted';

export type EntityBrowserChip =
  | string
  | {
      label: string;
      tone?: EntityBrowserChipTone;
    };

type EntityBrowserCardProps = {
  title: string;
  meta?: string;
  metaChips?: readonly EntityBrowserChip[];
  /** Optional row under chips (e.g. copyable SA- / Beitrittscode). */
  metaExtra?: ReactNode;
  /** Optional status badges (e.g. incomplete character draft). */
  badges?: readonly { label: string; variant?: 'destructive' | 'secondary' | 'outline' }[];
  imageUrl?: string;
  imageAlt: string;
  imageFallback: string;
  /** How the image fills its frame. Default `cover`. Use `contain` for sketches/icons. */
  imageObjectFit?: 'cover' | 'contain';
  /** CSS object-position for `cover` crops (e.g. covers with baked-in titles: `center 75%`). */
  imageObjectPosition?: string;
  /**
   * Carousel image frame. Default `square` keeps character portraits uncropped.
   * Use `landscape` for wide saga/world covers.
   */
  imageAspect?: 'square' | 'landscape';
  /** Click image to enlarge. Default true when `imageUrl` is set. */
  imageEnlargeable?: boolean;
  /** `grid` uses the same vertical card body as carousel (square previews). */
  variant: 'carousel' | 'list' | 'grid';
  /** Marks the carousel center card with a subtle primary border for focus feedback. */
  isCenter?: boolean;
  actions?: React.ReactNode;
  /**
   * Top-right overlay (e.g. ⋮ menu). List: card corner. Carousel: on cover/portrait.
   * Wrapper stops click/pointerdown so Embla + card onOpen do not steal the menu.
   */
  cornerAction?: React.ReactNode;
  onOpen?: () => void;
};

function stopCardChromeEvents(event: SyntheticEvent) {
  event.stopPropagation();
}

function normalizeChip(chip: EntityBrowserChip): { label: string; tone: EntityBrowserChipTone } {
  if (typeof chip === 'string') return { label: chip, tone: 'default' };
  return { label: chip.label, tone: chip.tone ?? 'default' };
}

function chipToneClass(tone: EntityBrowserChipTone): string {
  if (tone === 'native') {
    return 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300';
  }
  if (tone === 'success') {
    return 'border-emerald-500/45 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  if (tone === 'muted') {
    return 'border-border bg-muted/40 text-muted-foreground';
  }
  return 'border-border bg-muted/60 text-muted-foreground';
}

const FALLBACK_COLOR_CLASSES: readonly string[] = [
  'bg-primary/15 text-primary',
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
];

function fallbackColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  const index = hash % FALLBACK_COLOR_CLASSES.length;
  return FALLBACK_COLOR_CLASSES[index] ?? FALLBACK_COLOR_CLASSES[0];
}

function initialsFrom(imageFallback: string): string[] {
  return imageFallback
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .filter(Boolean);
}

function EntityImageFallback({
  imageFallback,
  className,
  textClassName,
}: {
  imageFallback: string;
  className?: string;
  textClassName?: string;
}) {
  const initials = initialsFrom(imageFallback);
  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center font-semibold select-none',
        fallbackColorClass(imageFallback),
        className,
      )}
    >
      {initials.length > 0 ? (
        <span className={textClassName}>{initials.join('')}</span>
      ) : (
        <ImageBroken className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}

function EntityThumbnail({
  imageUrl,
  imageAlt,
  imageFallback,
  rounded,
  className,
  imageObjectFit = 'cover',
  enlargeable = false,
  onEnlarge,
}: {
  imageUrl?: string;
  imageAlt: string;
  imageFallback: string;
  rounded: string;
  className?: string;
  imageObjectFit?: 'cover' | 'contain';
  enlargeable?: boolean;
  onEnlarge?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;
  const canEnlarge = enlargeable && showImage && Boolean(onEnlarge);

  const handleThumbClick = (event: MouseEvent) => {
    if (!canEnlarge) return;
    event.stopPropagation();
    onEnlarge?.();
  };

  return (
    <div
      className={cn(
        'relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden bg-muted md:h-20 md:w-20',
        rounded,
        canEnlarge && 'cursor-zoom-in ring-offset-background transition hover:ring-2 hover:ring-primary/40',
        className,
      )}
      role={canEnlarge ? 'button' : undefined}
      tabIndex={canEnlarge ? 0 : undefined}
      aria-label={canEnlarge ? `${imageAlt} vergrößern` : undefined}
      data-entity-thumbnail-enlarge={canEnlarge ? true : undefined}
      onClick={canEnlarge ? handleThumbClick : undefined}
      onKeyDown={
        canEnlarge
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onEnlarge?.();
              }
            }
          : undefined
      }
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={imageAlt}
          loading="lazy"
          className={cn(
            'pointer-events-none h-full w-full',
            imageObjectFit === 'contain' ? 'object-contain p-1' : 'object-cover',
          )}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <EntityImageFallback imageFallback={imageFallback} />
      )}
    </div>
  );
}

function EntityPortraitStage({
  imageUrl,
  imageAlt,
  imageFallback,
  imageObjectFit = 'cover',
  imageObjectPosition,
  imageAspect = 'square',
  enlargeable = false,
  onEnlarge,
}: {
  imageUrl?: string;
  imageAlt: string;
  imageFallback: string;
  imageObjectFit?: 'cover' | 'contain';
  imageObjectPosition?: string;
  imageAspect?: 'square' | 'landscape';
  enlargeable?: boolean;
  onEnlarge?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;
  const canEnlarge = enlargeable && showImage && Boolean(onEnlarge);

  const handleClick = (event: MouseEvent) => {
    if (!canEnlarge) return;
    event.stopPropagation();
    onEnlarge?.();
  };

  return (
    <div
      className={cn(
        // Square = portrait-safe; landscape = short 16/9 cover frames (saga/world).
        'relative w-full overflow-hidden bg-black',
        imageAspect === 'landscape' ? 'aspect-video' : 'aspect-square',
        canEnlarge && 'cursor-zoom-in',
      )}
      role={canEnlarge ? 'button' : undefined}
      tabIndex={canEnlarge ? 0 : undefined}
      aria-label={canEnlarge ? `${imageAlt} vergrößern` : undefined}
      data-entity-portrait-stage
      onClick={canEnlarge ? handleClick : undefined}
      onKeyDown={
        canEnlarge
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onEnlarge?.();
              }
            }
          : undefined
      }
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={imageAlt}
          loading="lazy"
          draggable={false}
          style={imageObjectPosition ? { objectPosition: imageObjectPosition } : undefined}
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full',
            imageObjectFit === 'contain'
              ? (imageAspect === 'landscape' ? 'object-contain p-1' : 'object-contain p-4')
              : 'object-cover',
          )}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <EntityImageFallback
          imageFallback={imageFallback}
          textClassName="text-3xl md:text-4xl tracking-wide"
        />
      )}
    </div>
  );
}

function MetaChipRow({
  chips,
  size,
}: {
  chips: readonly EntityBrowserChip[];
  size: 'sm' | 'md';
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', size === 'md' && 'gap-1.5')}>
      {chips.map((raw) => {
        const chip = normalizeChip(raw);
        return (
          <span
            key={`${chip.tone}:${chip.label}`}
            className={cn(
              'rounded-full border font-medium',
              size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]',
              chipToneClass(chip.tone),
            )}
          >
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}

export function EntityBrowserCard({
  title,
  meta,
  metaChips,
  metaExtra,
  badges,
  imageUrl,
  imageAlt,
  imageFallback,
  imageObjectFit = 'cover',
  imageObjectPosition,
  imageAspect = 'square',
  imageEnlargeable,
  variant,
  isCenter = false,
  actions,
  cornerAction,
  onOpen,
}: EntityBrowserCardProps) {
  const lightbox = useImageLightbox();
  const enlargeable = imageEnlargeable ?? Boolean(imageUrl);

  const openEnlarge = () => {
    if (!imageUrl) return;
    lightbox.openImage({
      src: imageUrl,
      alt: imageAlt,
      title,
    });
  };

  const lightboxNode = (
    <ImageLightboxDialog
      open={lightbox.open}
      target={lightbox.target}
      onOpenChange={lightbox.onOpenChange}
    />
  );

  const cornerChrome = cornerAction ? (
    <div
      className="absolute right-1.5 top-1.5 z-40"
      data-entity-browser-corner-action
      onClick={stopCardChromeEvents}
      onPointerDown={stopCardChromeEvents}
      onTouchStart={stopCardChromeEvents}
    >
      {cornerAction}
    </div>
  ) : null;

  if (variant === 'list') {
    const thumb = (
      <EntityThumbnail
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        imageFallback={imageFallback}
        imageObjectFit={imageObjectFit}
        enlargeable={enlargeable}
        onEnlarge={openEnlarge}
        rounded="rounded-lg"
      />
    );

    return (
      <>
        <Card
          className={cn(
            'group/card relative overflow-hidden transition-colors hover:border-primary/40',
            onOpen && 'cursor-pointer',
          )}
          onClick={onOpen}
        >
          <div className="flex items-center gap-3 p-3">
            {thumb}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold">{title}</p>
                {badges?.map((badge) => (
                  <Badge key={badge.label} variant={badge.variant ?? 'secondary'} className="text-[10px]">
                    {badge.label}
                  </Badge>
                ))}
              </div>
              {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
              {metaChips && metaChips.length > 0 && (
                <div className="mt-1.5">
                  <MetaChipRow chips={metaChips} size="md" />
                </div>
              )}
              {metaExtra ? (
                <div className="mt-1.5" onClick={stopCardChromeEvents}>
                  {metaExtra}
                </div>
              ) : null}
            </div>
            {(cornerAction || actions) && (
              <div
                className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch"
                onClick={stopCardChromeEvents}
                onPointerDown={stopCardChromeEvents}
                onTouchStart={stopCardChromeEvents}
              >
                {cornerAction ? (
                  <div
                    data-entity-browser-corner-action
                    onClick={stopCardChromeEvents}
                    onPointerDown={stopCardChromeEvents}
                    onTouchStart={stopCardChromeEvents}
                  >
                    {cornerAction}
                  </div>
                ) : (
                  <span className="size-8 shrink-0" aria-hidden="true" />
                )}
                {actions ? (
                  <div className="flex w-full min-w-[6.5rem] flex-col items-stretch justify-end">
                    {actions}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Card>
        {lightboxNode}
      </>
    );
  }

  return (
    <>
      <Card
        className={cn(
          // gap-0: no empty band between stage and text; card height = content height.
          'relative w-full gap-0 overflow-hidden transition-all duration-300',
          isCenter
            ? 'border-primary/40 shadow-none'
            : 'shadow-md hover:border-primary/40',
          onOpen && 'cursor-pointer',
        )}
        onClick={onOpen}
        data-entity-browser-card={variant === 'grid' ? 'grid' : 'carousel'}
      >
        <div className="relative">
          <EntityPortraitStage
            imageUrl={imageUrl}
            imageAlt={imageAlt}
            imageFallback={imageFallback}
            imageObjectFit={imageObjectFit}
            imageObjectPosition={imageObjectPosition}
            imageAspect={imageAspect}
            enlargeable={enlargeable}
            onEnlarge={openEnlarge}
          />
          {cornerChrome}
        </div>
        <CardContent className="space-y-2.5 p-3 [&:last-child]:pb-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{title}</p>
              {badges?.map((badge) => (
                <Badge key={badge.label} variant={badge.variant ?? 'secondary'} className="text-[10px]">
                  {badge.label}
                </Badge>
              ))}
            </div>
            {meta && <p className="truncate text-[11px] text-muted-foreground">{meta}</p>}
            {metaChips && metaChips.length > 0 && (
              <div className="mt-1.5">
                <MetaChipRow chips={metaChips} size="sm" />
              </div>
            )}
            {metaExtra ? (
              <div className="mt-1.5" onClick={stopCardChromeEvents}>
                {metaExtra}
              </div>
            ) : null}
          </div>
          {actions && (
            <div
              className="flex w-full flex-wrap items-stretch gap-1.5"
              onClick={stopCardChromeEvents}
            >
              {actions}
            </div>
          )}
        </CardContent>
      </Card>
      {lightboxNode}
    </>
  );
}
