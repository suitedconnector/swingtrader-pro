import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';

/**
 * Signed-in application frame: persistent left sidebar plus the page area.
 * The sidebar collapses to icons on desktop (Ctrl/Cmd+B) and becomes a
 * slide-out panel on mobile.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-12 items-center px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        </div>
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-2 lg:px-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
