import { NavLink } from 'react-router-dom';
import { FolderKanban, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  /** `dashboard` → /dashboard/projects… ; `admin` → /admin/projects… */
  base: 'dashboard' | 'admin';
};

export function ProjectsSectionNav({ base }: Props) {
  const projectsTo = `/${base}/projects`;
  const linksTo = `/${base}/projects/links`;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  return (
    <nav
      className="inline-flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1"
      aria-label="Projects section"
    >
      <NavLink to={projectsTo} end className={linkClass}>
        <FolderKanban className="h-3.5 w-3.5" />
        Projects
      </NavLink>
      <NavLink to={linksTo} className={linkClass}>
        <Link2 className="h-3.5 w-3.5" />
        Project Links
      </NavLink>
    </nav>
  );
}
