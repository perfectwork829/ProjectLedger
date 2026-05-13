import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { taskPoolItemStatusLabel } from '@/lib/taskPool';

export type ClientLinkedTaskRow = {
  id: string;
  name: string;
  status: string;
  main_stack: string | null;
  priority: string;
  updated_at: string;
};

type TasksBase = '/admin/tasks' | '/dashboard/tasks';

type ClientLinkedTasksSectionProps = {
  clientId: string | null | undefined;
  tasksBasePath: TasksBase;
  emptyState?: 'hint' | 'hidden';
  className?: string;
};

export function ClientLinkedTasksSection({
  clientId,
  tasksBasePath,
  emptyState = 'hint',
  className = '',
}: ClientLinkedTasksSectionProps) {
  const [rows, setRows] = useState<ClientLinkedTaskRow[]>([]);
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
        .from('task_pool_items')
        .select('id, name, status, main_stack, priority, updated_at')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) setRows([]);
      else setRows((data || []) as ClientLinkedTaskRow[]);
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
          After you save this client, link leads in <strong className="text-foreground">Tasks</strong> (task pool) under{' '}
          <strong className="text-foreground">Client (linked)</strong>. They appear here automatically.
        </p>
      </div>
    );
  }

  const listHref = `${tasksBasePath}?client=${encodeURIComponent(clientId)}`;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Tasks module (linked)</p>
        <Link to={listHref} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open in Tasks
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading linked tasks…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No task-pool leads use this client yet. Create or edit a task and set{' '}
          <span className="font-medium text-foreground">Client (linked)</span> to this person.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border bg-card p-2 text-sm">
          {rows.map((t) => {
            const openTask = new URLSearchParams();
            openTask.set('client', clientId);
            openTask.set('task', t.id);
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`${tasksBasePath}?${openTask.toString()}`}
                    className="font-medium text-primary hover:underline truncate block"
                  >
                    {t.name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {(t.main_stack || 'uncategorized').replace(/_/g, ' ')} · updated {new Date(t.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {taskPoolItemStatusLabel(t.status)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {t.priority}
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
