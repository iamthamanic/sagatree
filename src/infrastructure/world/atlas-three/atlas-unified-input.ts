/**
 * atlas-unified-input — SWS-06: Unified Input Controller (MacBook Trackpad + Mouse + Safari Gesture).
 * Location: src/infrastructure/world/atlas-three/atlas-unified-input.ts
 *
 * Implements ADR-SWS-01 §7.2 & Review Checklist E3–E5:
 *  - Delta normalization across `deltaMode` 0 (pixel), 1 (line ×16), 2 (page ×viewportH).
 *  - Trackpad Pinch: `ctrlKey + wheel` (Chromium/Firefox) AND `gesturestart/gesturechange` (Safari)
 *    → cursor-pinned zoom with `preventDefault()` blocking native browser zoom.
 *  - Two-Finger Trackpad Scroll → Pan (`deltaX`, `deltaY`).
 *  - Shift + Wheel → Orbit (yaw/pitch) alongside Shift+Drag / Right-Drag.
 *  - Mouse Wheel notches → cursor-pinned zoom.
 *  - Non-passive DOM listeners (`{ passive: false }`) so `preventDefault()` works reliably.
 */

export type NormalizedWheelInput = {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly clientX: number;
  readonly clientY: number;
  readonly viewportHeight: number;
};

export type UnifiedWheelAction =
  | {
      readonly kind: 'pinch-zoom';
      readonly zoomDelta: number;
      readonly clientX: number;
      readonly clientY: number;
    }
  | {
      readonly kind: 'wheel-zoom';
      readonly zoomDelta: number;
      readonly clientX: number;
      readonly clientY: number;
    }
  | {
      readonly kind: 'pan';
      readonly deltaX: number;
      readonly deltaY: number;
    }
  | {
      readonly kind: 'orbit';
      readonly deltaYawRad: number;
      readonly deltaPitchRad: number;
    };

const LINE_HEIGHT_PX = 16;

/**
 * Normalize DOM wheel deltas across `deltaMode` 0 (pixels), 1 (lines), 2 (pages) (Checklist E5).
 */
export function normalizeWheelDelta(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): { readonly dx: number; readonly dy: number } {
  const safeH = Math.max(100, Number.isFinite(viewportHeight) ? viewportHeight : 800);
  const mult = deltaMode === 1 ? LINE_HEIGHT_PX : deltaMode === 2 ? safeH : 1;
  return {
    dx: Number.isFinite(deltaX) ? deltaX * mult : 0,
    dy: Number.isFinite(deltaY) ? deltaY * mult : 0,
  };
}

/**
 * Classify a wheel event into pinch-zoom, two-finger trackpad pan, orbit, or mouse-wheel zoom.
 * Pure function — headless unit testable.
 */
export function classifyUnifiedWheelGesture(ev: NormalizedWheelInput): UnifiedWheelAction {
  const { dx, dy } = normalizeWheelDelta(ev.deltaX, ev.deltaY, ev.deltaMode, ev.viewportHeight);

  // 1) Chromium / Firefox Trackpad Pinch (or Ctrl+Wheel) → Zoom toward cursor (E3)
  if (ev.ctrlKey) {
    // Trackpad pinch wheel deltas are typically small (~±2..25 px); scale smoothly.
    return {
      kind: 'pinch-zoom',
      zoomDelta: dy * 4.5,
      clientX: ev.clientX,
      clientY: ev.clientY,
    };
  }

  // 2) Shift + Wheel/Trackpad → Orbit camera
  if (ev.shiftKey) {
    return {
      kind: 'orbit',
      deltaYawRad: -(dx !== 0 ? dx : dy) * 0.0045,
      deltaPitchRad: (dx !== 0 ? dy : 0) * 0.0035,
    };
  }

  // 3) Meta/Cmd + Wheel → Zoom toward cursor
  if (ev.metaKey) {
    return {
      kind: 'wheel-zoom',
      zoomDelta: dy,
      clientX: ev.clientX,
      clientY: ev.clientY,
    };
  }

  // 4) Two-Finger Trackpad Scroll → Pan (E4):
  // macOS trackpad emits pixel-mode (deltaMode===0) events with horizontal deltaX
  // or smooth sub-notch vertical deltas (< 48px, non-120 multiples).
  const isMouseNotch =
    ev.deltaMode !== 0 ||
    (Math.abs(dx) < 0.01 && Math.abs(dy) >= 48 && Math.abs(dy % 40) < 0.5);

  if (!isMouseNotch && (Math.abs(dx) > 0.01 || Math.abs(dy) < 48)) {
    return {
      kind: 'pan',
      deltaX: dx,
      deltaY: dy,
    };
  }

  // 5) Standard physical mouse wheel → Zoom toward cursor
  return {
    kind: 'wheel-zoom',
    zoomDelta: dy,
    clientX: ev.clientX,
    clientY: ev.clientY,
  };
}

/** Safari WebKit non-standard GestureEvent shape for trackpad pinch (E3). */
export type SafariGestureEventLike = Event & {
  readonly scale?: number;
  readonly clientX?: number;
  readonly clientY?: number;
};

/**
 * Convert Safari `gesturechange` scale ratio relative to previous scale into a
 * zoom delta compatible with `zoomAtScreen(delta, px, py)`.
 */
export function safariGestureScaleToZoomDelta(prevScale: number, nextScale: number): number {
  const safePrev = Math.max(0.05, Number.isFinite(prevScale) ? prevScale : 1);
  const safeNext = Math.max(0.05, Number.isFinite(nextScale) ? nextScale : safePrev);
  const ratio = safeNext / safePrev;
  // Positive delta zooms out, negative delta zooms in (matches wheel deltaY convention).
  return -Math.log(ratio) * 620;
}

export type AtlasUnifiedInputCallbacks = {
  readonly onZoomAtScreen: (zoomDelta: number, px: number, py: number) => void;
  readonly onPanByScreen: (deltaX: number, deltaY: number) => void;
  readonly onOrbitByDelta: (deltaYawRad: number, deltaPitchRad: number) => void;
};

/**
 * Attach non-passive (`{ passive: false }`) wheel + Safari gesture listeners to
 * a canvas element. Returns a cleanup disposer.
 */
export function bindAtlasUnifiedInput(
  element: HTMLElement,
  callbacks: AtlasUnifiedInputCallbacks,
): () => void {
  let lastSafariScale = 1;

  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const rect = element.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const action = classifyUnifiedWheelGesture({
      deltaX: ev.deltaX,
      deltaY: ev.deltaY,
      deltaMode: ev.deltaMode,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      clientX: px,
      clientY: py,
      viewportHeight: rect.height || window.innerHeight || 800,
    });

    if (action.kind === 'pinch-zoom' || action.kind === 'wheel-zoom') {
      callbacks.onZoomAtScreen(action.zoomDelta, action.clientX, action.clientY);
    } else if (action.kind === 'pan') {
      callbacks.onPanByScreen(action.deltaX, action.deltaY);
    } else if (action.kind === 'orbit') {
      callbacks.onOrbitByDelta(action.deltaYawRad, action.deltaPitchRad);
    }
  };

  const onGestureStart = (raw: Event) => {
    const ev = raw as SafariGestureEventLike;
    ev.preventDefault();
    lastSafariScale = typeof ev.scale === 'number' && Number.isFinite(ev.scale) ? ev.scale : 1;
  };

  const onGestureChange = (raw: Event) => {
    const ev = raw as SafariGestureEventLike;
    ev.preventDefault();
    const nextScale = typeof ev.scale === 'number' && Number.isFinite(ev.scale) ? ev.scale : lastSafariScale;
    const zoomDelta = safariGestureScaleToZoomDelta(lastSafariScale, nextScale);
    lastSafariScale = nextScale;
    if (Math.abs(zoomDelta) < 0.01) return;
    const rect = element.getBoundingClientRect();
    const px = typeof ev.clientX === 'number' ? ev.clientX - rect.left : rect.width / 2;
    const py = typeof ev.clientY === 'number' ? ev.clientY - rect.top : rect.height / 2;
    callbacks.onZoomAtScreen(zoomDelta, px, py);
  };

  const onGestureEnd = (ev: Event) => {
    ev.preventDefault();
    lastSafariScale = 1;
  };

  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
  element.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
  element.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);

  return () => {
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('gesturestart', onGestureStart);
    element.removeEventListener('gesturechange', onGestureChange);
    element.removeEventListener('gestureend', onGestureEnd);
  };
}
