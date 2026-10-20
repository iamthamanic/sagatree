/**
 * AtlasNative3dEditor — SagaTree-native host for the Unified Atlas 3D runtime.
 * Location: src/app/world/atlas/unified/AtlasNative3dEditor.tsx
 *
 * Mounts the in-repo WebGL runtime and applies SagaTree skin (no iframe).
 * Map-first reveal: land surface must be sized+painted before Ebenen/Werkzeuge chrome.
 * Product path (#721): controlled mount — seed/persist via generator_meta, not localStorage SoT.
 * Product nav (#747): external WorldNode tree replaces demo NAV_CHILDREN in #nav.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  webglToolChromeForKind,
  type WebglRuntimeState,
} from '../../../../domains/world/atlas';
import type { WorldNodeKind } from '../../../../domains/world/hierarchy';
import type { AtlasWebglNavTree } from '../../../../domains/world/places';
import { mountAtlasPrototype3d } from './prototype3d/atlas-prototype-runtime.mjs';
import './prototype3d/atlas-sagatree-skin.css';

export type AtlasNativeNavSelectPayload = {
  readonly placeId: string | null;
  readonly mapId: string | null;
  readonly worldRoot: boolean;
};

type AtlasNativeMountHandle = {
  readonly dispose: () => void;
  readonly updateExternalNav: (tree: AtlasWebglNavTree | null) => void;
  readonly setActiveNavPlaceId: (placeId: string | null) => void;
  readonly setToolChrome: (
    rows: ReturnType<typeof webglToolChromeForKind> | null,
  ) => void;
  readonly setCanEdit: (canEdit: boolean) => void;
};

export type AtlasNative3dEditorProps = {
  readonly className?: string;
  /** Remount key (active map id + revision). */
  readonly mapKey?: string;
  /** When true, runtime never uses localStorage as world SoT. */
  readonly controlled?: boolean;
  readonly seedState?: WebglRuntimeState | null;
  readonly onPersist?: (state: WebglRuntimeState) => void;
  /** Persisted world tree for product #nav (#747). */
  readonly externalNav?: AtlasWebglNavTree | null;
  readonly activePlaceId?: string | null;
  readonly onNavSelect?: (payload: AtlasNativeNavSelectPayload) => void;
  readonly onNavRename?: (payload: { readonly placeId: string; readonly label: string }) => void;
  /** Product #748 — server create / mutation bridge from WebGL #nav. */
  readonly onNavAdd?: (payload: { readonly uiKind: string; readonly parentId: string }) => void;
  readonly onNavDuplicate?: (payload: { readonly placeId: string }) => void;
  readonly onNavArchive?: (payload: { readonly placeId: string }) => void;
  readonly onNavReparent?: (payload: { readonly placeId: string }) => void;
  /** Hierarchy tip for ATLAS_TOOL_REGISTRY chrome (#750). */
  readonly activeNodeKind?: WorldNodeKind | null;
  /** Client-side mutation gate; RPC/RLS remain authority. */
  readonly canEdit?: boolean;
};

/** Rebrand leftover prototype copy to SagaTree product wording. */
function applySagaTreeCopy(host: HTMLElement): void {
  const eyebrow = host.querySelector('.side .eyebrow');
  if (eyebrow && /Eldoria/i.test(eyebrow.textContent ?? '')) {
    eyebrow.textContent = 'Zoom-Stufen';
  }
  const crumbRoot = host.querySelector('.subbar .crumb');
  if (crumbRoot) {
    crumbRoot.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && /Eldoria/i.test(node.textContent ?? '')) {
        node.textContent = (node.textContent ?? '').replace(/Eldoria/gi, 'Welt');
      }
    });
  }
  // Hide standalone-prototype disclaimer — SagaTree chrome owns product context.
  host.querySelectorAll('.inspector .atlas-panel-body > p.small, .inspector > p.small').forEach((el) => {
    if (/Technikprototyp|Datenbankintegration|CDN/i.test(el.textContent ?? '')) {
      el.setAttribute('hidden', '');
    }
  });
  const saveState = host.querySelector('#saveState');
  if (saveState && /Lokal gespeichert/i.test(saveState.textContent ?? '')) {
    saveState.textContent = 'Atlas bereit';
  }
}

type PanelFoldKey = 'layers' | 'tools';

/** Inline icons for panel folds (no extra deps; stroke matches currentColor). */
const PANEL_FOLD_ICONS: Record<PanelFoldKey, string> = {
  layers:
    '<svg class="atlas-panel-fold-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg>',
  tools:
    '<svg class="atlas-panel-fold-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>',
};

/** True when the WebGL buffer is large enough to show land (not the parked 260×240 stub). */
function isSurfaceSized(atlasRoot: Element): boolean {
  const canvas = atlasRoot.querySelector<HTMLCanvasElement>('canvas:not(.hidden)');
  if (!canvas) return false;
  const clientW = canvas.clientWidth;
  const clientH = canvas.clientHeight;
  if (clientW < 200 || clientH < 160) return false;
  // Buffer must track the visible stage — keep-alive park used to leave 260×240.
  return canvas.width >= Math.min(400, clientW * 0.5) && canvas.height >= Math.min(300, clientH * 0.5);
}

/**
 * Hide chrome until the map surface is actually presentable, then fade chips in.
 * Re-arms on keep-alive resume (IntersectionObserver) so UI never leads a tiny/blank canvas.
 */
function installMapFirstReveal(atlasRoot: HTMLElement): () => void {
  let settleTimer = 0;
  let raf = 0;
  let armed = false;

  const clearChrome = () => {
    armed = false;
    window.clearTimeout(settleTimer);
    window.cancelAnimationFrame(raf);
    atlasRoot.removeAttribute('data-atlas-chrome-ready');
    atlasRoot.removeAttribute('data-atlas-surface-ready');
  };

  const finishReveal = () => {
    atlasRoot.removeAttribute('data-atlas-boot');
    atlasRoot.setAttribute('data-atlas-surface-ready', 'true');
    settleTimer = window.setTimeout(() => {
      atlasRoot.setAttribute('data-atlas-chrome-ready', 'true');
    }, 60);
  };

  const armReveal = () => {
    if (armed) return;
    armed = true;
    window.clearTimeout(settleTimer);
    window.cancelAnimationFrame(raf);
    atlasRoot.removeAttribute('data-atlas-chrome-ready');
    atlasRoot.removeAttribute('data-atlas-surface-ready');
    // Nudge layout/resize observers after keep-alive resume.
    window.dispatchEvent(new Event('resize'));
    const poll = () => {
      if (!atlasRoot.isConnected) return;
      if (atlasRoot.hasAttribute('data-atlas-ready') && isSurfaceSized(atlasRoot)) {
        // Two paints after sized buffer so land presents before chrome.
        raf = window.requestAnimationFrame(() => {
          raf = window.requestAnimationFrame(finishReveal);
        });
        return;
      }
      raf = window.requestAnimationFrame(poll);
    };
    raf = window.requestAnimationFrame(poll);
  };

  // Initial mount.
  armReveal();

  // Keep-alive park/resume is driven by data-atlas-keepalive-host on an ancestor
  // (opacity:0 park still "intersects", so IntersectionObserver is the wrong signal).
  const parkHost = atlasRoot.closest('[data-atlas-keepalive-host]');
  const onParkAttr = () => {
    const state = parkHost?.getAttribute('data-atlas-keepalive-host');
    if (state === 'parked') {
      clearChrome();
      return;
    }
    if (state === 'active') {
      armed = false;
      armReveal();
    }
  };
  const mo =
    parkHost && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(onParkAttr)
      : null;
  mo?.observe(parkHost, { attributes: true, attributeFilter: ['data-atlas-keepalive-host'] });

  return () => {
    mo?.disconnect();
    window.clearTimeout(settleTimer);
    window.cancelAnimationFrame(raf);
  };
}

/** Layers / Tools fold controls — collapse each aside upward to a slim toggle. */
function installCollapsiblePanels(host: HTMLElement): () => void {
  const atlasRoot = host.querySelector('#atlas3d');
  const cleanups: Array<() => void> = [];
  // Boot: collapsed before first paint — no open→close transition flash.
  atlasRoot?.setAttribute('data-atlas-boot', 'true');

  const wire = (
    panel: HTMLElement | null,
    label: string,
    key: PanelFoldKey,
  ): void => {
    if (!panel || panel.querySelector(`[data-atlas-panel-fold="${key}"]`)) return;

    // Collapse before children re-enter the tree so first paint is map-only.
    panel.setAttribute('data-collapsed', 'true');
    atlasRoot?.setAttribute(`data-${key}-collapsed`, 'true');

    const body = document.createElement('div');
    body.className = 'atlas-panel-body';
    body.dataset.atlasPanelBody = key;
    body.id = `atlas-panel-body-${key}`;
    const inner = document.createElement('div');
    inner.className = 'atlas-panel-body-inner';
    while (panel.firstChild) {
      inner.appendChild(panel.firstChild);
    }
    body.appendChild(inner);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'atlas-panel-fold';
    btn.dataset.atlasPanelFold = key;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', `atlas-panel-body-${key}`);
    btn.setAttribute('aria-label', label);
    btn.innerHTML = `<span class="atlas-panel-fold-main">${PANEL_FOLD_ICONS[key]}<span class="atlas-panel-fold-label">${label}</span></span><span class="atlas-panel-fold-chevron" aria-hidden="true">▾</span>`;

    panel.appendChild(btn);
    panel.appendChild(body);

    const onToggle = () => {
      const next = panel.getAttribute('data-collapsed') !== 'true';
      panel.setAttribute('data-collapsed', next ? 'true' : 'false');
      btn.setAttribute('aria-expanded', next ? 'false' : 'true');
      atlasRoot?.setAttribute(`data-${key}-collapsed`, next ? 'true' : 'false');
    };
    btn.addEventListener('click', onToggle);
    cleanups.push(() => btn.removeEventListener('click', onToggle));
  };

  wire(host.querySelector('#side'), 'Ebenen', 'layers');
  wire(host.querySelector('#inspector'), 'Werkzeuge', 'tools');

  // Move tools into Werkzeuge BEFORE revealing panels (never flash stage tool rail).
  const actionTools = host.querySelector('#tools');
  const toolsInner = host.querySelector<HTMLElement>(
    '[data-atlas-panel-body="tools"] .atlas-panel-body-inner',
  );
  if (actionTools && toolsInner) {
    const kartEyebrow = Array.from(toolsInner.querySelectorAll('.eyebrow')).find((el) =>
      /Kartenwerkzeuge/i.test(el.textContent ?? ''),
    );
    if (kartEyebrow) {
      kartEyebrow.insertAdjacentElement('afterend', actionTools);
    } else {
      toolsInner.insertBefore(actionTools, toolsInner.firstChild);
    }
    actionTools.classList.add('atlas-tools-in-panel');
    actionTools.classList.remove('atlas-tools-on-canvas');
  }

  atlasRoot?.setAttribute('data-panels-ready', 'true');

  if (atlasRoot instanceof HTMLElement) {
    cleanups.push(installMapFirstReveal(atlasRoot));
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

export function AtlasNative3dEditor({
  className,
  mapKey = 'default',
  controlled = false,
  seedState = null,
  onPersist,
  externalNav = null,
  activePlaceId = null,
  onNavSelect,
  onNavRename,
  onNavAdd,
  onNavDuplicate,
  onNavArchive,
  onNavReparent,
  activeNodeKind = null,
  canEdit = true,
}: AtlasNative3dEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<AtlasNativeMountHandle | null>(null);
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  const navSelectRef = useRef(onNavSelect);
  navSelectRef.current = onNavSelect;
  const navRenameRef = useRef(onNavRename);
  navRenameRef.current = onNavRename;
  const navAddRef = useRef(onNavAdd);
  navAddRef.current = onNavAdd;
  const navDuplicateRef = useRef(onNavDuplicate);
  navDuplicateRef.current = onNavDuplicate;
  const navArchiveRef = useRef(onNavArchive);
  navArchiveRef.current = onNavArchive;
  const navReparentRef = useRef(onNavReparent);
  navReparentRef.current = onNavReparent;
  const externalNavRef = useRef(externalNav);
  externalNavRef.current = externalNav;
  const activePlaceIdRef = useRef(activePlaceId);
  activePlaceIdRef.current = activePlaceId;
  const activeNodeKindRef = useRef(activeNodeKind);
  activeNodeKindRef.current = activeNodeKind;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const mapKeyRef = useRef(mapKey);
  const seedRef = useRef(seedState);
  if (mapKeyRef.current !== mapKey) {
    mapKeyRef.current = mapKey;
    seedRef.current = seedState;
  }
  const [error, setError] = useState<string | null>(null);

  // Layout effect: mount + collapse panels before the browser paints (no open→close flash).
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    host.setAttribute('data-atlas-boot', 'true');
    if (controlled) {
      host.setAttribute('data-atlas-controlled', 'true');
    } else {
      host.removeAttribute('data-atlas-controlled');
    }
    let mount: AtlasNativeMountHandle | null = null;
    let disposePanels: (() => void) | null = null;
    let copyTimer = 0;
    try {
      mount = mountAtlasPrototype3d(host, {
        controlled,
        seedState: seedRef.current ?? null,
        onPersist: controlled
          ? (state) => {
              const next = state as WebglRuntimeState;
              persistRef.current?.(next);
            }
          : undefined,
        externalNav: externalNavRef.current ?? null,
        activePlaceId: activePlaceIdRef.current ?? null,
        onNavSelect: (payload) => {
          navSelectRef.current?.(payload);
        },
        onNavRename: (payload) => {
          navRenameRef.current?.(payload);
        },
        onNavAdd: (payload) => {
          navAddRef.current?.(payload);
        },
        onNavDuplicate: (payload) => {
          navDuplicateRef.current?.(payload);
        },
        onNavArchive: (payload) => {
          navArchiveRef.current?.(payload);
        },
        onNavReparent: (payload) => {
          navReparentRef.current?.(payload);
        },
        toolChrome: webglToolChromeForKind(activeNodeKindRef.current ?? null),
        canEdit: canEditRef.current !== false,
      });
      mountRef.current = mount;
      disposePanels = installCollapsiblePanels(host);
      applySagaTreeCopy(host);
      // Nav is rendered async after mount — rebrand once levels paint.
      copyTimer = window.setTimeout(() => applySagaTreeCopy(host), 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '3D-Atlas konnte nicht gestartet werden.');
    }
    return () => {
      window.clearTimeout(copyTimer);
      mountRef.current = null;
      try {
        disposePanels?.();
      } catch {
        /* ignore */
      }
      try {
        mount?.dispose();
      } catch {
        /* ignore */
      }
      host.replaceChildren();
      host.removeAttribute('data-atlas-boot');
      host.removeAttribute('data-atlas-controlled');
    };
  }, [mapKey, controlled]);

  // Push tree / selection updates without remounting WebGL.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.updateExternalNav(externalNav ?? null);
  }, [externalNav]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.setActiveNavPlaceId(activePlaceId ?? null);
  }, [activePlaceId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.setToolChrome(webglToolChromeForKind(activeNodeKind ?? null));
  }, [activeNodeKind]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.setCanEdit(canEdit !== false);
  }, [canEdit]);

  return (
    <div
      className={`flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden ${className ?? ''}`}
      data-atlas-native-3d
      data-atlas-proto-exact="true"
      data-atlas-controlled={controlled ? 'true' : undefined}
      data-atlas-product-nav={externalNav ? 'true' : undefined}
      style={{ background: '#123e4a' }}
    >
      {error ? (
        <p
          className="m-3 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div ref={hostRef} className="min-h-0 min-w-0 flex-1" data-atlas-native-3d-host />
    </div>
  );
}
