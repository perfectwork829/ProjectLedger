import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { RotateCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  buildTaskAutoRows,
  filterRowsByMode,
  getPaymentPeriods,
  normalizeManualRows,
  summarizeRows,
  type PaymentEntryRecord,
  type PaymentListFilter,
  type UnifiedPaymentRow,
  type TaskFinanceRow,
} from '@/lib/payments';
import PaymentEntryDetailDialog from '@/components/PaymentEntryDetailDialog';
import PaymentAccrualScheduleCard from '@/components/PaymentAccrualScheduleCard';
import AccrualPeriodHandleDialog from '@/components/AccrualPeriodHandleDialog';
import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { fetchAllAccrualPeriods, syncAccrualPeriodsForTasks, cancelAccrualPeriod, rollbackAccrualPeriodByPaymentEntryId } from '@/lib/taskPoolAccrualService';
import { filterAccrualPeriodsForPaymentTracking } from '@/lib/taskPoolAccrualPeriods';
import type { TaskPoolAccrualPeriodRow } from '@/lib/taskPoolAccrualPeriods';
import { normalizePoolItemId, periodBelongsToPool } from '@/lib/taskPoolAccrualPeriods';

export default function Payments() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canConfirmPayments = hasRole('admin');
  const [loading, setLoading] = useState(true);
  const [manualEntries, setManualEntries] = useState<PaymentEntryRecord[]>([]);
  const [taskRows, setTaskRows] = useState<TaskFinanceRow[]>([]);
  const [filter, setFilter] = useState<PaymentListFilter>('this_period');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [poolTasks, setPoolTasks] = useState<TaskPoolItemRecord[]>([]);
  const [accrualPeriods, setAccrualPeriods] = useState<TaskPoolAccrualPeriodRow[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TaskPoolAccrualPeriodRow | null>(null);
  const [rollbackEntryId, setRollbackEntryId] = useState<string | null>(null);
  const [rollbackBusy, setRollbackBusy] = useState(false);

  const fetchAll = useCallback(async ({ withLoading = false }: { withLoading?: boolean } = {}) => {
    if (withLoading) setLoading(true);
    const [manualRes, taskRes, poolRes, accountsRes] = await Promise.all([
      supabase.from('payment_entries').select('*').order('occurred_at', { ascending: false }),
      supabase
        .from('task_pool_items')
        .select(
          'id, name, currency, task_received_at, created_at, budget_type, fixed_budget_mode, withdrawn_amount, upwork_connection_fee, convert_fee, transfer_fee, upwork_fee, withdraw_fee',
        )
        .order('task_received_at', { ascending: false }),
      supabase.from('task_pool_items').select('*').order('created_at', { ascending: false }),
      supabase.from('freelancing_accounts').select('id, badge_status'),
    ]);
    setManualEntries((manualRes.data || []) as PaymentEntryRecord[]);
    setTaskRows((taskRes.data || []) as TaskFinanceRow[]);
    const poolItems = (poolRes.data || []) as TaskPoolItemRecord[];
    setPoolTasks(poolItems);
    try {
      const accounts = (accountsRes.data || []).map((a) => ({
        id: a.id as string,
        badge_status: (a.badge_status as string | null) ?? null,
      }));
      await syncAccrualPeriodsForTasks(poolItems, accounts);
      setAccrualPeriods(await fetchAllAccrualPeriods());
    } catch (e) {
      console.error('Failed to load payment schedule', e);
    } finally {
      if (withLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll({ withLoading: true });
  }, [fetchAll]);

  const allRows = useMemo<UnifiedPaymentRow[]>(() => {
    return [...buildTaskAutoRows(taskRows), ...normalizeManualRows(manualEntries)].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
  }, [taskRows, manualEntries]);

  const entryById = useMemo(() => Object.fromEntries(manualEntries.map((e) => [e.id, e])), [manualEntries]);
  const detailEntry = detailEntryId ? entryById[detailEntryId] ?? null : null;
  const detailAccrualPeriod = detailEntry
    ? accrualPeriods.find((p) => p.payment_entry_id === detailEntry.id) ?? null
    : null;

  const canRollbackEntry = useCallback(
    (entryId: string) => {
      const entry = entryById[entryId];
      if (!entry || entry.source_kind !== 'task_auto') return false;
      return accrualPeriods.some((p) => p.payment_entry_id === entryId && p.confirmed_at);
    },
    [entryById, accrualPeriods],
  );

  const requestRollback = (entryId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRollbackEntryId(entryId);
  };

  const confirmRollback = async () => {
    if (!rollbackEntryId) return;
    setRollbackBusy(true);
    try {
      await rollbackAccrualPeriodByPaymentEntryId(rollbackEntryId);
      if (detailEntryId === rollbackEntryId) setDetailEntryId(null);
      setRollbackEntryId(null);
      await fetchAll();
      toast({
        title: 'Payment rolled back',
        description: 'The ledger entry was removed and the payment item is unconfirmed again.',
      });
    } catch (err) {
      toast({
        title: 'Rollback failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRollbackBusy(false);
    }
  };

  const paymentTrackingPeriods = useMemo(
    () => filterAccrualPeriodsForPaymentTracking(accrualPeriods, poolTasks),
    [accrualPeriods, poolTasks],
  );

  const selectedPeriodTask = selectedPeriod
    ? poolTasks.find(
        (t) =>
          normalizePoolItemId(t.id) === normalizePoolItemId(selectedPeriod.pool_item_id) ||
          periodBelongsToPool({ pool_item_id: t.id }, selectedPeriod.pool_item_id),
      ) ?? null
    : null;

  const markPeriodCancelledLocally = useCallback((periodId: string) => {
    const cancelledAt = new Date().toISOString();
    setAccrualPeriods((prev) =>
      prev.map((p) => (p.id === periodId ? { ...p, cancelled_at: cancelledAt } : p)),
    );
  }, []);

  const refreshAfterPaymentConfirm = useCallback(async () => {
    try {
      const [manualRes, periods] = await Promise.all([
        supabase.from('payment_entries').select('*').order('occurred_at', { ascending: false }),
        fetchAllAccrualPeriods(),
      ]);
      if (!manualRes.error) {
        setManualEntries((manualRes.data || []) as PaymentEntryRecord[]);
      }
      setAccrualPeriods(periods);
    } catch (e) {
      console.error('Failed to refresh after payment confirm', e);
    }
  }, []);

  const handleCancelPeriod = async (period: TaskPoolAccrualPeriodRow) => {
    try {
      await cancelAccrualPeriod(period.id);
      if (selectedPeriod?.id === period.id) setSelectedPeriod(null);
      markPeriodCancelledLocally(period.id);
      toast({ title: 'Payment item cancelled', description: 'Removed from the confirm list.' });
    } catch (e) {
      toast({
        title: 'Cancel failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
      throw e;
    }
  };

  const now = new Date();
  const { thisPeriod, lastPeriod, yearStart, yearEnd } = getPaymentPeriods(now);
  const thisMonthLabel = `${now.toLocaleString('en-US', { month: 'long' })}-${now.getMonth() + 1}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthLabel = `${prev.toLocaleString('en-US', { month: 'long' })}-${prev.getMonth() + 1}`;
  const yearLabel = `${now.getFullYear()}`;

  const thisSummary = useMemo(
    () => summarizeRows(allRows.filter((r) => new Date(r.occurred_at) >= thisPeriod.start && new Date(r.occurred_at) < thisPeriod.end)),
    [allRows, thisPeriod],
  );
  const lastSummary = useMemo(
    () => summarizeRows(allRows.filter((r) => new Date(r.occurred_at) >= lastPeriod.start && new Date(r.occurred_at) < lastPeriod.end)),
    [allRows, lastPeriod],
  );
  const yearSummary = useMemo(
    () => summarizeRows(allRows.filter((r) => new Date(r.occurred_at) >= yearStart && new Date(r.occurred_at) < yearEnd)),
    [allRows, yearStart, yearEnd],
  );
  const filteredRows = useMemo(
    () =>
      filterRowsByMode(allRows, filter, now, {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(new Date(customEnd).getFullYear(), new Date(customEnd).getMonth(), new Date(customEnd).getDate() + 1) : null,
      }),
    [allRows, filter, now, customStart, customEnd],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Incoming and outgoing monthly cashflow (25th to 25th). Only delayed task payments are listed below;
          confirmed entries appear in the ledger. Click any entry for details.
        </p>
      </div>

      <PaymentAccrualScheduleCard
        periods={paymentTrackingPeriods}
        poolTasks={poolTasks.map((t) => ({ id: t.id, name: t.name }))}
        taskLinkPrefix="/dashboard/tasks"
        canCancel={canConfirmPayments}
        onPeriodSelect={setSelectedPeriod}
        onPeriodCancel={canConfirmPayments ? handleCancelPeriod : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title={`This Month (${thisMonthLabel})`} summary={thisSummary} />
        <StatCard title={`Last Month (${lastMonthLabel})`} summary={lastSummary} />
        <StatCard title={`Year (${yearLabel})`} summary={yearSummary} />
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as PaymentListFilter)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entries</SelectItem>
            <SelectItem value="this_period">This month (25-25)</SelectItem>
            <SelectItem value="last_period">Last month (25-25)</SelectItem>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="last_week">Last week</SelectItem>
            <SelectItem value="custom">Custom period</SelectItem>
            <SelectItem value="this_year">This year</SelectItem>
          </SelectContent>
        </Select>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'card' | 'list' | 'line' | 'table')}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="card">Card mode</SelectItem>
            <SelectItem value="list">List mode</SelectItem>
            <SelectItem value="line">Line mode</SelectItem>
            <SelectItem value="table">Table mode</SelectItem>
          </SelectContent>
        </Select>
        {filter === 'custom' ? (
          <div className="flex items-center gap-2">
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[170px]" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[170px]" />
          </div>
        ) : null}
      </div>

      {viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t hover:bg-muted/30"
                      onClick={() => setDetailEntryId(r.id)}
                    >
                      <td className="px-3 py-2">{new Date(r.occurred_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.entry_type === 'incoming' ? 'default' : 'secondary'}>{r.entry_type}</Badge>
                      </td>
                      <td className="px-3 py-2">{r.category}</td>
                      <td className={r.entry_type === 'incoming' ? 'px-3 py-2 text-emerald-600' : 'px-3 py-2 text-red-600'}>
                        {r.currency} {r.amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">{r.source_kind}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.note || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        {canRollbackEntry(r.id) ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700"
                            title="Roll back confirmation"
                            onClick={(e) => requestRollback(r.id, e)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'line' ? (
        <Card>
          <CardContent className="p-0">
            {filteredRows.map((r) => (
              <div
                key={r.id}
                className="flex cursor-pointer items-center justify-between gap-3 border-t px-3 py-2 first:border-t-0 hover:bg-muted/30"
                onClick={() => setDetailEntryId(r.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.category}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.occurred_at).toLocaleString()} · {r.source_kind}</p>
                </div>
                <p className={r.entry_type === 'incoming' ? 'shrink-0 text-sm text-emerald-600' : 'shrink-0 text-sm text-red-600'}>
                  {r.currency} {r.amount.toFixed(2)}
                </p>
                {canRollbackEntry(r.id) ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-amber-600 hover:text-amber-700"
                    title="Roll back confirmation"
                    onClick={(e) => requestRollback(r.id, e)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filteredRows.map((r) => (
            <Card key={r.id} className="cursor-pointer transition-colors hover:bg-muted/20" onClick={() => setDetailEntryId(r.id)}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{r.category}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.occurred_at).toLocaleString()}</p>
                </div>
                <Badge variant={r.entry_type === 'incoming' ? 'default' : 'secondary'}>{r.entry_type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((r) => (
            <Card key={r.id} className="cursor-pointer transition-colors hover:bg-muted/20" onClick={() => setDetailEntryId(r.id)}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <Badge variant={r.entry_type === 'incoming' ? 'default' : 'secondary'}>{r.entry_type}</Badge>
                  <span className="text-xs text-muted-foreground">{r.source_kind}</span>
                </div>
                <p className="text-sm font-medium">{r.category}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.occurred_at).toLocaleString()}</p>
                <p className={r.entry_type === 'incoming' ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
                  {r.currency} {r.amount.toFixed(2)}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{r.note || '-'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AccrualPeriodHandleDialog
        open={!!selectedPeriod}
        onOpenChange={(open) => !open && setSelectedPeriod(null)}
        period={selectedPeriod}
        task={selectedPeriodTask}
        taskHref={selectedPeriodTask ? `/dashboard/tasks?task=${selectedPeriodTask.id}` : null}
        readOnly={!canConfirmPayments}
        onConfirmed={() => void refreshAfterPaymentConfirm()}
        onCancel={canConfirmPayments ? handleCancelPeriod : undefined}
      />

      <PaymentEntryDetailDialog
        open={!!detailEntry}
        onOpenChange={(open) => !open && setDetailEntryId(null)}
        entry={detailEntry}
        accrualPeriod={detailAccrualPeriod}
        taskHref={detailEntry?.pool_item_id ? `/dashboard/tasks?task=${detailEntry.pool_item_id}` : null}
        onRollback={
          detailEntry && canRollbackEntry(detailEntry.id)
            ? () => {
                const id = detailEntry.id;
                setDetailEntryId(null);
                setRollbackEntryId(id);
              }
            : undefined
        }
      />

      <AlertDialog open={!!rollbackEntryId} onOpenChange={(open) => !open && !rollbackBusy && setRollbackEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the ledger entry and unconfirms the linked task payment. If it is overdue, it will show up
              on the delayed schedule again so you can confirm it correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rollbackBusy}
              className="bg-amber-600 hover:bg-amber-700"
              onClick={(e) => {
                e.preventDefault();
                void confirmRollback();
              }}
            >
              {rollbackBusy ? 'Rolling back…' : 'Roll back'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ title, summary }: { title: string; summary: { incoming: number; outgoing: number; net: number; count: number } }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground">{summary.count} entries</p>
      <p className="text-xs text-emerald-600">Incoming: {summary.incoming.toFixed(2)}</p>
      <p className="text-xs text-red-600">Outgoing: {summary.outgoing.toFixed(2)}</p>
      <p className="mt-1 text-sm font-medium text-foreground">Net: {summary.net.toFixed(2)}</p>
    </div>
  );
}
