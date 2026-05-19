import { useEffect, useMemo, useState } from 'react';
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
import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { parseMilestones } from '@/lib/taskPool';
import type { TaskPoolAccrualPeriodRow } from '@/lib/taskPoolAccrualPeriods';
import { calcWithdrawnAmount } from '@/lib/taskPoolFinance';
import { confirmAccrualPeriod } from '@/lib/taskPoolAccrualService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: TaskPoolAccrualPeriodRow | null;
  task: TaskPoolItemRecord | null;
  onConfirmed: () => void;
};

export default function AccrualPeriodConfirmDialog({ open, onOpenChange, period, task, onConfirmed }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState(true);
  const [billableHours, setBillableHours] = useState('');
  const [trackedHours, setTrackedHours] = useState('');
  const [upworkConnectionFee, setUpworkConnectionFee] = useState('');
  const [convertFee, setConvertFee] = useState('');
  const [transferFee, setTransferFee] = useState('');
  const [upworkFee, setUpworkFee] = useState('');
  const [withdrawFee, setWithdrawFee] = useState('');

  useEffect(() => {
    if (!open || !task || !period) return;
    setPaymentReceived(true);
    const defaultHours =
      period.billable_hours ?? period.tracked_hours ?? task.weekly_hours_cap ?? 40;
    setBillableHours(String(defaultHours));
    setTrackedHours(String(period.tracked_hours ?? defaultHours));
    setUpworkConnectionFee(String(task.upwork_connection_fee ?? 0));
    setConvertFee(String(task.convert_fee ?? 0));
    setTransferFee(String(task.transfer_fee ?? 0));
    setUpworkFee(String(task.upwork_fee ?? 0));
    setWithdrawFee(String(task.withdraw_fee ?? 0));
  }, [open, task, period]);

  const preview = useMemo(() => {
    if (!task || !period) return null;
    const fees = {
      upworkConnectionFee: Number(upworkConnectionFee || 0),
      convertFee: Number(convertFee || 0),
      transferFee: Number(transferFee || 0),
      upworkFee: Number(upworkFee || 0),
      withdrawFee: Number(withdrawFee || 0),
    };
    let gross = 0;
    if (period.period_kind === 'hourly_week') {
      const h = Math.min(
        Math.max(Number(billableHours || 0), 0),
        Number(task.weekly_hours_cap ?? 40),
      );
      gross = h * Number(task.hourly_rate ?? 0);
    } else if (period.period_kind === 'milestone' && period.milestone_id) {
      const m = parseMilestones(task.milestones_json).find((x) => x.id === period.milestone_id);
      gross = Number(m?.amount ?? 0);
    } else {
      gross = Number(task.budget_amount ?? 0);
    }
    const net = calcWithdrawnAmount({ budgetAmount: gross, ...fees });
    return { gross, net, currency: task.currency || 'USD' };
  }, [task, period, billableHours, upworkConnectionFee, convertFee, transferFee, upworkFee, withdrawFee]);

  const submit = async () => {
    if (!user?.id || !task || !period || !preview) return;
    if (preview.net <= 0) {
      toast({ title: 'Net amount is zero', description: 'Check hours and fees.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await confirmAccrualPeriod(period, task, {
        periodId: period.id,
        billableHours: period.period_kind === 'hourly_week' ? Number(billableHours) : null,
        trackedHours: period.period_kind === 'hourly_week' ? Number(trackedHours) : null,
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

  if (!period || !task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm payment — {task.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">{period.label}</p>
          <p className="text-xs text-muted-foreground">Due (JST): {period.due_confirm_on}</p>

          {period.period_kind === 'hourly_week' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tracked hours</Label>
                <Input type="number" min={0} value={trackedHours} onChange={(e) => setTrackedHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Billable hours (max {task.weekly_hours_cap ?? 40})</Label>
                <Input type="number" min={0} value={billableHours} onChange={(e) => setBillableHours(e.target.value)} />
              </div>
            </div>
          ) : null}

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
            <p className="font-medium text-foreground">
              Gross {preview.currency} {preview.gross.toFixed(2)} → Net {preview.net.toFixed(2)}
            </p>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
