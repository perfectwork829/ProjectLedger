import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Shield,
  CreditCard,
  Users,
  FolderKanban,
  Wallet,
  ClipboardList,
  Users2,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  LinkIcon,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const adminItems = [
  { to: '/admin/roles', label: 'Manage Roles', icon: Shield },
  { to: '/admin/accounts', label: 'Manage Accounts', icon: CreditCard },
  { to: '/admin/projects', label: 'Manage Projects', icon: FolderKanban },
  { to: '/admin/clients', label: 'Manage Clients', icon: Users },
  { to: '/admin/payments', label: 'Manage Payments', icon: Wallet },
  { to: '/admin/tasks', label: 'Manage Tasks', icon: ClipboardList },
  { to: '/admin/personnel', label: 'Manage Personnel', icon: Users2 },
  { to: '/admin/useful-links', label: 'Manage Links', icon: LinkIcon },
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-sm border-l-[3px] py-2 pl-[calc(0.75rem-3px)] pr-3 text-sm font-medium tracking-tight transition-colors',
      isActive
        ? 'border-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
        : 'border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-muted/80 hover:text-sidebar-foreground',
    );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-sidebar-border bg-card px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-[11px] font-bold text-primary-foreground">
          ADM
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">Administration</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">FreelancerHub</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        <NavLink
          to="/dashboard"
          className="mb-3 flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setSidebarOpen(false)}
        >
          <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" />
          Back to app
        </NavLink>

        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Administration</p>
        {adminItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setSidebarOpen(false)}>
            <item.icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
            {item.label}
          </NavLink>
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
    <div className="flex h-screen bg-background">
      <aside className="hidden w-[260px] shrink-0 border-r border-sidebar-border bg-sidebar shadow-[inset_-1px_0_0_hsl(var(--sidebar-border))] md:block">
        <SidebarContent />
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
            <SidebarContent />
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
  );
}
