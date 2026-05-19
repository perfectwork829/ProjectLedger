import { supabase } from '@/lib/supabase';
import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { parseMilestones, taskPoolFixedMode } from '@/lib/taskPool';
import { formatJstYmd } from '@/lib/jst';
import {
  buildExpectedAccrualPeriodSpecs,
  isUpworkTopRatedAccount,
  type TaskPoolAccrualPeriodRow,
} from '@/lib/taskPoolAccrualPeriods';
import { advanceRecurringDueJstYmd } from '@/lib/jst';
import { calcWithdrawnAmount, parseHourlyHoursFromAccrualNote } from '@/lib/taskPoolFinance';

export type AccountBadgeLookup = { id: string; badge_status: string | null };

export async function syncAccrualPeriodsForTask(
  task: TaskPoolItemRecord,
  account: AccountBadgeLookup | undefined,
  now = new Date(),
): Promise<void> {
  if (['cancelled'].includes(task.status)) return;
  const topRated = isUpworkTopRatedAccount(account?.badge_status);
  const specs = buildExpectedAccrualPeriodSpecs(task, { topRated, now });

  for (const spec of specs) {
    const { data: existing } = await supabase
      .from('task_pool_accrual_periods')
      .select('id, confirmed_at, tracked_hours, billable_hours')
      .eq('pool_item_id', task.id)
      .eq('period_kind', spec.period_kind)
      .eq('period_key', spec.period_key)
      .maybeSingle();

    if (existing?.confirmed_at) continue;

    const payload = {
      pool_item_id: task.id,
      period_kind: spec.period_kind,
      period_key: spec.period_key,
      label: spec.label,
      week_monday: spec.week_monday,
      period_end_ymd: spec.period_end_ymd,
      due_confirm_on: spec.due_confirm_on,
      milestone_id: spec.milestone_id,
      tracked_hours: existing?.tracked_hours ?? spec.tracked_hours ?? null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from('task_pool_accrual_periods').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('task_pool_accrual_periods').insert(payload);
    }
  }
}

export async function syncAccrualPeriodsForTasks(
  tasks: TaskPoolItemRecord[],
  accounts: AccountBadgeLookup[],
): Promise<void> {
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const active = tasks.filter((t) => !['cancelled'].includes(t.status));
  await Promise.all(
    active.map((t) => syncAccrualPeriodsForTask(t, t.account_id ? accountMap[t.account_id] : undefined)),
  );
}

export async function fetchAllAccrualPeriods(): Promise<TaskPoolAccrualPeriodRow[]> {
  const { data, error } = await supabase
    .from('task_pool_accrual_periods')
    .select('*')
    .order('due_confirm_on', { ascending: true });
  if (error) throw error;
  return (data || []) as TaskPoolAccrualPeriodRow[];
}

export async function fetchAccrualPeriodsForPool(poolId: string): Promise<TaskPoolAccrualPeriodRow[]> {
  const { data, error } = await supabase
    .from('task_pool_accrual_periods')
    .select('*')
    .eq('pool_item_id', poolId)
    .order('due_confirm_on', { ascending: true });
  if (error) throw error;
  return (data || []) as TaskPoolAccrualPeriodRow[];
}

export type ConfirmAccrualPeriodInput = {
  periodId: string;
  billableHours?: number | null;
  trackedHours?: number | null;
  paymentReceived: boolean;
  fees: {
    upworkConnectionFee: number;
    convertFee: number;
    transferFee: number;
    upworkFee: number;
    withdrawFee: number;
  };
  userId: string;
};

export async function confirmAccrualPeriod(
  period: TaskPoolAccrualPeriodRow,
  task: TaskPoolItemRecord,
  input: ConfirmAccrualPeriodInput,
): Promise<{ task: TaskPoolItemRecord }> {
  const fees = input.fees;
  let gross = 0;
  let billableHours = input.billableHours ?? period.billable_hours ?? period.tracked_hours;

  if (period.period_kind === 'hourly_week') {
    const h = Math.min(
      Math.max(Number(billableHours ?? 0), 0),
      Number(task.weekly_hours_cap ?? 40),
    );
    billableHours = h;
    gross = h * Number(task.hourly_rate ?? 0);
  } else if (period.period_kind === 'milestone' && period.milestone_id) {
    const m = parseMilestones(task.milestones_json).find((x) => x.id === period.milestone_id);
    gross = Number(m?.amount ?? 0);
  } else {
    gross = Number(task.budget_amount ?? 0);
  }

  const net = calcWithdrawnAmount({ budgetAmount: gross, ...fees });
  const nowIso = new Date().toISOString();

  let noteExtra = period.label;
  if (period.period_kind === 'hourly_week') {
    noteExtra = `Hourly (JST Mon–Sun) · ${billableHours}h × ${task.hourly_rate} · week ${period.week_monday}`;
  } else if (period.period_kind === 'fixed_project') {
    noteExtra = 'Fixed project · one-time payment (JST)';
  } else if (period.period_kind === 'milestone') {
    noteExtra = `Fixed milestone · ${period.label.replace(/^Milestone: /, '')}`;
  } else {
    noteExtra = `Fixed ${task.recurring_cadence || 'recurring'} · ${period.label}`;
  }

  const category =
    period.period_kind === 'hourly_week'
      ? 'Task pool (hourly)'
      : period.period_kind === 'fixed_project'
        ? 'Task pool (fixed project)'
        : period.period_kind === 'milestone'
          ? 'Task pool (fixed milestone)'
          : 'Task pool (fixed installment)';

  const payRes = await supabase
    .from('payment_entries')
    .insert({
      user_id: input.userId,
      entry_type: 'incoming',
      category,
      amount: net,
      currency: task.currency || 'USD',
      occurred_at: nowIso,
      note: `${task.name} — ${noteExtra}${input.paymentReceived ? '' : ' · payment pending'}`,
      source_kind: 'task_auto',
      pool_item_id: task.id,
      updated_at: nowIso,
    })
    .select('id')
    .single();

  if (payRes.error || !payRes.data) {
    throw new Error(payRes.error?.message || 'Payment entry failed');
  }

  await supabase
    .from('task_pool_accrual_periods')
    .update({
      billable_hours: billableHours,
      tracked_hours: input.trackedHours ?? period.tracked_hours ?? billableHours,
      payment_received: input.paymentReceived,
      gross_amount: gross,
      net_amount: net,
      confirmed_at: nowIso,
      payment_entry_id: payRes.data.id,
      updated_at: nowIso,
    })
    .eq('id', period.id);

  const taskPatch: Record<string, unknown> = {
    upwork_connection_fee: fees.upworkConnectionFee,
    convert_fee: fees.convertFee,
    transfer_fee: fees.transferFee,
    upwork_fee: fees.upworkFee,
    withdraw_fee: fees.withdrawFee,
    updated_at: nowIso,
  };

  if (period.period_kind === 'hourly_week' && period.week_monday) {
    taskPatch.hourly_last_ack_week_monday = period.week_monday;
    taskPatch.hourly_last_billable_hours = billableHours;
  }

  if (period.period_kind === 'milestone' && period.milestone_id) {
    const ms = parseMilestones(task.milestones_json).map((m) =>
      m.id === period.milestone_id ? { ...m, confirmed_at: nowIso } : m,
    );
    taskPatch.milestones_json = ms;
  }

  if (period.period_kind === 'recurring' && task.next_payment_due_at) {
    const cadence = task.recurring_cadence || 'weekly';
    taskPatch.next_payment_due_at = advanceRecurringDueJstYmd(task.next_payment_due_at, cadence);
  }

  const allPeriods = await fetchAccrualPeriodsForPool(task.id);
  taskPatch.withdrawn_amount = allPeriods
    .filter((p) => p.confirmed_at)
    .reduce((s, p) => s + Number(p.net_amount ?? 0), 0);

  const { data: updatedTask, error: taskErr } = await supabase
    .from('task_pool_items')
    .update(taskPatch)
    .eq('id', task.id)
    .select('*')
    .single();

  if (taskErr || !updatedTask) throw new Error(taskErr?.message || 'Task update failed');
  return { task: updatedTask as TaskPoolItemRecord };
}

/** Recompute task withdrawn from all confirmed periods. */
export async function recomputeTaskWithdrawnFromPeriods(poolId: string): Promise<number> {
  const periods = await fetchAccrualPeriodsForPool(poolId);
  return periods.filter((p) => p.confirmed_at).reduce((s, p) => s + Number(p.net_amount ?? 0), 0);
}

export async function updatePeriodTrackedHours(periodId: string, hours: number): Promise<void> {
  await supabase
    .from('task_pool_accrual_periods')
    .update({ tracked_hours: hours, updated_at: new Date().toISOString() })
    .eq('id', periodId);
}

/** Link legacy payment_entries to periods where possible (best-effort). */
export async function backfillConfirmedPeriodsFromPayments(
  task: TaskPoolItemRecord,
  payments: { id: string; amount: number; note: string | null; category: string }[],
): Promise<void> {
  for (const pay of payments) {
    if (!pay.category.includes('hourly')) continue;
    const hours = parseHourlyHoursFromAccrualNote(pay.note);
    const weekMatch = pay.note?.match(/week (\d{4}-\d{2}-\d{2})/);
    const weekMonday = weekMatch?.[1];
    if (!weekMonday) continue;
    await supabase
      .from('task_pool_accrual_periods')
      .update({
        confirmed_at: new Date().toISOString(),
        payment_entry_id: pay.id,
        net_amount: pay.amount,
        billable_hours: hours,
        tracked_hours: hours,
        payment_received: true,
        updated_at: new Date().toISOString(),
      })
      .eq('pool_item_id', task.id)
      .eq('period_kind', 'hourly_week')
      .eq('period_key', weekMonday)
      .is('confirmed_at', null);
  }
}
