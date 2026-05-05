import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Shield,
  CreditCard,
  Users,
  FolderKanban,
  ClipboardList,
  Users2,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  LinkIcon,
  ChevronLeft,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'fh-admin-sidebar-collapsed';

const COLLAPSED_RAIL_WIDTH = 'w-[5.25rem]';
const EXPANDED_SIDEBAR_WIDTH = 'w-[260px]';

const adminItems = [
  { to: '/admin/roles', label: 'Manage Roles', icon: Shield },
  { to: '/admin/accounts', label: 'Manage Accounts', icon: CreditCard },
  { to: '/admin/projects', label: 'Manage Projects', icon: FolderKanban },
  { to: '/admin/clients', label: 'Manage Clients', icon: Users },
  { to: '/admin/tasks', label: 'Manage Tasks', icon: ClipboardList },
  { to: '/admin/personnel', label: 'Manage Personnel', icon: Users2 },
  { to: '/admin/useful-links', label: 'Manage Links', icon: LinkIcon },
];

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

const railMenuLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex h-10 w-full min-w-0 shrink-0 items-center justify-center rounded-sm py-2 text-sm font-medium tracking-tight transition-colors',
    'before:pointer-events-none before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:content-[""]',
    isActive
      ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:bg-primary'
      : 'text-sidebar-foreground before:bg-transparent hover:bg-muted/80 hover:text-sidebar-foreground hover:before:bg-sidebar-border',
  );

const railBackLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex h-10 w-full min-w-0 shrink-0 items-center justify-center rounded-sm py-2 text-sm font-medium tracking-tight transition-colors',
    'before:pointer-events-none before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-transparent before:content-[""]',
    'text-muted-foreground hover:bg-muted hover:text-foreground hover:before:bg-sidebar-border',
    isActive && 'bg-muted/60 text-foreground',
  );

const railChromeRowClass =
  'relative flex h-10 w-full min-w-0 shrink-0 items-center justify-center rounded-sm py-2 text-muted-foreground transition-colors before:pointer-events-none before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-transparent before:content-[""] hover:bg-muted/80 hover:text-sidebar-foreground hover:before:bg-sidebar-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background';

function AdminRailNavItem({
  to,
  label,
  icon: Icon,
  isActive,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof Shield;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const link = (
    <NavLink to={to} onClick={onNavigate} title={label} aria-current={isActive ? 'page' : undefined} className={() => railMenuLinkClass({ isActive })}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
    </NavLink>
  );

  return (
    <li className="w-full min-w-0 shrink-0 list-none">
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

function AdminDesktopRail({
  onNavigate,
  onExpand,
  onSignOut,
}: {
  onNavigate: () => void;
  onExpand: () => void;
  onSignOut: () => void;
}) {
  const { pathname } = useLocation();
  const isPathActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="flex h-full min-w-0 flex-col bg-sidebar">
      <div className="shrink-0 border-b border-sidebar-border bg-card">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button type="button" className={railChromeRowClass} aria-label="Show full menu" onClick={onExpand}>
              <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Show menu</TooltipContent>
        </Tooltip>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-gutter:stable]" aria-label="Admin">
        <ul className="flex flex-col gap-0.5">
          <li className="w-full min-w-0 shrink-0 list-none">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <NavLink to="/dashboard" end onClick={onNavigate} title="Back to app" className={railBackLinkClass}>
                  <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Back to app
              </TooltipContent>
            </Tooltip>
          </li>

          {adminItems.map((item) => (
            <AdminRailNavItem key={item.to} to={item.to} label={item.label} icon={item.icon} isActive={isPathActive(item.to)} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border bg-card/50">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button type="button" className={cn(railChromeRowClass, 'w-full bg-transparent')} onClick={onSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const expandedLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-sm border-l-[3px] py-2 pl-[calc(0.75rem-3px)] pr-3 text-sm font-medium tracking-tight transition-colors',
      isActive
        ? 'border-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
        : 'border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-muted/80 hover:text-sidebar-foreground',
    );

  const ExpandedNavItem = ({
    to,
    label,
    icon: Icon,
    onNavigate,
  }: {
    to: string;
    label: string;
    icon: typeof Shield;
    onNavigate: () => void;
  }) => (
    <NavLink to={to} end className={expandedLinkClass} onClick={onNavigate}>
      <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
      <span className="truncate">{label}</span>
    </NavLink>
  );

  const DesktopSidebarExpanded = ({ onNavigate }: { onNavigate: () => void }) => (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border bg-card px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary text-[11px] font-bold text-primary-foreground">
          ADM
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">Administration</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">FreelancerHub</span>
        </div>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="Hide menu (icons only)"
              onClick={() => setSidebarCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Icon-only sidebar</TooltipContent>
        </Tooltip>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            cn(
              'mb-3 flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              isActive && 'bg-muted/60 text-foreground',
            )
          }
          onClick={onNavigate}
        >
          <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" />
          Back to app
        </NavLink>

        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Administration</p>

        {adminItems.map((item) => (
          <ExpandedNavItem key={item.to} to={item.to} label={item.label} icon={item.icon} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-sidebar-border bg-card/50 p-4">
        <div className="mb-3 truncate text-[11px] leading-tight text-muted-foreground">{user?.email}</div>
        <Button variant="outline" size="sm" className="h-9 w-full justify-start gap-2 border-border text-xs font-medium" onClick={handleSignOut}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );

  const MobileSidebarDrawer = ({ onNavigate }: { onNavigate: () => void }) => (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border bg-card px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary text-[11px] font-bold text-primary-foreground">
          ADM
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <span className="block truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">Administration</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">FreelancerHub</span>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            cn(
              'mb-3 flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              isActive && 'bg-muted/60 text-foreground',
            )
          }
          onClick={onNavigate}
        >
          <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" />
          Back to app
        </NavLink>

        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Administration</p>

        {adminItems.map((item) => (
          <ExpandedNavItem key={item.to} to={item.to} label={item.label} icon={item.icon} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-sidebar-border bg-card/50 p-4">
        <div className="mb-3 truncate text-[11px] leading-tight text-muted-foreground">{user?.email}</div>
        <Button variant="outline" size="sm" className="h-9 w-full justify-start gap-2 border-border text-xs font-medium" onClick={handleSignOut}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        <aside
          className={cn(
            'hidden shrink-0 border-r border-sidebar-border bg-sidebar shadow-[inset_-1px_0_0_hsl(var(--sidebar-border))] transition-[width] duration-200 ease-out md:block',
            sidebarCollapsed ? COLLAPSED_RAIL_WIDTH : EXPANDED_SIDEBAR_WIDTH,
          )}
        >
          {sidebarCollapsed ? (
            <AdminDesktopRail onNavigate={() => {}} onExpand={() => setSidebarCollapsed(false)} onSignOut={handleSignOut} />
          ) : (
            <DesktopSidebarExpanded onNavigate={() => {}} />
          )}
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={() => setSidebarOpen(false)} aria-hidden />
            <aside className="relative z-50 flex h-full w-[260px] flex-col bg-sidebar shadow-xl">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              <MobileSidebarDrawer onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <header className="flex shrink-0 flex-col border-b border-border bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
            <div className="clarity-header-strip" aria-hidden />
            <div className="flex h-14 items-center gap-3 px-4 md:px-6">
              <button type="button" className="-ml-1 rounded-md p-2 md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
                <Menu className="h-5 w-5 text-foreground" />
              </button>
              <h1 className="text-[17px] font-semibold tracking-tight text-foreground">Admin Panel</h1>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
