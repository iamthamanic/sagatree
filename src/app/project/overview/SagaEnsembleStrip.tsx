/**
 * SagaEnsembleStrip — Ensemble panel with linked account + character avatars.
 * Account avatar connected to character portrait; identity pills + full-text filter.
 * Location: src/app/project/overview/SagaEnsembleStrip.tsx
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Leaf,
  Link,
  MagnifyingGlass
} from '@phosphor-icons/react';
import {
  ensembleMemberSearchHaystack,
  type EnsembleCharacterIdentityVm,
} from '../../../domains/character/use-cases/ensemble-character-identity';
import { GM_DEFAULT_CHARACTER_ROLE_LABEL } from '../../../domains/character/use-cases/sagatree-native-gm-presence';
import {
  initialsFromDisplayName,
} from '../../../domains/user-profile';
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar';
import { Input } from '../../../shared/ui/input';
import { cn } from '../../../shared/ui/utils';
import { ArchetypeIcon, EssenceIcon } from '../../character';
import { useAccountAvatar } from '../../shell';
import type { SagaEnsembleMemberWithAccount } from '../hooks/useSagaEnsembleProfiles';

export type SagaEnsembleStripProps = {
  ensemble: readonly SagaEnsembleMemberWithAccount[];
  onManageCharacters?: () => void;
  /** GM presence portrait when no PC is bound. */
  gmWorldPortraitUrl?: string | null;
};

function roleLabel(role: string): string {
  if (role === 'gamemaster' || role === 'gm') return 'Gamemaster';
  if (role === 'viewer' || role === 'observer') return 'Beobachter';
  return 'Spieler';
}

/**
 * IdentityStatPills — Scanable facet strip: Level badge + labeled species/archetype/essence.
 * Each facet keeps its own color + micro-label so the row does not read as one mushy chip string.
 */
function IdentityStatPills({ identity }: { identity: EnsembleCharacterIdentityVm }) {
  const facets: {
    key: string;
    category: string;
    value: string;
    className: string;
    icon?: ReactNode;
  }[] = [];

  if (identity.level != null) {
    facets.push({
      key: 'level',
      category: 'Level',
      value: String(identity.level),
      className:
        'border-primary/40 bg-primary/15 text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent)]',
    });
  }
  if (identity.speciesLabel) {
    facets.push({
      key: 'species',
      category: 'Spezies',
      value: identity.speciesLabel,
      className:
        'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      icon: <Leaf className="size-3 shrink-0 opacity-80" aria-hidden />,
    });
  }
  if (identity.archetypeLabel) {
    facets.push({
      key: 'archetype',
      category: 'Archetyp',
      value: identity.archetypeLabel,
      className:
        'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200',
      icon: identity.archetypeKey ? (
        <ArchetypeIcon archetypeKey={identity.archetypeKey} className="size-3 shrink-0 opacity-90" />
      ) : undefined,
    });
  }
  if (identity.essenceLabel) {
    facets.push({
      key: 'essence',
      category: 'Essenz',
      value: identity.essenceLabel,
      className:
        'border-violet-500/35 bg-violet-500/10 text-violet-800 dark:text-violet-200',
      icon: identity.essenceKey ? (
        <EssenceIcon essenceKey={identity.essenceKey} className="size-3 shrink-0 opacity-90" />
      ) : undefined,
    });
  }
  if (facets.length === 0) return null;

  return (
    <ul
      className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5"
      data-saga-hub-ensemble-identity
      aria-label="Charakter-Identität"
    >
      {facets.map((facet) => (
        <li
          key={facet.key}
          className={cn(
            'inline-flex max-w-full min-h-7 items-center gap-1.5 rounded-md border px-2.5 py-1',
            facet.className,
          )}
          data-saga-hub-ensemble-stat={facet.key}
          title={`${facet.category}: ${facet.value}`}
        >
          {facet.key === 'level' ? (
            <>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-75">
                Lv
              </span>
              <span className="font-mono text-sm font-bold leading-none tabular-nums">
                {facet.value}
              </span>
            </>
          ) : (
            <>
              {facet.icon}
              <span className="flex min-w-0 flex-col leading-none">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-65">
                  {facet.category}
                </span>
                <span className="mt-0.5 truncate text-[11px] font-semibold">{facet.value}</span>
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function LinkedAvatars(props: {
  accountName: string;
  accountAvatarUrl: string | null;
  characterName: string | null;
  characterPortraitUrl: string | null;
  isGamemaster: boolean;
}) {
  const hasCharacter = Boolean(props.characterName?.trim());
  const isGmRole = props.isGamemaster && !hasCharacter;
  const characterInitials = hasCharacter
    ? initialsFromDisplayName(props.characterName)
    : isGmRole
      ? 'GM'
      : '?';

  return (
    <div
      className="flex shrink-0 items-center"
      data-saga-hub-ensemble-linked-avatars
      aria-hidden
    >
      <Avatar
        className="relative z-10 size-14 rounded-xl border border-border"
        data-saga-hub-ensemble-avatar
      >
        {props.accountAvatarUrl ? (
          <AvatarImage
            src={props.accountAvatarUrl}
            alt=""
          />
        ) : null}
        <AvatarFallback className="rounded-xl text-base font-bold text-cyan-400">
          {initialsFromDisplayName(props.accountName)}
        </AvatarFallback>
      </Avatar>

      {/*
        Bond chip: account ↔ character. Primary pill + Link sits above the frames
        so the binding reads as intentional UI chrome, not a lost hairline.
      */}
      <span
        className="relative z-20 -mx-2.5 flex h-14 w-7 shrink-0 items-center justify-center"
        data-saga-hub-ensemble-avatar-link
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-primary/70 to-transparent"
        />
        <span
          aria-hidden
          className="relative flex size-6 items-center justify-center rounded-full border border-primary/55 bg-card text-primary ring-2 ring-background shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]"
        >
          <Link className="size-3 stroke-[2.5]" />
        </span>
      </span>

      <Avatar
        className={
          hasCharacter || isGmRole
            ? 'relative z-10 size-14 rounded-xl border border-border bg-gradient-to-br from-slate-600 to-slate-800'
            : 'relative z-10 size-14 rounded-xl border border-dashed border-border/70 opacity-70'
        }
        data-saga-hub-ensemble-character-avatar={isGmRole ? 'gamemaster' : 'character'}
      >
        {props.characterPortraitUrl ? (
          <AvatarImage
            src={props.characterPortraitUrl}
            alt=""
            className="object-cover"
          />
        ) : null}
        <AvatarFallback
          className={
            isGmRole
              ? 'rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-base font-bold text-cyan-400'
              : 'rounded-xl text-base font-bold text-amber-500/90'
          }
        >
          {characterInitials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

export function SagaEnsembleStrip({
  ensemble,
  onManageCharacters,
  gmWorldPortraitUrl = null,
}: SagaEnsembleStripProps) {
  // Live account avatar for self — same store as shell sidebar (#682).
  // Ensemble batch fetch alone stays stale after upload (blob/signed URL).
  const { avatarUrl: selfAccountAvatarUrl } = useAccountAvatar();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return ensemble;
    return ensemble.filter((member) => {
      const role = roleLabel(String(member.role));
      const haystack = ensembleMemberSearchHaystack({
        accountDisplayName: member.accountDisplayName,
        characterName: member.characterName,
        roleLabel: role,
        identity: member.identity,
      });
      return haystack.includes(needle);
    });
  }, [ensemble, searchQuery]);

  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card"
      data-saga-overview-ensemble
      aria-labelledby="saga-overview-ensemble-title"
    >
      <div className="flex shrink-0 flex-col gap-2.5 px-4 pb-2.5 pt-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h3 id="saga-overview-ensemble-title" className="text-[1.05rem] font-bold text-foreground">
              Spieler-Charakter Ensemble
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {ensemble.length === 0
                ? 'Noch keine aktiven Mitglieder.'
                : searchQuery.trim()
                  ? `${filtered.length} von ${ensemble.length} aktiv`
                  : `${ensemble.length} aktiv`}
            </p>
          </div>
        </div>
        <div className="relative min-w-0">
          <MagnifyingGlass
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Ensemble durchsuchen…"
            className="pl-10"
            aria-label="Spieler-Charakter Ensemble durchsuchen"
            data-saga-hub-ensemble-search
          />
        </div>
      </div>

      {ensemble.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Lade Spieler ein, sobald die Saga läuft.
        </p>
      ) : filtered.length === 0 ? (
        <p
          className="px-4 pb-4 text-sm text-muted-foreground"
          data-saga-hub-ensemble-search-empty
        >
          Keine Treffer für „{searchQuery.trim()}“.
        </p>
      ) : (
        <ul
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3"
          data-saga-overview-ensemble-list
        >
          {filtered.map((member) => {
            const isGm = member.role === 'gamemaster' || member.role === 'gm';
            const characterLabel =
              member.characterName?.trim() ||
              (isGm ? GM_DEFAULT_CHARACTER_ROLE_LABEL : 'Keine Figur gewählt');
            const displayName = member.isSelf
              ? `${member.accountDisplayName} · du`
              : member.accountDisplayName;

            return (
              <li
                key={member.userId}
                className="flex min-h-[4.5rem] items-center gap-3.5 rounded-xl border border-transparent px-3 py-2.5 hover:border-border hover:bg-white/[0.03]"
                data-saga-overview-ensemble-member={member.userId}
              >
                <LinkedAvatars
                  accountName={member.accountDisplayName}
                  accountAvatarUrl={
                    member.isSelf
                      ? selfAccountAvatarUrl || member.avatarUrl
                      : member.avatarUrl
                  }
                  characterName={member.characterName}
                  characterPortraitUrl={
                    member.characterPortraitUrl
                    ?? (isGm && !member.characterName?.trim() ? gmWorldPortraitUrl : null)
                  }
                  isGamemaster={isGm}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-base font-bold leading-snug text-foreground"
                    data-lobby-account-name
                  >
                    {displayName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {roleLabel(String(member.role))}
                    {' · '}
                    <span data-saga-hub-ensemble-character>{characterLabel}</span>
                  </p>
                  {member.identity ? <IdentityStatPills identity={member.identity} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {onManageCharacters ? (
        <div className="shrink-0 border-t border-border px-3 py-3">
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-transparent px-4 text-sm font-semibold text-foreground hover:border-amber-500/50 hover:text-amber-500"
            data-saga-hub-characters
            onClick={onManageCharacters}
          >
            Spieler-Charaktere verwalten
          </button>
        </div>
      ) : null}
    </section>
  );
}
