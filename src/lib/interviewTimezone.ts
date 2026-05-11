import { addDays, startOfDay } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { canonicalTimezoneOrLegacy, matchTimezone } from '@/lib/timezones';
import { getViewerIanaTimezoneForDisplay } from '@/lib/viewerTimezone';

/** Your display timezone: localStorage override (e.g. Asia/Tokyo) or browser default. */
export function getViewerIanaTimezone(): string {
  return getViewerIanaTimezoneForDisplay();
}

/** Resolve stored personnel timezone to an IANA name for date-fns-tz, or null if unusable. */
export function resolveIanaForBooking(stored: string | null | undefined): string | null {
  const cleaned = canonicalTimezoneOrLegacy(stored ?? '');
  if (!cleaned) return null;
  return matchTimezone(cleaned);
}

/**
 * Build UTC instant from calendar date, wall-clock time, and developer (or booking) IANA zone.
 */
export function utcInstantFromDeveloperWallClock(
  dateYmd: string,
  timeHm: string,
  interviewIana: string,
): Date {
  const [y, mo, d] = dateYmd.split('-').map((x) => parseInt(x, 10));
  const [h, mi] = timeHm.split(':').map((x) => parseInt(x, 10));
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) {
    throw new Error('Invalid date or time');
  }
  const wall = new Date(y, mo - 1, d, h, mi, 0, 0);
  return fromZonedTime(wall, interviewIana);
}

export type DualInterviewTime = {
  developerLine: string;
  viewerLine: string;
  shortSummary: string;
};

function tzShortLabel(iana: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value;
    return name || iana;
  } catch {
    return iana;
  }
}

/**
 * Human-readable pair: developer local vs viewer local (e.g. alerts, list subtitles).
 */
export function formatDualInterviewTime(
  scheduledAtUtc: Date,
  developerIana: string,
  viewerIana: string,
): DualInterviewTime {
  const devPat = "EEE, MMM d, yyyy 'at' h:mm a";
  const devStr = formatInTimeZone(scheduledAtUtc, developerIana, devPat);
  const viewerStr = formatInTimeZone(scheduledAtUtc, viewerIana, devPat);
  const devTimeOnly = formatInTimeZone(scheduledAtUtc, developerIana, 'h:mm a');
  const viewerTimeOnly = formatInTimeZone(scheduledAtUtc, viewerIana, 'h:mm a');
  const devTz = tzShortLabel(developerIana);
  const viewerTz = tzShortLabel(viewerIana);

  return {
    developerLine: `${devStr} (${devTz})`,
    viewerLine: `${viewerStr} (${viewerTz})`,
    shortSummary: `${devTimeOnly} (${devTz}) developer — ${viewerTimeOnly} (${viewerTz}) your time`,
  };
}

/** Same calendar day in a given IANA zone as `instant`. */
export function isSameZonedDay(instant: Date, zonedDay: Date, iana: string): boolean {
  const a = formatInTimeZone(instant, iana, 'yyyy-MM-dd');
  const b = formatInTimeZone(zonedDay, iana, 'yyyy-MM-dd');
  return a === b;
}

/** True if interview falls on viewer's "today". */
export function isInterviewTodayForViewer(scheduledAtUtc: Date, viewerIana: string): boolean {
  return isSameZonedDay(scheduledAtUtc, new Date(), viewerIana);
}

/** Calendar date `yyyy-MM-dd` for `instant` interpreted in `iana`. */
export function calendarDateKeyInZone(instant: Date, iana: string): string {
  return formatInTimeZone(instant, iana, 'yyyy-MM-dd');
}

/** Calendar date key for the calendar day after "now" in `iana` (midnight in that zone). */
export function nextCalendarDateKeyInZone(iana: string): string {
  const zNow = toZonedTime(new Date(), iana);
  const zTomorrowStart = addDays(startOfDay(zNow), 1);
  const instant = fromZonedTime(zTomorrowStart, iana);
  return formatInTimeZone(instant, iana, 'yyyy-MM-dd');
}

/** Readable title for that next calendar day (e.g. Mon, May 12, 2026). */
export function nextCalendarDayTitleInZone(iana: string): string {
  const zNow = toZonedTime(new Date(), iana);
  const zTomorrowStart = addDays(startOfDay(zNow), 1);
  const instant = fromZonedTime(zTomorrowStart, iana);
  return formatInTimeZone(instant, iana, 'EEE, MMM d, yyyy');
}

function formatGmtOffsetSuffix(utcDate: Date, iana: string): string {
  const tryNames: Intl.DateTimeFormatOptions['timeZoneName'][] = ['shortOffset', 'longOffset', 'shortGeneric'];
  for (const timeZoneName of tryNames) {
    try {
      const raw =
        new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName })
          .formatToParts(utcDate)
          .find((p) => p.type === 'timeZoneName')?.value?.replace(/\s+/g, '') ?? '';
      if (raw) return raw.replace(/^UTC/i, 'GMT');
    } catch {
      /* try next */
    }
  }
  return iana;
}

/** e.g. `GMT+3` for `iana` at `utcDate` (falls back to IANA id). */
export function gmtOffsetLabelForInstant(utcDate: Date, iana: string): string {
  const resolved = resolveIanaForBooking(iana) || iana;
  return formatGmtOffsetSuffix(utcDate, resolved);
}

/** e.g. `May-11(10:00 AM)` in `wallClockIana` (no year). */
export function formatUpcomingSlotWallLine(utcDate: Date, wallClockIana: string): string {
  const iana = resolveIanaForBooking(wallClockIana) || wallClockIana;
  const datePart = formatInTimeZone(utcDate, iana, 'MMM-dd');
  const timePart = formatInTimeZone(utcDate, iana, 'h:mm a');
  return `${datePart}(${timePart})`;
}

