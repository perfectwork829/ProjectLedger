import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, ChevronRight, Clock, ExternalLink, X } from 'lucide-react';
import {
  isPeriodOverdue,
  isPeriodUnconfirmed,
  normalizePoolItemId,
  periodBelongsToPool,
  type TaskPoolAccrualPeriodRow,
} from '@/lib/taskPoolAccrualPeriods';

type TaskRef = { id: string; name: string };

type Props = {
  periods: TaskPoolAccrualPeriodRow[];
  poolTasks: TaskRef[];
  filterTaskId?: string | null;
  filterTaskName?: string | null;
  loading?: boolean;
  taskLinkPrefix?: string;
  canCancel?: boolean;
  onPeriodSelect?: (period: TaskPoolAccrualPeriodRow) => void;
  onPeriodCancel?: (period: TaskPoolAccrualPeriodRow) => void | Promise<void>;
};

function taskForPeriod(period: TaskPoolAccrualPeriodRow, poolTasks: TaskRef[]) {
  const key = normalizePoolItemId(period.pool_item_id);
  if (key) {
    const hit = poolTasks.find((t) => normalizePoolItemId(t.id) === key);
    if (hit) return hit;
  }
  return poolTasks.find((t) => periodBelongsToPool({ pool_item_id: t.id }, period.pool_item_id)) ?? null;
}

function periodStatusLabel(_period: TaskPoolAccrualPeriodRow) {
  return { text: 'Delayed', variant: 'destructive' as const };
}

function periodKindLabel(kind: TaskPoolAccrualPeriodRow['period_kind']) {
  return kind.replace(/_/g, ' ');
}

type TaskGroup = {
  taskId: string;
  taskName: string;
  periods: TaskPoolAccrualPeriodRow[];
  delayed: number;
};

function TaskPaymentGroup({
  group,
  taskHref,
  showTaskHeader,
  canCancel,
  onPeriodSelect,
  onPeriodCancelRequest,
}: {
  group: TaskGroup;
  taskHref: string;
  showTaskHeader: boolean;
  canCancel?: boolean;
  onPeriodSelect?: (period: TaskPoolAccrualPeriodRow) => void;
  onPeriodCancelRequest?: (period: TaskPoolAccrualPeriodRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      {showTaskHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
          <div className="min-w-0">
            <Link
              to={taskHref}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"
            >
              {group.taskName}
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {group.periods.length} delayed payment{group.periods.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              {group.delayed} delayed
            </Badge>
          </div>
        </header>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/50 bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">#</th>
              <th className="min-w-[180px] px-3 py-2">Period</th>
              <th className="hidden px-3 py-2 sm:table-cell">Type</th>
              <th className="hidden px-3 py-2 md:table-cell">Period end</th>
              <th className="px-3 py-2">Due confirm</th>
              <th className="px-3 py-2">Status</th>
              <th className="w-24 px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {group.periods.map((period, index) => {
              const status = periodStatusLabel(period);
              const overdue = isPeriodOverdue(period);
              return (
                <tr
                  key={period.id}
                  className={`cursor-pointer border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/40 ${
                    overdue ? 'bg-red-500/[0.04]' : index % 2 === 1 ? 'bg-muted/10' : ''
                  }`}
                  onClick={() => onPeriodSelect?.(period)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPeriodSelect?.(period);
                    }
                  }}
                >
                  <td className="px-3 py-3 align-middle text-xs font-medium text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-3 align-middle">
                    <p className="font-medium leading-snug text-foreground">{period.label}</p>
                    <p className="mt-0.5 text-[11px] capitalize text-muted-foreground sm:hidden">
                      {periodKindLabel(period.period_kind)}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 align-middle capitalize text-muted-foreground sm:table-cell">
                    {periodKindLabel(period.period_kind)}
                  </td>
                  <td className="hidden px-3 py-3 align-middle text-muted-foreground md:table-cell">
                    {period.period_end_ymd || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-middle text-muted-foreground">{period.due_confirm_on}</td>
                  <td className="px-3 py-3 align-middle">
                    <Badge variant={status.variant} className="text-[10px]">
                      {status.text}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      {canCancel && onPeriodCancelRequest ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2 text-muted-foreground hover:text-destructive"
                          title="Remove from confirm list"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPeriodCancelRequest(period);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Cancel</span>
                        </Button>
                      ) : null}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PaymentAccrualScheduleCard({
  periods,
  poolTasks,
  filterTaskId,
  filterTaskName,
  loading,
  taskLinkPrefix = '/admin/tasks',
  canCancel = false,
  onPeriodSelect,
  onPeriodCancel,
}: Props) {
  const [scheduleTaskFilter, setScheduleTaskFilter] = useState<string>('all');
  const [cancelTarget, setCancelTarget] = useState<TaskPoolAccrualPeriodRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const delayedOnly = useMemo(
    () =>
      periods.filter((p) => {
        if (!isPeriodUnconfirmed(p)) return false;
        return isPeriodOverdue(p);
      }),
    [periods],
  );

  const scoped = useMemo(() => {
    const urlFilter = filterTaskId;
    const uiFilter = urlFilter ?? (scheduleTaskFilter === 'all' ? null : scheduleTaskFilter);
    if (!uiFilter) return delayedOnly;
    return delayedOnly.filter((p) => periodBelongsToPool(p, uiFilter));
  }, [delayedOnly, filterTaskId, scheduleTaskFilter]);

  const taskGroups = useMemo<TaskGroup[]>(() => {
    const map = new Map<string, TaskPoolAccrualPeriodRow[]>();
    for (const p of scoped) {
      const key = normalizePoolItemId(p.pool_item_id) ?? p.pool_item_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()]
      .map(([taskId, groupPeriods]) => {
        const task = taskForPeriod(groupPeriods[0], poolTasks);
        const sorted = [...groupPeriods].sort((a, b) => a.due_confirm_on.localeCompare(b.due_confirm_on));
        return {
          taskId,
          taskName: task?.name ?? 'Task',
          periods: sorted,
          delayed: sorted.length,
        };
      })
      .sort((a, b) => {
        if (a.delayed !== b.delayed) return b.delayed - a.delayed;
        return a.taskName.localeCompare(b.taskName);
      });
  }, [scoped, poolTasks]);

  const taskFilterOptions = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const p of delayedOnly) {
      const key = normalizePoolItemId(p.pool_item_id) ?? p.pool_item_id;
      const task = taskForPeriod(p, poolTasks);
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { name: task?.name ?? 'Task', count: 1 });
    }
    return [...map.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [delayedOnly, poolTasks]);

  const delayedCount = scoped.length;

  const title = filterTaskId
    ? `Delayed payments — ${filterTaskName ?? 'task'}`
    : 'Delayed payments by task';

  const effectiveTaskFilter = filterTaskId ?? scheduleTaskFilter;

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-amber-600" />
          {title}
          {delayedCount > 0 ? (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              {delayedCount} delayed
            </Badge>
          ) : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Past-due task payments only (after the JST confirm date). Due-today and upcoming items are not listed here.
          Click a row to confirm, or cancel to remove from the list without recording payment.
        </p>
        {!filterTaskId && taskFilterOptions.length > 0 ? (
          <div className="pt-2">
            <Select value={effectiveTaskFilter} onValueChange={setScheduleTaskFilter}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Filter by task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tasks ({delayedOnly.length} delayed)</SelectItem>
                {taskFilterOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.count} items)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading scheduled payments…</p>
        ) : scoped.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filterTaskId || scheduleTaskFilter !== 'all'
              ? 'No delayed payments for this task.'
              : 'No delayed task payments. Items appear here only after their confirm date has passed (JST).'}
          </p>
        ) : (
          taskGroups.map((group) => (
            <TaskPaymentGroup
              key={group.taskId}
              group={group}
              taskHref={`${taskLinkPrefix}?task=${group.taskId}`}
              showTaskHeader
              canCancel={canCancel}
              onPeriodSelect={onPeriodSelect}
              onPeriodCancelRequest={canCancel && onPeriodCancel ? setCancelTarget : undefined}
            />
          ))
        )}
      </CardContent>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && !cancelling && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this payment item?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{cancelTarget?.label}</strong> will be removed from the confirm list. No payment will be recorded
              and it will not appear here again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                if (!cancelTarget || !onPeriodCancel) return;
                setCancelling(true);
                void Promise.resolve(onPeriodCancel(cancelTarget)).finally(() => {
                  setCancelling(false);
                  setCancelTarget(null);
                });
              }}
            >
              {cancelling ? 'Cancelling…' : 'Cancel item'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
