/**
 * SagaWorkspaceNav — Top chrome: Übersicht / Welt / Einstellungen (#saga-workspace-ia).
 * Location: src/app/project/SagaWorkspaceNav.tsx
 *
 * Library-style TabsList grid; deep-link sections map via resolveSagaWorkspaceTop.
 */
import {
  BookOpen,
  Layout,
  Gear
} from '@phosphor-icons/react';
import {
  pathSectionForTop,
  resolveSagaWorkspaceTop,
  type SagaWorkspaceTopId,
} from '../../domains/project/contracts/saga-workspace-nav';
import { Tabs, TabsList, TabsTrigger } from '../../shared/ui/tabs';
import type { SagaSectionId } from '../shell';
import { pathForSagaSection } from '../shell';

const TOP_TABS: readonly {
  id: SagaWorkspaceTopId;
  label: string;
  icon: typeof Layout;
}[] = [
  { id: 'overview', label: 'Übersicht', icon: Layout },
  { id: 'world', label: 'Welt', icon: BookOpen },
  { id: 'settings', label: 'Einstellungen', icon: Gear },
];

export type SagaWorkspaceNavProps = {
  sagaPublicId: string;
  active: SagaSectionId;
  onNavigate: (view: string) => void;
};

export function SagaWorkspaceNav({
  sagaPublicId,
  active,
  onNavigate,
}: SagaWorkspaceNavProps) {
  const top = resolveSagaWorkspaceTop(active);

  return (
    <Tabs
      value={top}
      onValueChange={(value) => {
        const next = value as SagaWorkspaceTopId;
        onNavigate(pathForSagaSection(sagaPublicId, pathSectionForTop(next)));
      }}
      className="@container w-full min-w-0"
      data-saga-workspace-nav
    >
      <TabsList
        className="grid h-auto w-full max-w-full min-w-0 grid-cols-3 gap-1"
        aria-label="Saga-Bereiche"
      >
        {TOP_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="min-h-11 min-w-0 max-w-full gap-1.5 px-2 text-xs sm:text-sm"
              data-saga-nav={tab.id}
              onClick={() => {
                // Click fallback — Radix activates primarily on mousedown.
                onNavigate(pathForSagaSection(sagaPublicId, pathSectionForTop(tab.id)));
              }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
