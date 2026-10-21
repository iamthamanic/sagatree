# SagaTree UI Styleguide — Character Editor Patterns

Dieses Dokument beschreibt wiederverwendbare UI/UX-Muster aus dem Feature-Branch `feat/attribute-bonus-pool` (Attribute-Bonus-Pool, Hintergrund-Frameworks, Karussell-Connectors). Ziel: konsistente Übernahme in weiteren Editor-Bereichen.

**Konvention:** `.qa/` enthält Acceptance- und QA-Artefakte; `docs/` enthält Regeln und Entwickler-Dokumentation. UI-Patterns liegen hier in `docs/ui-styleguide.md`.

**Charakter-3D-/Art-Look (nicht UI):** siehe [`docs/character-visual-styleguide.md`](character-visual-styleguide.md) — Palworld × Overwatch soft-real, Golden-Refs, Generation-Prompts. Dieses UI-Dokument deckt **keinen** Avatar-Mesh-Stil ab.

**Adaptive / Content-Width:** siehe [`docs/concepts/adaptive-ui-experience-contract.md`](concepts/adaptive-ui-experience-contract.md) (`AU-CONTENT-WIDTH`) und Abschnitt **Page width** unten.

---

## 0. Page width (Journey / Adaptive)

**Wann:** Alle Journey-Screens (Session Join, Library forms, onboarding-ähnliche Flows).

| Regel | Umsetzung |
|---|---|
| Shell main ist Container | Layout: `@container/main` + `data-adaptive-main` |
| Viewport vs Content | Shell-Chrome: `useAdaptiveBand()`; Spalten/Forms: Content-Breite (`useAdaptiveContentBand`, `@[…]/main:…`) |
| Journey-Spalte | `AdaptiveJourneyColumn` → `w-full min-w-0 max-w-2xl` (Soft-Cap, füllt schmale Panes) |
| Page-Shell | `AdaptivePage` — engere Gutters unter `@[40rem]/main`, breitere ab Container-Breite |
| Verboten | Hartes Zentrieren mit großen Seitenrändern + Viewport-`md:` so, dass Primary-CTAs im IDE-Split abgeschnitten werden |

```tsx
import { AdaptiveJourneyColumn, AdaptivePage } from '@/shared/ui/adaptive';

<AdaptivePage data-au-surface="session-join">
  <AdaptiveJourneyColumn className="space-y-4">
    {/* form */}
  </AdaptiveJourneyColumn>
</AdaptivePage>
```

Testflächen: Phone, Tablet, Desktop **und** schmale Main-Panes (Cursor/IDE Split ~360–720 px).

---

## 0b. Iconography (Phosphor)

Canonical rules: [`src/THEME_GUIDE.md`](../src/THEME_GUIDE.md) § Iconography. Package: `@phosphor-icons/react`.

### Sidebar / Hauptnavigation

```tsx
import { House, Books, Storefront } from '@phosphor-icons/react';

<button
  className={
    isActive
      ? 'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground'
      : 'text-sidebar-foreground hover:bg-accent/10 hover:text-accent'
  }
>
  <Books size={20} weight="regular" className="shrink-0" aria-hidden />
</button>
```

Active = Cyan Primary-Surface + `currentColor` (Weight bleibt `regular`, kein `fill`). Hover = Gold/Amber (`accent`), analog zu `Button`. Icon-only: `aria-label` am Button.

### Icon-Button (Action)

```tsx
import { Gear } from '@phosphor-icons/react';
import { Button } from '@/shared/ui/button';

<Button type="button" variant="ghost" size="icon" aria-label="Einstellungen">
  <Gear size={20} weight="regular" aria-hidden />
</Button>
```

### Dashboard-Feature-Karte

```tsx
import { UserPlus } from '@phosphor-icons/react';

<UserPlus size={32} weight="regular" className="size-8" aria-hidden />
```

Dashboard-Karten: `regular` (kein Duotone/Fill). Duotone nur gezielt auf groesseren Feature-Illustrationen.

### Status / Loading

```tsx
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';

<CircleNotch className="size-4 animate-spin" aria-hidden />
<WarningCircle size={16} weight="fill" className="text-destructive" aria-hidden />
```

### RPG-spezifische Symbole

- System-UI → Phosphor.
- Spielwelt (Waffen, Magie, Kreaturen): bestehende Custom-SVGs (z. B. `AttributeD20Icon`) beibehalten; game-icons.net nur lokal + CC-BY-3.0 Attribution.

---

## 1. AttributeD20Icon

**Datei:** `src/shared/ui/AttributeD20Icon.tsx`

**Wann verwenden:** Visuelles Attribut-Symbol auf Attribut-Bonus-Karten im Charakter-Editor (d20 + Attributbonus).

**Visuelle Specs:**

| Eigenschaft | Wert |
|---|---|
| Größe | `size-14` (56×56 px) |
| Wireframe | Grau, `stroke-gray-500/45`, `strokeWidth="1.25"` |
| Ziffer | Weiß `"20"`, `fontSize={10}`, `fontWeight="700"` |
| Form | Pointy-top-Hex + Front-Dreieck + Facetten-Speichen (SVG) |

**Beispiel:**

```tsx
import { AttributeD20Icon } from '@/components/AttributeD20Icon';

<AttributeD20Icon className="my-0.5" />
```

**Deutsche Copy in der Umgebung:** Attributkarten zeigen `+N Bonus` im Select.

---

## 2. Attribut-Bonus-Karten (Grid)

**Datei:** `src/components/CharacterEditor.tsx` (Abschnitt „Attributsbonus (=D20 + Bonus)“)

**Layout:**

- Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`
- Karte: zentriert, `rounded-lg border bg-card p-3`, klickbar für Connector-Fokus
- Kopf: Label + `shortLabel`-Chip (`text-[10px] uppercase`)
- Mitte: `AttributeD20Icon`
- Select: `+0` bis `+4 Bonus`, `min-h-11`

**Budget-Badges (oben rechts):**

- `{used} / 15 Bonuspunkte`
- `{used} / {budget} Entwicklung` (ab Level 8/16)

**Deutsche Labels:**

- „Attributsbonus (=D20 + Bonus)“
- „Permanente Attributentwicklung“
- „Permanente Entwicklung (Level 8|16)“ — Select-Label, kein `+1`
- Attributbonus-RuleHelp: Bonuspunkte-Verteilung (ohne „+0 bis +4“ im Opening), Level-8/16-Entwicklung, +0-Erklärung, Bonus-Obergrenzen-Liste, Hinweis zu Charakteren mit Bonuspunktveränderung (Beispiel Level 8: Cap +5, 16 statt 15 Punkte)
- Level-Guide-Tooltip (gruppiert): `Level 1–7: Bonus max. +4 (Basisverteilung)` · `Level 8–15: Bonus max. +5 (1 zusätzlicher Bonuspunkt darf auf ein Grundattribut verteilt werden)` · `Level 16+: Bonus max. +5 (1 zusätzlicher Bonuspunkt darf auf ein Grundattribut verteilt werden.)`
- „Reguläres Maximum: +5“

---

## 3. Karussell-Basis (Embla + useCarouselScrollSync)

**Hook:** `src/modules/characters/hooks/useCarouselScrollSync.ts`  
**Typ:** `src/modules/characters/hooks/carousel.types.ts` → `CarouselScrollPhase`

**Implementierungen:**

| Komponente | Datei |
|---|---|
| Spezies | `SpeciesCarousel.tsx` |
| Archetyp | `ArchetypeCarousel.tsx` |
| Hintergrund-Framework | `BackgroundCarousel.tsx` |
| Essenz (geplant) | `EssenceCarousel.tsx` — noch nicht implementiert; `CharacterEssencePanel.tsx` nutzt derzeit ein Grid |

### Embla-Optionen (einheitlich)

```tsx
opts={{
  align: 'center',
  loop: true,
  skipSnaps: false,
  dragFree: false,
  containScroll: 'trimSnaps',
  duration: 25,
}}
```

### Slide-Breiten

`basis-[64%] sm:basis-[52%] md:basis-[40%] lg:basis-[34%] pl-1.5`

### Center-Slide-Styling (CSS-in-JS pro Karussell)

- Nicht-zentriert: `opacity: 0.62`, `blur(1px)`, `scale(0.9)`
- Zentriert (`.is-center`): volle Opazität, `scale(1)`, `z-index: 10`
- Transition: `0.4s cubic-bezier(0.4, 0, 0.2, 1)`

### Nav-Buttons

- Absolut über dem Karussell, `pointer-events: none` auf Container
- Buttons: `h-10 w-10 md:h-11 md:w-11`, `rounded-full`, `top-[28%]`
- ARIA: „Vorheriger …“ / „Nächster …“

### Scroll-Sync-Muster (Hook)

**Problem:** Programmatisches `scrollTo` feuert Embla-`select` → doppelte `onSelect`-Calls.  
**Lösung:** `skipSelectRef` — nur synchronisieren, wenn `selectionSyncKey` sich ändert.

```tsx
const { setApi, current, handleCardClick, scrollPrev, scrollNext } = useCarouselScrollSync({
  optionsLength: options.length,
  getSelectedIndex: () => options.findIndex(/* match external selection */),
  getValueAtIndex: (index) => options[index]?.value,
  isSelectionUnset: () => !selectedValue,           // Auto-Select beim Mount
  shouldSyncScrollToSelection: () => true,
  selectionSyncKey: selectedValue,                  // Re-sync nur bei ID-Wechsel
  shouldEmitSelect: (_i, value) => value !== selectedValue,
  onSelect,
  onScrollPhaseChange,                              // optional, für Connectors
  selectOnCenterClick: false,                         // Background: true
});
```

**Scroll-Phase (Connectors):** `scrolling` bei Bewegung, `settled` nach 120 ms ohne `scroll`-Event.

---

## 4. BackgroundCarousel (Hintergrund-Framework)

**Datei:** `src/modules/characters/components/BackgroundCarousel.tsx`

**Wann verwenden:** Auswahl eines Hintergrund-Frameworks oder „Eigener Hintergrund“.

**Besonderheiten:**

- Phosphor-Icons pro Framework (`BACKGROUND_FRAMEWORK_ICON_BY_ID`)
- Custom-Karte: gestrichelter Rand, `PencilSimpleLine`-Icon
- `selectOnCenterClick: true` — Center-Klick bestätigt Auswahl (Embla schluckt oft reinen Center-Click)
- Badge „Gewählt“ nur wenn zentriert **und** ausgewählt
- Skill-Pool-Badges nur auf Center-Slide sichtbar

**Deutsche Copy:**

- „Hintergrund Framework“ / „Freier Hintergrund“
- „Gewählt“
- „Eigener Hintergrund“

---

## 5. ArchetypeCarousel

**Datei:** `src/modules/characters/components/ArchetypeCarousel.tsx`

**Wann verwenden:** Primärarchetyp-Auswahl unter Parameter → Archetype.

**Besonderheiten:**

- `ArchetypeIcon` in Hero-Bereich (`aspect-[8/7]`)
- Collapsible für Kernfähigkeit nur auf Center-Slide
- `selectOnCenterClick: false` — Center-Klick scrollt nicht erneut
- Connector-Integration via `onScrollPhaseChange` → `ArchetypeSkillChoice`

---

## 6. EssenceCarousel (Zielbild)

**Aktuell:** `CharacterEssencePanel.tsx` — Grid `sm:grid-cols-2 xl:grid-cols-3`.

**Empfohlene Migration:** Gleiches Karussell-Muster wie Archetyp/Background:

1. `EssenceCarousel.tsx` anlegen (Kopie von `ArchetypeCarousel` als Vorlage)
2. `useCarouselScrollSync` mit `sagaTreeEssenceOptions`
3. Manifestations-Vorschau im Center-Slide (wie jetzt im Grid bei `selected`)

**Deutsche Copy:** „Primäre Essenz“, „Essenz-Manifestation“, „Rang I · geplant“.

---

## 7. Background Training Node Graph

**Datei:** `src/modules/characters/components/CharacterBackgroundPanel.tsx`  
**Hook:** `src/modules/characters/hooks/useSelectionGraph.ts`

### Ablauf

1. **Pool-Ansicht:** 4 Skill-Nodes (`xl:grid-cols-4`)
2. **Auswahl:** 2 Trainings klicken → `Hintergrund +1`
3. **Swap bei 2/2:** Graph zeigt nur noch 2 Nodes; „Auswahl ändern“ aktiviert Edit-Modus
4. **Spezialisierung:** Branch unter gewähltem Node nach 2/2

### Node-Specs

- `flex min-h-28 flex-col items-center justify-center rounded-lg border p-3 text-center`
- Selected: `border-primary bg-primary/5` + Check-Icon
- Badges: `Pool` / `Hintergrund +1`
- Spezialisierung-Branch: vertikale Linie `border-l border-primary/60`, Badge `+2 auf passende Checks`

### Connector (SVG)

**Komponente:** `BackgroundSkillConnector` (inline in Panel)

- Misst `.background-carousel-item.is-center [data-slot="card"]` → `[data-background-skill-grid]`
- `scrollPhase === 'scrolling'`: Geometrie eingefroren, Overlay ausgeblendet
- Standstill-Watcher: 3 stabile rAF-Frames (±0.5 px) → `onStandstill`
- Animierte Primary-Route für trainierte Skills (Marching Ants)

**Data-Attribute:**

```html
<section data-background-panel>
  <div data-background-skill-grid data-training-view="pool|selected">
    <div data-background-skill-node="{skillKey}">...</div>
  </div>
</section>
```

### useSelectionGraph API

```tsx
const {
  visibleNodes,
  viewMode,           // 'pool' | 'selected'
  isComplete,
  editing,
  activeItem,
  setActiveItem,
  isNodeDisabled,
  handleToggleComplete,
  startEditing,
  cancelEditing,
} = useSelectionGraph({
  poolItems: poolSkills,
  selectedItems: trainedSkills,
  maxSelections: 2,
  resetKey: `${templateId}|${poolIdentity}`,
});
```

---

## 8. Connector-Pattern (Archetyp + Hintergrund)

**Referenz:** `ArchetypeSkillChoice.tsx` → `ArchetypeConnector`

Gemeinsame Regeln:

1. `CarouselScrollPhase` vom Karussell nach oben reichen
2. Während `scrolling`: kein `measure()`, Overlay `opacity: 0`
3. Bei `settled`: `measure()` + SVG-Remount via `fadeGeneration`-Key
4. ResizeObserver auf Connector + Skill-Grid
5. `aria-hidden="true"` — rein dekorativ

---

## 9. Wiederverwendbare Hooks — Übersicht

| Hook | Pfad | Zweck |
|---|---|---|
| `useCarouselScrollSync` | `src/modules/characters/hooks/useCarouselScrollSync.ts` | Embla index sync, skipSelect, scroll phase |
| `useSelectionGraph` | `src/modules/characters/hooks/useSelectionGraph.ts` | Pool → N-of-M Auswahl, Edit-Modus |
| `CarouselScrollPhase` | `src/modules/characters/hooks/carousel.types.ts` | `'scrolling' \| 'settled'` |

**Re-Export:** `ArchetypeCarousel` exportiert `CarouselScrollPhase` weiterhin für Abwärtskompatibilität.

---

## 10. Deutsche Copy-Muster

| Kontext | Muster |
|---|---|
| Auswahl bestätigt | „Gewählt“ |
| Fortschritt | `{n} / {max}` in Badge |
| Training | „Training · 2 wählen“, „Hintergrund +1“ |
| Validierung offen | „… offen“ / „… vollständig“ |
| Regelhilfe | `RuleHelp` mit `label` = sichtbarer Titel |
| Platzhalter Select | „Attribut wählen“, „Fertigkeit {n}“ |

---

## 11. Checkliste für neue Karussell-Komponenten

- [ ] `useCarouselScrollSync` statt duplizierter `useEffect`-Blöcke
- [ ] Einheitliche Embla-`opts` und Slide-Breiten
- [ ] `.is-center`-Klasse an `CarouselItem` wenn `index === current`
- [ ] `role="radiogroup"` + `role="radio"` + `aria-checked={isSelected && isCenter}`
- [ ] Nav-Buttons nur wenn `options.length > 1`
- [ ] Bei Connector-Anbindung: `onScrollPhaseChange` durchreichen
- [ ] Komponenten-Kommentar oben: Zweck + Pfad

---

## 12. Tooltip-Interaktion (Hover + Klick-Pin)

**Primitive:** `src/components/ui/tooltip.tsx`  
**Hook:** `src/components/ui/useTooltipPin.ts`  
**Wrapper:** `RuleHelp` (`src/modules/characters/components/RuleHelp.tsx`)

Alle Tooltips nutzen standardmäßig `pinOnClick` (Default: `true`).

| Interaktion | Verhalten |
|---|---|
| **Hover** auf Trigger | Tooltip erscheint kurz als Vorschau; schließt beim Verlassen des Triggers (bleibt **nicht** offen) |
| **Klick** auf Trigger | Tooltip öffnet sich und **bleibt** offen (gepinnt) |
| **Erneuter Klick** auf Trigger | Pin aufheben, Tooltip schließen |
| **Klick außerhalb** | Pin aufheben (nur wenn gepinnt) |
| **Escape** | Pin aufheben (nur wenn gepinnt); bei reiner Hover-Vorschau schließt Radix normal |

**Technik:**

- `useTooltipPin` verwaltet `pinned` (Klick) und `hoverOpen` (Hover) → `open = pinned || hoverOpen`
- `disableHoverableContent={!pinned}` — Hover-Vorschau schließt beim Verlassen des Triggers; gepinnte Tooltips erlauben Hover über den Inhalt (z. B. scrollbare Regeltexte)
- `TooltipTrigger` toggelt Pin bei Klick/Enter/Leerzeichen
- `TooltipContent` entlässt Pin bei `onPointerDownOutside` und `onEscapeKeyDown`

**Beispiel (Regelhilfe):**

```tsx
import { RuleHelp } from '@/modules/characters/components/RuleHelp';

<RuleHelp label="Attributbonus" contentClassName="max-h-48 overflow-y-auto">
  Langer Regeltext …
</RuleHelp>
```

**Klassisches Hover-only** (z. B. Sidebar): `<Tooltip pinOnClick={false}>…</Tooltip>`

**Controlled Pin** (selten): `open` / `onOpenChange` steuern nur den Pin-Zustand; Hover-Vorschau bleibt uncontrolled.

---

## Verwandte Dokumente

- `docs/character-visual-styleguide.md` — **Avatar-/Charakter-Art-Look** (getrennt von diesem UI-Guide)
- `docs/attribute-bonus-pool-rules-amendment.md` — **SUPERSEDED**; kanonisch: `docs/sagatree core rules.md` §3.2/§3.3/§3.7
- `docs/sagatree-background-competency-rules.md` — Hintergrund-Kompetenzen
- `.qa/design/background-competency-system.md` — UX-Design Hintergrund
- `.qa/acceptance/attribute-bonus-pool.md` — Acceptance Attribute-Bonus
- `.qa/acceptance/background-frameworks.md` — Acceptance Frameworks
