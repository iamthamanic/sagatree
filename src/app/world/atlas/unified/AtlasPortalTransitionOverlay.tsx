/**
 * AtlasPortalTransitionOverlay — Thematic 3D portal & atmospheric flight transitions.
 * Location: src/app/world/atlas/unified/AtlasPortalTransitionOverlay.tsx
 *
 * Pure UI presentation (no Three.js, no Host):
 *  - `flight-in` / `flight-out`: GPU-composited WebGL snapshot cross-dive / pull-back
 *    with subtle atmospheric haze for silky Google-Earth outdoor scale changes.
 *  - `tavern-doors`: 3D-perspective carved oak tavern double doors with iron hinges &
 *    warm hearth light swinging smoothly open as you step inside a building.
 *  - `crypt-gate`: Carved ancient stone crypt archway with rising wrought-iron portcullis
 *    & flickering torch sconces as you descend into a dungeon/cave.
 *  - `outdoor-exit`: Warm sunlit doorway pull-out when leaving an interior back outdoors.
 */
import { useEffect, useState } from 'react';
import type { AtlasPortalTransitionKind } from '../../../../domains/world/atlas';

export type AtlasPortalTransitionState = {
  readonly id: number;
  readonly kind: AtlasPortalTransitionKind;
  readonly label: string | null;
  readonly snapshotUrl: string | null;
};

type Props = {
  readonly transition: AtlasPortalTransitionState | null;
};

export function AtlasPortalTransitionOverlay({ transition }: Props) {
  const [phase, setPhase] = useState<'enter' | 'open'>('enter');

  useEffect(() => {
    if (!transition) return;
    setPhase('enter');
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setPhase('open');
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [transition?.id]);

  if (!transition) return null;

  const isOpen = phase === 'open';
  const { kind, label, snapshotUrl } = transition;

  if (kind === 'flight-in' || kind === 'flight-out') {
    const zoomIn = kind === 'flight-in';
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[9] overflow-hidden"
        data-atlas-portal-transition={kind}
        aria-hidden
      >
        {snapshotUrl ? (
          <img
            src={snapshotUrl}
            alt=""
            className="h-full w-full object-cover transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-150"
            style={{
              transform: isOpen ? (zoomIn ? 'scale(1.42)' : 'scale(0.74)') : 'scale(1)',
              opacity: isOpen ? 0 : 1,
              filter: isOpen ? 'blur(4px)' : 'blur(0px)',
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:duration-150"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,244,218,0.16) 0%, rgba(15,23,42,0.42) 100%)',
            opacity: isOpen ? 0 : 0.72,
          }}
        />
        {label ? (
          <div
            className="absolute inset-x-0 bottom-20 flex justify-center transition-[opacity,transform] duration-500 ease-out"
            style={{
              opacity: isOpen ? 0 : 0.96,
              transform: isOpen ? 'translateY(-8px) scale(1.04)' : 'translateY(0px) scale(1)',
            }}
          >
            <span className="rounded-full border border-amber-300/40 bg-slate-950/75 px-4 py-1.5 font-heading text-base font-bold tracking-wide text-amber-100 shadow-2xl backdrop-blur-md">
              {label}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  if (kind === 'outdoor-exit') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[9] overflow-hidden transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-150"
        data-atlas-portal-transition="outdoor-exit"
        style={{
          opacity: isOpen ? 0 : 1,
          transform: isOpen ? 'scale(0.92)' : 'scale(1.12)',
          background:
            'radial-gradient(circle at 50% 48%, rgba(255,246,214,0.88) 0%, rgba(255,222,162,0.45) 38%, rgba(15,23,42,0.86) 82%)',
        }}
        aria-hidden
      />
    );
  }

  if (kind === 'tavern-doors') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[9] overflow-hidden transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-150"
        data-atlas-portal-transition="tavern-doors"
        style={{
          perspective: '1150px',
          opacity: isOpen ? 0 : 1,
          transform: isOpen ? 'scale(1.16)' : 'scale(1)',
        }}
        aria-hidden
      >
        {/* Warm hearth light spilling from inside as the double oak doors swing open */}
        <div
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{
            background:
              'radial-gradient(ellipse at 50% 54%, rgba(255,204,112,0.82) 0%, rgba(217,119,6,0.34) 36%, rgba(15,23,42,0.72) 85%)',
            opacity: isOpen ? 0.12 : 0.9,
          }}
        />

        {/* Carved timber & stone outer frame */}
        <div
          className="absolute inset-0 border-[14px] border-stone-900/95 shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Left Carved Oak Door Leaf */}
          <div
            className="absolute inset-y-0 left-0 w-1/2 origin-left transition-transform duration-700 ease-[cubic-bezier(0.25,0.9,0.3,1)] motion-reduce:duration-150"
            style={{
              transform: isOpen ? 'rotateY(-84deg)' : 'rotateY(0deg)',
              background:
                'linear-gradient(90deg, #2d1b10 0%, #4b2e1b 45%, #3a2314 94%, #1c1009 100%)',
              boxShadow: 'inset -6px 0 18px rgba(0,0,0,0.65)',
            }}
          >
            <svg viewBox="0 0 400 800" preserveAspectRatio="none" className="h-full w-full opacity-90">
              {/* Vertical oak planks */}
              <line x1="100" y1="0" x2="100" y2="800" stroke="#1e1109" strokeWidth="4" />
              <line x1="200" y1="0" x2="200" y2="800" stroke="#1e1109" strokeWidth="4" />
              <line x1="300" y1="0" x2="300" y2="800" stroke="#1e1109" strokeWidth="4" />
              {/* Wrought-iron strap hinges & studs */}
              <rect x="0" y="155" width="320" height="32" rx="4" fill="#1e242b" />
              <rect x="0" y="615" width="320" height="32" rx="4" fill="#1e242b" />
              <circle cx="54" cy="171" r="6" fill="#475569" />
              <circle cx="150" cy="171" r="6" fill="#475569" />
              <circle cx="255" cy="171" r="6" fill="#475569" />
              <circle cx="54" cy="631" r="6" fill="#475569" />
              <circle cx="150" cy="631" r="6" fill="#475569" />
              <circle cx="255" cy="631" r="6" fill="#475569" />
              {/* Brass ring handle near center seam */}
              <circle cx="348" cy="410" r="22" fill="none" stroke="#eab308" strokeWidth="7" />
              <circle cx="348" cy="390" r="8" fill="#ca8a04" />
            </svg>
          </div>

          {/* Right Carved Oak Door Leaf */}
          <div
            className="absolute inset-y-0 right-0 w-1/2 origin-right transition-transform duration-700 ease-[cubic-bezier(0.25,0.9,0.3,1)] motion-reduce:duration-150"
            style={{
              transform: isOpen ? 'rotateY(84deg)' : 'rotateY(0deg)',
              background:
                'linear-gradient(270deg, #2d1b10 0%, #4b2e1b 45%, #3a2314 94%, #1c1009 100%)',
              boxShadow: 'inset 6px 0 18px rgba(0,0,0,0.65)',
            }}
          >
            <svg viewBox="0 0 400 800" preserveAspectRatio="none" className="h-full w-full opacity-90">
              <line x1="100" y1="0" x2="100" y2="800" stroke="#1e1109" strokeWidth="4" />
              <line x1="200" y1="0" x2="200" y2="800" stroke="#1e1109" strokeWidth="4" />
              <line x1="300" y1="0" x2="300" y2="800" stroke="#1e1109" strokeWidth="4" />
              <rect x="80" y="155" width="320" height="32" rx="4" fill="#1e242b" />
              <rect x="80" y="615" width="320" height="32" rx="4" fill="#1e242b" />
              <circle cx="145" cy="171" r="6" fill="#475569" />
              <circle cx="250" cy="171" r="6" fill="#475569" />
              <circle cx="346" cy="171" r="6" fill="#475569" />
              <circle cx="145" cy="631" r="6" fill="#475569" />
              <circle cx="250" cy="631" r="6" fill="#475569" />
              <circle cx="346" cy="631" r="6" fill="#475569" />
              <circle cx="52" cy="410" r="22" fill="none" stroke="#eab308" strokeWidth="7" />
              <circle cx="52" cy="390" r="8" fill="#ca8a04" />
            </svg>
          </div>
        </div>

        {/* Carved wooden nameplate crest */}
        {label ? (
          <div
            className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center transition-[opacity,transform] duration-500 ease-out"
            style={{
              opacity: isOpen ? 0 : 1,
              transform: isOpen ? 'translateY(-60%) scale(1.12)' : 'translateY(-50%) scale(1)',
            }}
          >
            <span className="rounded-lg border border-amber-400/60 bg-stone-950/90 px-5 py-2 font-heading text-lg font-bold tracking-wide text-amber-200 shadow-2xl">
              {label}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  // `crypt-gate`: Ancient stone dungeon archway + rising heavy wrought-iron portcullis grate!
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[9] overflow-hidden transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-150"
      data-atlas-portal-transition="crypt-gate"
      style={{
        opacity: isOpen ? 0 : 1,
        transform: isOpen ? 'scale(1.22)' : 'scale(1)',
      }}
      aria-hidden
    >
      {/* Flickering torchlight & dungeon stone shadow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 56%, rgba(245,158,11,0.28) 0%, rgba(15,23,42,0.88) 62%, rgba(2,6,23,0.98) 100%)',
        }}
      />

      {/* Rising Wrought-Iron Portcullis Grate */}
      <div
        className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.32,0.84,0.32,1)] motion-reduce:duration-150"
        style={{
          transform: isOpen ? 'translateY(-94%)' : 'translateY(0%)',
        }}
      >
        <svg viewBox="0 0 1200 800" preserveAspectRatio="none" className="h-full w-full">
          {/* Vertical iron bars with pointed spikes at bottom */}
          {[120, 240, 360, 480, 600, 720, 840, 960, 1080].map((x) => (
            <g key={x}>
              <rect x={x - 10} y={0} width={20} height={740} fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
              <polygon points={`${x - 10},740 ${x + 10},740 ${x},788`} fill="#334155" />
            </g>
          ))}
          {/* Heavy horizontal iron crossbars */}
          {[140, 320, 500, 680].map((y) => (
            <rect
              key={y}
              x={0}
              y={y}
              width={1200}
              height={24}
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="3"
            />
          ))}
        </svg>
      </div>

      {/* Carved Stone Archway Silhouette */}
      <svg viewBox="0 0 1200 800" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path
          d="M0,0 H1200 V800 H1020 V360 C1020,160 840,70 600,70 C360,70 180,160 180,360 V800 H0 Z"
          fill="#0f172a"
          fillOpacity="0.96"
        />
        {/* Dual amber torchlight blooms on stone jambs */}
        <circle cx="155" cy="390" r="56" fill="rgba(251, 146, 60, 0.34)" />
        <circle cx="155" cy="390" r="14" fill="#fbbf24" />
        <circle cx="1045" cy="390" r="56" fill="rgba(251, 146, 60, 0.34)" />
        <circle cx="1045" cy="390" r="14" fill="#fbbf24" />
      </svg>

      {label ? (
        <div
          className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center transition-[opacity,transform] duration-500 ease-out"
          style={{
            opacity: isOpen ? 0 : 1,
            transform: isOpen ? 'translateY(-64%) scale(1.1)' : 'translateY(-50%) scale(1)',
          }}
        >
          <span className="rounded-lg border border-amber-500/45 bg-slate-950/92 px-5 py-2 font-heading text-lg font-bold tracking-wider text-amber-100 shadow-2xl">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
