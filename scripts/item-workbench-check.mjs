#!/usr/bin/env node
/**
 * item-workbench-check — UI/architecture contract for Item Workbench (#139).
 * Location: scripts/item-workbench-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function mustExist(relPath) {
  check(existsSync(join(root, relPath)), `missing ${relPath}`);
}

section('1 · slice files exist');
[
  'src/app/items/workbench/index.ts',
  'src/app/items/workbench/ItemWorkbenchScreen.tsx',
  'src/app/items/workbench/useItemEditor.ts',
  'src/app/items/workbench/ItemWorkbenchLanding.tsx',
  'src/app/items/workbench/ItemWorkbenchEditor.tsx',
  'src/app/items/workbench/ItemWorkbenchTopbar.tsx',
  'src/app/items/workbench/ItemTypePickerDialog.tsx',
  'src/app/items/workbench/ItemVisualsPanel.tsx',
  'src/app/items/workbench/ItemBasicsSection.tsx',
  'src/app/items/workbench/ItemTaxonomySection.tsx',
  'src/app/items/workbench/ItemRulesSection.tsx',
  'src/app/items/workbench/ItemAvailabilitySection.tsx',
  'src/app/items/workbench/ItemForkDialog.tsx',
  'src/app/items/workbench/ItemArchiveDialog.tsx',
  'src/app/items/workbench/workbenchForm.ts',
  'src/app/items/workbench/workbenchLabels.ts',
  'src/assets/items/workbench-line-art.svg',
  '.qa/acceptance/item-workbench.md',
  '.qa/acceptance/item-workbench-forge-layout.md',
  'e2e/item-workbench.spec.ts',
].forEach(mustExist);

section('2 · App wires workbench routes');
{
  const app = read('src/App.tsx');
  check(/ItemWorkbenchScreen/.test(app), 'App imports ItemWorkbenchScreen');
  check(/route=["']create["']/.test(app), 'create route wired');
  check(/route=["']detail["']/.test(app), 'detail route wired');
  check(!/ItemCreatePlaceholder/.test(app), 'create placeholder removed from App');
  check(!/ItemDetailPlaceholder/.test(app), 'detail placeholder removed from App');
}

section('3 · no Supabase in workbench slice');
{
  const files = [
    'src/app/items/workbench/useItemEditor.ts',
    'src/app/items/workbench/ItemWorkbenchScreen.tsx',
    'src/app/items/workbench/workbenchForm.ts',
  ];
  for (const file of files) {
    const content = read(file);
    check(!/from ['"].*supabase/.test(content), `${file} must not import supabase`);
    check(!/supabase\.from/.test(content), `${file} must not query supabase`);
  }
}

section('4 · persistence via catalog service');
{
  const hook = read('src/app/items/workbench/useItemEditor.ts');
  check(/getItemDefinitionById/.test(hook), 'loads via getItemDefinitionById');
  check(/createPersonalDefinition/.test(hook), 'creates personal via service');
  check(/createWorldDefinition/.test(hook), 'creates world via service');
  check(/updateDefinition/.test(hook), 'updates via service');
  check(/forkDefinition/.test(hook), 'forks via service');
  check(/archiveDefinition/.test(hook), 'archives via service');
  check(/setNavigationBlocker/.test(hook), 'registers dirty navigation blocker');
  check(/Ungespeicherte Änderungen verwerfen\?/.test(hook) || /DIRTY_LEAVE_MESSAGE/.test(hook), 'dirty message');
}

section('5 · catalog service exposes getItemDefinitionById + builtin fork');
{
  const service = read('src/infrastructure/inventory/item-catalog-service.ts');
  check(/getItemDefinitionById/.test(service), 'service exports getItemDefinitionById');
  check(/fetchHostLibraryItem/.test(service), 'service loads persisted defs via host HTTP');
  check(/getBuiltinStandardDefinition/.test(service), 'builtin fork/load resolution');
}

section('6 · UX contract strings / a11y hooks');
{
  const landing = read('src/app/items/workbench/ItemWorkbenchLanding.tsx');
  const topbar = read('src/app/items/workbench/ItemWorkbenchTopbar.tsx');
  const labels = read('src/app/items/workbench/workbenchLabels.ts');
  const screen = read('src/app/items/workbench/ItemWorkbenchScreen.tsx');
  const editor = read('src/app/items/workbench/ItemWorkbenchEditor.tsx');

  check(/Klicke hier, um ein Item zu erstellen/.test(landing), 'landing CTA copy');
  check(/data-item-workbench-landing/.test(landing), 'landing data hook');
  check(/data-item-workbench-art/.test(landing), 'line-art data hook');
  check(/Zurück zu Items/.test(topbar), 'back copy');
  check(/Speichern/.test(screen) || /Speichern/.test(topbar) || /Speichern/.test(editor), 'save CTA');
  check(/Als eigenes Item verwenden/.test(screen), 'fork CTA copy');
  check(/Waffe/.test(labels) && /Gerät/.test(labels) && /Verbrauchsgut/.test(labels), 'type picker labels');
  check(/md:grid-cols-\[minmax\(0,18rem\)_minmax\(0,1fr\)\]/.test(editor), 'desktop two-column forge grid');
  check(/data-item-workbench-panel-scroll="details"/.test(editor), 'details panel scroll container');
  check(/overflow-y-auto/.test(editor) && /md:overflow-hidden/.test(read('src/app/items/workbench/ItemWorkbenchEditor.tsx')), 'right scrolls, left fixed');
  check(/h-full min-h-0/.test(screen) && /overflow-hidden/.test(screen), 'screen fills main without outer scroll');
  check(/order-1/.test(editor) && /order-2/.test(editor), 'mobile stack order');
  check(/data-item-workbench-panel="visuals-basics"/.test(editor), 'kind+basics under visuals');
  check(/ItemKindField/.test(editor) && /ItemBasicsSection/.test(editor), 'Item-Art and name under visuals');
  check(/data-item-workbench-setting-tech/.test(read('src/app/items/workbench/ItemTaxonomySection.tsx')), 'setting + tech-level row');
  check(!/wb-basics/.test(read('src/app/items/workbench/ItemBasicsSection.tsx')), 'no Basisdaten heading');
  check(!/ItemWorkbenchStage/.test(editor), 'stage square removed');
  check(/ItemVisualModeToggle/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), '2D/3D visuals toggle composed');
  check(/data-item-workbench-visual-toggle/.test(read('src/app/items/visuals/ItemVisualModeToggle.tsx')), '2D/3D visuals toggle');
  check(!/ItemWorkbenchFlowLines/.test(editor), 'flow lines removed from editor');
  check(/animateExpand/.test(editor), 'create expand-out animation hook');
  check(/data-item-workbench-primary/.test(topbar), 'save/fork primary in topbar');
  check(/hidePrimary=\{editor\.mode === 'landing'\}/.test(screen), 'topbar save visible on create/edit');
  check(!/data-item-workbench-save-slot/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'no save under visuals');
  check(!/data-item-workbench-art/.test(editor), 'no workbench art in forge editor');
  check(/isTypePickerVisible/.test(read('src/app/items/workbench/useItemEditor.ts')), 'type picker mode-gated visibility');
  check(/requestKindChange/.test(read('src/app/items/workbench/useItemEditor.ts')), 'Item-Art dropdown applies type template');
  check(/onKindChange/.test(read('src/app/items/workbench/ItemKindField.tsx')), 'kind field change callback');
  check(!/>Typ-Vorlage/.test(read('src/app/items/workbench/ItemTaxonomySection.tsx')), 'no Typ-Vorlage button');
  check(/handleTypePickerOpenChange/.test(read('src/app/items/workbench/useItemEditor.ts')), 'type picker ignores Radix reopen');
  check(/onNavigateToCreateType/.test(read('src/app/items/workbench/useItemEditor.ts')), 'type pick navigates to typed create URL');
  check(/workbenchEntryBySlug/.test(read('src/app/items/workbench/useItemEditor.ts')), 'typed create hydrates from slug');
  check(/slug: 'waffe'/.test(labels), 'German URL slug for Waffe');
  check(/createTypeSlug/.test(read('src/App.tsx')), 'App passes createTypeSlug from route');
  check(/navigateToItemCreateType/.test(read('src/App.tsx')), 'App navigates typed create');
  check(/min-h-11/.test(topbar), 'topbar ≥44px targets');
  check(/ensureDraftId/.test(read('src/app/items/workbench/useItemEditor.ts')), 'auto-draft for assets');
  check(/ensureDraftId=\{editor\.ensureDraftId\}/.test(screen), 'screen wires ensureDraftId');
  check(/assets\.canEdit/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'upload UI when editable without save-first');
  check(!/Speichere das Item zuerst/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'no save-first asset copy');
  check(/data-item-workbench-visual-dropzone/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'fixed visuals dropzone');
  check(/onDrop/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'drag-drop upload');
  check(/useItemVisualTools/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'visuals tools hook composed');
  check(/ItemVisualToolsBar/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'visuals tools bar composed');
  {
    const toolsBar = read('src/app/items/visuals/ItemVisualToolsBar.tsx');
    check(/data-item-workbench-visual-upload/.test(toolsBar), 'visuals upload affordance');
    check(/data-item-workbench-visual-enlarge/.test(toolsBar), 'visuals enlarge preview');
    check(/data-item-workbench-visual-convert/.test(toolsBar), 'visuals 2D/3D convert');
    check(/data-item-workbench-visual-to-2d/.test(toolsBar), 'visuals arrow to 2D');
    check(/data-item-workbench-visual-to-3d/.test(toolsBar), 'visuals arrow to 3D');
    check(/data-item-workbench-visual-generate-2d/.test(toolsBar), 'visuals 2D generate');
    check(/data-item-workbench-visual-tools/.test(toolsBar), 'visuals tool row');
  }
  check(/captureSideProfilePng/.test(read('src/app/items/workbench/ItemModelPreviewRuntime.ts')), '3D side-profile snapshot');
  check(/preserveDrawingBuffer:\s*true/.test(read('src/app/items/workbench/ItemModelPreviewRuntime.ts')), 'WebGL preserveDrawingBuffer for snapshot');
  check(/data-item-workbench-visual-preview-modal/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'visuals enlarge modal');
  check(/h-44/.test(read('src/app/items/workbench/ItemVisualsPanel.tsx')), 'stable dropzone height');
  check(/queuePendingItemAsset/.test(read('src/app/items/visuals/useItemAssets.ts')), 'pending asset across remount');
  check(/useItemVisualTools/.test(read('src/app/items/index.ts')), 'items barrel exports visual tools');
  check(/data-item-workbench-world-draft-hint/.test(read('src/app/items/workbench/ItemAvailabilitySection.tsx')), 'world→personal auto-draft hint');
  check(/Als persönliches Item angelegt/.test(read('src/app/items/workbench/useItemEditor.ts')), 'toast when world draft falls back');
  {
    const layout = read('src/app/shell/Layout.tsx');
    const childrenMounts = (layout.match(/\{children\}/g) || []).length;
    check(childrenMounts === 1, 'single children mount (no remount on resize)');
    check(/data-app-shell=\{isDesktop \? 'desktop' : 'mobile'\}/.test(layout), 'data-app-shell desktop|mobile marker');
    check(/hidden md:flex/.test(layout) && /md:hidden/.test(layout), 'CSS chrome toggle (stable route state)');
    check(/matchMedia/.test(layout), 'shell marker via matchMedia');
  }
  check(/Item erstellt/.test(read('src/app/items/workbench/useItemEditor.ts')), 'create toast');
  check(/Item gespeichert/.test(read('src/app/items/workbench/useItemEditor.ts')), 'save toast');
}

section('7 · original asset (no watermarked reference path)');
{
  const art = read('src/assets/items/workbench-line-art.svg');
  check(/Original SagaTree workbench/.test(art), 'asset marked original');
  check(!/watermark/i.test(art), 'no watermark content');
  check(!/shutterstock|getty|adobe stock/i.test(art), 'no stock attribution');
}

if (failures > 0) {
  console.error(`item-workbench-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('item-workbench-check: OK');
