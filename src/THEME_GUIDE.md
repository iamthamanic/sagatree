# SagaTree Corporate Identity and UI Theme Guide

## Status

Diese Datei ist die kanonische visuelle Designsystem-Referenz fuer SagaTree. Fuer AI-/Figma-Make-Generierung gilt zusaetzlich `src/guidelines/Guidelines.md`. Die technische Source of Truth sind die Theme-Tokens in `src/styles/globals.css` und die Primitives unter `src/shared/ui/`.

Produktverhalten ist separat verbindlich definiert:
- `docs/concepts/conductor-experience-contract.md` fuer Performance Mode, Live-Steuerung, Responsivitaet, Motion, Command Depth und Mastery.
- `docs/concepts/imagination-first-visualization-contract.md` fuer Scenes, Program/Viewer, 2D/3D, Visual Authority, Progressive Materialization und Imagination Preservation.
- `docs/concepts/adaptive-ui-experience-contract.md` fuer Adaptive UI / Mobile Experience (Phone/Tablet/Desktop-Rekomposition, Touch Targets, Safe Areas, Accessibility, `AU-*` Gates).

Diese Experience-Vertraege sind keine optionalen Designhinweise. Relevante UI-/Visualisierungsfeatures muessen ihre Gates erfuellen oder eine explizite Abweichung dokumentieren.

**Entdopplung:** Visuelle Tokens, Markenrollen und Control-Affordances bleiben in diesem THEME_GUIDE. Messbare Mobile-/Viewport-/Touch-/Safe-Area-/Recomposition-Regeln und `AU-*` Gates stehen nur im Adaptive-UI-Contract — hier nicht widerspruechlich duplizieren.

## Design Read

**SagaTree** ist eine dunkle, werkzeugartige TTRPG-Oberflaeche — kein generisches Gaming-Dashboard. Dunkle, ruhige Surfaces und zwei Markenfarben aus dem Logo; professionell und fokussiert, nicht wie eine Marketing-Landingpage.

## Farbpalette

### Light Mode

| Rolle | Farbe | Hex |
|---|---|---|
| Background | White | `#FFFFFF` |
| Card | White | `#FFFFFF` |
| Foreground | Slate-900 | `#0F172A` |
| Brand Selection / CTA | Cyan-600 | `#0891B2` |
| Brand Hover / Accent | Gold | `#E8A641` |
| Muted | Slate-50 | `#F8FAFC` |
| Border | Slate-200 | `#E2E8F0` |
| Danger | Red-500 | `#EF4444` |

### Dark Mode

| Rolle | Farbe | Hex |
|---|---|---|
| Background | Slate-900 | `#0F172A` |
| Card | Slate-800 | `#1E293B` |
| Foreground | Slate-100 | `#F1F5F9` |
| Brand Selection / CTA | Cyan-500 | `#06B6D4` |
| Brand Hover / Accent | Amber-500 | `#F59E0B` |
| Muted | Slate-800 | `#1E293B` |
| Border | Slate-700 | `#334155` |
| Danger | Red-400 | `#F87171` |

## Verbindliche Farbrollen

### Cyan / Teal

Cyan ist die **Hauptfarbe aus dem Logo** und steht fuer **Auswahl** sowie **wichtigste Aktion**.

Verwendung:
- Primaere CTA (gefuellt)
- aktiver Tab / ausgewaehlte Segmented-Control-Option
- Keyboard-Focus-Ringe
- Links und funktionale Navigation
- Progress und Status

Nicht verwenden fuer:
- Destructive Actions
- Disabled States
- zufaellige Dekoration

### Gold / Amber

Gold ist die **Sekundaerfarbe aus dem Logo** und steht fuer **Hover-Feedback** sowie Premium-Akzente.

Verwendung:
- Hover auf primaeren CTAs und aktiven Tabs
- Hover auf Outline-/Ghost-Actions und inaktiven Tabs
- Level-, Achievement- und Premium-Akzente

Nicht verwenden fuer:
- Standard-Auswahlzustand (dafuer Cyan)
- Destructive Actions
- Disabled States
- reine Focus-Indikation

### Merksatz

**Cyan = ausgewaehlt oder wichtigste Aktion. Gold = Hover und Premium-Akzent.**

Damit folgt die UI dem Logo: Tuerkis/Cyan dominiert, Gold akzentuiert Interaktion.

## Theme-Tokens

Die vorhandenen Basis-Tokens bleiben bestehen:

```css
:root {
  --primary: #0891B2;
  --primary-foreground: #FFFFFF;
  --accent: #E8A641;
  --accent-foreground: #0F172A;
}

.dark {
  --primary: #06B6D4;
  --primary-foreground: #0F172A;
  --accent: #F59E0B;
  --accent-foreground: #0F172A;
}
```

Semantische Verwendung:
- `primary` = Cyan/Teal, Auswahl und primaere CTA
- `accent` = Gold/Amber, Hover-Feedback und Premium-Akzent

Keine neuen Hex-Hardcodes in Feature-Komponenten, wenn ein semantischer Theme-Token existiert.

## Typografie

SagaTree verwendet Darker Grotesque fuer UI und Headings.

```css
font-family: 'Darker Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

- Headings: 700
- UI-Labels: 500 bis 600
- Body: 400 bis 500
- Keine zusaetzlichen Serif-Fonts in der Produkt-UI

## Iconography

Kanonische visuelle Referenz fuer Produkt-Icons. Implementierungsbeispiele: `docs/ui-styleguide.md`.

### Standardbibliothek

- **System-Icons (Produkt-UI):** [`@phosphor-icons/react`](https://github.com/phosphor-icons/react) — verpflichtend.
- **Nicht zulaessig:** neue `lucide-react`-Abhaengigkeiten oder gemischte Icon-Familien in Navigation/Chrome.
- Imports explizit und tree-shaking-freundlich (`import { House, Gear } from '@phosphor-icons/react'`). Keine Namespace-Imports der gesamten Bibliothek.
- Icons nutzen `currentColor` bzw. vorhandene Theme-Tokens — keine willkuerlichen Hex-Farben.

### Weights und Groessen (Defaults)

| Kontext | Phosphor Weight | Standardgroesse |
|---|---|---|
| Sidebar – inaktiv | `regular` | 20 px |
| Sidebar – aktiv | `regular` (Cyan/`primary` Surface + `currentColor`) | 20 px |
| Hauptnavigation | `regular` | 20 px |
| Buttons und Actions | `regular` | 16–20 px |
| Formulare und Controls | `regular` | 16–20 px |
| Dashboard-Feature-Karten | `regular` | 24–32 px |
| Groessere Feature-Illustrationen | `duotone` | 24–32 px |
| Status und Warnungen | `regular` / `fill` | 16–20 px |

Defaults duerfen bestehende Layouts nicht zerstören; optische Einheitlichkeit vor starrer Pixelzahl.

### Farben und Zustaende

- Standard: Foreground-/Muted-Tokens.
- Aktive Navigation: Cyan/Teal (`primary` / Sidebar-Accent).
- Hover: Gold/Amber gemaess Theme.
- Destructive: Danger-Tokens.
- Disabled: bestehende Disabled-Konventionen.
- Zustaende nie ausschliesslich ueber Farbe; Active zusaetzlich ueber Weight (`fill`) und Surface.

### Sidebar

- Eingeklappt und ausgeklappt: gleiche Icon-Familie, 20 px, Weight immer `regular`.
- Active: Cyan/Teal Primary-Surface (`bg-primary text-primary-foreground`) — Auswahl ueber Farbe und Surface, nicht ueber `fill`.
- Hover: Gold/Amber (`hover:bg-accent` / `hover:text-accent`) wie bei `Button` — auch auf dem aktiven Item.
- Icon-only-Buttons brauchen `aria-label` / `title`.
- Decorative Icons: `aria-hidden`.

### Duotone

- Gezielt auf Feature-Karten und groesseren Illustrationen.
- Nicht auf jedem Button, Tab oder Form-Control.

### System- vs. Spielwelt-Icons

- **System-Icons:** Phosphor fuer Chrome, Navigation, Dialoge, Forms, Status.
- **Spielwelt-Icons:** bestehende Custom-SVGs (z. B. Attribute-d20) beibehalten; [game-icons.net](https://game-icons.net/) (CC-BY-3.0) nur lokal und nur wenn ein spezialisiertes RPG-Symbol echten Mehrwert bietet. Attribution inkl. Urheber und Aenderungen. Keine externen Runtime-CDN-Assets.

### Accessibility

- Icon-only Controls: zugaengliche Bezeichnung.
- Decorative Icons vor Screenreadern verbergen.
- Erkennbarkeit bei 16–20 px sicherstellen.
- Loading: `CircleNotch` + `animate-spin` (nicht Farbe allein).

### Individuelle SVGs und Lizenzen

- Hochwertige vorhandene SVGs nicht wahllos durch Phosphor ersetzen.
- Neue Custom-SVGs nur mit klarer Begruendung und Lizenzhinweis im Repo.

## Komponentenregeln

### Buttons

Der `Button`-Default ist die primaere CTA.

- Primary CTA: `bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground`
- Outline: neutraler Rahmen, Gold bei Hover
- Secondary: neutrale gefuellte Surface
- Ghost: neutral, Gold bei Hover
- Link: Cyan
- Destructive: Rot

`variant="accent"` bleibt als Alias fuer die Primary-CTA erhalten. Neue primaere CTAs sollen den Default-Button verwenden.

Regeln:
- Nach Moeglichkeit eine visuell dominante primaere CTA pro Abschnitt.
- Eine sekundaere Aktion darf nicht dieselbe visuelle Dominanz wie die primaere CTA haben.
- Keine lokalen gelben oder blauen Button-Hardcodes.

### Tabs

- Active: `bg-primary text-primary-foreground border-primary`
- Inactive: neutral
- Inactive Hover: dezentes Gold (`accent`)
- Focus: Cyan-Ring ueber `primary` / `ring`
- Aktiver Tab wechselt bei Hover zu Gold

Aktive Tabs muessen auf den ersten Blick als Auswahlzustand erkennbar sein und duerfen nicht nur ueber Textfarbe kommuniziert werden.

### Inputs, Textareas und Selects

- Label steht oberhalb des Controls.
- Controls besitzen auch im Ruhezustand einen sichtbaren 1px-Rahmen.
- Standardhoehe wichtiger Controls mindestens 44px, soweit der konkrete Component-Kontext dies vorsieht.
- Hover verstaerkt Border/Surface subtil.
- Focus verwendet Cyan/Teal.
- Invalid bleibt Rot.
- Disabled bleibt neutral und deutlich reduziert.

### Cards und Panels

- Standard: `bg-card text-card-foreground` mit subtil sichtbarem Border.
- Shadow nur zur echten Hierarchie, nicht als Dekoration.
- Keine Neon-Glows auf Standard-Panels.
- Goldene Borders nur fuer Premium-/Achievement-Zustaende.

### Navigation

- Active Navigation: Cyan-orientiert, sofern es sich um Navigation und nicht um einen Auswahl-Tab handelt.
- Hover: dezentes Gold.
- Tabs sind eine eigene Auswahlkomponente und folgen der Cyan-Active-Regel.

## Interaction Hierarchy

```text
Primaere CTA              -> Cyan (Hover: Gold)
Aktive Auswahl / Tab      -> Cyan (Hover: Gold)
Sekundaere Aktion         -> Neutral / Outline
Sekundaer-Hover           -> Gold
Link / Navigation         -> Cyan
Focus Ring                -> Cyan
Progress / Status         -> Cyan
Achievement / Level       -> Gold
Destructive               -> Rot
Disabled                  -> Neutral
```

## Accessibility

- Textkontrast mindestens WCAG AA.
- UI-Boundaries und Focus-Indikatoren muessen sichtbar bleiben.
- Selected, focus, disabled und invalid duerfen nicht nur durch denselben Farbwechsel unterschieden werden.
- Radix-Keyboard-Navigation und Focus-Management nicht ueberschreiben.
- Touch Targets fuer wichtige Produktaktionen mindestens 44x44px, sofern die Komponente nicht bewusst kompakt ist.

## Responsive Product UI

- Mobile first.
- Mehrspaltige Editor-Layouts unter 768px auf eine Spalte reduzieren.
- Keine horizontal abgeschnittenen Tabs oder Form Controls.
- Labels und Helper-Text bleiben lesbar und springen nicht in Controls hinein.
- Verbindliche Device-Bands, Safe-Area-, Touch-Parity-, Recomposition- und `AU-*` Gate-Regeln: `docs/concepts/adaptive-ui-experience-contract.md` (nicht hier erneut ausformulieren).

## Umsetzung fuer neue Screens

1. Bestehendes Primitive unter `src/shared/ui/` pruefen.
2. Theme-Tokens aus `src/styles/globals.css` verwenden.
3. Allgemeine Designsystem-Regeln im Primitive oder Theme loesen, nicht lokal im Feature.
4. `src/guidelines/Guidelines.md` bei AI-/Figma-Make-Generierung beachten.
5. Neue lokale Hex-Farben nur einfuehren, wenn sie eine neue semantische Rolle haben und im Guide dokumentiert werden.

## Do

- Cyan fuer primaere CTA und aktive Auswahl verwenden.
- Gold fuer Hover-Feedback und Premium-/Achievement-Akzente verwenden.
- Controls mit klarer Affordance bauen.
- Eine ruhige Dark-Product-UI erhalten.
- Light und Dark Mode gemeinsam pruefen.

## Don't

- Cyan und Gold ohne feste Rolle gegeneinander austauschen.
- Aktive Tabs neutral lassen.
- Jede Aktion als gefuellte Primary-CTA darstellen.
- Destructive oder Invalid States mit Brand-Farben ueberschreiben.
- Feature-spezifische Farb-Hardcodes fuer allgemeine Komponentenregeln einfuehren.
- Neue UI-Libraries neben Radix/shadcn einfuehren, nur um Styling zu loesen.

## Quick Reference

```text
CYAN / TEAL
- Primary CTA
- Active tab
- Selected state
- Focus / Links / Navigation / Progress

GOLD / AMBER
- Hover feedback
- Achievement / Level / Premium accents
```
