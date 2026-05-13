import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

export type ClientLinkedProjectRow = {
  id: string;
  name: string;
  status: string;
  main_stack: string | null;
  priority: string;
  updated_at: string;
};

type ProjectsBase = '/admin/projects' | '/dashboard/projects';

type ClientLinkedProjectsSectionProps = {
  clientId: string | null | undefined;
  projectsBasePath: ProjectsBase;
  /** When there is no client id yet (e.g. new client form), show how to link after save */
  emptyState?: 'hint' | 'hidden';
  className?: string;
};

export function ClientLinkedProjectsSection({
  clientId,
  projectsBasePath,
  emptyState = 'hint',
  className = '',
}: ClientLinkedProjectsSectionProps) {
  const [rows, setRows] = useState<ClientLinkedProjectRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, main_stack, priority, updated_at')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) setRows([]);
      else setRows((data || []) as ClientLinkedProjectRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    if (emptyState === 'hidden') return null;
    return (
      <div className={`rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground ${className}`}>
        <p>
          After you save this client, link rows in <strong className="text-foreground">Projects</strong> or{' '}
          <strong className="text-foreground">Tasks</strong> using <strong className="text-foreground">Client (linked)</strong>. Linked items appear in Project
          history automatically.
        </p>
      </div>
    );
  }

  const listHref = `${projectsBasePath}?client=${encodeURIComponent(clientId)}`;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Projects module (linked)</p>
        <Link
          to={listHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open in Projects
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading linked projects…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No projects use this client yet. Create or edit a project and set <span className="font-medium text-foreground">Client (linked)</span> to this
          person.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border bg-card p-2 text-sm">
          {rows.map((p) => {
            const openProject = new URLSearchParams();
            openProject.set('client', clientId);
            openProject.set('project', p.id);
            return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <Link
                  to={`${projectsBasePath}?${openProject.toString()}`}
                  className="font-medium text-primary hover:underline truncate block"
                >
                  {p.name}
                </Link>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {(p.main_stack || 'uncategorized').replace(/_/g, ' ')} · updated {new Date(p.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {p.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {p.priority}
                </Badge>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
