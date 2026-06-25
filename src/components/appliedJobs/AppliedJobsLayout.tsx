import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAppliedJobsBase } from '@/lib/useAppliedJobsBase';
import { Briefcase, BarChart3, CalendarClock, Settings, LayoutDashboard } from 'lucide-react';

const tabs = [
  { suffix: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { suffix: '/analytics', label: 'Analytics', icon: BarChart3, end: false },
  { suffix: '/interviews', label: 'Interviews', icon: CalendarClock, end: false },
  { suffix: '/settings', label: 'Settings', icon: Settings, end: false },
] as const;

export default function AppliedJobsLayout() {
  const base = useAppliedJobsBase();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applied jobs</p>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Job search hub</h1>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2 rounded-2xl border bg-card p-1.5 shadow-sm">
          {tabs.map((tab) => (
            <NavLink key={tab.suffix} to={`${base}${tab.suffix}`} end={tab.end} className={linkClass}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
