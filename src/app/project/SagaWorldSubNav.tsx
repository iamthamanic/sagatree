/**
 * SagaWorldSubNav — Welt content subtabs (Karte / NPCs / items / quests / lore).
 * Location: src/app/project/SagaWorldSubNav.tsx
 */
import { BookOpen, Map, Package, ScrollText, Users } from 'lucide-react';
import {
  pathSectionForWorldSub,
  resolveSagaWorldSub,
  type SagaWorldSubId,
} from '../../domains/project/contracts/saga-workspace-nav';
import { Tabs, TabsList, TabsTrigger } from '../../shared/ui/tabs';
import type { SagaSectionId } from '../shell';
import { pathForSagaSection } from '../shell';

const WORLD_TABS: readonly {
  id: SagaWorldSubId;
  label: string;
  icon: typeof Map;
}[] = [
  { id: 'map', label: 'Karte', icon: Map },
  { id: 'npc-creatures', label: 'NSCs / Kreaturen', icon: Users },
  { id: 'items', label: 'Gegenstände', icon: Package },
  { id: 'quests', label: 'Quests', icon: ScrollText },
  { id: 'lore', label: 'Lore / Verlauf', icon: BookOpen },
];

export type SagaWorldSubNavProps = {
  sagaPublicId: string;
  active: SagaSectionId;
  onNavigate: (view: string) => void;
};

export function SagaWorldSubNav({
  sagaPublicId,
  active,
  onNavigate,
}: SagaWorldSubNavProps) {
  const sub = resolveSagaWorldSub(active) ?? 'map';

  return (
    <Tabs
      value={sub}
      onValueChange={(value) => {
        const next = value as SagaWorldSubId;
        onNavigate(pathForSagaSection(sagaPublicId, pathSectionForWorldSub(next)));
      }}
      className="@container w-full min-w-0"
      data-saga-world-subnav
    >
      <TabsList className="grid h-auto w-full max-w-full min-w-0 grid-cols-2 gap-1 @[36rem]:grid-cols-3 @[48rem]:grid-cols-5">
        {WORLD_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="min-h-11 min-w-0 max-w-full gap-1.5 px-2 text-xs sm:text-sm"
              data-saga-world-sub={tab.id}
              onClick={() => {
                onNavigate(pathForSagaSection(sagaPublicId, pathSectionForWorldSub(tab.id)));
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
