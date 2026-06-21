import { compareJstYmd, formatJstYmd } from '@/lib/jst';
import type { TaskPoolItemRecord, TaskPoolItemStatus } from '@/lib/taskPool';

export const ACCRUAL_GAP_RANGES_META_KEY = 'accrual_gap_ranges';

export type AccrualGapRange = { from_ymd: string; to_ymd: string };

export function isTaskPaused(task: Pick<TaskPoolItemRecord, 'status'>): boolean {
  return task.status === 'paused';
}

/** Whether unconfirmed accruals should appear in Payments / task badges. */
export function isTaskPaymentAccrualActive(task: Pick<TaskPoolItemRecord, 'status'>): boolean {
  return !['cancelled', 'paused', 'completed'].includes(task.status);
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

/** Closed gaps from metadata plus the open pause window when status is paused. */
export function getAccrualGapRanges(task: TaskPoolItemRecord, now = new Date()): AccrualGapRange[] {
  const gaps = [...parseAccrualGapRanges(task.metadata_json)];
  if (task.status === 'paused' && task.paused_at) {
    gaps.push({
      from_ymd: formatJstYmd(new Date(task.paused_at)),
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

/** Fields to merge when changing parent task status (pause / resume bookkeeping). */
export function buildPoolStatusTransitionFields(
  existing: TaskPoolItemRecord,
  newStatus: TaskPoolItemStatus,
  now = new Date(),
): Pick<TaskPoolItemRecord, 'status' | 'paused_at' | 'metadata_json'> {
  const todayYmd = formatJstYmd(now);
  const metadata = { ...(existing.metadata_json ?? {}) } as Record<string, unknown>;
  const gaps = parseAccrualGapRanges(metadata);

  if (newStatus === 'paused' && existing.status !== 'paused') {
    return {
      status: 'paused',
      paused_at: now.toISOString(),
      metadata_json: metadata,
    };
  }

  if (existing.status === 'paused' && newStatus !== 'paused' && existing.paused_at) {
    gaps.push({
      from_ymd: formatJstYmd(new Date(existing.paused_at)),
      to_ymd: todayYmd,
    });
    metadata[ACCRUAL_GAP_RANGES_META_KEY] = gaps;
    return {
      status: newStatus,
      paused_at: null,
      metadata_json: metadata,
    };
  }

  return {
    status: newStatus,
    paused_at: existing.paused_at ?? null,
    metadata_json: metadata,
  };
}
