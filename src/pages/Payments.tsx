import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
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

export default function Payments() {
  const [loading, setLoading] = useState(true);
  const [manualEntries, setManualEntries] = useState<PaymentEntryRecord[]>([]);
  const [taskRows, setTaskRows] = useState<TaskFinanceRow[]>([]);
  const [filter, setFilter] = useState<PaymentListFilter>('this_period');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const [manualRes, taskRes] = await Promise.all([
      supabase.from('payment_entries').select('*').order('occurred_at', { ascending: false }),
      supabase
        .from('task_pool_items')
        .select(
          'id, name, currency, task_received_at, created_at, withdrawn_amount, upwork_connection_fee, convert_fee, transfer_fee, upwork_fee, withdraw_fee',
        )
        .order('task_received_at', { ascending: false }),
    ]);
    setManualEntries((manualRes.data || []) as PaymentEntryRecord[]);
    setTaskRows((taskRes.data || []) as TaskFinanceRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const allRows = useMemo<UnifiedPaymentRow[]>(() => {
    return [...buildTaskAutoRows(taskRows), ...normalizeManualRows(manualEntries)].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
  }, [taskRows, manualEntries]);

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
        <p className="text-sm text-muted-foreground">Incoming and outgoing monthly cashflow (25th to 25th).</p>
      </div>

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
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-t">
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
              <div key={r.id} className="flex items-center justify-between gap-3 border-t px-3 py-2 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.category}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.occurred_at).toLocaleString()} · {r.source_kind}</p>
                </div>
                <p className={r.entry_type === 'incoming' ? 'shrink-0 text-sm text-emerald-600' : 'shrink-0 text-sm text-red-600'}>
                  {r.currency} {r.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filteredRows.map((r) => (
            <Card key={r.id}>
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
            <Card key={r.id}>
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
