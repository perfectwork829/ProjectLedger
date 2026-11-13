import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  CreditCard,
  DollarSign,
  ClipboardList,
  Users2,
  LogOut,
  Menu,
  X,
  Shield,
  HelpCircle,
  ChevronDown,
  CalendarClock,
  Link2,
} from 'lucide-react';
import { JobInterviewReminders } from '@/components/JobInterviewReminders';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Flat nav items after Overview + Projects (Projects is a hover submenu). */
const navItems = [
  { to: '/dashboard/clients', label: 'Clients', icon: Users },
  { to: '/dashboard/accounts', label: 'Accounts', icon: CreditCard },
  { to: '/dashboard/payments', label: 'Payments', icon: DollarSign },
  { to: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/dashboard/personnel', label: 'Personnel', icon: Users2 },
  { to: '/dashboard/applied-jobs', label: 'Applied jobs', icon: CalendarClock },
  { to: '/dashboard/useful-links', label: 'Help', icon: HelpCircle },
] as const;

function ProjectsNavHover({ linkClass }: { linkClass: (args: { isActive: boolean }) => string }) {
  const { pathname } = useLocation();
  const projectsActive =
    pathname === '/dashboard/projects' || pathname.startsWith('/dashboard/projects/');

  return (
    <div className="group relative flex items-stretch">
      <NavLink
        to="/dashboard/projects"
        className={() => linkClass({ isActive: projectsActive })}
        aria-haspopup="menu"
      >
        <FolderKanban className="h-[15px] w-[15px] shrink-0 opacity-90" strokeWidth={2} />
        Projects
        <ChevronDown className="h-3 w-3 opacity-70" />
      </NavLink>
      {/* Hover bridge + flyout */}
      <div
        className={cn(
          'invisible absolute left-0 top-full z-50 min-w-[200px] pt-1 opacity-0 transition-opacity',
          'group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
        )}
        role="menu"
        aria-label="Projects submenu"
      >
        <div className="rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <Link
            to="/dashboard/projects"
            role="menuitem"
            className={cn(
              'flex items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
              pathname === '/dashboard/projects' && 'bg-accent/60 font-medium',
            )}
          >
            <FolderKanban className="h-4 w-4 shrink-0 opacity-80" />
            Projects
          </Link>
          <Link
            to="/dashboard/projects/links"
            role="menuitem"
            className={cn(
              'flex items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
              pathname.startsWith('/dashboard/projects/links') && 'bg-accent/60 font-medium',
            )}
          >
            <Link2 className="h-4 w-4 shrink-0 opacity-80" />
            Project Links
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FrontendLayout() {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileProjectsOpen, setMobileProjectsOpen] = useState(false);
  const isAdmin = hasRole('admin');
  const email = user?.email || '';
  const userInitial = email ? email.charAt(0).toUpperCase() : 'U';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium tracking-tight transition-colors',
      isActive
        ? 'border-primary text-primary'
        : 'text-muted-foreground hover:border-border hover:text-foreground',
    );

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const projectsActive =
    pathname === '/dashboard/projects' || pathname.startsWith('/dashboard/projects/');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JobInterviewReminders />
      {/* Clarity-style header: white/chrome bar + primary accent strip */}
      <header className="sticky top-0 z-50 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
        <div className="clarity-header-strip" aria-hidden />
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-5">
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 rounded-sm text-foreground outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="BenchHub — go to overview"
            >
              <img src="/favicon.svg" alt="" className="h-8 w-8 shrink-0 rounded-sm shadow-sm" width={32} height={32} />
              <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">
                BenchHub
              </span>
            </Link>

            <nav className="hidden items-stretch md:flex md:gap-0 lg:gap-1">
              <NavLink to="/dashboard" end className={linkClass}>
                <LayoutDashboard className="h-[15px] w-[15px] shrink-0 opacity-90" strokeWidth={2} />
                Overview
              </NavLink>
              <ProjectsNavHover linkClass={linkClass} />
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  <item.icon className="h-[15px] w-[15px] shrink-0 opacity-90" strokeWidth={2} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 border-border px-2.5 text-xs font-medium">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-primary/10 text-[11px] font-semibold text-primary">
                    {userInitial}
                  </span>
                  <span className="hidden sm:inline">Account</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Signed in as</DropdownMenuLabel>
                <DropdownMenuItem className="cursor-default font-medium">
                  <span className="truncate">{email || 'Unknown user'}</span>
                </DropdownMenuItem>
                {isAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <NavLink to="/admin" className="flex w-full cursor-pointer items-center gap-2">
                        <Shield className="h-4 w-4 shrink-0" />
                        Admin
                      </NavLink>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <NavLink to="/admin/tasks" className="flex w-full cursor-pointer items-center gap-2">
                        <ClipboardList className="h-4 w-4 shrink-0" />
                        Manage data
                      </NavLink>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="border-t border-border bg-card px-4 py-3 md:hidden">
            <div className="flex flex-col gap-0.5">
              <NavLink
                to="/dashboard"
                end
                className={mobileLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4" />
                Overview
              </NavLink>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  projectsActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => setMobileProjectsOpen((v) => !v)}
                aria-expanded={mobileProjectsOpen}
              >
                <span className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Projects
                </span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', mobileProjectsOpen && 'rotate-180')} />
              </button>
              {mobileProjectsOpen ? (
                <div className="mb-1 ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                  <NavLink
                    to="/dashboard/projects"
                    end
                    className={mobileLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <FolderKanban className="h-4 w-4" />
                    Projects
                  </NavLink>
                  <NavLink
                    to="/dashboard/projects/links"
                    className={mobileLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link2 className="h-4 w-4" />
                    Project Links
                  </NavLink>
                </div>
              ) : null}
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={mobileLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:px-6 md:py-6">
        <Outlet />
      </main>
    </div>
  );
}
