import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Shared layout primitives for the dashboard redesign.
 * Hierarchy comes from spacing, type and alignment, not containers:
 * no borders, shadows, gradients or card backgrounds. Accent colors
 * appear only through AccentBar / Stat indicators.
 */

export type Signal = 'up' | 'down' | 'info' | 'warn' | 'neutral';

const SIGNAL_BG: Record<Signal, string> = {
  up: 'bg-signal-up',
  down: 'bg-signal-down',
  info: 'bg-signal-info',
  warn: 'bg-signal-warn',
  neutral: 'bg-muted-foreground/40',
};

const SIGNAL_TEXT: Record<Signal, string> = {
  up: 'text-signal-up',
  down: 'text-signal-down',
  info: 'text-signal-info',
  warn: 'text-signal-warn',
  neutral: 'text-foreground',
};

/** Short, thick accent line used as a status indicator. */
export function AccentBar({
  signal = 'info',
  orientation = 'horizontal',
  className,
}: {
  signal?: Signal;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 rounded-full',
        orientation === 'horizontal' ? 'h-[3px] w-6' : 'h-4 w-[3px]',
        SIGNAL_BG[signal],
        className
      )}
    />
  );
}

/** Page title row with optional description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4 pb-8', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A titled block of content separated by whitespace, not a card. */
export function Section({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('py-6 first:pt-0', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && (
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label/value metric with an optional accent indicator. */
export function Stat({
  label,
  value,
  hint,
  signal,
  colorValue = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  signal?: Signal;
  /** Tint the value with the signal color (use sparingly). */
  colorValue?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-2">
        {signal && <AccentBar signal={signal} className="w-4" />}
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div
        className={cn(
          'mt-2 font-mono text-xl tabular-nums',
          colorValue && signal ? SIGNAL_TEXT[signal] : 'text-foreground'
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Quiet placeholder for empty lists and tables. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('py-12 text-center', className)}>
      <p className="text-sm text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
