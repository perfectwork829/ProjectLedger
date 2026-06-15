import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { AlertTriangle, CalendarClock, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { parseMilestones } from '@/lib/taskPool';
import {
  isPeriodOverdue,
  isPeriodPending,
  isPeriodUpcoming,
  type TaskPoolAccrualPeriodRow,
} from '@/lib/taskPoolAccrualPeriods';
import { calcWithdrawnAmount } from '@/lib/taskPoolFinance';
import { confirmAccrualPeriod } from '@/lib/taskPoolAccrualService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: TaskPoolAccrualPeriodRow | null;
  task: TaskPoolItemRecord | null;
  taskHref?: string | null;
  readOnly?: boolean;
  onConfirmed: () => void;
  onCancel?: (period: TaskPoolAccrualPeriodRow) => void | Promise<void>;
};

function periodStatus(period: TaskPoolAccrualPeriodRow) {
  if (period.confirmed_at) return 'confirmed' as const;
  if (isPeriodOverdue(period)) return 'delayed' as const;
  if (isPeriodPending(period)) return 'due' as const;
  if (isPeriodUpcoming(period)) return 'upcoming' as const;
  return 'unknown' as const;
}

function defaultGross(task: TaskPoolItemRecord, period: TaskPoolAccrualPeriodRow, billableHours: number): number {
  if (period.period_kind === 'hourly_week') {
    return billableHours * Number(task.hourly_rate ?? 0);
  }
  if (period.period_kind === 'milestone' && period.milestone_id) {
    const m = parseMilestones(task.milestones_json).find((x) => x.id === period.milestone_id);
    return Number(m?.amount ?? 0);
  }
  return Number(task.budget_amount ?? 0);
}

export default function AccrualPeriodHandleDialog({
  open,
  onOpenChange,
  period,
  task: taskProp,
  taskHref,
  readOnly = false,
  onConfirmed,
  onCancel,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState<TaskPoolItemRecord | null>(taskProp);
  const [loadingTask, setLoadingTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState(true);
  const [periodEndYmd, setPeriodEndYmd] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [billableHours, setBillableHours] = useState('');
  const [trackedHours, setTrackedHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [upworkConnectionFee, setUpworkConnectionFee] = useState('');
  const [convertFee, setConvertFee] = useState('');
  const [transferFee, setTransferFee] = useState('');
  const [upworkFee, setUpworkFee] = useState('');
  const [withdrawFee, setWithdrawFee] = useState('');

  useEffect(() => {
    if (!open || !period?.pool_item_id) {
      if (!open) setTask(taskProp);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTask(true);
      const res = await supabase.from('task_pool_items').select('*').eq('id', period.pool_item_id).maybeSingle();
      if (!cancelled) {
        if (res.data) setTask(res.data as TaskPoolItemRecord);
        else if (taskProp) setTask(taskProp);
        setLoadingTask(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, period?.pool_item_id, period?.id, taskProp]);

  const status = period ? periodStatus(period) : null;

  useEffect(() => {
    if (!open || !task || !period) return;
    setPaymentReceived(true);
    setPeriodEndYmd(period.period_end_ymd || '');
    setOccurredAt(new Date().toISOString().slice(0, 16));
    const defaultHours =
      period.billable_hours ?? period.tracked_hours ?? task.weekly_hours_cap ?? 40;
    const hoursNum = Number(defaultHours);
    setBillableHours(String(defaultHours));
    setTrackedHours(String(period.tracked_hours ?? defaultHours));
    setHourlyRate(task.hourly_rate != null ? String(task.hourly_rate) : '');
    setGrossAmount(String(defaultGross(task, period, hoursNum)));
    setUpworkConnectionFee(String(task.upwork_connection_fee ?? 0));
    setConvertFee(String(task.convert_fee ?? 0));
    setTransferFee(String(task.transfer_fee ?? 0));
    setUpworkFee(String(task.upwork_fee ?? 0));
    setWithdrawFee(String(task.withdraw_fee ?? 0));
  }, [open, task, period]);

  const isHourly = period?.period_kind === 'hourly_week';
  const canConfirm = !readOnly && !!period && !period.confirmed_at && !!task;

  const preview = useMemo(() => {
    if (!task || !period || !canConfirm) return null;
    const fees = {
      upworkConnectionFee: Number(upworkConnectionFee || 0),
      convertFee: Number(convertFee || 0),
      transferFee: Number(transferFee || 0),
      upworkFee: Number(upworkFee || 0),
      withdrawFee: Number(withdrawFee || 0),
    };
    const gross = Number(grossAmount || 0);
    const net = calcWithdrawnAmount({ budgetAmount: gross, ...fees });
    return { gross, net, currency: task.currency || 'USD' };
  }, [
    task,
    period,
    canConfirm,
    grossAmount,
    upworkConnectionFee,
    convertFee,
    transferFee,
    upworkFee,
    withdrawFee,
  ]);

  const onBillableHoursChange = (value: string) => {
    setBillableHours(value);
    if (!task || !period || period.period_kind !== 'hourly_week') return;
    const h = Math.min(Math.max(Number(value || 0), 0), Number(task.weekly_hours_cap ?? 40));
    const rate = Number(hourlyRate || task.hourly_rate || 0);
    if (rate > 0) setGrossAmount(String(h * rate));
  };

  const onHourlyRateChange = (value: string) => {
    setHourlyRate(value);
    if (!task || !period || period.period_kind !== 'hourly_week') return;
    const h = Math.min(Math.max(Number(billableHours || 0), 0), Number(task.weekly_hours_cap ?? 40));
    const rate = Number(value || 0);
    if (h > 0 && rate >= 0) setGrossAmount(String(h * rate));
  };

  const submit = async () => {
    if (!user?.id || !task || !period || !preview) return;
    if (preview.net <= 0) {
      toast({ title: 'Net amount is zero', description: 'Check payment amount and fees.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await confirmAccrualPeriod(period, task, {
        periodId: period.id,
        billableHours: isHourly ? Number(billableHours) : null,
        trackedHours: isHourly ? Number(trackedHours) : null,
        grossAmount: preview.gross,
        periodEndYmd: periodEndYmd.trim() || null,
        occurredAt: occurredAt || null,
        paymentReceived,
        fees: {
          upworkConnectionFee: Number(upworkConnectionFee || 0),
          convertFee: Number(convertFee || 0),
          transferFee: Number(transferFee || 0),
          upworkFee: Number(upworkFee || 0),
          withdrawFee: Number(withdrawFee || 0),
        },
        userId: user.id,
      });
      toast({
        title: paymentReceived ? 'Payment confirmed' : 'Accrual recorded',
        description: `${preview.currency} ${preview.net.toFixed(2)} added to withdrawn.`,
      });
      onOpenChange(false);
      onConfirmed();
    } catch (e) {
      toast({
        title: 'Confirm failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const submitCancel = async () => {
    if (!period || !onCancel) return;
    setCancelling(true);
    try {
      await onCancel(period);
      setCancelOpen(false);
      onOpenChange(false);
    } catch {
      /* parent toasts */
    } finally {
      setCancelling(false);
    }
  };

  if (!period) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            Confirm payment
            {status === 'delayed' ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Delayed
              </Badge>
            ) : null}
            {status === 'due' ? (
              <Badge className="gap-1 bg-amber-600 hover:bg-amber-600">
                <Clock className="h-3 w-3" />
                Due
              </Badge>
            ) : null}
            {status === 'upcoming' ? (
              <Badge variant="secondary" className="gap-1">
                <CalendarClock className="h-3 w-3" />
                Upcoming
              </Badge>
            ) : null}
            {status === 'confirmed' ? <Badge variant="outline">Confirmed</Badge> : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              {loadingTask ? 'Loading task…' : taskHref && task ? (
                <Link to={taskHref} className="text-primary hover:underline" onClick={() => onOpenChange(false)}>
                  {task.name}
                </Link>
              ) : (
                task?.name ?? '—'
              )}
            </p>
            <p className="text-xs text-muted-foreground">{period.label}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{period.period_kind.replace(/_/g, ' ')}</p>
            {status === 'upcoming' && canConfirm ? (
              <p className="text-[11px] text-amber-700">
                Scheduled due {period.due_confirm_on} (JST) — you can confirm early below.
              </p>
            ) : null}
          </div>

          {canConfirm ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="period-end">Period end date (JST)</Label>
                  <Input
                    id="period-end"
                    type="date"
                    value={periodEndYmd}
                    onChange={(e) => setPeriodEndYmd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-date">Payment date</Label>
                  <Input
                    id="payment-date"
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                  />
                </div>
              </div>

              {isHourly ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Tracked hours</Label>
                    <Input type="number" min={0} value={trackedHours} onChange={(e) => setTrackedHours(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Billable hours (max {task?.weekly_hours_cap ?? 40})</Label>
                    <Input type="number" min={0} value={billableHours} onChange={(e) => onBillableHoursChange(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly rate ({task?.currency ?? 'USD'})</Label>
                    <Input type="number" min={0} step="0.01" value={hourlyRate} onChange={(e) => onHourlyRateChange(e.target.value)} />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="gross-amount">Gross payment amount ({task?.currency ?? 'USD'})</Label>
                <Input
                  id="gross-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  readOnly={isHourly}
                  className={isHourly ? 'bg-muted' : undefined}
                />
                {isHourly ? (
                  <p className="text-[11px] text-muted-foreground">Calculated from billable hours × hourly rate.</p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Upwork connection</Label>
                  <Input type="number" value={upworkConnectionFee} onChange={(e) => setUpworkConnectionFee(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Convert fee</Label>
                  <Input type="number" value={convertFee} onChange={(e) => setConvertFee(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Transfer fee</Label>
                  <Input type="number" value={transferFee} onChange={(e) => setTransferFee(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Upwork fee</Label>
                  <Input type="number" value={upworkFee} onChange={(e) => setUpworkFee(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Withdraw fee</Label>
                  <Input type="number" value={withdrawFee} onChange={(e) => setWithdrawFee(e.target.value)} />
                </div>
              </div>

              {preview ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                  <p className="font-medium text-foreground">
                    Net withdrawn: {preview.currency} {preview.net.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Gross {preview.gross.toFixed(2)} after fees</p>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="payment-received"
                  checked={paymentReceived}
                  onCheckedChange={(v) => setPaymentReceived(v === true)}
                />
                <Label htmlFor="payment-received" className="font-normal">
                  Payment received from client
                </Label>
              </div>
            </>
          ) : period.confirmed_at ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Confirmed {new Date(period.confirmed_at).toLocaleString()}</p>
              {period.period_end_ymd ? <p>Period end (JST): {period.period_end_ymd}</p> : null}
              {period.net_amount != null ? (
                <p className="font-medium text-emerald-600">
                  Net: {task?.currency ?? 'USD'} {Number(period.net_amount).toFixed(2)}
                </p>
              ) : null}
            </div>
          ) : readOnly ? (
            <p className="text-xs text-muted-foreground">
              Confirm payments on <strong>Admin → Payments</strong> (`/admin/payments`).
            </p>
          ) : loadingTask ? (
            <p className="text-xs text-muted-foreground">Loading task details…</p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {canConfirm && onCancel ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={saving || cancelling}
                onClick={() => setCancelOpen(true)}
              >
                Cancel item
              </Button>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || cancelling}>
              Close
            </Button>
            {canConfirm ? (
              <Button onClick={() => void submit()} disabled={saving || cancelling || loadingTask || !task}>
                {saving ? 'Saving…' : 'Confirm payment'}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={cancelOpen} onOpenChange={(open) => !cancelling && setCancelOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this payment item?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{period.label}</strong> will be removed from the confirm list. No payment will be recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                void submitCancel();
              }}
            >
              {cancelling ? 'Cancelling…' : 'Cancel item'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
