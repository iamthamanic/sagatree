# SagaTree UI Generation Guidelines

Diese Regeln gelten fuer neue und ueberarbeitete SagaTree-Produktoberflaechen. `src/THEME_GUIDE.md` ist die kanonische visuelle Detailreferenz. UI-Primitives unter `src/shared/ui/` sind die technische Source of Truth.

Vor Generierung oder Umsetzung zuerst klassifizieren:
- `SETUP`: klassische Konfigurations-/Editor-UI ist erlaubt.
- `PERFORMANCE`: `docs/concepts/conductor-experience-contract.md` lesen und CE-Gates anwenden.
- Visualisierung/Scene/Program/Viewer/3D: zusaetzlich `docs/concepts/imagination-first-visualization-contract.md` lesen und IV-Gates anwenden.

"Premium", "cinematic", "immersive" oder "smooth" duerfen nie allein als Designanforderung interpretiert werden; die Agenten muessen diese Begriffe in messbare Interaktions-, Motion-, Fokus-, Detail- und State-Regeln uebersetzen.

## Grundstil

- Produkt-UI, keine Marketing-Landingpage-Aesthetik.
- Dark-first, klar, ruhig, hochwertig und funktional.
- Bestehende Radix/shadcn-Komponenten wiederverwenden statt lokale Sonderloesungen zu bauen.
- Darker Grotesque als UI-Schrift beibehalten.
- Keine zufaelligen Farben ausserhalb der SagaTree-CI.
- Controls muessen auch ohne Hover oder Focus eindeutig als Controls erkennbar sein.
- Touch Targets fuer wichtige Controls mindestens 44px hoch.

## Brand-Farbrollen

SagaTree verwendet zwei Markenfarben mit festen semantischen Rollen:

### Cyan / Teal: Auswahl und wichtigste Aktion

- Light: `#0891B2`
- Dark: `#06B6D4`
- Aktiver Tab: gefuellter Cyan-/Teal-Zustand.
- Primaere CTA: gefuellter Cyan-/Teal-Button.
- Focus-Ringe, Links, Progress und Navigation bleiben ebenfalls Cyan.
- Nicht fuer Fehler-, Disabled- oder Premium-Dekoration verwenden.

### Gold / Amber: Hover und Premium-Akzent

- Light: `#E8A641`
- Dark: `#F59E0B`
- Hover auf primaeren CTAs und aktiven Tabs.
- Hover auf Outline/Ghost und inaktiven Tabs.
- Level-, Achievement- und Premium-Akzente.
- Nicht als Standard-Auswahlzustand verwenden.

Merksatz: **Cyan = ausgewaehlt oder wichtigste Aktion. Gold = Hover und Premium-Akzent.**

## Buttons

- `Button` ohne Variant ist die primaere CTA und wird Cyan/Teal dargestellt; Hover wechselt zu Gold.
- Pro Abschnitt nach Moeglichkeit nur eine visuell dominante primaere CTA.
- `outline` fuer sekundaere Aktionen. Neutral im Ruhezustand, Gold bei Hover.
- `secondary` fuer untergeordnete gefuellte Aktionen.
- `ghost` fuer tertiaere Aktionen.
- `destructive` bleibt rot und wird niemals durch Brand-Farben ersetzt.
- Keine lokalen `bg-yellow-*`, `bg-blue-*` oder Hex-Hardcodes fuer Standardaktionen.

## Tabs

- Aktiver Tab: `bg-primary text-primary-foreground border-primary`.
- Inaktiver Tab: neutral.
- Hover auf inaktiven Tabs: dezentes Gold/Amber.
- Focus: sichtbarer Cyan/Teal-Ring.
- Aktive Tabs duerfen auf Hover zu Gold wechseln.

## Forms

- Label immer oberhalb des Controls.
- Input, Textarea und Select haben im Ruhezustand einen sichtbaren 1px-Rahmen.
- Placeholder darf nicht als einziges Label dienen.
- Selects, Inputs und Textareas verwenden dieselbe Border-, Hover- und Focus-Hierarchie.
- Invalid und Disabled States muessen ohne Farbverwechslung erkennbar bleiben.

## Cards und Panels

- Cards nur fuer echte Hierarchie verwenden.
- Standard-Panel: dunkle Surface, subtil sichtbarer Border, sehr zurueckhaltender Shadow.
- Keine Neon-Glows oder zufaelligen Gradient-Effekte.
- Goldene Outlines nur fuer bewusst hervorgehobene Premium-/Achievement-Zustaende.

## Icons

- **Pflicht:** `@phosphor-icons/react` fuer allgemeine UI-Icons. Canonical: `src/THEME_GUIDE.md` § Iconography.
- **Verboten:** `lucide-react` oder andere Icon-Familien in neuer generierter UI.
- Imports: `import { House, Gear } from '@phosphor-icons/react'` — keine Namespace-Imports.
- Weights: Navigation immer `regular` (20px); Active = Cyan Primary-Surface + `currentColor` (kein `fill`); Actions/Forms und Dashboard-Karten `regular` 16–32px; Duotone nur gezielt auf groesseren Illustrationen.
- Farbe: `currentColor` / Theme-Tokens. Keine Glow-/Gradient-Icon-Effekte.
- RPG-Symbole: vorhandene Custom-SVGs beibehalten; nicht jedes Spielwelt-Icon durch Phosphor ersetzen.
- Icon-only Buttons: `aria-label`. Decorative: `aria-hidden`.
- Vor neuen Icons vorhandene Phosphor- und Repo-Assets pruefen.

## Umsetzung

Vor lokalen Styles zuerst die bestehenden Primitives pruefen:

- `src/shared/ui/button.tsx`
- `src/shared/ui/tabs.tsx`
- `src/shared/ui/select.tsx`
- `src/shared/ui/input.tsx`
- `src/shared/ui/textarea.tsx`
- `src/styles/globals.css`

Wenn eine Regel fuer mehrere Screens gelten soll, wird zuerst das passende Primitive oder Theme-Token angepasst. Keine CharacterEditor-spezifischen Farb-Hardcodes fuer allgemeine Designsystem-Regeln.

## Accessibility

- WCAG AA Kontrast fuer Text und Controls.
- Focus ist immer sichtbar und darf nicht nur ueber Farbe kommuniziert werden.
- Tastaturbedienung der Radix-Primitives erhalten.
- Disabled, invalid, selected und focus muessen voneinander unterscheidbar bleiben.
