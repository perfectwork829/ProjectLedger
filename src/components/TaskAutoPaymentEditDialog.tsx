import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
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
import type { PaymentEntryRecord } from '@/lib/payments';
import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { parseMilestones } from '@/lib/taskPool';
import {
  calcWithdrawnAmount,
  computeWithdrawnFromTaskAutoPayments,
  parseHourlyHoursFromAccrualNote,
  taskPoolFeesFromNumbers,
  type TaskAutoPaymentSlice,
} from '@/lib/taskPoolFinance';

type Props = {
  entry: PaymentEntryRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

function milestoneTitleFromNote(note: string | null): string | null {
  if (!note) return null;
  const tail = note.includes('—') ? note.split('—').pop()?.trim() : note;
  const m = (tail || note).match(/Fixed milestone · (.+)$/i);
  return m?.[1]?.trim() || null;
}

export default function TaskAutoPaymentEditDialog({ entry, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState<TaskPoolItemRecord | null>(null);
  const [allPayments, setAllPayments] = useState<TaskAutoPaymentSlice[]>([]);
  const [hours, setHours] = useState('');
  const [gross, setGross] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [upworkConnectionFee, setUpworkConnectionFee] = useState('');
  const [convertFee, setConvertFee] = useState('');
  const [transferFee, setTransferFee] = useState('');
  const [upworkFee, setUpworkFee] = useState('');
  const [withdrawFee, setWithdrawFee] = useState('');
  const [occurredAt, setOccurredAt] = useState('');

  const isHourly = entry?.category.toLowerCase().includes('hourly') ?? false;
  const isMilestone = entry?.category.toLowerCase().includes('milestone') ?? false;
  const isProject = entry?.category.toLowerCase().includes('fixed project') ?? false;
  const isInstallment = entry?.category.toLowerCase().includes('installment') ?? false;

  useEffect(() => {
    if (!entry?.pool_item_id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [taskRes, payRes] = await Promise.all([
        supabase.from('task_pool_items').select('*').eq('id', entry.pool_item_id).single(),
        supabase
          .from('payment_entries')
          .select('id, amount, note, category')
          .eq('pool_item_id', entry.pool_item_id)
          .eq('entry_type', 'incoming')
          .eq('source_kind', 'task_auto')
          .order('occurred_at', { ascending: true }),
      ]);
      if (cancelled) return;
      if (taskRes.error || !taskRes.data) {
        toast({ title: 'Could not load task', description: taskRes.error?.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      const t = taskRes.data as TaskPoolItemRecord;
      setTask(t);
      setAllPayments(
        (payRes.data || []).map((p) => ({
          id: p.id,
          amount: Number(p.amount ?? 0),
          note: p.note,
          category: String(p.category || ''),
        })),
      );
      setUpworkConnectionFee(String(t.upwork_connection_fee ?? 0));
      setConvertFee(String(t.convert_fee ?? 0));
      setTransferFee(String(t.transfer_fee ?? 0));
      setUpworkFee(String(t.upwork_fee ?? 0));
      setWithdrawFee(String(t.withdraw_fee ?? 0));
      setHourlyRate(t.hourly_rate != null ? String(t.hourly_rate) : '');
      setOccurredAt(entry.occurred_at ? new Date(entry.occurred_at).toISOString().slice(0, 16) : '');

      if (entry.category.toLowerCase().includes('hourly')) {
        const parsed = parseHourlyHoursFromAccrualNote(entry.note);
        const h =
          parsed ??
          (t.hourly_last_billable_hours != null ? Number(t.hourly_last_billable_hours) : null) ??
          0;
        setHours(String(h));
        const rate = Number(t.hourly_rate ?? 0);
        setGross(rate > 0 && h > 0 ? String(h * rate) : '');
      } else if (isMilestone) {
        const title = milestoneTitleFromNote(entry.note);
        const ms = parseMilestones(t.milestones_json);
        const m = title ? ms.find((x) => x.title === title) : null;
        setGross(m ? String(m.amount) : String(entry.amount));
      } else {
        setGross(String(t.budget_amount ?? entry.amount));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [entry, toast, isMilestone]);

  const fees = useMemo(
    () =>
      taskPoolFeesFromNumbers({
        upwork_connection_fee: upworkConnectionFee ? Number(upworkConnectionFee) : 0,
        convert_fee: convertFee ? Number(convertFee) : 0,
        transfer_fee: transferFee ? Number(transferFee) : 0,
        upwork_fee: upworkFee ? Number(upworkFee) : 0,
        withdraw_fee: withdrawFee ? Number(withdrawFee) : 0,
      }),
    [upworkConnectionFee, convertFee, transferFee, upworkFee, withdrawFee],
  );

  const grossAmount = useMemo(() => {
    if (isHourly) {
      const h = Number(hours || 0);
      const rate = Number(hourlyRate || 0);
      return h * rate;
    }
    return Number(gross || 0);
  }, [isHourly, hours, hourlyRate, gross]);

  const netPreview = useMemo(
    () => calcWithdrawnAmount({ budgetAmount: grossAmount, ...fees }),
    [grossAmount, fees],
  );

  const handleHoursOrRateChange = (nextHours: string, nextRate: string) => {
    setHours(nextHours);
    setHourlyRate(nextRate);
  };

  const save = async () => {
    if (!entry?.pool_item_id || !task) return;
    setSaving(true);
    const rate = Number(hourlyRate || task.hourly_rate || 0);
    const feeNums = {
      upwork_connection_fee: Number(upworkConnectionFee || 0),
      convert_fee: Number(convertFee || 0),
      transfer_fee: Number(transferFee || 0),
      upwork_fee: Number(upworkFee || 0),
      withdraw_fee: Number(withdrawFee || 0),
    };
    const net = netPreview;

    let note = entry.note || '';
    if (isHourly) {
      const h = Math.min(Math.max(Number(hours || 0), 0), Number(task.weekly_hours_cap ?? 40));
      const weekTail = entry.note?.includes('week ending') ? entry.note.split('week ending').slice(1).join('week ending') : '';
      note = `${task.name} — Hourly (JST Mon–Sun) · ${h}h × ${rate}${weekTail ? ` · week ending${weekTail}` : ''}`;
    }

    const payUpd = await supabase
      .from('payment_entries')
      .update({
        amount: net,
        note,
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : entry.occurred_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);
    if (payUpd.error) {
      toast({ title: 'Payment update failed', description: payUpd.error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    const updatedPayments = allPayments.map((p) => (p.id === entry.id ? { ...p, amount: net, note } : p));
    const milestoneGross: Record<string, number> = {};
    if (isMilestone && entry.id) milestoneGross[entry.id] = grossAmount;

    const newWithdrawn = computeWithdrawnFromTaskAutoPayments(
      { ...task, hourly_rate: rate, ...feeNums },
      fees,
      updatedPayments,
      milestoneGross,
    );

    const taskPatch: Record<string, unknown> = {
      ...feeNums,
      withdrawn_amount: newWithdrawn,
      updated_at: new Date().toISOString(),
    };
    if (task.budget_type === 'hourly') {
      taskPatch.hourly_rate = rate;
      const h = Number(hours || 0);
      if (h > 0) taskPatch.hourly_last_billable_hours = h;
    }
    if (isProject || isInstallment) {
      taskPatch.budget_amount = grossAmount;
    }
    if (isMilestone) {
      const title = milestoneTitleFromNote(entry.note);
      if (title) {
        const ms = parseMilestones(task.milestones_json).map((m) =>
          m.title === title ? { ...m, amount: grossAmount } : m,
        );
        taskPatch.milestones_json = ms;
      }
    }

    const taskUpd = await supabase.from('task_pool_items').update(taskPatch).eq('id', task.id);
    if (taskUpd.error) {
      toast({ title: 'Task update failed', description: taskUpd.error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    toast({ title: 'Payment updated', description: `Net ${task.currency} ${net.toFixed(2)}; task withdrawn synced.` });
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!entry) return null;

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit task payment</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{entry.category}</span>
              {task ? ` · ${task.name}` : ''}
            </p>
            {isHourly ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Billable hours</Label>
                    <Input
                      type="number"
                      value={hours}
                      onChange={(e) => handleHoursOrRateChange(e.target.value, hourlyRate)}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly rate</Label>
                    <Input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => handleHoursOrRateChange(hours, e.target.value)}
                      min={0}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gross: {task?.currency ?? entry.currency} {grossAmount.toFixed(2)} (hours × rate)
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Gross amount</Label>
                <Input type="number" value={gross} onChange={(e) => setGross(e.target.value)} min={0} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Upwork connection fee</Label>
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
              <div className="space-y-2">
                <Label>Withdraw fee</Label>
                <Input type="number" value={withdrawFee} onChange={(e) => setWithdrawFee(e.target.value)} />
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Net incoming: {entry.currency} {netPreview.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Gross minus all fees above. Saving updates this payment and the task withdrawn total.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
