import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { parseMilestones, taskPoolContractGross, taskPoolFixedMode } from '@/lib/taskPool';

export type TaskPoolFeeFields = {
  upworkConnectionFee: number;
  convertFee: number;
  transferFee: number;
  upworkFee: number;
  withdrawFee: number;
};

export function taskPoolFeesFromNumbers(row: {
  upwork_connection_fee?: number | null;
  convert_fee?: number | null;
  transfer_fee?: number | null;
  upwork_fee?: number | null;
  withdraw_fee?: number | null;
}): TaskPoolFeeFields {
  return {
    upworkConnectionFee: Number(row.upwork_connection_fee ?? 0),
    convertFee: Number(row.convert_fee ?? 0),
    transferFee: Number(row.transfer_fee ?? 0),
    upworkFee: Number(row.upwork_fee ?? 0),
    withdrawFee: Number(row.withdraw_fee ?? 0),
  };
}

/** Parse billable hours from hourly accrual payment note (`… · 32h × …`). */
export function parseHourlyHoursFromAccrualNote(note: string | null | undefined): number | null {
  if (!note) return null;
  const m = note.match(/(\d+(?:\.\d+)?)\s*h\s*×/i);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) ? h : null;
}

export type HourlyAccrualPaymentSlice = { id: string; amount: number; note: string | null };

export type TaskAutoPaymentSlice = {
  id: string;
  amount: number;
  note: string | null;
  category: string;
};

/** Recompute total withdrawn for hourly tasks from stored hours per payment + current fees. */
export function sumHourlyWithdrawnFromPayments(
  hourlyRate: number,
  fees: TaskPoolFeeFields,
  payments: HourlyAccrualPaymentSlice[],
): number {
  let total = 0;
  for (const p of payments) {
    const hours = parseHourlyHoursFromAccrualNote(p.note);
    if (hours == null || hours <= 0) {
      total += Number(p.amount ?? 0);
      continue;
    }
    const gross = hours * hourlyRate;
    total += calcWithdrawnAmount({ budgetAmount: gross, ...fees });
  }
  return total;
}

export type TaskPoolListFilter =
  | 'all'
  | 'latest'
  | 'this_period'
  | 'last_period'
  | 'this_year'
  | 'working'
  | 'this_week'
  | 'last_week'
  | 'custom';

export function calcWithdrawnAmount(input: {
  budgetAmount: number;
  upworkConnectionFee: number;
  convertFee: number;
  transferFee: number;
  upworkFee: number;
  withdrawFee: number;
}): number {
  return (
    input.budgetAmount -
    (input.upworkConnectionFee + input.convertFee + input.transferFee + input.upworkFee + input.withdrawFee)
  );
}

export function getPeriodBoundsForDate(now: Date): { start: Date; end: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const isAfterOrOn25 = day >= 25;

  const start = isAfterOrOn25 ? new Date(year, month, 25, 0, 0, 0, 0) : new Date(year, month - 1, 25, 0, 0, 0, 0);
  const end = isAfterOrOn25 ? new Date(year, month + 1, 25, 0, 0, 0, 0) : new Date(year, month, 25, 0, 0, 0, 0);
  return { start, end };
}

export function getLastPeriodBounds(now: Date): { start: Date; end: Date } {
  const current = getPeriodBoundsForDate(now);
  return {
    start: new Date(current.start.getFullYear(), current.start.getMonth() - 1, 25, 0, 0, 0, 0),
    end: current.start,
  };
}

export function getWeekBounds(now: Date): {
  thisWeekStart: Date;
  thisWeekEnd: Date;
  lastWeekStart: Date;
  lastWeekEnd: Date;
} {
  const weekday = now.getDay(); // 0=Sun...6=Sat
  const diffFromMonday = (weekday + 6) % 7;
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffFromMonday, 0, 0, 0, 0);
  const thisWeekEnd = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + 7, 0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() - 7, 0, 0, 0, 0);
  const lastWeekEnd = thisWeekStart;
  return { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd };
}

export function isWithinRange(dateIso: string | null, start: Date, end: Date): boolean {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  return d >= start && d < end;
}

export type TaskPoolFormWithdrawnInput = {
  budgetType: 'fixed' | 'hourly';
  fixedBudgetMode: 'project' | 'recurring' | 'milestone';
  budgetAmount: string;
  milestones: { amount: string; confirmedAt: string | null }[];
  hourlyRate: string;
};

/** Live preview for the task form "Withdrawn amount" field (reacts to fee inputs). */
export function computeTaskPoolWithdrawnPreview(
  form: TaskPoolFormWithdrawnInput,
  fees: TaskPoolFeeFields,
  existing: TaskPoolItemRecord | null | undefined,
  taskAutoPayments?: TaskAutoPaymentSlice[],
): number {
  if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'project') {
    const budget = Number(form.budgetAmount || 0);
    return calcWithdrawnAmount({ budgetAmount: budget, ...fees });
  }
  if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone') {
    return form.milestones
      .filter((m) => m.confirmedAt)
      .reduce((s, m) => {
        const gross = Math.max(0, Number(m.amount) || 0);
        return s + calcWithdrawnAmount({ budgetAmount: gross, ...fees });
      }, 0);
  }
  if (form.budgetType === 'hourly') {
    if (!existing) return 0;
    const rate = Number(form.hourlyRate || existing.hourly_rate || 0);
    const hourlySlices = taskAutoPayments?.filter((p) => p.category.toLowerCase().includes('hourly'));
    if (hourlySlices && hourlySlices.length > 0 && rate > 0) {
      return sumHourlyWithdrawnFromPayments(rate, fees, hourlySlices);
    }
    const storedHours = Number(existing.hourly_last_billable_hours ?? 0);
    const current = Number(existing.withdrawn_amount ?? 0);
    if (storedHours > 0 && rate > 0) {
      const rowFees = taskPoolFeesFromNumbers(existing);
      const oldLastNet = calcWithdrawnAmount({ budgetAmount: storedHours * rate, ...rowFees });
      const newLastNet = calcWithdrawnAmount({ budgetAmount: storedHours * rate, ...fees });
      return Math.max(0, current - oldLastNet + newLastNet);
    }
    return current;
  }
  if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring') {
    const installment = Number(form.budgetAmount || existing?.budget_amount || 0);
    const slices =
      taskAutoPayments?.filter((p) => p.category.toLowerCase().includes('installment')) ?? [];
    if (slices.length > 0 && installment > 0) {
      const perSlice = calcWithdrawnAmount({ budgetAmount: installment, ...fees });
      return perSlice * slices.length;
    }
    return Number(existing?.withdrawn_amount ?? 0);
  }
  return Number(existing?.withdrawn_amount ?? 0);
}

/** Total withdrawn from all confirmed task-auto incoming rows using current fees. */
export function computeWithdrawnFromTaskAutoPayments(
  task: Pick<TaskPoolItemRecord, 'budget_type' | 'fixed_budget_mode' | 'budget_amount' | 'hourly_rate'>,
  fees: TaskPoolFeeFields,
  payments: TaskAutoPaymentSlice[],
  milestoneGrossByPaymentId?: Record<string, number>,
): number {
  const incoming = payments.filter((p) => p.category.startsWith('Task pool'));
  if (task.budget_type === 'hourly') {
    return sumHourlyWithdrawnFromPayments(Number(task.hourly_rate ?? 0), fees, incoming);
  }
  let total = 0;
  for (const p of incoming) {
    let gross = milestoneGrossByPaymentId?.[p.id] ?? 0;
    if (gross <= 0 && task.budget_type === 'fixed') {
      gross = Number(task.budget_amount ?? 0);
    }
    if (gross > 0) total += calcWithdrawnAmount({ budgetAmount: gross, ...fees });
    else total += Number(p.amount ?? 0);
  }
  return total;
}

/** Persisted withdrawn when saving the task form (fee edits sync to stored withdrawn). */
export function computeTaskPoolWithdrawnOnSave(
  form: TaskPoolFormWithdrawnInput,
  fees: TaskPoolFeeFields,
  existing: TaskPoolItemRecord | null | undefined,
  milestoneRowsForSave: { confirmed_at: string | null; amount: number }[],
  hourlyPaymentSlices?: HourlyAccrualPaymentSlice[],
): number {
  if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'project') {
    const budget = Number(form.budgetAmount || 0);
    const targetNet = calcWithdrawnAmount({ budgetAmount: budget, ...fees });
    if (!existing) return 0;
    const current = Number(existing.withdrawn_amount ?? 0);
    if (current <= 0) return 0;
    return targetNet;
  }
  if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone') {
    return milestoneRowsForSave
      .filter((m) => m.confirmed_at)
      .reduce((s, m) => s + calcWithdrawnAmount({ budgetAmount: Number(m.amount ?? 0), ...fees }), 0);
  }
  if (form.budgetType === 'hourly' && existing && hourlyPaymentSlices && hourlyPaymentSlices.length > 0) {
    const rate = Number(form.hourlyRate || existing.hourly_rate || 0);
    return sumHourlyWithdrawnFromPayments(rate, fees, hourlyPaymentSlices);
  }
  if (form.budgetType === 'hourly' && existing) {
    return computeTaskPoolWithdrawnPreview(form, fees, existing);
  }
  if (existing && (form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring')) {
    return Number(existing.withdrawn_amount ?? 0);
  }
  return 0;
}

export function summarizeTaskPool(items: TaskPoolItemRecord[]): { count: number; realBudget: number; withdrawnBudget: number } {
  return items.reduce(
    (acc, item) => {
      acc.count += 1;
      acc.realBudget += taskPoolContractGross(item);
      acc.withdrawnBudget += Number(item.withdrawn_amount ?? 0);
      return acc;
    },
    { count: 0, realBudget: 0, withdrawnBudget: 0 },
  );
}

