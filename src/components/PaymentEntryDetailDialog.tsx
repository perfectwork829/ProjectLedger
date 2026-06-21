import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PaymentEntryRecord } from '@/lib/payments';
import type { TaskPoolAccrualPeriodRow } from '@/lib/taskPoolAccrualPeriods';

type Props = {
  entry: PaymentEntryRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName?: string | null;
  taskHref?: string | null;
  accrualPeriod?: TaskPoolAccrualPeriodRow | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onRollback?: () => void;
};

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/50 py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-sm font-medium text-muted-foreground sm:w-36">{label}</span>
      <div className="min-w-0 flex-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

export default function PaymentEntryDetailDialog({
  entry,
  open,
  onOpenChange,
  taskName: taskNameProp,
  taskHref,
  accrualPeriod: accrualPeriodProp,
  onEdit,
  onDelete,
  onRollback,
}: Props) {
  const [taskName, setTaskName] = useState<string | null>(null);
  const [accrualPeriod, setAccrualPeriod] = useState<TaskPoolAccrualPeriodRow | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (!open || !entry) {
      setTaskName(null);
      setAccrualPeriod(null);
      return;
    }

    setTaskName(taskNameProp ?? null);
    setAccrualPeriod(accrualPeriodProp ?? null);

    const needsTask = entry.pool_item_id && taskNameProp == null;
    const needsPeriod = entry.source_kind === 'task_auto' && accrualPeriodProp == null;

    if (!needsTask && !needsPeriod) return;

    let cancelled = false;
    (async () => {
      setLoadingExtra(true);
      try {
        const [taskRes, periodRes] = await Promise.all([
          needsTask
            ? supabase.from('task_pool_items').select('name').eq('id', entry.pool_item_id!).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          needsPeriod
            ? supabase
                .from('task_pool_accrual_periods')
                .select('*')
                .eq('payment_entry_id', entry.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (cancelled) return;
        if (needsTask && taskRes.data) setTaskName((taskRes.data as { name: string }).name);
        if (needsPeriod && periodRes.data) setAccrualPeriod(periodRes.data as TaskPoolAccrualPeriodRow);
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, entry, taskNameProp, accrualPeriodProp]);

  const resolvedTaskName = taskNameProp ?? taskName;
  const resolvedPeriod = accrualPeriodProp ?? accrualPeriod;
  const amountClass = entry?.entry_type === 'incoming' ? 'text-emerald-600' : 'text-red-600';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            Payment details
            {entry ? (
              <Badge variant={entry.entry_type === 'incoming' ? 'default' : 'secondary'} className="capitalize">
                {entry.entry_type}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {entry ? (
          <div className="max-h-[min(60vh,520px)] overflow-y-auto pr-1">
            <DetailRow
              label="Amount"
              value={
                <span className={`text-base font-semibold ${amountClass}`}>
                  {entry.currency} {Number(entry.amount).toFixed(2)}
                </span>
              }
            />
            <DetailRow label="Category" value={entry.category} />
            <DetailRow
              label="Date"
              value={new Date(entry.occurred_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
            <DetailRow
              label="Source"
              value={entry.source_kind === 'task_auto' ? 'Task (auto-confirmed)' : 'Manual entry'}
            />
            {resolvedTaskName || entry.pool_item_id ? (
              <DetailRow
                label="Linked task"
                value={
                  taskHref ? (
                    <Link to={taskHref} className="font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
                      {resolvedTaskName ?? 'Open task'}
                    </Link>
                  ) : (
                    resolvedTaskName ?? entry.pool_item_id
                  )
                }
              />
            ) : null}
            {resolvedPeriod ? (
              <>
                <DetailRow label="Accrual period" value={resolvedPeriod.label} />
                <DetailRow label="Period kind" value={resolvedPeriod.period_kind.replace(/_/g, ' ')} />
                {resolvedPeriod.due_confirm_on ? (
                  <DetailRow label="Due confirm (JST)" value={resolvedPeriod.due_confirm_on} />
                ) : null}
                {resolvedPeriod.confirmed_at ? (
                  <DetailRow
                    label="Confirmed at"
                    value={new Date(resolvedPeriod.confirmed_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  />
                ) : null}
                {resolvedPeriod.gross_amount != null ? (
                  <DetailRow label="Gross amount" value={`${entry.currency} ${Number(resolvedPeriod.gross_amount).toFixed(2)}`} />
                ) : null}
                {resolvedPeriod.net_amount != null ? (
                  <DetailRow label="Net amount" value={`${entry.currency} ${Number(resolvedPeriod.net_amount).toFixed(2)}`} />
                ) : null}
                {resolvedPeriod.billable_hours != null ? (
                  <DetailRow label="Billable hours" value={String(resolvedPeriod.billable_hours)} />
                ) : null}
              </>
            ) : loadingExtra && entry.source_kind === 'task_auto' ? (
              <p className="py-2 text-xs text-muted-foreground">Loading task details…</p>
            ) : null}
            <DetailRow label="Note" value={entry.note ? <span className="whitespace-pre-wrap">{entry.note}</span> : '—'} />
            <DetailRow
              label="Created"
              value={new Date(entry.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            />
            <DetailRow
              label="Updated"
              value={new Date(entry.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            />
          </div>
        ) : null}

        {(onEdit || onDelete || onRollback) && entry ? (
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {onEdit && entry.source_kind === 'task_auto' && entry.pool_item_id ? (
              <Button type="button" variant="outline" className="gap-2" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Edit payment
              </Button>
            ) : null}
            {onRollback && entry.source_kind === 'task_auto' && resolvedPeriod?.confirmed_at ? (
              <Button type="button" variant="outline" className="gap-2 text-amber-700 hover:text-amber-800" onClick={onRollback}>
                <RotateCcw className="h-4 w-4" />
                Roll back confirmation
              </Button>
            ) : null}
            {onDelete && entry.source_kind === 'manual' ? (
              <Button type="button" variant="destructive" className="gap-2" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete entry
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
