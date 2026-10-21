#!/usr/bin/env node
/**
 * Inventory v2 equipment / container UI contract (#111).
 * Static checks that panels exist, import domain ops, and that the
 * CharacterInventoryV2Panel wires Ausrüstung (ohne Schnellzugriff-UI).
 * Location: scripts/inventory-equipment-ui-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
let group = '';

function read(relPath) {
  return readFileSync(new URL(`../${relPath}`, import.meta.url), 'utf8');
}

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: fehlt ${label}`);
  }
}

function rejectMatch(content, pattern, label) {
  if (pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: ${label}`);
  }
}

const requiredFiles = [
  'src/app/character/inventory/InventoryEquipmentPanel.tsx',
  'src/app/character/inventory/InventoryEquipmentPaperDollFigure.tsx',
  'src/app/character/inventory/InventoryEquipmentPaperDollHotspots.tsx',
  'src/app/character/inventory/InventoryContainerPanel.tsx',
  'src/app/character/inventory/inventory-equip-preview.ts',
  'src/app/character/inventory/inventory-ui-labels.ts',
  'src/app/character/inventory/CharacterInventoryV2Panel.tsx',
  'src/app/character/inventory/InventoryItemActions.tsx',
];

section('1 · Dateien vorhanden');
for (const rel of requiredFiles) {
  check(existsSync(`${root}/${rel}`), rel);
}

const equipment = read('src/app/character/inventory/InventoryEquipmentPanel.tsx');
const figure = read('src/app/character/inventory/InventoryEquipmentPaperDollFigure.tsx');
const container = read('src/app/character/inventory/InventoryContainerPanel.tsx');
const panel = read('src/app/character/inventory/CharacterInventoryV2Panel.tsx');
const actions = read('src/app/character/inventory/InventoryItemActions.tsx');
const labels = read('src/app/character/inventory/inventory-ui-labels.ts');
const grid = read('src/app/character/inventory/InventoryBaseGrid.tsx');
const allNew = [equipment, figure, container, panel, actions, labels, grid].join('\n');

section('2 · Domain-Ops importiert (kein Reimplementieren)');
for (const op of ['equipItem', 'unequipItem', 'moveIntoContainer', 'moveOutOfContainer']) {
  requireMatch(allNew, new RegExp(`\\b${op}\\b`), `Domain-Op ${op}`);
}
requireMatch(equipment, /from ['"].*domains\/character\/inventory-v2/, 'Equipment imports domain');
requireMatch(container, /from ['"].*domains\/character\/inventory-v2/, 'Container imports domain');

section('3 · Panel-Verdrahtung');
requireMatch(panel, /InventoryEquipmentPanel/, 'Panel rendert EquipmentPanel');
requireMatch(panel, /InventoryContainerPanel/, 'Panel rendert ContainerPanel');
requireMatch(panel, /lg:flex-row/, 'Layout flex-col lg:flex-row');
requireMatch(panel, /lg:w-96/, 'Aside lg:w-96 for paper-doll');
requireMatch(panel, /openContainerInstanceId/, 'Container open state');
rejectMatch(panel, /InventoryQuickSlotsBar/, 'Schnellzugriff-UI entfernt');
rejectMatch(allNew, /Schnellzugriff zuweisen/, 'Kein Schnellzugriff-Menü');

section('4 · Labels & Wortlaut');
requireMatch(labels, /EQUIPMENT_SLOT_LABELS/, 'EQUIPMENT_SLOT_LABELS');
requireMatch(labels, /EQUIPMENT_SLOT_HELP/, 'Slot help tooltips');
requireMatch(labels, /Helm|Stirnband/, 'Head help examples');
requireMatch(equipment, /Question|data-equipment-slot-help/, 'Slot help trigger');
requireMatch(labels, /Kopfbedeckung/, 'Category hint Kopf');
requireMatch(labels, /Schuhe \/ Fußschutz/, 'Category hint Füße');
requireMatch(labels, /feet:\s*'Füße'/, 'Label Füße');
requireMatch(equipment, /data-equipment-paper-doll/, 'Desktop paper-doll marker');
requireMatch(equipment, /InventoryEquipmentPaperDollFigure/, 'Paper-doll figure');
requireMatch(equipment, /InventoryEquipmentPaperDollHotspots/, 'Paper-doll hotspots');
requireMatch(equipment, /selectedSlot|data-equipment-slot-selected/, 'Sticky slot selection');
requireMatch(figure, /equipment-paper-doll\.png|data-equipment-paper-doll-figure/, 'Figure uses sketch asset');
requireMatch(equipment, /data-equipment-slot-square|InventoryItemThumb/, 'Square PNG slot tiles');
requireMatch(equipment, /md:hidden/, 'Mobile list fallback');
const hotspots = read('src/app/character/inventory/InventoryEquipmentPaperDollHotspots.tsx');
requireMatch(hotspots, /data-equipment-hotspot/, 'Hotspot markers');
requireMatch(hotspots, /data-equipment-hotspot-selected/, 'Sticky hotspot selection');
requireMatch(hotspots, /feet/, 'Feet hotspot');
const thumb = read('src/app/character/inventory/InventoryItemThumb.tsx');
requireMatch(thumb, /slots\/head|SLOT_ICONS/, 'Slot PNG placeholders');
requireMatch(thumb, /onError/, 'PNG missing → slot fallback');
requireMatch(labels, /Benötigt Stärke/, 'Strength copy helper');
requireMatch(labels, /Nicht genügend freie Inventarplätze/, 'Displace no-room copy');
requireMatch(equipment, /Ablegen ins Inventar/, 'Unequip wording');
requireMatch(equipment, /Zweihändig \/ gekoppelt/, 'Two-handed off-hand link');
requireMatch(actions, /Öffnen/, 'Container open action');
requireMatch(actions, /In Behälter verschieben/, 'Move into container action');
requireMatch(actions, /Aus Inventar entfernen/, 'Remove wording kept');
rejectMatch(actions, /Ablegen\b(?! ins Inventar)/, 'Bare Ablegen must not appear for delete');
rejectMatch(actions, /Ausrüstungs-UI folgt in #111/, 'Placeholder #111 toast removed');
rejectMatch(actions, /eslint-disable/, 'No eslint-disable in actions');
rejectMatch(allNew, /\bas any\b/, 'No as any');

section('5 · DnD instanceId');
requireMatch(grid, /application\/x-inventory-instance-id|INVENTORY_INSTANCE_DRAG_MIME/, 'Grid drag mime');
requireMatch(equipment, /application\/x-inventory-instance-id/, 'Equipment accepts instance drag');

check(failures === 0, `${failures} Fehler insgesamt`);

if (failures > 0) {
  console.error(`\ninventory-equipment-ui-check: ${failures} Fehler`);
  process.exit(1);
}

console.log('inventory-equipment-ui-check: OK');
