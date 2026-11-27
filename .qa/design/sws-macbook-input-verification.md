# SWS-06 — MacBook Trackpad Hardware Verification Checklist (E6)

- **Status:** Implementiert (`src/infrastructure/world/atlas-three/atlas-unified-input.ts`, verdrahtet in `AtlasThreeWorkstation.tsx`); automatisierte Unit-Abdeckung in `scripts/sws-renderer-input-history.self-test.mjs`.
- **Warum Hardware-Test verbindlich:** Playwright/Chromium-Headless kann native macOS-Trackpad-Pinch-Events (`ctrlKey + wheel` mit kontinuierlicher Trackpad-Beschleunigung sowie WebKit/Safari `gesturestart`/`gesturechange`/`gestureend`) nicht vollständig hardwaregetreu emulieren (ADR-SWS-01 §7.2, Checkliste E6).

## Manuelle Prüf-Schritte auf echtem MacBook (Chrome + Safari)

1. **Trackpad-Pinch (Chromium / Edge / Firefox)**
   - Atlas im 3D-Modus öffnen, Cursor über Dornhain positionieren, mit zwei Fingern aufziehen/zusammenziehen.
   - **Soll:** Kontinuierlicher Zoom exakt auf den Cursorpunkt; **kein** Browser-Page-Zoom (`preventDefault` über `{ passive: false }`).
2. **Trackpad-Pinch (Safari)**
   - Gleiche Geste in Safari (`gesturestart` → `gesturechange` → `gestureend`).
   - **Soll:** Kontinuierlicher Zoom zum Cursor; **kein** Safari-Viewport-Zoom.
3. **Zwei-Finger-Scroll = Pan**
   - Zwei Finger horizontal/vertikal über das Trackpad ziehen (ohne `ctrlKey`).
   - **Soll:** Kamera schwenkt flüssig in der Kartenebene (respektiert aktuellen `yawRad`), kein ungewollter Zoom.
4. **Orbit (Shift+Drag / Rechts-Drag / Shift+Scroll)**
   - `Shift` halten + Drag (oder Rechtsklick-Drag / `Shift` + Zwei-Finger-Scroll).
   - **Soll:** Sanfter Orbit (Yaw) und Tilt (Pitch) innerhalb der Mode-Clamps.
5. **Mode-Wechsel ohne Yaw-Reset (E2)**
   - Karte auf z. B. ~65° drehen, zwischen **Diorama** und **Draufsicht (2D/Satellit)** umschalten und zurück.
   - **Soll:** Fokus, Span und Yaw (~65°) bleiben exakt erhalten (kein harter Reset auf 0°).
6. **3D Undo/Redo Batching (F1–F3)**
   - Objekt im 3D-Modus verschieben (`W`), drehen (`E`), skalieren (`T`), Terrain formen und Biom malen; anschließend `Cmd+Z` / `Cmd+Shift+Z`.
   - **Soll:** Jede Drag-Geste ist genau **ein** Undo-Schritt, der den exakten Vor-Geste-Zustand wiederherstellt.
