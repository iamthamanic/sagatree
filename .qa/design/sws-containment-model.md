# SagaTree Spatial Containment Model (SCM)

- **Status:** Verbindliches Design — ergänzt ADR-SWS-01 (`sws-adr-shared-world-space.md`). Kein Code in diesem Dokument.
- **Datum:** 2026-11-26 · **Autor:** Ben (Produktentscheidungen) + SagaTree Agent (Formalisierung)
- **Kennzeichnung:** ✅ belegt (bestehender Code) · 🧩 Designentscheidung · 🔴 von Ben beschlossen
- **Anlass:** Der SWS-Branch (`feat/atlas-nested-lod-spike`) macht Kamera + Scene-Graph kontinuierlich (`clearRootCount === 0`, Multi-Map), aber die **Geometrie bleibt gestapelte Dokumente**. Ben: „Es ist immer noch nicht eine Welt wie bei Google Maps — jeder Layer ist unabhängig vom Layer darüber." Dieses Dokument definiert den fehlenden Kern: **erzwungenes räumliches Containment als Domain-Invariante.**

---

## 0. Problemstatement (Symptom → fehlende Regel)

| Beobachtetes Symptom (Screenshots/Ben) | Fehlende Regel |
|---|---|
| „Land kann größer als sein Kontinent sein" | Keine Laufzeit-Invariante `Kind ⊆ Träger`. |
| „Haus über Stadtgrenze, Stadt reagiert nicht" | Keine Wachstums-Propagation nach oben. |
| „Landmasse entfernen löscht keine enthaltene Stadt" | Keine Entfernen-Kaskade nach unten. |
| „Rechteckige Randnaht / Straße ragt in Dornhain" (Finding M-2) | Geometrien sind nebeneinander gelegt, nicht ineinander; Cutout-Filter clippt nicht. |
| „Ebenen-Baum klappt beim Zoom zu, markiert nicht die Ebene" | Layer-Anzeige ist manueller Baum, kein Abbild des Kamera-/LOD-Zustands. |

🧩 **Kernaussage:** SWS-01..08 liefern *koordinaten- und renderseitige* Kontinuität. SCM liefert die *geometrisch-topologische* Kontinuität: **eine Welt, eine Geometrie-Quelle, Containment als erzwungene Invariante.**

---

## 1. Grundprinzip

> **Es gibt genau EINE kontinuierliche Welt.** Kontinent, Land, Stadt, Gebäude, Raum, Wald, Berg, Fluss sind keine separaten Karten, sondern **verschachtelte Bereiche derselben Geometrie**. Jede Edit-Operation wird vor dem Schreiben gegen räumliche Invarianten ausgewertet und als **eine atomare, rückgängig machbare Welt-Operation** ausgeführt.

Die Karten-/Ebenen-Sichten bleiben als **LOD-/Render-Projektionen** bestehen (SWS-03/04), sind aber **abgeleitete Sichten**, keine unabhängigen Wahrheiten.

---

## 2. Die drei räumlichen Beziehungstypen 🧩

Jede physische Struktur hat **einen** Beziehungstyp zu ihrer räumlichen Umgebung. Der Typ bestimmt das Verhalten bei Wachstum und Entfernung. Drei Typen sind die minimale Menge, die alle von Ben genannten Fälle abdeckt.

| Typ | Definition | Beispiele | Wachstum über Grenze | Entfernen des Trägers |
|---|---|---|---|---|
| **CONTAINED** | Liegt **auf/in** einer Trägerfläche und benötigt sie als Grund. | Haus in Stadt, Stadt in Land, Land in Kontinent, Wald/Baum auf Land, Raum in Gebäude | Träger **wächst** (propagiert nach oben, siehe §4) | Kinder werden **mitentfernt** (Kaskade, §5) |
| **CARVED** | Ist **in eine Masse eingeschnitten** (Hohlraum). | Haus im Berg, Höhle/Dungeon im Fels, Tunnel, Keller | Masse wird **ausgehöhlt/erweitert**; äußere Kontur ändert sich nur, wenn die Masse selbst an ihre Grenze stößt | Carved-Raum **verfällt** mit der Träger-Masse |
| **FLOWING** | **Durchquert** mehrere Bereiche, folgt der Topografie. | Fluss, Straße, Weg, Küstenlinie | Verlauf wird **neu geroutet** entlang der (ggf. geänderten) Topografie | Wird **umgeleitet oder gekappt**, nicht blind gelöscht |

**Warum drei statt einer Regel:** Ein Haus *im* Berg (CARVED) verhält sich physikalisch anders als ein Haus *auf* der Wiese (CONTAINED); ein Fluss *durchquert* Grenzen statt *in* ihnen zu liegen (FLOWING). Ohne diese Unterscheidung entstehen Fehler wie „Berg wächst unkontrolliert, weil das Haus im Berg größer wurde" oder „Fluss wird gelöscht, weil ein Land schrumpft".

**Zuordnung (Default, erweiterbar):**
- CONTAINED: `landmass`-Kinder, `political`, `forest`, `building`, `room`, `terrain`-Patches, Scatter-Props.
- CARVED: `room` in `fels`/`berg`, `dungeon`, `tunnel`.
- FLOWING: `river`, `road`, `coast`.

---

## 3. Die sechs Invarianten 🧩

Diese Regeln gelten **für alle** Strukturen und werden von der Domäne erzwungen (nicht vom Renderer, nicht von der UI).

- **INV-1 — Eine Welt, ein Raum.** Eine einzige autoritative Geometrie-Quelle (Topografie + Containment-Graph). Ebenen sind Sichten darauf.
- **INV-2 — Erzwungenes Containment.** Kein Kind außerhalb seines Trägers, ohne dass der Träger reagiert (wachsen / umleiten / ablehnen). Verletzungen sind zur Laufzeit unmöglich, nicht nur beim Erzeugen.
- **INV-3 — Wachstum propagiert nur so weit nötig nach oben.** Die Erweiterung eskaliert rekursiv bis zum ersten Elternteil, der sie **ohne eigene Änderung** aufnehmen kann. Stadt mitten im Land → Land unverändert. Stadt an Küste → Landmasse + Kontinent wachsen.
- **INV-4 — Entfernen kaskadiert nach unten, typabhängig.** CONTAINED/CARVED-Kinder verfallen mit dem Träger; FLOWING-Kinder werden umgeleitet/gekappt.
- **INV-5 — Topografie ist die Wurzel.** Landmasse/Heightfield ist die unterste Autorität. Flüsse, Straßen, Gebäude hängen davon ab — nie umgekehrt.
- **INV-6 — Atomarität + Undo.** Jede Edit-Operation inkl. aller Propagationen ist **eine** Transaktion und **ein** Undo-Schritt in `atlas-edit-history`. Kein partiell angewandter Zwischenzustand.

---

## 4. Wachstums-Propagation (nach oben) 🔴 Ben-Entscheidung: Auto-Grow mit Bestätigung

**Verhalten:** Auto-Grow, aber **standardmäßig mit Bestätigung**, abschaltbar.

1. Edit-Intent wird gegen den Träger geprüft (`passt das Kind noch in den Container?`).
2. Bei Grenzverletzung plant die Domäne die **Propagations-Kette** (welche Eltern müssen mitwachsen, bis aufnehmbar).
3. **Bestätigungs-Dialog** (Standard): z. B. „Das geht über die aktuelle Stadtgrenze hinaus und **erweitert die Stadt**. Bestätigen?" — mit **„Nicht mehr nachfragen"**-Option.
4. Nach Bestätigung (oder wenn Hinweis deaktiviert): **eine** atomare Operation wächst Kind + alle betroffenen Eltern.

**Propagation-Stopp:** sobald ein Elternteil die neue Ausdehnung ohne eigene Konturänderung aufnehmen kann.

**Beispiele:**
- Haus über Stadtgrenze → Stadt wächst (Bestätigung). Stadt mitten im Land → Land unverändert.
- Stadt an Küste wächst ins Meer → Landmasse wächst → Kontinent wächst (eine Operation, eine Bestätigung mit vollständiger Ketten-Vorschau).
- Haus im Berg (CARVED) wächst → Berg wird ausgehöhlt; äußere Kontur nur, wenn Berg an seine eigene Trägergrenze stößt.

---

## 5. Entfernen-Kaskade (nach unten) 🔴 Ben-Entscheidung: Soft-Kaskade mit Bestätigung

**Verhalten:** Entfernen eines Trägers entfernt/markiert enthaltene Kinder, **standardmäßig mit Bestätigung**, abschaltbar.

1. Entfernen-Intent auf eine Fläche (z. B. Landmasse am Kontinent) → Domäne ermittelt **alle enthaltenen Kinder** (Land, Städte, Häuser, …).
2. **Bestätigungs-Dialog** (Standard): „Diese Landmasse enthält 1 Land, 1 Stadt und 4 Häuser. Diese werden mitentfernt. Bestätigen?" — mit **„Nicht mehr nachfragen"**.
3. **Soft-Kaskade:** Kinder werden **verwaist/archiviert** (rückholbar), nicht unwiderruflich hart gelöscht. Harte Löschung ist ein separater, expliziter Schritt.
4. FLOWING-Kinder (Fluss/Straße) werden **umgeleitet/gekappt**, nicht blind archiviert.

---

## 6. Bestätigungs- & Preference-Modell 🔴 Ben-Entscheidung

Zwei **persistente User-Preferences** (nicht pro Session), standardmäßig **an**:

| Preference | Default | Wirkung |
|---|---|---|
| `spatialEdit.confirmGrow` | `true` | Bestätigung vor Auto-Grow-Propagation |
| `spatialEdit.confirmCascade` | `true` | Bestätigung vor Entfernen-Kaskade |

- Jeder Dialog hat **„Nicht mehr nachfragen"** → setzt die jeweilige Preference auf `false`.
- Eine **Werkzeug-Einstellung** (Atlas → Einstellungen) schaltet beide Hinweise jederzeit wieder ein/aus.
- Auch mit deaktiviertem Hinweis bleibt jede Operation **atomar + undo-fähig** (INV-6) — die Preference steuert nur die Rückfrage, nie die Sicherheit der Daten.

---

## 7. Domain-API (logisch, UI-frei) 🧩

Reine Domäne unter `src/domains/world/…` — **kein React, kein Three.js, kein Host-SDK** (BR-005).

```
EditIntent(z. B. „resize Haus X um Δ Richtung Küste" / „remove Landmasse Y")
  → resolveRelation(objectId): CONTAINED | CARVED | FLOWING
  → checkContainment(objectId, intent): { fits | violations[] }
  → planPropagation(intent): WorldOperationPlan   // wer wächst / verfällt / routet um
  → (UI) Bestätigung gemäß §6 (Preference + Dialog)
  → applyWorldOperation(plan): ein Commit → genau ein Undo-Eintrag
  → Renderer (SWS Multi-Map-Graph) konsumiert das Ergebnis
```

- `WorldOperationPlan` ist ein **reines Domain-Artefakt**: Liste betroffener Strukturen über alle Ebenen + ihre Änderungen + Vorschau-Geometrie für den Bestätigungs-Dialog.
- Der Renderer bleibt **dumm**: er bekommt das Ergebnis und zeichnet es (SWS-04), plant aber selbst keine Propagation.
- Bestehende Guards (SWS-01 Zyklus/Scherung) und Geometry Ownership (SWS-02) bleiben gültig; SCM ergänzt sie um die Containment-/Propagations-Dimension.

---

## 8. Zoom-getriebene Layer-Anzeige 🧩

Der Ebenen-Baum wird aus dem **aktiven Kamera-/LOD-Zustand** abgeleitet, nicht manuell verwaltet:

- Beim Rein-/Rauszoomen wird die **aktive Ebene** (Welt → Kontinent → Land → Ort → Gebäude → Raum) **markiert**.
- Der Baum **bleibt offen** und klappt nicht bei jedem Zoom-Schritt zu.
- Quelle ist `AtlasWorldCameraState` + der aktive Scene-Plan (SWS-03/05); die Anzeige ist eine **Funktion** dieses Zustands.

---

## 9. Vertikale Slices & Abnahmekriterien (Given/When/Then)

Jede Slice wird gegen diese Kriterien abgenommen (IDs **SCM-xx**):

- **SCM-01 Haus über Stadtgrenze (CONTAINED, Grow):** Given Stadt mitten im Land, When Haus über Stadtgrenze vergrößert, Then Bestätigung „erweitert Stadt", nach OK wächst nur die Stadt; Land unverändert; ein Undo stellt alles zurück.
- **SCM-02 Stadt an Küste (Grow-Kette):** Given Stadt an Küste, When Wachstum ins Meer, Then Bestätigung zeigt Kette Stadt→Landmasse→Kontinent, nach OK wachsen alle drei atomar; ein Undo.
- **SCM-03 Haus im Berg (CARVED):** Given Haus in Berg, When Haus wächst, Then Berg wird ausgehöhlt, äußere Kontur nur bei eigener Grenzverletzung.
- **SCM-04 Fluss durch Land (FLOWING):** Given Fluss durchquert Land, When Landmasse/Gelände ändert sich, Then Fluss wird neu geroutet/gekappt, nicht gelöscht.
- **SCM-05 Landmasse entfernen mit Inhalt (Kaskade):** Given Kontinent mit Land+Stadt+Häusern, When Landmasse entfernt, Then Bestätigung listet Inhalt, nach OK sind Kinder verwaist/archiviert (rückholbar); Fluss gekappt.
- **SCM-06 Bestätigungs-Preferences:** Given `confirmGrow/confirmCascade=false`, When gleiche Edits, Then kein Dialog, aber weiterhin atomar + undo-fähig; „Nicht mehr nachfragen" und Werkzeug-Einstellung wirken persistent.
- **SCM-07 Zoom-Layer-Anzeige:** When Zoom Welt→…→Raum, Then aktive Ebene markiert, Baum bleibt offen.
- **SCM-08 Invarianten-Bruch abgelehnt:** When ein Edit INV-1..6 verletzen würde (z. B. Zyklus), Then fail-closed abgelehnt (wie SWS-01 Guards).

---

## 10. Abgrenzung & Sequenz

- **Kein** zweites Weltmodell, keine parallele Kartenspeicherung. SCM **ersetzt** die „gestapelte Dokumente"-Semantik durch einen Containment-Graphen über einer Topografie-Wurzel; die SWS-Renderer-/Kamera-Arbeit wird **weiterverwendet**.
- **Sequenz:** (1) Dieses Modell absegnen → (2) SCM-Domäne + Invarianten + Propagation → (3) Bestätigungs-UI + Preferences → (4) Zoom-Layer-Anzeige → (5) Renderer-Konsumation. Visumaxx bleibt davon **unberührt** (optimiert nur die Darstellung, SCM entscheidet die Welt).
- **Qualitätsgate:** `npm run test-gate` + neue SCM-Self-Tests (Invarianten, Propagation, Kaskade, Undo-Atomarität) analog zu den SWS-Self-Tests.
