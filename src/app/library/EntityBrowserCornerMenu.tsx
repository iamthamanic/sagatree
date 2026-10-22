/**
 * EntityBrowserCornerMenu — Embla-safe ⋮ trigger + body portal for Library cards.
 * Location: src/app/library/EntityBrowserCornerMenu.tsx
 *
 * Native capture on the trigger so carousel drag listeners never swallow the click.
 * Menu panel is owned by the parent (survives slide remounts).
 * Portal tracks the trigger on scroll/resize so it stays anchored.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CircleNotch,
  DotsThree
} from '@phosphor-icons/react';
import { cn } from '../../shared/ui/utils';

export type EntityBrowserCornerMenuItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
};

export type EntityBrowserCornerMenuAnchor = {
  top: number;
  left: number;
  menuKey: string;
  /** Concrete trigger node — preferred over querySelector when Embla clones share menuKey. */
  triggerEl: HTMLElement;
};

const MENU_WIDTH = 224;

function clampMenuLeft(preferredLeft: number): number {
  if (typeof window === 'undefined') return preferredLeft;
  return Math.min(
    Math.max(8, preferredLeft),
    window.innerWidth - MENU_WIDTH - 8,
  );
}

function positionFromTriggerRect(rect: DOMRect): { top: number; left: number } {
  return {
    top: rect.bottom + 4,
    left: clampMenuLeft(rect.right - MENU_WIDTH),
  };
}

type TriggerProps = {
  compact?: boolean;
  busy?: boolean;
  label: string;
  menuKey: string;
  open: boolean;
  onToggle: (rect: DOMRect, triggerEl: HTMLElement) => void;
  /** data-* attribute name without `data-` prefix, e.g. library-saga-menu */
  dataAttr?: string;
};

export function EntityBrowserCornerMenuTrigger({
  compact = false,
  busy = false,
  label,
  menuKey,
  open,
  onToggle,
  dataAttr = 'library-entity-menu',
}: TriggerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;

    const blockEmbla = (event: Event) => {
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    };
    const onClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      if (busy) return;
      onToggle(el.getBoundingClientRect(), el);
    };

    el.addEventListener('pointerdown', blockEmbla, true);
    el.addEventListener('touchstart', blockEmbla, true);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('pointerdown', blockEmbla, true);
      el.removeEventListener('touchstart', blockEmbla, true);
      el.removeEventListener('click', onClick, true);
    };
  }, [busy, onToggle]);

  return (
    <button
      ref={triggerRef}
      type="button"
      disabled={busy}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      data-state={open ? 'open' : 'closed'}
      {...{ [`data-${dataAttr}`]: menuKey }}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-md border border-border/80',
        'bg-background/90 text-foreground shadow-md backdrop-blur-sm',
        'hover:bg-secondary/80 active:scale-[0.98]',
        'outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:opacity-50',
        compact ? 'size-8 min-h-8' : 'size-9 min-h-9',
      )}
    >
      {busy ? (
        <CircleNotch className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <DotsThree className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

type PortalProps = {
  anchor: EntityBrowserCornerMenuAnchor;
  busy?: boolean;
  items: EntityBrowserCornerMenuItem[];
  onClose: () => void;
  dataAttr?: string;
  contentDataAttr?: string;
};

export function EntityBrowserCornerMenuPortal({
  anchor,
  busy = false,
  items,
  onClose,
  dataAttr = 'library-entity-menu',
  contentDataAttr = 'library-entity-menu-content',
}: PortalProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [coords, setCoords] = useState(() => ({
    top: anchor.top,
    left: clampMenuLeft(anchor.left),
  }));

  useLayoutEffect(() => {
    let raf = 0;
    const syncFromTrigger = () => {
      const trigger = anchor.triggerEl;
      if (!(trigger instanceof HTMLElement) || !trigger.isConnected) {
        onCloseRef.current();
        return;
      }
      const rect = trigger.getBoundingClientRect();
      // Trigger scrolled out of the visible main pane → close.
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        onCloseRef.current();
        return;
      }
      setCoords(positionFromTriggerRect(rect));
    };
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncFromTrigger);
    };

    syncFromTrigger();
    window.addEventListener('resize', onScrollOrResize);
    // Capture scroll on any scrollable ancestor (main pane, Embla, window).
    document.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [anchor.menuKey, anchor.triggerEl]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (anchor.triggerEl.contains(target)) return;
      onCloseRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor.menuKey, anchor.triggerEl]);

  const runAndClose = (action: () => void) => {
    onClose();
    action();
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      {...{ [`data-${contentDataAttr}`]: anchor.menuKey }}
      className="fixed z-[200] min-w-[14rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ top: coords.top, left: coords.left }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore ? (
            <div className="bg-border -mx-1 my-1 h-px" role="separator" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={cn(
              'relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none',
              item.destructive
                ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                : 'hover:bg-accent hover:text-accent-foreground',
              (busy || item.disabled) && 'pointer-events-none opacity-50',
            )}
            disabled={busy || item.disabled}
            data-library-entity-menu-item={item.id}
            onClick={() => runAndClose(item.onSelect)}
          >
            {item.icon}
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/**
 * Menu label for copy-id: `Item-ID IT-XXXXX` when publicId exists,
 * else `Item-ID` (kindLabel only). Kind labels: Item-ID, Charakter-ID, …
 */
export function copyPublicIdMenuLabel(
  kindLabel: string,
  publicId: string | null | undefined,
): string {
  const id = publicId?.trim();
  if (!id) return kindLabel;
  return `${kindLabel} ${id}`;
}
