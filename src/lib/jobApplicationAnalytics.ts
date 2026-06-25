import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { ApplicationStatus, JobApplicationRow } from '@/lib/jobApplications';

export type AnalyticsRange = '7d' | '14d' | '30d' | '90d';

export function rangeDays(range: AnalyticsRange): number {
  return range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 90;
}

export function applicationsInRange(rows: JobApplicationRow[], range: AnalyticsRange, tz: string, now = new Date()): JobApplicationRow[] {
  const days = rangeDays(range);
  const startKey = formatInTimeZone(subDays(now, days - 1), tz, 'yyyy-MM-dd');
  return rows.filter((r) => {
    const key = formatInTimeZone(parseISO(r.applied_at), tz, 'yyyy-MM-dd');
    return key >= startKey;
  });
}

export function countApplicationsOnDate(rows: JobApplicationRow[], dateKey: string, tz: string): number {
  return rows.filter((r) => formatInTimeZone(parseISO(r.applied_at), tz, 'yyyy-MM-dd') === dateKey).length;
}

export function dailyApplicationSeries(rows: JobApplicationRow[], range: AnalyticsRange, tz: string, now = new Date()) {
  const days = rangeDays(range);
  const series: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(now, i);
    const key = formatInTimeZone(d, tz, 'yyyy-MM-dd');
    series.push({ date: key, count: countApplicationsOnDate(rows, key, tz) });
  }
  return series;
}

export function weeklyApplicationSeries(rows: JobApplicationRow[], range: AnalyticsRange, tz: string, now = new Date()) {
  const daily = dailyApplicationSeries(rows, range, tz, now);
  const buckets = new Map<string, number>();
  for (const point of daily) {
    const monday = format(
      startOfDay(subDays(parseISO(`${point.date}T12:00:00`), (parseISO(`${point.date}T12:00:00`).getDay() + 6) % 7)),
      'MM-dd',
    );
    buckets.set(monday, (buckets.get(monday) || 0) + point.count);
  }
  return [...buckets.entries()].map(([week, count]) => ({ week, count }));
}

export function monthlyApplicationSeries(rows: JobApplicationRow[], tz: string) {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const month = formatInTimeZone(parseISO(r.applied_at), tz, 'yyyy-MM');
    buckets.set(month, (buckets.get(month) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({ month, count }));
}

export function sourceDistribution(rows: JobApplicationRow[]) {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const key = r.source_platform || 'other';
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].map(([source, count]) => ({ source, count }));
}

export function employmentDistribution(rows: JobApplicationRow[]) {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const types = r.employment_types?.length ? r.employment_types : ['unspecified'];
    for (const t of types) buckets.set(t, (buckets.get(t) || 0) + 1);
  }
  return [...buckets.entries()].map(([type, count]) => ({ type, count }));
}

export function topCompanies(rows: JobApplicationRow[], limit = 8) {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const key = r.company_name.trim();
    if (!key) continue;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([company, count]) => ({ company, count }));
}

export function analyticsSummary(
  rows: JobApplicationRow[],
  interviewCount: number,
  scheduledInterviews: number,
  completedInterviews: number,
) {
  const total = rows.length;
  const offers = rows.filter((r) => r.application_status === 'offer_received' || r.application_status === 'hired').length;
  const rejections = rows.filter((r) => r.application_status === 'rejected').length;
  const active = rows.filter((r) => !['rejected', 'withdrawn', 'hired'].includes(r.application_status)).length;
  const successRate = total > 0 ? Math.round((offers / total) * 100) : 0;
  const interviewRatio = total > 0 ? Math.round((interviewCount / total) * 100) : 0;
  const offerRatio = interviewCount > 0 ? Math.round((offers / interviewCount) * 100) : 0;

  return {
    totalApplications: total,
    totalInterviews: interviewCount,
    scheduledInterviews,
    completedInterviews,
    offersReceived: offers,
    rejections,
    activeApplications: active,
    successRate,
    interviewRatio,
    offerRatio,
  };
}

export function applicationsTodayCount(rows: JobApplicationRow[], tz: string, now = new Date()): number {
  const todayKey = formatInTimeZone(now, tz, 'yyyy-MM-dd');
  return countApplicationsOnDate(rows, todayKey, tz);
}

export function weeklyTargetProgress(rows: JobApplicationRow[], weeklyTarget: number, tz: string, now = new Date()) {
  const weekStart = subDays(now, (now.getDay() + 6) % 7);
  const weekStartKey = formatInTimeZone(weekStart, tz, 'yyyy-MM-dd');
  const thisWeek = rows.filter((r) => formatInTimeZone(parseISO(r.applied_at), tz, 'yyyy-MM-dd') >= weekStartKey).length;
  const daysLeftInWeek = 7 - ((now.getDay() + 6) % 7 + 1);
  const remaining = Math.max(0, weeklyTarget - thisWeek);
  const perDay = daysLeftInWeek > 0 ? Math.ceil(remaining / daysLeftInWeek) : remaining;
  return { thisWeek, weeklyTarget, remaining, perDaySuggested: perDay };
}
