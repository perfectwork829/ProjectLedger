import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  CreditCard,
  Wallet,
  ClipboardList,
  Users2,
  LogOut,
  Menu,
  X,
  Shield,
  LinkIcon,
  ChevronDown,
} from 'lucide-react';
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

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { to: '/dashboard/clients', label: 'Clients', icon: Users },
  { to: '/dashboard/accounts', label: 'Accounts', icon: CreditCard },
  { to: '/dashboard/payments', label: 'Payments', icon: Wallet },
  { to: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/dashboard/personnel', label: 'Personnel', icon: Users2 },
  { to: '/dashboard/useful-links', label: 'Links', icon: LinkIcon },
];

export default function FrontendLayout() {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Clarity-style header: white/chrome bar + primary accent strip */}
      <header className="sticky top-0 z-50 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
        <div className="clarity-header-strip" aria-hidden />
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-[13px] font-bold text-primary-foreground shadow-sm">
                FH
              </div>
              <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">
                FreelancerHub
              </span>
            </div>

            <nav className="hidden items-stretch md:flex md:gap-0 lg:gap-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={linkClass}>
                  <item.icon className="h-[15px] w-[15px] shrink-0 opacity-90" strokeWidth={2} />
                  {item.label}
                </NavLink>
              ))}
              {isAdmin && (
                <NavLink to="/admin" className={linkClass}>
                  <Shield className="h-[15px] w-[15px] shrink-0 opacity-90" strokeWidth={2} />
                  Admin
                </NavLink>
              )}
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
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  className={mobileLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              {isAdmin && (
                <NavLink to="/admin" className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  <Shield className="h-4 w-4" />
                  Admin
                </NavLink>
              )}
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
