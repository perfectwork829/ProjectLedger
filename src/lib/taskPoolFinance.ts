import type { TaskPoolItemRecord } from '@/lib/taskPool';
import { taskPoolContractGross } from '@/lib/taskPool';

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

