/** Calendar math in Asia/Tokyo (UTC+9, no DST). */

const JST_FORMATTER_YMD = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const JST_WEEKDAY_LONG = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  weekday: 'long',
});

const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function formatJstYmd(d: Date): string {
  return JST_FORMATTER_YMD.format(d);
}

export function parseJstYmd(ymd: string): { y: number; m: number; day: number } {
  const [y, m, day] = ymd.split('-').map((x) => parseInt(x, 10));
  return { y, m, day };
}

export function compareJstYmd(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Add calendar days to a JST Y-M-D (proleptic Gregorian). */
export function addDaysToJstYmd(ymd: string, n: number): string {
  const { y, m, day } = parseJstYmd(ymd);
  const u = Date.UTC(y, m - 1, day + n);
  const dt = new Date(u);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function jstWeekdayIndexLong(d: Date): number {
  const w = JST_WEEKDAY_LONG.format(d);
  const idx = WEEKDAY_ORDER.indexOf(w as (typeof WEEKDAY_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

/** Monday-based week: returns JST YYYY-MM-DD of the Monday on or before `d` (in JST). */
export function getJstMondayYmd(d: Date): string {
  const ymd = formatJstYmd(d);
  const off = jstWeekdayIndexLong(d);
  return addDaysToJstYmd(ymd, -off);
}

export function addMonthsToJstYmd(ymd: string, deltaMonths: number): string {
  const { y, m, day } = parseJstYmd(ymd);
  const idx = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const d2 = Math.min(day, dim);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
}

export function advanceRecurringDueJstYmd(ymd: string, cadence: 'weekly' | 'biweekly' | 'monthly'): string {
  if (cadence === 'weekly') return addDaysToJstYmd(ymd, 7);
  if (cadence === 'biweekly') return addDaysToJstYmd(ymd, 14);
  return addMonthsToJstYmd(ymd, 1);
}

export function retreatRecurringDueJstYmd(ymd: string, cadence: 'weekly' | 'biweekly' | 'monthly'): string {
  if (cadence === 'weekly') return addDaysToJstYmd(ymd, -7);
  if (cadence === 'biweekly') return addDaysToJstYmd(ymd, -14);
  return addMonthsToJstYmd(ymd, -1);
}

const JST_DATETIME_DISPLAY = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Format an ISO timestamp for display in Asia/Tokyo (matches product accrual calendar). */
export function formatIsoInJst(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${JST_DATETIME_DISPLAY.format(d)} JST`;
}

/** Date-only label in JST (for date fields that are already calendar dates). */
export function formatJstYmdFromIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatJstYmd(d)} JST`;
}

/**
 * Values for `<input type="datetime-local" />` interpreted as **Asia/Tokyo** wall time
 * (not the browser's local zone).
 */
export function isoToDatetimeLocalInJst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Parse datetime-local string as JST wall time → UTC ISO (for Supabase). */
export function datetimeLocalJstToIso(localYmdHm: string): string | null {
  const t = localYmdHm.trim().replace(' ', 'T');
  if (!t) return null;
  const [datePart, timePart] = t.split('T');
  if (!datePart || !timePart) return null;
  const [y, mo, d] = datePart.split('-').map((x) => parseInt(x, 10));
  const timeParts = timePart.split(':');
  const h = parseInt(timeParts[0] ?? '', 10);
  const mi = parseInt((timeParts[1] ?? '0').split('.')[0], 10);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi, 0, 0) - 9 * 60 * 60 * 1000;
  const iso = new Date(ms).toISOString();
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Parse optional datetime-local (JST) for forms; returns null when empty. */
export function optionalDatetimeLocalJstToIso(
  localYmdHm: string,
): { ok: true; iso: string | null } | { ok: false } {
  const trimmed = localYmdHm.trim();
  if (!trimmed) return { ok: true, iso: null };
  const iso = datetimeLocalJstToIso(trimmed);
  if (!iso) return { ok: false };
  return { ok: true, iso };
}
