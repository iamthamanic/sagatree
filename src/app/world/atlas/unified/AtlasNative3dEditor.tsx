/**
 * AtlasNative3dEditor — SagaTree-native host for the Unified Atlas 3D runtime.
 * Location: src/app/world/atlas/unified/AtlasNative3dEditor.tsx
 *
 * Mounts the in-repo WebGL runtime and applies SagaTree skin (no iframe).
 */
import { useEffect, useRef, useState } from 'react';
import { mountAtlasPrototype3d } from './prototype3d/atlas-prototype-runtime.mjs';
import './prototype3d/atlas-sagatree-skin.css';

export type AtlasNative3dEditorProps = {
  readonly className?: string;
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

/** Layers / Tools fold controls — collapse each aside upward to a slim toggle. */
function installCollapsiblePanels(host: HTMLElement): () => void {
  const atlasRoot = host.querySelector('#atlas3d');
  const cleanups: Array<() => void> = [];

  const wire = (
    panel: HTMLElement | null,
    label: string,
    key: PanelFoldKey,
  ): void => {
    if (!panel || panel.querySelector(`[data-atlas-panel-fold="${key}"]`)) return;

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
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', `atlas-panel-body-${key}`);
    btn.setAttribute('aria-label', label);
    btn.innerHTML = `<span class="atlas-panel-fold-main">${PANEL_FOLD_ICONS[key]}<span class="atlas-panel-fold-label">${label}</span></span><span class="atlas-panel-fold-chevron" aria-hidden="true">▾</span>`;

    panel.appendChild(btn);
    panel.appendChild(body);
    // Start collapsed so the map fills the stage; open via Layers / Tools.
    panel.setAttribute('data-collapsed', 'true');
    btn.setAttribute('aria-expanded', 'false');
    atlasRoot?.setAttribute(`data-${key}-collapsed`, 'true');

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

  // Place mode tools under „Kartenwerkzeuge“ in the Tools panel (inside slide inner).
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

  return () => {
    for (const fn of cleanups) fn();
  };
}

export function AtlasNative3dEditor({ className }: AtlasNative3dEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    let mount: { dispose: () => void } | null = null;
    let disposePanels: (() => void) | null = null;
    let copyTimer = 0;
    try {
      mount = mountAtlasPrototype3d(host);
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
    };
  }, []);

  return (
    <div
      className={`flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background ${className ?? ''}`}
      data-atlas-native-3d
      data-atlas-proto-exact="true"
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
