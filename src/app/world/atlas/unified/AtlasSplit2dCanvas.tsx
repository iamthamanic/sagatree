/**
 * AtlasSplit2dCanvas — Synchronized 2D cartography pane for Split 2D + 3D workstation mode.
 * Location: src/app/world/atlas/unified/AtlasSplit2dCanvas.tsx
 *
 * Renders the exact canonical `UnifiedCanvasDoc` in crisp cartographic 2D alongside
 * the live Three.js 3D viewport (no Three.js imports; pure Canvas2D).
 */
import { useEffect, useRef, useState } from 'react';
import { MapPin } from '@phosphor-icons/react';
import type { AtlasMapPin, AtlasMapScale, UnifiedCanvasDoc } from '../../../../domains/world/atlas';

const MATERIAL_FILL: Readonly<Record<string, string>> = {
  wasser: '#1d586c',
  gras: '#5b8a57',
  erde: '#9e835c',
  sand: '#d8c598',
  stein: '#7e8682',
  pflaster: '#a59e8d',
  holz: '#8f6440',
  moos: '#4e7b59',
  schnee: '#e4edf2',
};

const MATERIAL_STROKE: Readonly<Record<string, string>> = {
  wasser: '#3d8fa1',
  gras: '#3c6139',
  erde: '#735d3e',
  sand: '#b59f6e',
  stein: '#575f5c',
  pflaster: '#6e685a',
  holz: '#5c3d22',
};

export type AtlasSplit2dCanvasProps = {
  readonly doc: UnifiedCanvasDoc;
  readonly mapScale: AtlasMapScale;
  readonly mapPins: readonly AtlasMapPin[];
  readonly activePlaceId: string | null;
  readonly onSelectPin?: (pin: AtlasMapPin) => void;
};

export function AtlasSplit2dCanvas({
  doc,
  mapScale,
  mapPins,
  activePlaceId,
  onSelectPin,
}: AtlasSplit2dCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 480, height: 480 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(120, Math.floor(entry.contentRect.width));
      const h = Math.max(120, Math.floor(entry.contentRect.height));
      setSize({ width: w, height: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute uniform fit transform from [0..1000] world space to canvas pixels.
  const pad = 20;
  const scale = Math.min((size.width - pad * 2) / 1000, (size.height - pad * 2) / 1000);
  const offX = (size.width - 1000 * scale) / 2;
  const offY = (size.height - 1000 * scale) / 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(size.width * dpr));
    canvas.height = Math.max(1, Math.floor(size.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background sea / interior slate
    const bg = ctx.createRadialGradient(
      size.width * 0.5,
      size.height * 0.5,
      size.width * 0.08,
      size.width * 0.5,
      size.height * 0.5,
      size.width * 0.72,
    );
    if (mapScale === 'interior') {
      bg.addColorStop(0, '#1e293b');
      bg.addColorStop(1, '#0f172a');
    } else {
      bg.addColorStop(0, '#225f73');
      bg.addColorStop(1, '#123847');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.width, size.height);

    ctx.translate(offX, offY);
    ctx.scale(scale, scale);

    // Subtle cartographic grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 / Math.max(0.05, scale);
    for (let g = 0; g <= 1000; g += 100) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 1000);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(1000, g);
      ctx.stroke();
    }

    // 1) Rooms / Landmasses / Lakes
    for (const room of doc.rooms) {
      if (room.id === 'w.ocean' || room.id === 'g.ocean') {
        if (mapScale === 'settlement') {
          ctx.fillStyle = '#4e764d';
          ctx.fillRect(room.x, room.y, room.w, room.h);
        }
        continue;
      }
      ctx.beginPath();
      if (room.points && room.points.length >= 3) {
        room.points.forEach(([px, py], i) => {
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
      } else {
        ctx.rect(room.x, room.y, room.w, room.h);
      }
      ctx.fillStyle = MATERIAL_FILL[room.material] ?? '#5b8a57';
      ctx.fill();
      ctx.strokeStyle = MATERIAL_STROKE[room.material] ?? 'rgba(15,23,42,0.45)';
      ctx.lineWidth = Math.max(1.5, 2 / Math.max(0.1, scale));
      ctx.stroke();
    }

    // 2) Smooth heightfield contours (when present)
    if (doc.heightfield && doc.layers.terrain !== false) {
      const hf = doc.heightfield;
      for (let r = 0; r + 1 < hf.rows; r += 1) {
        for (let c = 0; c + 1 < hf.cols; c += 1) {
          const h = hf.heights[r * hf.cols + c] ?? 0;
          if (h <= 1) continue;
          const x = hf.originX + c * hf.cellSize;
          const y = hf.originZ + r * hf.cellSize;
          ctx.fillStyle =
            h > 20
              ? 'rgba(226, 232, 240, 0.36)'
              : h > 10
                ? 'rgba(148, 163, 184, 0.24)'
                : 'rgba(134, 239, 172, 0.16)';
          ctx.fillRect(x, y, hf.cellSize + 0.5, hf.cellSize + 0.5);
        }
      }
    }

    // 3) Rivers, mountain ridges, and roads
    if (doc.layers.roads !== false) {
      for (const stroke of doc.strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        stroke.points.forEach(([px, py], i) => {
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, stroke.width);
        ctx.strokeStyle = MATERIAL_FILL[stroke.material] ?? '#a59e8d';
        ctx.stroke();
      }
    }

    // 4) Walls
    for (const wall of doc.walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.lineCap = 'square';
      ctx.lineWidth = Math.max(4, wall.width);
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();
    }

    // 5) Canonical Objects
    if (doc.layers.objects !== false) {
      for (const obj of doc.objects) {
        const rad = Math.max(5, obj.size * 22);
        ctx.beginPath();
        if (obj.type === 'haus' || obj.type === 'turm') {
          ctx.fillStyle = '#e8b679';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.rect(obj.x - rad, obj.y - rad * 0.8, rad * 2, rad * 1.6);
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'baum' || obj.type === 'tanne') {
          ctx.fillStyle = '#2d6a4f';
          ctx.arc(obj.x, obj.y, rad * 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'fels') {
          ctx.fillStyle = '#94a3b8';
          ctx.moveTo(obj.x, obj.y - rad);
          ctx.lineTo(obj.x + rad, obj.y + rad * 0.7);
          ctx.lineTo(obj.x - rad, obj.y + rad * 0.7);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = '#f59e0b';
          ctx.arc(obj.x, obj.y, Math.max(4, rad * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }, [doc, mapScale, offX, offY, scale, size.height, size.width]);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border bg-[#0f172a]"
      data-atlas-split-2d
    >
      <div className="z-[2] flex items-center justify-between border-b border-border bg-card/95 px-3 py-1.5 text-xs">
        <span className="font-semibold text-foreground">2D-Kartografie (Live-Sync)</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {doc.rooms.length} Flächen · {doc.objects.length} Objekte
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label="Synchronisierte 2D-Kartenansicht"
        />
        {mapPins.map((pin) => {
          const left = offX + pin.x * scale;
          const top = offY + pin.y * scale;
          const active = activePlaceId === pin.id;
          return (
            <button
              key={pin.id}
              type="button"
              style={{ left, top }}
              className={`absolute z-[3] flex min-h-8 -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow backdrop-blur transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-primary/60 bg-card/90 text-foreground hover:border-accent hover:bg-accent hover:text-accent-foreground'
              }`}
              onClick={() => onSelectPin?.(pin)}
            >
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span>{pin.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
