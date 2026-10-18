/**
 * AdaptivePage — Journey/Workstation page shell with AU gutters + safe areas (#482).
 * Gutters tighten in narrow main-pane containers (@container/main from Layout).
 * Location: src/shared/ui/adaptive/AdaptivePage.tsx
 */
import * as React from 'react';
import { cn } from '../utils';

export type AdaptivePageProps = React.ComponentProps<'div'> & {
  /** Optional sticky/header slot above the scroll body. */
  header?: React.ReactNode;
  /** Optional footer / action region (prefer AdaptiveActionBar for primary CTAs). */
  footer?: React.ReactNode;
  /** Extra classes for the body region (e.g. flex column for fill-remaining map). */
  bodyClassName?: string;
};

export function AdaptivePage({
  className,
  header,
  footer,
  bodyClassName,
  children,
  ...props
}: AdaptivePageProps) {
  return (
    <div
      data-slot="adaptive-page"
      data-au-pattern="page"
      className={cn(
        'flex min-h-0 min-w-0 w-full flex-1 flex-col bg-background text-foreground',
        className,
      )}
      {...props}
    >
      {header ? (
        <div
          data-slot="adaptive-page-header"
          className="shrink-0 border-b border-border px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 @[40rem]/main:px-6"
        >
          {header}
        </div>
      ) : null}
      <div
        data-slot="adaptive-page-body"
        className={cn(
          'min-h-0 min-w-0 w-full flex-1 overflow-x-hidden px-3 py-4 @[40rem]/main:px-6',
          bodyClassName ?? 'overflow-y-auto',
        )}
      >
        {children}
      </div>
      {footer ? (
        <div data-slot="adaptive-page-footer" className="shrink-0">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
