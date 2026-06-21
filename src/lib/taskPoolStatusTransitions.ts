import { compareJstYmd, formatJstYmd } from '@/lib/jst';
import type { TaskPoolItemRecord, TaskPoolItemStatus } from '@/lib/taskPool';

export const ACCRUAL_GAP_RANGES_META_KEY = 'accrual_gap_ranges';

/** Task statuses where work may continue but payments are not tracked. */
export const NON_BILLING_TASK_STATUSES = ['paused', 'free'] as const;

export type NonBillingTaskStatus = (typeof NON_BILLING_TASK_STATUSES)[number];

export type AccrualGapRange = { from_ymd: string; to_ymd: string };

const NON_BILLING_AT_FIELD: Record<NonBillingTaskStatus, 'paused_at' | 'free_at'> = {
  paused: 'paused_at',
  free: 'free_at',
};

export function isNonBillingTaskStatus(status: string): status is NonBillingTaskStatus {
  return (NON_BILLING_TASK_STATUSES as readonly string[]).includes(status);
}

export function isTaskPaused(task: Pick<TaskPoolItemRecord, 'status'>): boolean {
  return task.status === 'paused';
}

export function isTaskFree(task: Pick<TaskPoolItemRecord, 'status'>): boolean {
  return task.status === 'free';
}

/** Whether unconfirmed accruals should appear in Payments / task badges. */
export function isTaskPaymentAccrualActive(task: Pick<TaskPoolItemRecord, 'status'>): boolean {
  return !['cancelled', 'completed', ...NON_BILLING_TASK_STATUSES].includes(task.status);
}

export function parseAccrualGapRanges(metadata: Record<string, unknown> | null | undefined): AccrualGapRange[] {
  const raw = metadata?.[ACCRUAL_GAP_RANGES_META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (g): g is AccrualGapRange =>
      !!g &&
      typeof g === 'object' &&
      typeof (g as AccrualGapRange).from_ymd === 'string' &&
      typeof (g as AccrualGapRange).to_ymd === 'string',
  );
}

/** Closed gaps from metadata plus the open non-billing window when status is paused or free. */
export function getAccrualGapRanges(task: TaskPoolItemRecord, now = new Date()): AccrualGapRange[] {
  const gaps = [...parseAccrualGapRanges(task.metadata_json)];
  if (task.status === 'paused' && task.paused_at) {
    gaps.push({
      from_ymd: formatJstYmd(new Date(task.paused_at)),
      to_ymd: '9999-12-31',
    });
  }
  if (task.status === 'free' && task.free_at) {
    gaps.push({
      from_ymd: formatJstYmd(new Date(task.free_at)),
      to_ymd: '9999-12-31',
    });
  }
  return gaps;
}

export function periodOverlapsAccrualGap(
  task: TaskPoolItemRecord,
  periodStartYmd: string,
  periodEndYmd: string,
  now = new Date(),
): boolean {
  for (const gap of getAccrualGapRanges(task, now)) {
    if (compareJstYmd(periodEndYmd, gap.from_ymd) >= 0 && compareJstYmd(periodStartYmd, gap.to_ymd) <= 0) {
      return true;
    }
  }
  return false;
}

function nonBillingSinceIso(task: TaskPoolItemRecord, status: NonBillingTaskStatus): string | null | undefined {
  return task[NON_BILLING_AT_FIELD[status]];
}

/** Fields to merge when changing parent task status (pause / free / resume bookkeeping). */
export function buildPoolStatusTransitionFields(
  existing: TaskPoolItemRecord,
  newStatus: TaskPoolItemStatus,
  now = new Date(),
): Pick<TaskPoolItemRecord, 'status' | 'paused_at' | 'free_at' | 'metadata_json'> {
  const todayYmd = formatJstYmd(now);
  const isoNow = now.toISOString();
  const metadata = { ...(existing.metadata_json ?? {}) } as Record<string, unknown>;
  const gaps = parseAccrualGapRanges(metadata);

  let paused_at = existing.paused_at ?? null;
  let free_at = existing.free_at ?? null;

  if (isNonBillingTaskStatus(existing.status) && existing.status !== newStatus) {
    const since = nonBillingSinceIso(existing, existing.status);
    if (since) {
      gaps.push({
        from_ymd: formatJstYmd(new Date(since)),
        to_ymd: todayYmd,
      });
      metadata[ACCRUAL_GAP_RANGES_META_KEY] = gaps;
    }
    if (existing.status === 'paused') paused_at = null;
    if (existing.status === 'free') free_at = null;
  }

  if (isNonBillingTaskStatus(newStatus) && existing.status !== newStatus) {
    if (newStatus === 'paused') paused_at = isoNow;
    if (newStatus === 'free') free_at = isoNow;
  }

  return {
    status: newStatus,
    paused_at,
    free_at,
    metadata_json: metadata,
  };
}
