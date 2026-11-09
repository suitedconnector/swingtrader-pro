import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  Calculator,
  ChartLine,
  LayoutGrid,
  ListChecks,
  LogOut,
  Moon,
  Radar,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useLogout } from '@/hooks/use-logout';
import { useThemeContext } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Overview', href: '/', icon: LayoutGrid },
  { title: 'Scanner', href: '/scanner', icon: Radar },
  { title: 'Watchlists', href: '/watchlists', icon: ListChecks },
  { title: 'Alerts', href: '/alerts', icon: Bell },
  { title: 'Trade Planner', href: '/plan', icon: Calculator },
  { title: 'Positions', href: '/positions', icon: ChartLine },
  { title: 'Journal', href: '/journal', icon: BookOpen },
];

// Active item: no filled background; a short, thick accent line on the left.
const navButtonClass = cn(
  'relative text-sidebar-foreground',
  'data-[active=true]:bg-transparent data-[active=true]:text-sidebar-accent-foreground',
  "before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-signal-info before:opacity-0 before:content-['']",
  'data-[active=true]:before:opacity-100'
);

function isActive(location: string, href: string) {
  return href === '/' ? location === '/' : location === href || location.startsWith(`${href}/`);
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { logout, isLoggingOut } = useLogout();
  const { theme, toggleTheme } = useThemeContext();

  const { data: profile } = useQuery<{ tradingBankroll?: string }>({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });

  const bankroll = Number(profile?.tradingBankroll);
  const bankrollText = Number.isFinite(bankroll)
    ? bankroll.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '—';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 pb-2 pt-5 group-data-[collapsible=icon]:px-2">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <span aria-hidden="true" className="h-4 w-[3px] shrink-0 rounded-full bg-signal-info" />
          <span className="truncate group-data-[collapsible=icon]:hidden">SwingTrader Pro</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(location, item.href)}
                    tooltip={item.title}
                    className={navButtonClass}
                  >
                    <Link href={item.href}>
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 px-2 pb-4">
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Bankroll</div>
          <div className="mt-1 font-mono text-sm tabular-nums text-foreground">{bankrollText}</div>
        </div>

        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(location, '/profile')}
              tooltip="Settings"
              className={navButtonClass}
            >
              <Link href="/profile">
                <Settings aria-hidden="true" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="text-sidebar-foreground"
            >
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              disabled={isLoggingOut}
              tooltip="Log out"
              className="text-sidebar-foreground"
            >
              <LogOut aria-hidden="true" />
              <span className="truncate">
                {isLoggingOut ? 'Logging out…' : user?.username ? `Log out · ${user.username}` : 'Log out'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
