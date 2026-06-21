import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Plus, Trash2, X, RotateCcw } from 'lucide-react';
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
import TaskAutoPaymentEditDialog from '@/components/TaskAutoPaymentEditDialog';
import AccrualPeriodHandleDialog from '@/components/AccrualPeriodHandleDialog';
import PaymentEntryDetailDialog from '@/components/PaymentEntryDetailDialog';
import PaymentAccrualScheduleCard from '@/components/PaymentAccrualScheduleCard';
import type { TaskPoolItemRecord } from '@/lib/taskPool';
import {
  normalizePoolItemId,
  periodBelongsToPool,
  type TaskPoolAccrualPeriodRow,
} from '@/lib/taskPoolAccrualPeriods';
import {
  fetchAccrualPeriodsForPool,
  fetchAllAccrualPeriods,
  syncAccrualPeriodsForTasks,
  cancelAccrualPeriod,
  rollbackAccrualPeriodByPaymentEntryId,
} from '@/lib/taskPoolAccrualService';
import { filterAccrualPeriodsForPaymentTracking } from '@/lib/taskPoolAccrualPeriods';

const OUTGOING_CATEGORIES = [
  'Base fee',
  'Upwork connections fee',
  'Freelancer bid fee',
  'Guru bid fee',
  'Other freelancing bid fee',
  'Account rental fee',
  'VPS fee',
  'Octo browser fee',
  'Usage fee (Cursor/Claude/etc)',
  'Proxy fee',
  'Telephone fee',
  'Other',
] as const;

const INCOMING_CATEGORIES = ['Other incoming', 'Friend transfer', 'Gift/Present', 'Bonus', 'Other'] as const;

export default function AdminPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterTaskId = useMemo(() => {
    const q = new URLSearchParams(location.search);
    return normalizePoolItemId(q.get('task') ?? searchParams.get('task'));
  }, [location.search, searchParams]);
  const [loading, setLoading] = useState(true);
  const [manualEntries, setManualEntries] = useState<PaymentEntryRecord[]>([]);
  const [taskRows, setTaskRows] = useState<TaskFinanceRow[]>([]);
  const [filter, setFilter] = useState<PaymentListFilter>('this_period');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [entryType, setEntryType] = useState<'incoming' | 'outgoing'>('incoming');
  const [category, setCategory] = useState('Other incoming');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState('');
  const [editingTaskPayment, setEditingTaskPayment] = useState<PaymentEntryRecord | null>(null);
  const [poolTasks, setPoolTasks] = useState<TaskPoolItemRecord[]>([]);
  const [accrualPeriods, setAccrualPeriods] = useState<TaskPoolAccrualPeriodRow[]>([]);
  const [taskScopedPeriods, setTaskScopedPeriods] = useState<TaskPoolAccrualPeriodRow[] | null>(null);
  const [taskPeriodsLoading, setTaskPeriodsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TaskPoolAccrualPeriodRow | null>(null);
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [rollbackEntryId, setRollbackEntryId] = useState<string | null>(null);
  const [rollbackBusy, setRollbackBusy] = useState(false);

  const loadTaskScopedPeriods = useCallback(async (poolId: string) => {
    setTaskPeriodsLoading(true);
    try {
      const rows = await fetchAccrualPeriodsForPool(poolId);
      setTaskScopedPeriods(rows);
    } catch (e) {
      console.error('Failed to load task accrual periods', e);
      setTaskScopedPeriods([]);
    } finally {
      setTaskPeriodsLoading(false);
    }
  }, []);

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
    if (manualRes.error) toast({ title: 'Error loading payment entries', description: manualRes.error.message, variant: 'destructive' });
    if (taskRes.error) toast({ title: 'Error loading task finances', description: taskRes.error.message, variant: 'destructive' });
    setManualEntries((manualRes.data || []) as PaymentEntryRecord[]);
    setTaskRows((taskRes.data || []) as TaskFinanceRow[]);
    const poolItems = (poolRes.data || []) as TaskPoolItemRecord[];
    setPoolTasks(poolItems);
    const accounts = (accountsRes.data || []).map((a) => ({
      id: a.id as string,
      badge_status: (a.badge_status as string | null) ?? null,
    }));
    try {
      await syncAccrualPeriodsForTasks(poolItems, accounts);
      setAccrualPeriods(await fetchAllAccrualPeriods());
      const taskFromUrl = normalizePoolItemId(new URLSearchParams(window.location.search).get('task'));
      if (taskFromUrl) await loadTaskScopedPeriods(taskFromUrl);
    } catch (e) {
      console.error('Accrual sync failed', e);
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [loadTaskScopedPeriods, toast]);

  useEffect(() => {
    void fetchAll({ withLoading: true });
  }, [fetchAll]);

  useEffect(() => {
    if (!filterTaskId) {
      setTaskScopedPeriods(null);
      return;
    }
    void loadTaskScopedPeriods(filterTaskId);
  }, [filterTaskId, loadTaskScopedPeriods]);

  /** When `?task=` is set, only use periods loaded for that pool (never the global list). */
  const paymentTrackingPeriods = useMemo(
    () => filterAccrualPeriodsForPaymentTracking(accrualPeriods, poolTasks),
    [accrualPeriods, poolTasks],
  );
  const trackedTaskScopedPeriods = useMemo(
    () => filterAccrualPeriodsForPaymentTracking(taskScopedPeriods ?? [], poolTasks),
    [taskScopedPeriods, poolTasks],
  );
  const accrualSource = filterTaskId ? trackedTaskScopedPeriods : paymentTrackingPeriods;

  const taskById = useMemo(() => {
    const map: Record<string, TaskPoolItemRecord> = {};
    for (const t of poolTasks) {
      const key = normalizePoolItemId(t.id);
      if (key) map[key] = t;
    }
    return map;
  }, [poolTasks]);

  const filterTask = filterTaskId ? taskById[filterTaskId] ?? poolTasks.find((t) => periodBelongsToPool({ pool_item_id: t.id }, filterTaskId)) ?? null : null;

  const selectedPeriodTask = selectedPeriod
    ? taskById[normalizePoolItemId(selectedPeriod.pool_item_id) ?? ''] ??
      poolTasks.find((t) => periodBelongsToPool({ pool_item_id: t.id }, selectedPeriod.pool_item_id)) ??
      null
    : null;

  const allRows = useMemo<UnifiedPaymentRow[]>(() => {
    return [...buildTaskAutoRows(taskRows), ...normalizeManualRows(manualEntries)].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
  }, [taskRows, manualEntries]);

  const entryById = useMemo(() => Object.fromEntries(manualEntries.map((e) => [e.id, e])), [manualEntries]);

  const rowsForTaskFilter = useMemo(() => {
    if (!filterTaskId) return allRows;
    return allRows.filter((r) => periodBelongsToPool({ pool_item_id: entryById[r.id]?.pool_item_id ?? '' }, filterTaskId));
  }, [allRows, filterTaskId, entryById]);

  const now = new Date();
  const { thisPeriod, lastPeriod, yearStart, yearEnd } = getPaymentPeriods(now);
  const thisMonthLabel = `${now.toLocaleString('en-US', { month: 'long' })}-${now.getMonth() + 1}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthLabel = `${prev.toLocaleString('en-US', { month: 'long' })}-${prev.getMonth() + 1}`;
  const yearLabel = `${now.getFullYear()}`;

  const summarySource = filterTaskId ? rowsForTaskFilter : allRows;

  const thisSummary = useMemo(
    () =>
      summarizeRows(
        summarySource.filter((r) => new Date(r.occurred_at) >= thisPeriod.start && new Date(r.occurred_at) < thisPeriod.end),
      ),
    [summarySource, thisPeriod],
  );
  const lastSummary = useMemo(
    () =>
      summarizeRows(
        summarySource.filter((r) => new Date(r.occurred_at) >= lastPeriod.start && new Date(r.occurred_at) < lastPeriod.end),
      ),
    [summarySource, lastPeriod],
  );
  const yearSummary = useMemo(
    () =>
      summarizeRows(summarySource.filter((r) => new Date(r.occurred_at) >= yearStart && new Date(r.occurred_at) < yearEnd)),
    [summarySource, yearStart, yearEnd],
  );

  const filteredRows = useMemo(
    () =>
      filterRowsByMode(rowsForTaskFilter, filter, now, {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(new Date(customEnd).getFullYear(), new Date(customEnd).getMonth(), new Date(customEnd).getDate() + 1) : null,
      }),
    [rowsForTaskFilter, filter, now, customStart, customEnd],
  );

  const clearTaskFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  };

  const markPeriodCancelledLocally = useCallback((periodId: string) => {
    const cancelledAt = new Date().toISOString();
    setAccrualPeriods((prev) =>
      prev.map((p) => (p.id === periodId ? { ...p, cancelled_at: cancelledAt } : p)),
    );
    setTaskScopedPeriods((prev) =>
      prev ? prev.map((p) => (p.id === periodId ? { ...p, cancelled_at: cancelledAt } : p)) : prev,
    );
  }, []);

  const refreshAfterPaymentConfirm = useCallback(async () => {
    try {
      const [manualRes, periods] = await Promise.all([
        supabase.from('payment_entries').select('*').order('occurred_at', { ascending: false }),
        fetchAllAccrualPeriods(),
      ]);
      if (manualRes.error) {
        toast({ title: 'Error refreshing payments', description: manualRes.error.message, variant: 'destructive' });
      } else {
        setManualEntries((manualRes.data || []) as PaymentEntryRecord[]);
      }
      setAccrualPeriods(periods);
      if (filterTaskId) await loadTaskScopedPeriods(filterTaskId);
    } catch (e) {
      console.error('Failed to refresh after payment confirm', e);
    }
  }, [filterTaskId, loadTaskScopedPeriods, toast]);

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

  const addManualEntry = async () => {
    if (!user?.id) {
      toast({ title: 'Not signed in', variant: 'destructive' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'Amount is required', variant: 'destructive' });
      return;
    }
    const res = await supabase.from('payment_entries').insert({
      user_id: user.id,
      entry_type: entryType,
      category,
      amount: Number(amount),
      currency: currency || 'USD',
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
      note: note.trim() || null,
      source_kind: 'manual',
      updated_at: new Date().toISOString(),
    });
    if (res.error) {
      toast({ title: 'Create failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    setAmount('');
    setNote('');
    toast({ title: 'Entry added' });
    void fetchAll();
  };

  const openTaskPaymentEdit = (rowId: string) => {
    const e = entryById[rowId];
    if (e?.source_kind === 'task_auto' && e.pool_item_id) setEditingTaskPayment(e);
  };

  const detailEntry = detailEntryId ? entryById[detailEntryId] ?? null : null;
  const detailTask =
    detailEntry?.pool_item_id
      ? taskById[normalizePoolItemId(detailEntry.pool_item_id) ?? ''] ??
        poolTasks.find((t) => periodBelongsToPool({ pool_item_id: t.id }, detailEntry.pool_item_id)) ??
        null
      : null;
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

  const deleteManual = async (id: string) => {
    const res = await supabase.from('payment_entries').delete().eq('id', id);
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    void fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const categoryOptions = entryType === 'incoming' ? INCOMING_CATEGORIES : OUTGOING_CATEGORIES;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Manage incoming and outgoing cashflow per period (25th to 25th). The schedule below lists only delayed task payments; confirmed rows appear in the ledger. Click any entry for details.
        </p>
      </div>

      {filterTaskId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Showing payments for{' '}
            <span className="font-medium text-foreground">{filterTask?.name ?? 'this task'}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1" asChild>
              <Link to={`/admin/tasks?task=${filterTaskId}`}>Open task</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={clearTaskFilter}>
              <X className="h-3.5 w-3.5" />
              Show all tasks
            </Button>
          </div>
        </div>
      ) : null}

      <PaymentAccrualScheduleCard
        periods={filterTaskId ? accrualSource : paymentTrackingPeriods}
        poolTasks={poolTasks.map((t) => ({ id: t.id, name: t.name }))}
        filterTaskId={filterTaskId}
        filterTaskName={filterTask?.name ?? null}
        loading={!!filterTaskId && taskPeriodsLoading}
        canCancel
        onPeriodSelect={setSelectedPeriod}
        onPeriodCancel={handleCancelPeriod}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title={`This Month (${thisMonthLabel})`} summary={thisSummary} />
        <StatCard title={`Last Month (${lastMonthLabel})`} summary={lastSummary} />
        <StatCard title={`Year (${yearLabel})`} summary={yearSummary} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add manual entry</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={entryType}
              onValueChange={(v) => {
                const next = v as 'incoming' | 'outgoing';
                setEntryType(next);
                setCategory(next === 'incoming' ? 'Other incoming' : 'Base fee');
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="incoming">Incoming</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-5">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="gap-2" onClick={addManualEntry}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {filterTaskId
                          ? 'No payment entries linked to this task for the selected period.'
                          : 'No entries for the selected period.'}
                      </td>
                    </tr>
                  ) : null}
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
                        <div className="flex justify-end gap-1">
                          {r.source_kind === 'task_auto' && entryById[r.id]?.pool_item_id ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Edit task payment"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTaskPaymentEdit(r.id);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
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
                          {r.source_kind === 'manual' ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteManual(r.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
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
                <div className="flex items-center gap-2">
                  <p className={r.entry_type === 'incoming' ? 'shrink-0 text-sm text-emerald-600' : 'shrink-0 text-sm text-red-600'}>
                    {r.currency} {r.amount.toFixed(2)}
                  </p>
                  {r.source_kind === 'task_auto' && entryById[r.id]?.pool_item_id ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTaskPaymentEdit(r.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
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
                  {r.source_kind === 'manual' ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteManual(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
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
                <div className="flex items-center gap-2">
                  <Badge variant={r.entry_type === 'incoming' ? 'default' : 'secondary'}>{r.entry_type}</Badge>
                  {r.source_kind === 'task_auto' && entryById[r.id]?.pool_item_id ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTaskPaymentEdit(r.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
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
                  {r.source_kind === 'manual' ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteManual(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
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
                <div className="flex flex-wrap gap-2">
                  {r.source_kind === 'task_auto' && entryById[r.id]?.pool_item_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTaskPaymentEdit(r.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  ) : null}
                  {canRollbackEntry(r.id) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 px-2 text-amber-700 hover:text-amber-800"
                      onClick={(e) => requestRollback(r.id, e)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Roll back
                    </Button>
                  ) : null}
                  {r.source_kind === 'manual' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-2 px-2 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteManual(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaymentEntryDetailDialog
        open={!!detailEntry}
        onOpenChange={(open) => !open && setDetailEntryId(null)}
        entry={detailEntry}
        taskName={detailTask?.name ?? null}
        taskHref={detailTask ? `/admin/tasks?task=${detailTask.id}` : null}
        accrualPeriod={detailAccrualPeriod}
        onEdit={
          detailEntry?.source_kind === 'task_auto' && detailEntry.pool_item_id
            ? () => {
                setDetailEntryId(null);
                openTaskPaymentEdit(detailEntry.id);
              }
            : undefined
        }
        onDelete={
          detailEntry?.source_kind === 'manual'
            ? () => {
                const id = detailEntry.id;
                setDetailEntryId(null);
                void deleteManual(id);
              }
            : undefined
        }
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

      <TaskAutoPaymentEditDialog
        entry={editingTaskPayment}
        onClose={() => setEditingTaskPayment(null)}
        onSaved={() => void fetchAll()}
      />

      <AccrualPeriodHandleDialog
        open={!!selectedPeriod}
        onOpenChange={(open) => !open && setSelectedPeriod(null)}
        period={selectedPeriod}
        task={selectedPeriodTask}
        taskHref={selectedPeriodTask ? `/admin/tasks?task=${selectedPeriodTask.id}` : null}
        onConfirmed={() => void refreshAfterPaymentConfirm()}
        onCancel={handleCancelPeriod}
      />
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
      <p className="text-[11px] text-muted-foreground">Net = Incoming - Outgoing</p>
    </div>
  );
}
