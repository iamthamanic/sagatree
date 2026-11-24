import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  allocateSevenFreeSkillPoints,
  completeSpeciesBasics,
  ensureLoggedIn,
  selectAttributeGroup,
} from './helpers/character-editor';

const EVIDENCE_DIR = '.qa/evidence/sagatree-character-editor-core';
const V2_EVIDENCE_DIR = '.qa/evidence/skill-progression-v2-character-editor-ux';


test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.mkdirSync('.qa/evidence/attribute-bonus-pool', { recursive: true });
  fs.mkdirSync('.qa/evidence/skill-progression-v2-character-editor-ux', { recursive: true });
});

test('character editor exposes the SagaTree Core creation flow', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);
  const createViaEmptyState = page.getByRole('button', { name: 'Charakter erstellen' });
  if (await createViaEmptyState.count()) {
    await createViaEmptyState.first().click();
  } else {
    await page.getByRole('heading', { name: 'Neuer Charakter' }).first().click();
  }
  await expect(page.getByRole('heading', { name: 'Charakter erstellen' })).toBeVisible();
  await page.getByRole('button', { name: /Eigenen Charakter erstellen/i }).click();
  await expect(page.getByRole('heading', { name: 'Charakter Editor' }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('SagaTree Core').first()).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Regelset/i }).first()).toBeVisible();

  for (const tab of ['Spezies', 'Charakter', 'Look', 'Inventar', 'Einstellungen']) {
    await expect(page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') })).toBeVisible();
  }
  await expect(page.locator('[role="tablist"]').first().getByRole('tab', { name: /^Hintergrund$/i })).toHaveCount(0);

  await page.getByRole('tab', { name: /^Spezies$/i }).click();
  await expect(page.getByText('Spezies', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('radio', { name: /Mensch/i })).toBeVisible();
  await expect(page.getByRole('img', { name: /Skizze: Mensch/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Speziesmerkmale/i })).toBeVisible();
  await expect(page.getByText('Geschärfter Sinn').first()).toBeVisible();
  await expect(page.getByText('Geringer Ruhebedarf').first()).toBeVisible();
  await expect(page.getByText('Flugfähig')).toHaveCount(0);
  await expect(page.getByText(/^0 \/ 3$/).first()).toBeVisible();
  await expect(page.getByText(/Speziespunkte steigen nicht automatisch mit der Charakterstufe/i).first()).toBeVisible();

  await page.getByRole('button', { name: /Enge Resistenz, 1 Punkt/i }).click();
  const firstResistance = page.getByRole('combobox', { name: 'Enge Resistenz: Gefahrenart' });
  await expect(firstResistance).toBeVisible();
  await page.getByRole('button', { name: /Enge Resistenz: Gefahrenart erklären/i }).click();
  await expect(page.getByRole('tooltip').getByText(/konkrete Wirkung, nicht ihre Quelle/i)).toBeVisible();
  await page.getByRole('button', { name: /Enge Resistenz: Gefahrenart erklären/i }).click();
  await firstResistance.click();
  const supernaturalOption = page.getByRole('option', { name: /Übernatürliche Veränderungen/i });
  await supernaturalOption.scrollIntoViewIfNeeded();
  await expect(page.getByRole('listbox').getByText(/keine Illusionen und keine Gedankenkontrolle/i)).toBeVisible();
  await page.getByRole('option', { name: /Gift \/ Toxine/i }).click();
  await page.getByRole('button', { name: /Weitere Auswahl/i }).click();
  const resistanceSelects = page.getByRole('combobox', { name: /Enge Resistenz: Gefahrenart/ });
  await expect(resistanceSelects).toHaveCount(2);
  await resistanceSelects.nth(1).click();
  await expect(page.getByRole('option', { name: /Gift \/ Toxine/i })).toBeDisabled();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-species-duplicate-option-blocked.png'), fullPage: true });
  await page.getByRole('option', { name: /Krankheit \/ Infektion/i }).click();

  await page.getByRole('button', { name: /Geschärfter Sinn, 1 Punkt/i }).click();
  const senseSelect = page.getByRole('combobox', { name: 'Geschärfter Sinn: Sinn' });
  await expect(senseSelect).toBeVisible();
  await page.getByRole('button', { name: /Geschärfter Sinn: Sinn erklären/i }).click();
  await expect(page.getByRole('tooltip').getByText(/keine neue Sinnesart/i)).toBeVisible();
  await page.getByRole('button', { name: /Geschärfter Sinn: Sinn erklären/i }).click();
  await senseSelect.click();
  await expect(page.getByRole('listbox').getByText(/Geräusche entscheidend sind/i)).toBeVisible();
  await page.getByRole('option', { name: /Hören/i }).click();
  await expect(page.getByText(/^3 \/ 3$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Weitere Auswahl/i }).first()).toBeDisabled();
  await page.getByLabel(/^Weitere Auswahl:/i).first().click();
  await expect(page.getByRole('tooltip').getByText(/Startbudget ist mit 3 \/ 3/i)).toBeVisible();
  await expect(page.getByRole('tooltip').getByText(/Weltprofil-Modul „Speziesentwicklung“/i)).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-species-repeatable-two-resistances.png'), fullPage: true });

  await page.getByLabel('Stufe').click();
  await page.getByRole('option', { name: '10', exact: true }).click();
  await expect(page.getByText(/^3 \/ 3$/).first()).toBeVisible();
  await page.getByLabel('Stufe').click();
  await page.getByRole('option', { name: '1', exact: true }).click();

  await page.getByRole('button', { name: /Enge Resistenz abwählen/i }).click();
  await page.getByRole('button', { name: /Geschärfter Sinn abwählen/i }).click();
  await expect(page.getByText(/^0 \/ 3$/).first()).toBeVisible();

  await page.getByRole('button', { name: /Umweltanpassung, 1 Punkt/i }).click();
  const environmentSelect = page.getByRole('combobox', { name: 'Umweltanpassung: Umgebung' });
  await expect(environmentSelect).toBeVisible();
  await environmentSelect.click();
  await expect(page.getByRole('listbox').getByText(/großer Höhe und dünner Luft/i)).toBeVisible();
  await page.getByRole('option', { name: /Hochgebirge & dünne Luft/i }).click();
  await page.getByRole('button', { name: /Umweltanpassung entfernen/i }).click();

  await page.getByRole('radio', { name: /Alien/i }).click();
  await expect(page.getByLabel(/Name deiner Spezies/i)).toBeVisible();
  await expect(page.getByLabel(/Körperbeschreibung/i)).toBeVisible();
  await expect(page.getByText('Flugfähig').first()).toBeVisible();
  await expect(page.getByText('Erweitertes Schwimmen').first()).toBeVisible();
  await expect(page.getByText('Noch nicht verfügbar').first()).toBeVisible();
  await page.getByLabel(/Name deiner Spezies/i).fill('Schneggl');
  await expect(page.getByLabel(/Name deiner Spezies/i)).toHaveValue('Schneggl');
  await expect(page.getByLabel('Spezies: Schneggl')).toHaveCount(0);

  await page.getByRole('button', { name: /Erweiterte Sicht, 2 Punkte/i }).click();
  const sightSelect = page.getByRole('combobox', { name: 'Erweiterte Sicht: Sichtform' });
  await expect(sightSelect).toBeVisible();
  await sightSelect.click();
  await expect(page.getByRole('listbox').getByText(/Natürliche Dunkelheit allein/i)).toBeVisible();
  await page.getByRole('option', { name: /Dunkelsicht/i }).click();
  await page.getByRole('button', { name: /Erweiterte Sicht entfernen/i }).click();

  await page.getByRole('button', { name: /Extremumwelt, 3 Punkte/i }).click();
  const extremeSelect = page.getByRole('combobox', { name: 'Extremumwelt: Extremumwelt' });
  await expect(extremeSelect).toBeVisible();
  await extremeSelect.click();
  await expect(page.getByRole('listbox').getByText(/ohne Atemluft/i)).toBeVisible();
  await page.getByRole('option', { name: /Vakuum & Sauerstofflosigkeit/i }).click();
  await expect(page.getByText(/^3 \/ 3$/).first()).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-species-repeatable-dropdowns.png'), fullPage: true });

  await page.getByRole('radio', { name: /Mensch/i }).click();
  await expect(page.getByText('Flugfähig')).toHaveCount(0);
  await expect(page.getByText(/^0 \/ 3$/).first()).toBeVisible();

  await page.getByRole('tab', { name: /^Charakter$/i }).click();
  await expect(page.getByRole('tab', { name: /^Archetype$/i })).toHaveAttribute('data-state', 'active');
  await expect(page.getByRole('tab', { name: /^Attribute$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Hintergrund$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Details$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Archetype$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Essenz$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Kompetenzen$/i })).toHaveCount(0);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-info-core-tabs.png'), fullPage: true });

  await page.getByRole('radio', { name: /Kämpfer/i }).click();
  await page.locator('[data-archetype-skill-grid] button').filter({ hasText: 'Nahkampf' }).first().click();
  await expect(page.getByText(/Archetyp-Punkt \(1 von 10\)/i).first()).toBeVisible();
  await expect(page.getByText(/Kampfroutine/i).first()).toBeVisible();
  await expect(page.getByText(/Charakter → Attribute/i).first()).toBeVisible();
  await expect(page.getByText('Freie Fertigkeitspunkte')).toHaveCount(0);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-info-archetype-essence.png'), fullPage: true });

  await page.getByRole('tab', { name: /^Essenz$/i }).click();
  await expect(page.getByText('Gebunden').first()).toBeVisible();
  await page.getByRole('button', { name: /Mental/i }).click();
  await expect(page.getByText(/Essenz-Manifestation/i).first()).toBeVisible();
  await expect(page.getByText(/mentaler Kämpfer|vollständig regelkonform/i).first()).toBeVisible();
  await expect(page.getByText(/Feuerball/i)).toHaveCount(0);
  await expect(page.getByLabel(/^Essenz:/)).toBeVisible();
  await expect(page.getByLabel(/^Archetype:/)).toBeVisible();
  await expect(page.getByLabel('Spezies: Mensch')).toHaveCount(0);
  await expect(page.getByLabel('Spezies: Schneggl')).toHaveCount(0);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05-abilities-core-ability.png'), fullPage: true });

  await page.getByRole('tab', { name: /^Attribute$/i }).click();
  const attributeSection = page.locator('[data-attr-connector-section]');
  await expect(attributeSection.getByRole('heading', { name: /Attributsbonus/i })).toBeVisible();
  await expect(attributeSection.getByText('Attributscheck').first()).toBeVisible();
  await expect(attributeSection.getByText('Startverteilung').first()).toBeVisible();
  await expect(attributeSection.getByText(/15 \/ 15 Bonuspunkte/i).first()).toBeVisible();
  await expect(attributeSection.getByText(/\+4 Bonus|\+3 Bonus|\+2 Bonus|\+1 Bonus/i).first()).toBeVisible();
  await expect(attributeSection.getByText('Ausdauer').first()).toBeVisible();
  await expect(attributeSection.getByText('Verstand').first()).toBeVisible();
  await expect(attributeSection.getByText('Wahrnehmung').first()).toBeVisible();
  await page.screenshot({ path: path.join('.qa/evidence/attribute-bonus-pool', '01-attribute-budget-level-1.png'), fullPage: true });

  await page.getByRole('tab', { name: /^Hintergrund$/i }).click();
  await expect(page.getByText('Bühne & Öffentlichkeit').first()).toBeVisible();
  await expect(page.getByText('Natur & Wildnis').first()).toBeAttached();
  await expect(page.getByText('Hintergrund Framework').first()).toBeVisible();
  await expect(page.getByRole('radio', { name: /Eigener Hintergrund/i })).toBeAttached();

  const backgroundPanel = page.locator('[data-background-panel]');
  const pointsBudget = backgroundPanel.locator('[data-background-points-budget]');
  const healingFramework = page.getByRole('radio', { name: /Heilung & Fürsorge/i });
  await healingFramework.click();
  await expect(healingFramework).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
  // Intro copy carries the 2-point budget explanation; badge shows X / 2 verteilt only.
  await expect(backgroundPanel.getByText(/2 Hintergrund-Fertigkeitspunkte/).first()).toBeVisible();
  await expect(pointsBudget.getByText(/^0 \/ 2 verteilt$/).first()).toBeVisible();
  await expect(backgroundPanel.getByText('Empfohlen')).toHaveCount(0);

  const medicineNode = backgroundPanel.locator('[data-background-skill-node="medicine"]');
  const insightNode = backgroundPanel.locator('[data-background-skill-node="insight"]');
  const survivalNode = backgroundPanel.locator('[data-background-skill-node="survival"]');
  const awarenessNode = backgroundPanel.locator('[data-background-skill-node="awareness"]');
  await expect(medicineNode).toHaveCount(1);
  await expect(insightNode).toHaveCount(1);
  await expect(survivalNode).toHaveCount(1);
  await expect(awarenessNode).toHaveCount(1);
  await expect(backgroundPanel.locator('[data-background-skill-grid]')).toHaveAttribute('data-training-view', 'pool');

  await medicineNode.getByRole('button', { name: 'Medizin Hintergrundpunkt erhöhen' }).click();
  await expect(pointsBudget.getByText(/^1 \/ 2 verteilt$/).first()).toBeVisible();
  await insightNode.getByRole('button', { name: 'Menschenkenntnis Hintergrundpunkt erhöhen' }).click();
  await expect(pointsBudget.getByText(/^2 \/ 2 verteilt$/).first()).toBeVisible();
  await expect(medicineNode).toHaveCount(1);
  await expect(insightNode).toHaveCount(1);
  await expect(survivalNode).toHaveCount(1);
  await expect(awarenessNode).toHaveCount(1);
  await expect(backgroundPanel.locator('[data-background-skill-grid]')).toHaveAttribute('data-training-view', 'pool');
  await page.screenshot({ path: '.qa/evidence/skill-progression-v2-character-editor-ux/02-background-plus-two.png', fullPage: true });

  await insightNode.getByRole('button', { name: 'Menschenkenntnis Hintergrundpunkt verringern' }).click();
  await expect(pointsBudget.getByText(/^1 \/ 2 verteilt$/).first()).toBeVisible();
  await expect(backgroundPanel.locator('[data-background-skill-grid]')).toHaveAttribute('data-training-view', 'pool');
  await expect(survivalNode).toHaveCount(1);
  await expect(awarenessNode).toHaveCount(1);
  await awarenessNode.getByRole('button', { name: 'Aufmerksamkeit Hintergrundpunkt erhöhen' }).click();
  await expect(pointsBudget.getByText(/^2 \/ 2 verteilt$/).first()).toBeVisible();
  await expect(medicineNode).toHaveCount(1);
  await expect(awarenessNode).toHaveCount(1);
  await expect(insightNode).toHaveCount(1);
  await expect(survivalNode).toHaveCount(1);

  await medicineNode.getByRole('button', { name: 'Spezialisieren' }).click();
  await medicineNode.getByRole('combobox', { name: 'Medizin Spezialisierungsvorschlag' }).click();
  await page.getByRole('option', { name: /Notfallmedizin/ }).click();
  await page.getByLabel('Milieuzugang').fill('Notaufnahmen');
  await page.getByLabel('Kontakt').fill('Dr. Sera Malk');
  await page.getByLabel('Komplikation').fill('Alte Schulden');
  await page.getByLabel('Zusätzliche Kommunikationsform').fill('Gebärdensprache');
  await expect(page.getByText(/^Hintergrund vollständig$/i)).toBeVisible();
  await expect(page.getByTestId('character-lore-project-context')).toBeVisible();
  await expect(page.getByTestId('character-bg-generate')).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '06-background-core-fields.png'), fullPage: true });

  await page.getByRole('tab', { name: /^Details$/i }).click();
  await expect(page.getByRole('heading', { name: /^Notizen$/i })).toBeVisible();
  await expect(page.locator('#notes')).toBeVisible();

  await page.getByRole('tab', { name: /^Attribute$/i }).click();
  await expect(page.getByRole('heading', { name: /^Attribute$/i })).toBeVisible();
  await expect(page.getByText('Proben verstehen')).toHaveCount(0);
  await expect(page.getByText('Freie Punkte')).toHaveCount(0);
  await expect(page.getByText(/Vergib genau 7 freie Fertigkeitspunkte/i)).toHaveCount(0);
  await expect(page.getByText(/Start gesamt 10 Punkte/i)).toHaveCount(0);
  await page.screenshot({ path: '.qa/evidence/skill-progression-v2-character-editor-ux/01-three-start-sources.png', fullPage: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '04-skills-budget-specialization.png'), fullPage: true });

  await selectAttributeGroup(page, 'Verstand');
  await page.locator('[data-attribute-skill-node="medicine"]').click();
  const formulaSection = page.locator('[data-skill-check-formula="true"]');
  const formulaToggle = formulaSection.getByRole('button', { name: /Formeldetails fuer Medizin/i });
  await expect(formulaSection).toBeVisible();
  await expect(formulaToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/Standardattribut: Verstand/i).last()).toBeVisible();
  await expect(page.getByText(/^Herkunft$/).last()).toBeVisible();
  await expect(page.getByText(/Globaler EB/i).last()).toBeVisible();
  await expect(page.getByText(/anwendbarer Erfahrungsbonus/i).last()).toBeVisible();
  await formulaToggle.click();
  await expect(formulaToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(formulaSection.getByText(/Standardattribut: Verstand/i)).toHaveCount(0);
  await formulaToggle.click();
  await expect(formulaToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/Standardattribut: Verstand/i).last()).toBeVisible();
  await page.screenshot({ path: '.qa/evidence/skill-progression-v2-character-editor-ux/03-skill-formula-applied-eb.png', fullPage: true });

  await page.getByLabel('Stufe').click();
  await page.getByRole('option', { name: '17', exact: true }).click();
  await selectAttributeGroup(page, 'Verstand');
  await page.locator('[data-attribute-skill-node="medicine"]').click();
  await expect(page.getByText(/Durch Rang 1 anwendbar/i).last()).toBeVisible();
  await expect(page.getByText(/\+2 anwendbarer Erfahrungsbonus/i)).toBeVisible();
  await selectAttributeGroup(page, 'Stärke');
  await page.locator('[data-attribute-skill-node="athletics"]').click();
  await expect(page.getByText(/Durch Rang 0 anwendbar/i).last()).toBeVisible();
  await expect(page.getByText(/\+0 anwendbarer Erfahrungsbonus/i)).toBeVisible();

  await page.getByLabel('Stufe').click();
  await page.getByRole('option', { name: '1', exact: true }).click();
  await completeSpeciesBasics(page);
  await page.getByRole('tab', { name: /^Charakter$/i }).click();
  await page.getByRole('tab', { name: /^Attribute$/i }).click();
  await allocateSevenFreeSkillPoints(page);

  const roundtripName = `E2E SkillV2 ${Date.now()}`;
  await page.getByRole('tab', { name: /^Spezies$/i }).click();
  await page.getByPlaceholder('Charaktername').first().fill(roundtripName);

  await page.getByLabel('Stufe').click();
  await page.getByRole('option', { name: '3', exact: true }).click();
  await page.getByRole('tab', { name: /^Charakter$/i }).click();
  await page.getByRole('tab', { name: /^Attribute$/i }).click();
  const progressionSlots = page.getByTestId('skill-progression-slots');
  await expect(progressionSlots).toBeVisible();
  await progressionSlots.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Bestehenden Skill +1' }).click();
  await progressionSlots.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: /Medizin \(Rang 1\)/ }).click();
  await expect(progressionSlots.getByText(/Medizin: 1 → 2/)).toBeVisible();
  await page.screenshot({ path: path.join(V2_EVIDENCE_DIR, '04-progression-slot.png'), fullPage: true });

  // (33) Repeated level slots carry unique accessible names.
  await expect(progressionSlots.getByRole('combobox', { name: 'Level 3 Entwicklung' })).toBeVisible();
  await expect(progressionSlots.getByRole('combobox', { name: 'Level 3 Fertigkeit' })).toBeVisible();

  // Raise to level 7 to unlock the L5/L7 development slots.
  await page.getByLabel('Stufe').click();
  await page.getByRole('option', { name: '7', exact: true }).click();

  // (27/28) L5 learn Fingerfertigkeit, L7 rank-up Fingerfertigkeit, then remove L5:
  // the dependent L7 decision must be pruned deterministically without a render crash.
  await progressionSlots.getByRole('combobox', { name: 'Level 5 Entwicklung' }).click();
  await page.getByRole('option', { name: 'Neuen Skill 0→1' }).click();
  await progressionSlots.getByRole('combobox', { name: 'Level 5 Fertigkeit' }).click();
  await page.getByRole('option', { name: /Fingerfertigkeit \(Rang 0\)/ }).click();
  await expect(progressionSlots.getByText(/Fingerfertigkeit: 0 → 1/)).toBeVisible();
  await progressionSlots.getByRole('combobox', { name: 'Level 7 Entwicklung' }).click();
  await page.getByRole('option', { name: 'Bestehenden Skill +1' }).click();
  await progressionSlots.getByRole('combobox', { name: 'Level 7 Fertigkeit' }).click();
  await page.getByRole('option', { name: /Fingerfertigkeit \(Rang 1\)/ }).click();
  await expect(progressionSlots.getByText(/Fingerfertigkeit: 1 → 2/)).toBeVisible();
  await progressionSlots.getByRole('combobox', { name: 'Level 5 Entwicklung' }).click();
  await page.getByRole('option', { name: /zurücksetzen/ }).click();
  await expect(progressionSlots.getByText(/Fingerfertigkeit: 1 → 2/)).toHaveCount(0);
  await expect(progressionSlots.getByText(/Fingerfertigkeit: 0 → 1/)).toHaveCount(0);
  await expect(progressionSlots).toBeVisible();
  await page.screenshot({ path: path.join(V2_EVIDENCE_DIR, '05-progression-cascade-prune.png'), fullPage: true });

  // Every unlocked slot needs exactly one decision before a level-7 save validates:
  // fill the now-empty L7 slot with a fresh learn (Fingerfertigkeit 0→1).
  await progressionSlots.getByRole('combobox', { name: 'Level 7 Entwicklung' }).click();
  await page.getByRole('option', { name: 'Neuen Skill 0→1' }).click();
  await progressionSlots.getByRole('combobox', { name: 'Level 7 Fertigkeit' }).click();
  await page.getByRole('option', { name: /Fingerfertigkeit \(Rang 0\)/ }).click();
  await expect(progressionSlots.getByText(/Fingerfertigkeit: 0 → 1/)).toBeVisible();

  // (26) Specialization draft flow: kind first, then skill, then name — only complete decisions persist.
  await progressionSlots.getByRole('combobox', { name: 'Level 5 Entwicklung' }).click();
  await page.getByRole('option', { name: 'Spezialisierung' }).click();
  await expect(progressionSlots.getByRole('combobox', { name: 'Level 5 Entwicklung' })).toContainText('Spezialisierung');
  await progressionSlots.getByRole('combobox', { name: 'Level 5 Fertigkeit' }).click();
  await page.getByRole('option', { name: /Überzeugen \(Rang 1\)/ }).click();
  const specNameInput = progressionSlots.getByRole('textbox', { name: 'Level 5 Spezialisierungsname' });
  await expect(specNameInput).toBeVisible();
  await specNameInput.fill('Verhandeln');
  await expect(progressionSlots.getByText(/Spezialisierung „Verhandeln" auf Überzeugen/)).toBeVisible();
  await page.screenshot({ path: path.join(V2_EVIDENCE_DIR, '06-progression-specialization.png'), fullPage: true });

  // Persisted specialization: changing ONLY the skill commits immediately (no name edit needed).
  await progressionSlots.getByRole('combobox', { name: 'Level 5 Fertigkeit' }).click();
  await page.getByRole('option', { name: /Athletik \(Rang 1\)/ }).click();
  await expect(progressionSlots.getByText(/Spezialisierung „Verhandeln" auf Athletik/)).toBeVisible();
  await page.screenshot({ path: path.join(V2_EVIDENCE_DIR, '08-progression-specialization-skill-change.png'), fullPage: true });

  // (29/30) Normal check has NO automatic specialization bonus; situational bonus shown separately.
  await selectAttributeGroup(page, 'Verstand');
  await page.locator('[data-attribute-skill-node="medicine"]').click();
  const normalCheckFormula = page.getByText(/Normaler Medizin-Check/i).locator('..');
  await expect(normalCheckFormula).toBeVisible();
  await expect(normalCheckFormula.getByText(/Spezialisierung/)).toHaveCount(0);
  const situationalBonus = page.getByTestId('specialization-situational-bonus');
  await expect(situationalBonus).toBeVisible();
  await expect(situationalBonus).toContainText('Notfallmedizin');
  await expect(situationalBonus).toContainText('+2');
  await expect(situationalBonus).toContainText(/Gesamt in passender Situation: d20 \+\d+/);
  await page.screenshot({ path: path.join(V2_EVIDENCE_DIR, '07-skill-check-situational-spec.png'), fullPage: true });

  await page.getByRole('tab', { name: /Einstellungen/i }).click();
  await page.getByRole('tab', { name: /^Statistik$/i }).click();
  await expect(page.getByText(/Speichere den Charakter zuerst/i)).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Preset$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Notizen/i })).toHaveCount(0);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '13-statistics-tab.png'), fullPage: true });
  await page.getByRole('tab', { name: /^Charakter$/i }).click();
  await page.getByRole('tab', { name: /^Hintergrund$/i }).click();
  await expect(page.getByText(/^Hintergrund vollständig$/i)).toBeVisible();
  await page.getByRole('tab', { name: /^Attribute$/i }).click();
  await expect(page.getByTestId('skill-progression-slots')).toBeVisible();
  await expect(page.getByText(/Legacy-Charakter|vollständige Herkunft nicht rekonstruierbar/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Speichern/i }).first()).toBeEnabled();

  // Live POST + Bibliothek roundtrip needs a reachable live host (local .env).
  // GitHub Actions has no DB — skipping avoids a 7m waitForResponse hang. Opt in with E2E_LIVE_CHARACTER_SAVE=1.
  const requireLiveSave = process.env.E2E_LIVE_CHARACTER_SAVE === '1' || !process.env.CI;
  if (requireLiveSave) {
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/rest/v1/characters') && response.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /Speichern/i }).first().click();
    const saveResponse = await saveResponsePromise;
    if (!saveResponse.ok()) {
      throw new Error(`Character save failed: ${saveResponse.status()} ${await saveResponse.text()}`);
    }
    const savedBody = await saveResponse.json() as {
      sagatree_profile?: {
        archetype?: string;
        archetypeTrainingSkill?: string;
        freeSkillRanks?: Record<string, number>;
        skillProvenanceStatus?: string;
        background?: { backgroundSkillPoints?: Record<string, number>; specialization?: { name?: string } };
        skillAdvances?: Array<{ level: number; kind: string; skill: string }>;
        specializations?: Array<{ skill: string; name: string; source: string; acquiredAtLevel: number }>;
      };
      sagatree_profile?: {
        archetype?: string;
        archetypeTrainingSkill?: string;
        freeSkillRanks?: Record<string, number>;
        skillProvenanceStatus?: string;
        background?: { backgroundSkillPoints?: Record<string, number>; specialization?: { name?: string } };
        skillAdvances?: Array<{ level: number; kind: string; skill: string }>;
        specializations?: Array<{ skill: string; name: string; source: string; acquiredAtLevel: number }>;
      };
    };
    const savedProfile = savedBody.sagatree_profile ?? savedBody.sagatree_profile;
    expect(savedProfile?.skillProvenanceStatus).toBeUndefined();
    expect(savedProfile?.archetype).toBe('fighter');
    expect(savedProfile?.archetypeTrainingSkill).toBe('melee');
    const freeSum = Object.values(savedProfile?.freeSkillRanks ?? {}).reduce((sum, value) => sum + value, 0);
    expect(freeSum).toBe(7);
    const backgroundSum = Object.values(savedProfile?.background?.backgroundSkillPoints ?? {}).reduce((sum, value) => sum + value, 0);
    expect(backgroundSum).toBe(2);
    expect(savedProfile?.background?.specialization?.name).toBe('Notfallmedizin');
    expect(savedProfile?.skillAdvances).toEqual(
      expect.arrayContaining([
        { level: 3, kind: 'rank-up', skill: 'medicine' },
        { level: 7, kind: 'learn', skill: 'sleight' },
      ]),
    );
    expect(savedProfile?.specializations).toEqual(
      expect.arrayContaining([
        { skill: 'athletics', name: 'Verhandeln', source: 'skill-development', acquiredAtLevel: 5 },
      ]),
    );
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: /gespeichert/i }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Bibliothek' }).first().click();
    await expect(page.getByRole('heading', { name: /Meine Bibliothek/i })).toBeVisible();
    await page.getByPlaceholder('Suche in deiner Bibliothek...').first().fill(roundtripName);
    const savedCard = page.locator('div').filter({ hasText: roundtripName }).filter({ has: page.getByRole('button', { name: 'Bearbeiten' }) }).first();
    await expect(savedCard).toBeVisible({ timeout: 15_000 });
    await savedCard.getByRole('button', { name: 'Bearbeiten' }).click();
    await expect(page.getByRole('heading', { name: 'Charakter Editor' }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Charaktername').first()).toHaveValue(roundtripName, { timeout: 15_000 });
    await page.getByRole('tab', { name: /^Charakter$/i }).click();
    await page.getByRole('tab', { name: /^Hintergrund$/i }).click();
    await expect(page.getByText(/^Hintergrund vollständig$/i)).toBeVisible();
    await expect(page.getByLabel('Spezialisierung Fachgebiet')).toHaveValue('Notfallmedizin');
    await page.getByRole('tab', { name: /^Attribute$/i }).click();
    await expect(page.getByText(/Legacy-Charakter|vollständige Herkunft nicht rekonstruierbar/i)).toHaveCount(0);
    await expect(page.getByTestId('skill-progression-slots')).toBeVisible();
    await expect(page.getByText(/Medizin: 1 → 2/)).toBeVisible();
    await expect(page.getByText(/Fingerfertigkeit: 0 → 1/)).toBeVisible();
    await expect(page.getByText(/Spezialisierung „Verhandeln" auf Athletik/)).toBeVisible();
    await expect(page.getByText('Verhandeln').first()).toBeVisible();
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'Skipped live character POST/Bibliothek roundtrip (CI without a live host backend). Covered by local E2E + repository assert.',
    });
  }

  await page.getByRole('tab', { name: /Inventar/i }).click();
  await expect(page.getByText(/^Last 0 \/ 13$/).first()).toBeVisible();
  await expect(page.getByText(/Inventar 0 \/ 20/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first()).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '07-inventory-load.png'), fullPage: true });

  await page.getByRole('tab', { name: /Spezies/i }).click();
  await page.getByPlaceholder('Charaktername').first().fill('');
  await page.getByRole('button', { name: /Speichern/i }).first().click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: /Namen|Bitte gib/i }).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '11-edge-invalid-build.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: /Inventar/i }).click();
  await expect(page.getByText(/Inventar 0 \/ 20/i).first()).toBeVisible();
  await expect(page.locator('[data-character-inventory-v2]')).toBeVisible();
  await expect(page.locator('[data-inventory-mobile-view-switch]')).toBeVisible();
  await expect(page.locator('[data-inventory-mobile-view="inventar"]')).toBeVisible();
  await expect(page.locator('[data-inventory-mobile-view="ausruestung"]')).toBeVisible();
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(noHorizontalOverflow).toBe(true);
  await page.locator('[data-inventory-mobile-view="ausruestung"]').click();
  await expect(page.locator('[data-inventory-mobile-panel="ausruestung"]')).toBeVisible();
  await expect(page.locator('[data-inventory-mobile-panel="inventar"]')).toHaveCount(0);
  await page.locator('[data-inventory-mobile-view="inventar"]').click();
  await expect(page.locator('[data-inventory-mobile-panel="inventar"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first()).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '07b-inventory-mobile-390.png'), fullPage: true });

  await page.getByRole('tab', { name: /^Spezies$/i }).click();
  const removeResistance = page.getByRole('button', { name: /Enge Resistenz abwählen|Enge Resistenz entfernen/i });
  if (await removeResistance.count()) {
    await removeResistance.first().click();
  }
  await page.getByRole('button', { name: /Enge Resistenz, 1 Punkt/i }).click();
  await expect(page.getByRole('combobox', { name: 'Enge Resistenz: Gefahrenart' })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '04-species-mobile-repeatable.png'), fullPage: true });

  await page.getByRole('tab', { name: /^Charakter$/i }).click();
  await page.getByRole('tab', { name: /^Hintergrund$/i }).click();
  await expect(page.getByRole('radio', { name: /Heilung & Fürsorge/i })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '12-mobile-competencies.png'), fullPage: true });
});
