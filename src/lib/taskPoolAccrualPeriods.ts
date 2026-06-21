import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { parseMilestones, taskPoolFixedMode, milestoneDueConfirmOnYmd } from '@/lib/taskPool';
import { periodOverlapsAccrualGap, isTaskPaymentAccrualActive } from '@/lib/taskPoolStatusTransitions';
import { addDaysToJstYmd, compareJstYmd, formatJstYmd, getJstMondayYmd } from '@/lib/jst';

export type AccrualPeriodKind = 'hourly_week' | 'recurring' | 'fixed_project' | 'milestone';

export interface TaskPoolAccrualPeriodRow {
  id: string;
  pool_item_id: string;
  period_kind: AccrualPeriodKind;
  period_key: string;
  label: string;
  week_monday: string | null;
  period_end_ymd: string;
  due_confirm_on: string;
  tracked_hours: number | null;
  billable_hours: number | null;
  payment_received: boolean | null;
  gross_amount: number | null;
  net_amount: number | null;
  milestone_id: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  payment_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AccrualPeriodSpec = Omit<
  TaskPoolAccrualPeriodRow,
  'id' | 'pool_item_id' | 'created_at' | 'updated_at' | 'tracked_hours' | 'billable_hours' | 'payment_received' | 'gross_amount' | 'net_amount' | 'confirmed_at' | 'cancelled_at' | 'payment_entry_id'
> & {
  tracked_hours?: number | null;
};

export function isUpworkTopRatedAccount(badgeStatus: string | null | undefined): boolean {
  return badgeStatus === 'top_rated' || badgeStatus === 'top_rated_plus';
}

/** Normalize pool/task ids from URL or Supabase for reliable equality checks. */
export function normalizePoolItemId(id: string | null | undefined): string | null {
  if (id == null) return null;
  const trimmed = String(id).trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

export function periodBelongsToPool(
  period: Pick<TaskPoolAccrualPeriodRow, 'pool_item_id'>,
  poolId: string | null | undefined,
): boolean {
  const a = normalizePoolItemId(period.pool_item_id);
  const b = normalizePoolItemId(poolId);
  return !!a && !!b && a === b;
}

/** Wednesday after `weeksAfter` full JST weeks from work-week Monday (1 → +9d, 2 → +16d). */
export function wednesdayDueForWorkWeek(weekMonday: string, weeksAfter: 1 | 2): string {
  return addDaysToJstYmd(weekMonday, 2 + weeksAfter * 7);
}

function taskEndYmd(task: TaskPoolItemRecord, now: Date): string {
  if (task.finished_at) return formatJstYmd(new Date(task.finished_at));
  if (task.status === 'paused' && task.paused_at) return formatJstYmd(new Date(task.paused_at));
  if (task.status === 'free' && task.free_at) return formatJstYmd(new Date(task.free_at));
  return formatJstYmd(now);
}

function skipSpecForAccrualGap(task: TaskPoolItemRecord, periodStartYmd: string, periodEndYmd: string, now: Date): boolean {
  return periodOverlapsAccrualGap(task, periodStartYmd, periodEndYmd, now);
}

function taskStartMonday(task: TaskPoolItemRecord): string {
  const anchor = task.task_received_at || task.created_at;
  return getJstMondayYmd(new Date(anchor));
}

function iterateWeekMondays(fromMonday: string, untilYmd: string): string[] {
  const out: string[] = [];
  let cur = fromMonday;
  while (compareJstYmd(cur, untilYmd) <= 0) {
    out.push(cur);
    cur = addDaysToJstYmd(cur, 7);
    if (out.length > 520) break;
  }
  return out;
}

function formatWeekLabel(weekMonday: string): string {
  const end = addDaysToJstYmd(weekMonday, 6);
  return `Week ${weekMonday} – ${end}`;
}

/** Build expected accrual period specs (not yet persisted). */
export function buildExpectedAccrualPeriodSpecs(
  task: TaskPoolItemRecord,
  opts: { topRated: boolean; now?: Date },
): AccrualPeriodSpec[] {
  const now = opts.now ?? new Date();
  const today = formatJstYmd(now);
  const endYmd = taskEndYmd(task, now);
  const specs: AccrualPeriodSpec[] = [];

  if (task.budget_type === 'hourly') {
    const startMon = taskStartMonday(task);
    const weeks = iterateWeekMondays(startMon, endYmd);
    const wedOffset = opts.topRated ? 1 : 2;
    for (const weekMonday of weeks) {
      const periodEnd = addDaysToJstYmd(weekMonday, 6);
      if (compareJstYmd(periodEnd, today) > 0 && !task.finished_at) continue;
      if (skipSpecForAccrualGap(task, weekMonday, periodEnd, now)) continue;
      specs.push({
        period_kind: 'hourly_week',
        period_key: weekMonday,
        label: formatWeekLabel(weekMonday),
        week_monday: weekMonday,
        period_end_ymd: periodEnd,
        due_confirm_on: wednesdayDueForWorkWeek(weekMonday, wedOffset),
        milestone_id: null,
        tracked_hours: Number(task.weekly_hours_cap ?? 40),
      });
    }
    return specs;
  }

  if (task.budget_type === 'fixed' && taskPoolFixedMode(task) === 'project') {
    const due =
      task.deadline != null && !Number.isNaN(new Date(task.deadline).getTime())
        ? formatJstYmd(new Date(task.deadline))
        : endYmd;
    specs.push({
      period_kind: 'fixed_project',
      period_key: 'project',
      label: 'Fixed project payment',
      week_monday: null,
      period_end_ymd: due,
      due_confirm_on: due,
      milestone_id: null,
    });
    return specs;
  }

  if (task.budget_type === 'fixed' && taskPoolFixedMode(task) === 'milestone') {
    for (const m of parseMilestones(task.milestones_json)) {
      if (Number(m.amount) <= 0) continue;
      if (m.confirmed_at) continue;
      const dueYmd = milestoneDueConfirmOnYmd(task, m);
      specs.push({
        period_kind: 'milestone',
        period_key: m.id,
        label: `Milestone: ${m.title}`,
        week_monday: null,
        period_end_ymd: dueYmd,
        due_confirm_on: dueYmd,
        milestone_id: m.id,
      });
    }
    return specs;
  }

  if (task.budget_type === 'fixed' && taskPoolFixedMode(task) === 'recurring') {
    const cadence = task.recurring_cadence || 'weekly';
    const startMon = taskStartMonday(task);
    const stepDays = cadence === 'biweekly' ? 14 : cadence === 'monthly' ? 28 : 7;
    let blockStart = startMon;
    let i = 0;
    while (compareJstYmd(blockStart, endYmd) <= 0 && i < 260) {
      const blockEnd = addDaysToJstYmd(blockStart, stepDays - 1);
      const dueMonday = addDaysToJstYmd(blockEnd, 1);
      if (compareJstYmd(blockEnd, today) <= 0 || task.finished_at) {
        if (!skipSpecForAccrualGap(task, blockStart, blockEnd, now)) {
          specs.push({
            period_kind: 'recurring',
            period_key: `i${i}`,
            label:
              cadence === 'biweekly'
                ? `Bi-weekly ${blockStart} – ${blockEnd}`
                : cadence === 'monthly'
                  ? `Monthly ${blockStart} – ${blockEnd}`
                  : `Weekly ${blockStart} – ${blockEnd}`,
            week_monday: blockStart,
            period_end_ymd: blockEnd,
            due_confirm_on: dueMonday,
            milestone_id: null,
          });
        }
      }
      blockStart = addDaysToJstYmd(blockStart, stepDays);
      i += 1;
    }
    return specs;
  }

  return specs;
}

export function isPeriodCancelled(period: TaskPoolAccrualPeriodRow): boolean {
  return !!period.cancelled_at;
}

export function isPeriodConfirmable(period: TaskPoolAccrualPeriodRow, todayYmd: string = formatJstYmd(new Date())): boolean {
  if (period.confirmed_at || period.cancelled_at) return false;
  return compareJstYmd(todayYmd, period.due_confirm_on) >= 0;
}

export function isPeriodUnconfirmed(period: TaskPoolAccrualPeriodRow): boolean {
  return !period.confirmed_at && !period.cancelled_at;
}

/** Past the JST due-confirm date and still not confirmed. */
export function isPeriodOverdue(period: TaskPoolAccrualPeriodRow, todayYmd: string = formatJstYmd(new Date())): boolean {
  if (period.confirmed_at || period.cancelled_at) return false;
  return compareJstYmd(todayYmd, period.due_confirm_on) > 0;
}

/** Scheduled accrual not yet due for confirmation (JST). */
export function isPeriodUpcoming(period: TaskPoolAccrualPeriodRow, todayYmd: string = formatJstYmd(new Date())): boolean {
  if (period.confirmed_at || period.cancelled_at) return false;
  return compareJstYmd(todayYmd, period.due_confirm_on) < 0;
}

export function isPeriodPending(period: TaskPoolAccrualPeriodRow, todayYmd: string = formatJstYmd(new Date())): boolean {
  return isPeriodConfirmable(period, todayYmd);
}

export function countPendingPeriods(periods: TaskPoolAccrualPeriodRow[], todayYmd?: string): number {
  return periods.filter((p) => isPeriodPending(p, todayYmd)).length;
}

export function countPendingByPool(periods: TaskPoolAccrualPeriodRow[], todayYmd?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of periods) {
    if (!isPeriodPending(p, todayYmd)) continue;
    out[p.pool_item_id] = (out[p.pool_item_id] || 0) + 1;
  }
  return out;
}

/** Drop accrual rows for tasks that are paused, free, completed, or cancelled. */
export function filterAccrualPeriodsForPaymentTracking(
  periods: TaskPoolAccrualPeriodRow[],
  tasks: Pick<TaskPoolItemRecord, 'id' | 'status'>[],
): TaskPoolAccrualPeriodRow[] {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  return periods.filter((p) => {
    const task = byId[p.pool_item_id];
    return task && isTaskPaymentAccrualActive(task);
  });
}

export function findAccrualPeriodForMilestone(
  periods: TaskPoolAccrualPeriodRow[],
  poolItemId: string,
  milestoneId: string,
): TaskPoolAccrualPeriodRow | null {
  return (
    periods.find(
      (p) =>
        p.pool_item_id === poolItemId &&
        p.period_kind === 'milestone' &&
        p.period_key === milestoneId &&
        !p.confirmed_at &&
        !p.cancelled_at,
    ) ?? null
  );
}
