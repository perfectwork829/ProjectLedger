import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { compareTaskPoolItemsWithinPriority } from '@/lib/taskPool';
import { PRIORITY_RANK } from '@/lib/taskPriority';

/** Table sections: paid work → paused → free → done → cancelled. */
export type TaskPoolTableBand = 'active' | 'paused' | 'free' | 'completed' | 'cancelled';

export const TASK_POOL_TABLE_BAND_ORDER: TaskPoolTableBand[] = [
  'active',
  'paused',
  'free',
  'completed',
  'cancelled',
];

export function taskPoolTableBand(status: string): TaskPoolTableBand {
  if (status === 'paused') return 'paused';
  if (status === 'free') return 'free';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'active';
}

export const TASK_POOL_TABLE_BAND_LABEL: Record<TaskPoolTableBand, string> = {
  active: 'Active & billable',
  paused: 'Paused',
  free: 'Free maintenance',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TASK_POOL_TABLE_BAND_HEADER_CLASS: Record<TaskPoolTableBand, string> = {
  active: 'border-t-[3px] border-emerald-500 bg-emerald-500/8',
  paused: 'border-t-[3px] border-amber-500 bg-amber-500/10',
  free: 'border-t-[3px] border-sky-500 bg-sky-500/10',
  completed: 'border-t-[3px] border-muted-foreground/35 bg-muted/50',
  cancelled: 'border-t-[3px] border-destructive/50 bg-destructive/5',
};

export const TASK_POOL_TABLE_BAND_ROW_CLASS: Record<TaskPoolTableBand, string> = {
  active: 'border-l-[3px] border-l-emerald-500/70',
  paused: 'border-l-[3px] border-l-amber-500/80',
  free: 'border-l-[3px] border-l-sky-500/80',
  completed: 'border-l-[3px] border-l-muted-foreground/25',
  cancelled: 'border-l-[3px] border-l-destructive/40',
};

export function sortTasksForTableView(
  items: TaskPoolItemRecord[],
  prioritySortOrder: 'high_first' | 'low_first',
): TaskPoolItemRecord[] {
  return [...items].sort((a, b) => {
    const ba = TASK_POOL_TABLE_BAND_ORDER.indexOf(taskPoolTableBand(a.status));
    const bb = TASK_POOL_TABLE_BAND_ORDER.indexOf(taskPoolTableBand(b.status));
    if (ba !== bb) return ba - bb;
    const pa = PRIORITY_RANK[a.priority] ?? 999;
    const pb = PRIORITY_RANK[b.priority] ?? 999;
    if (pa !== pb) return prioritySortOrder === 'high_first' ? pa - pb : pb - pa;
    return compareTaskPoolItemsWithinPriority(a, b);
  });
}

export function countTasksByTableBand(items: TaskPoolItemRecord[]): Record<TaskPoolTableBand, number> {
  const counts: Record<TaskPoolTableBand, number> = {
    active: 0,
    paused: 0,
    free: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const t of items) {
    counts[taskPoolTableBand(t.status)] += 1;
  }
  return counts;
}
