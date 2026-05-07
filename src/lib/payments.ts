import { getLastPeriodBounds, getPeriodBoundsForDate, isWithinRange } from '@/lib/taskPoolFinance';

export type PaymentEntryType = 'incoming' | 'outgoing';
export type PaymentSourceKind = 'manual' | 'task_auto';
export type PaymentListFilter = 'all' | 'this_period' | 'last_period' | 'this_year' | 'this_week' | 'last_week' | 'custom';

export interface PaymentEntryRecord {
  id: string;
  user_id: string | null;
  entry_type: PaymentEntryType;
  category: string;
  amount: number;
  currency: string;
  occurred_at: string;
  note: string | null;
  source_kind: PaymentSourceKind;
  pool_item_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskFinanceRow {
  id: string;
  name: string;
  currency: string;
  task_received_at: string | null;
  created_at: string;
  budget_type: 'fixed' | 'hourly';
  fixed_budget_mode?: 'project' | 'recurring' | 'milestone' | null;
  withdrawn_amount: number | null;
  upwork_connection_fee: number;
  convert_fee: number;
  transfer_fee: number;
  upwork_fee: number;
  withdraw_fee: number;
}

export interface UnifiedPaymentRow {
  id: string;
  entry_type: PaymentEntryType;
  category: string;
  amount: number;
  currency: string;
  occurred_at: string;
  note: string | null;
  source_kind: PaymentSourceKind;
}

export interface PaymentSummary {
  incoming: number;
  outgoing: number;
  net: number;
  count: number;
}

export function buildTaskAutoRows(tasks: TaskFinanceRow[]): UnifiedPaymentRow[] {
  // Task cashflow is confirmation-driven and persisted in `payment_entries` (source_kind='task_auto').
  // Keep this empty to avoid double-counting virtual rows against confirmed rows.
  void tasks;
  return [];

  /*
  const rows: UnifiedPaymentRow[] = [];
  for (const t of tasks) {
    const occurred = t.task_received_at || t.created_at;
    const baseId = `task:${t.id}`;
    const currency = t.currency || 'USD';
    const taskNameNote = t.name ? `Task: ${t.name}` : null;
    const accrual = taskFinanceUsesAccrual(t);

    const withdrawn = Number(t.withdrawn_amount ?? 0);
    if (!accrual && withdrawn > 0) {
      rows.push({
        id: `${baseId}:incoming:withdrawn`,
        entry_type: 'incoming',
        category: 'Task withdrawn',
        amount: withdrawn,
        currency,
        occurred_at: occurred,
        note: taskNameNote,
        source_kind: 'task_auto',
      });
    }

    if (!accrual) {
      const outgoingFees: Array<[string, number]> = [
        ['Upwork connections fee', Number(t.upwork_connection_fee ?? 0)],
        ['Convert fee', Number(t.convert_fee ?? 0)],
        ['Transfer fee', Number(t.transfer_fee ?? 0)],
        ['Upwork fee', Number(t.upwork_fee ?? 0)],
        ['Withdraw fee', Number(t.withdraw_fee ?? 0)],
      ];
      outgoingFees.forEach(([category, amount]) => {
        if (amount <= 0) return;
        rows.push({
          id: `${baseId}:outgoing:${category.toLowerCase().replace(/\s+/g, '_')}`,
          entry_type: 'outgoing',
          category,
          amount,
          currency,
          occurred_at: occurred,
          note: taskNameNote,
          source_kind: 'task_auto',
        });
      });
    }
  }
  return rows;
  */
}

export function normalizeManualRows(entries: PaymentEntryRecord[]): UnifiedPaymentRow[] {
  return entries.map((e) => ({
    id: e.id,
    entry_type: e.entry_type,
    category: e.category,
    amount: Number(e.amount ?? 0),
    currency: e.currency || 'USD',
    occurred_at: e.occurred_at,
    note: e.note,
    source_kind: e.source_kind,
  }));
}

export function summarizeRows(rows: UnifiedPaymentRow[]): PaymentSummary {
  return rows.reduce(
    (acc, r) => {
      acc.count += 1;
      if (r.entry_type === 'incoming') acc.incoming += r.amount;
      else acc.outgoing += r.amount;
      acc.net = acc.incoming - acc.outgoing;
      return acc;
    },
    { incoming: 0, outgoing: 0, net: 0, count: 0 },
  );
}

export function getPaymentPeriods(now: Date) {
  const thisPeriod = getPeriodBoundsForDate(now);
  const lastPeriod = getLastPeriodBounds(now);
  const weekday = now.getDay(); // 0=Sun ... 6=Sat
  const diffFromMonday = (weekday + 6) % 7;
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffFromMonday, 0, 0, 0, 0);
  const thisWeekEnd = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + 7, 0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() - 7, 0, 0, 0, 0);
  const lastWeekEnd = thisWeekStart;
  const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  return { thisPeriod, lastPeriod, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, yearStart, yearEnd };
}

export function filterRowsByMode(
  rows: UnifiedPaymentRow[],
  filter: PaymentListFilter,
  now: Date,
  customRange?: { start: Date | null; end: Date | null },
): UnifiedPaymentRow[] {
  if (filter === 'all') return rows;
  const { thisPeriod, lastPeriod, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, yearStart, yearEnd } = getPaymentPeriods(now);
  if (filter === 'this_period') return rows.filter((r) => isWithinRange(r.occurred_at, thisPeriod.start, thisPeriod.end));
  if (filter === 'last_period') return rows.filter((r) => isWithinRange(r.occurred_at, lastPeriod.start, lastPeriod.end));
  if (filter === 'this_week') return rows.filter((r) => isWithinRange(r.occurred_at, thisWeekStart, thisWeekEnd));
  if (filter === 'last_week') return rows.filter((r) => isWithinRange(r.occurred_at, lastWeekStart, lastWeekEnd));
  if (filter === 'custom' && customRange?.start && customRange?.end) {
    return rows.filter((r) => isWithinRange(r.occurred_at, customRange.start as Date, customRange.end as Date));
  }
  if (filter === 'this_year') return rows.filter((r) => isWithinRange(r.occurred_at, yearStart, yearEnd));
  return rows;
}
