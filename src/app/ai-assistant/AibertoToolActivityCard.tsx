/**
 * AibertoToolActivityCard — Tool-Activity UI for Read/Nav tools (AIB-06 / #1129).
 * Location: src/app/ai-assistant/AibertoToolActivityCard.tsx
 *
 * Shows tool id + DE status. Labels are static; tool ids are plain text (no HTML).
 */
import { CheckCircle, WarningCircle, SpinnerGap, Prohibit } from '@phosphor-icons/react';
import { Badge } from '../../shared/ui/badge';

export type AibertoToolActivityStatus = 'pending' | 'ok' | 'denied' | 'error';

export type AibertoToolActivity = {
  readonly id: string;
  readonly toolId: string;
  readonly labelDe: string;
  readonly status: AibertoToolActivityStatus;
  readonly detail?: string;
};

export type AibertoToolActivityCardProps = {
  readonly activity: AibertoToolActivity;
};

function statusIcon(status: AibertoToolActivityStatus) {
  switch (status) {
    case 'ok':
      return <CheckCircle size={16} weight="regular" aria-hidden className="text-primary" />;
    case 'denied':
      return <Prohibit size={16} weight="regular" aria-hidden className="text-destructive" />;
    case 'error':
      return <WarningCircle size={16} weight="regular" aria-hidden className="text-destructive" />;
    default:
      return <SpinnerGap size={16} weight="regular" aria-hidden className="animate-spin" />;
  }
}

function statusLabel(status: AibertoToolActivityStatus): string {
  switch (status) {
    case 'ok':
      return 'Erfolgreich';
    case 'denied':
      return 'Verweigert';
    case 'error':
      return 'Fehler';
    default:
      return 'Läuft…';
  }
}

export function AibertoToolActivityCard({ activity }: AibertoToolActivityCardProps) {
  return (
    <li
      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
      data-aiberto-tool-activity
      data-aiberto-tool-id={activity.toolId}
      data-aiberto-tool-status={activity.status}
      aria-label={`Tool ${activity.labelDe}: ${statusLabel(activity.status)}`}
    >
      <div className="flex items-center gap-2">
        {statusIcon(activity.status)}
        <span className="font-medium text-foreground">{activity.labelDe}</span>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {activity.toolId}
        </Badge>
      </div>
      {activity.detail ? (
        <p className="mt-1 text-muted-foreground" data-aiberto-tool-detail>
          {activity.detail}
        </p>
      ) : null}
    </li>
  );
}

export function AibertoToolActivityList({
  activities,
}: {
  readonly activities: readonly AibertoToolActivity[];
}) {
  if (activities.length === 0) return null;
  return (
    <ul className="space-y-2" data-aiberto-tool-activity-list>
      {activities.map((activity) => (
        <AibertoToolActivityCard key={activity.id} activity={activity} />
      ))}
    </ul>
  );
}
