/**
 * AibertoCompanion — shell-global rulebook companion (AIB-02 / #1125).
 * Location: src/app/ai-assistant/AibertoCompanion.tsx
 *
 * Desktop/tablet: right dock 320–520px with drag resize.
 * Phone: AdaptiveSheet (background may block). Phase A: Regeln only — no chat.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpenText, X } from '@phosphor-icons/react';
import {
  AdaptiveSheet,
  AdaptiveSheetContent,
  AdaptiveSheetHeader,
  AdaptiveSheetTitle,
  useAdaptiveBand,
} from '../../shared/ui/adaptive';
import { Button } from '../../shared/ui/button';
import { RulebookBrowser } from './RulebookBrowser';
import { isAibertoCompanionEnabled } from './aiberto-flags';
import {
  AIBERTO_DOCK_MAX_PX,
  AIBERTO_DOCK_MIN_PX,
  clampAibertoDockWidth,
  readAibertoPrefs,
  writeAibertoPrefs,
  type AibertoPrefs,
} from './aiberto-prefs';

export type AibertoCompanionProps = {
  /** Controlled open from shell chrome; falls back to prefs when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AibertoCompanion({ open: openProp, onOpenChange }: AibertoCompanionProps) {
  const enabled = isAibertoCompanionEnabled();
  const band = useAdaptiveBand();
  const phone = band === 'phone';
  const [prefs, setPrefs] = useState<AibertoPrefs>(() => readAibertoPrefs());
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setPrefs(readAibertoPrefs());
  }, []);

  const open = openProp ?? prefs.open;

  const setOpen = useCallback(
    (next: boolean) => {
      setPrefs((current) => {
        const updated = { ...current, open: next };
        writeAibertoPrefs(updated);
        return updated;
      });
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const setWidth = useCallback((widthPx: number) => {
    setPrefs((current) => {
      const updated = { ...current, widthPx: clampAibertoDockWidth(widthPx) };
      writeAibertoPrefs(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startX - event.clientX;
      setWidth(drag.startWidth + delta);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setWidth]);

  if (!enabled) return null;

  if (phone) {
    return (
      <AdaptiveSheet open={open} onOpenChange={setOpen}>
        <AdaptiveSheetContent
          forceSide="bottom"
          className="flex h-[min(92dvh,920px)] flex-col gap-0 p-0"
          data-aiberto-companion="sheet"
          aria-describedby={undefined}
        >
          <AdaptiveSheetHeader className="shrink-0 border-b border-border px-4 py-3">
            <AdaptiveSheetTitle className="flex items-center gap-2">
              <BookOpenText size={20} weight="regular" aria-hidden />
              Aiberto · Regeln
            </AdaptiveSheetTitle>
          </AdaptiveSheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden p-4">
            <RulebookBrowser />
          </div>
        </AdaptiveSheetContent>
      </AdaptiveSheet>
    );
  }

  if (!open) return null;

  return (
    <aside
      data-aiberto-companion="dock"
      data-adaptive-band={band}
      aria-label="Aiberto Regelbuch"
      className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-border bg-card"
      style={{ width: prefs.widthPx }}
    >
      <button
        type="button"
        aria-label="Aiberto-Breite anpassen"
        title="Breite ziehen (320–520px)"
        className="absolute top-0 bottom-0 left-0 z-10 w-2 -translate-x-1 cursor-col-resize touch-none hover:bg-primary/30 focus-visible:bg-primary/40 focus-visible:outline-none"
        onPointerDown={(event) => {
          event.preventDefault();
          dragRef.current = { startX: event.clientX, startWidth: prefs.widthPx };
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        data-aiberto-resize
      />
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <BookOpenText size={20} weight="regular" aria-hidden className="shrink-0" />
          <span className="truncate">Aiberto · Regeln</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Aiberto schließen"
          onClick={() => setOpen(false)}
        >
          <X size={18} weight="regular" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <RulebookBrowser />
      </div>
      <p className="sr-only">
        Dockbreite {prefs.widthPx}px, erlaubt {AIBERTO_DOCK_MIN_PX}–{AIBERTO_DOCK_MAX_PX}px.
      </p>
    </aside>
  );
}

/** Chrome toggle control for shell nav / header. */
export function AibertoToggleButton({
  open,
  onToggle,
  compact = false,
}: {
  open: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  if (!isAibertoCompanionEnabled()) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Aiberto"
      aria-label="Aiberto Regelbuch"
      aria-pressed={open}
      data-aiberto-toggle
      className={`flex items-center rounded-lg text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        compact ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
      } ${
        open
          ? 'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground'
          : 'text-sidebar-foreground hover:bg-accent/10 hover:text-accent'
      }`}
    >
      <BookOpenText className="h-5 w-5 shrink-0" size={20} weight="regular" aria-hidden />
      {!compact ? <span className="truncate">Aiberto</span> : null}
    </button>
  );
}
