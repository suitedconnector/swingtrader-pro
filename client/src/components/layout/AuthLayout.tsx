import type { ReactNode } from 'react';
import { AccentBar } from './primitives';

/** Centered, container-free frame for the signed-out pages. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <AccentBar orientation="vertical" />
          SwingTrader Pro
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}
