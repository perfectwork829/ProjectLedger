import { matchCountry } from './countries';
import { DEFAULT_TIMEZONE_BY_ISO2, GENERATED_COMMON_TIMEZONES } from './countryTimezone.generated';

export type TimezoneOption = {
  zone: string;
  offset: string;
};

/** All primary IANA zones used by at least one country (+ Etc/UTC), for normalization in the picker. */
export const COMMON_TIMEZONES: TimezoneOption[] = GENERATED_COMMON_TIMEZONES;

const NAME_SET = new Set(COMMON_TIMEZONES.map((t) => t.zone));

const ALIASES: Record<string, string> = {
  UTC: 'Etc/UTC',
  GMT: 'Etc/UTC',
};

export function timezoneDisplayName(zone: string, offset?: string): string {
  const pretty = zone.replaceAll('_', ' ').replaceAll('/', ' / ');
  return offset ? `${pretty} (${offset})` : pretty;
}

export function matchTimezone(input: string | null | undefined): string | null {
  if (input == null) return null;
  const t = input.trim();
  if (!t) return null;
  if (NAME_SET.has(t)) return t;
  const upper = t.toUpperCase();
  const alias = ALIASES[upper];
  return alias && NAME_SET.has(alias) ? alias : null;
}

export function canonicalTimezoneOrLegacy(stored: string | null | undefined): string {
  if (stored == null) return '';
  const cleaned = stored.replace(/\uFFFD/g, '').replace(/\uFEFF/g, '').trim();
  if (!cleaned) return '';
  const m = matchTimezone(cleaned);
  return m ?? cleaned;
}

/** When user picks a canonical country, suggest a primary IANA zone (editable afterward). */
export function suggestedTimezoneForCountry(countryFieldValue: string): string | null {
  const cleaned = String(countryFieldValue ?? '')
    .replace(/\uFFFD/g, '')
    .replace(/\uFEFF/g, '')
    .trim();
  if (!cleaned) return null;
  const hit = matchCountry(cleaned);
  if (!hit) return null;
  return DEFAULT_TIMEZONE_BY_ISO2[hit.code] ?? null;
}

function parseLongOffsetGmtToMinutes(gmtPart: string | undefined): number | null {
  if (!gmtPart?.startsWith('GMT')) return null;
  const rest = gmtPart.slice(3).trim();
  if (!rest) return 0;
  const sign = rest[0] === '-' ? -1 : 1;
  const body = rest.replace(/^[+-]/, '').trim();
  const [hPart, mPart = '0'] = body.includes(':') ? body.split(':') : [body, '0'];
  const h = parseInt(hPart, 10);
  const m = parseInt(mPart, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return sign * (h * 60 + m);
}

export function ianaTimezoneToOffsetMinutes(iana: string, ref: Date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'longOffset',
    }).formatToParts(ref);
    const gmt = parts.find((p) => p.type === 'timeZoneName')?.value;
    return parseLongOffsetGmtToMinutes(gmt);
  } catch {
    return null;
  }
}

function minutesToUtcOffsetLabel(totalMinutes: number): string {
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseUtcOffsetLabelToMinutes(label: string): number | null {
  const t = label.trim();
  const m = t.match(/^UTC([+-])(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = parseInt(m[3], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return sign * (h * 60 + min);
}

/** Map IANA zone to closest AdminClients `TIMEZONES` value (UTC±HH:MM strings) for current offset (DST-aware). */
export function resolveUtcSelectValueForIana(iana: string, allowed: readonly string[], ref: Date = new Date()): string | null {
  const mins = ianaTimezoneToOffsetMinutes(iana, ref);
  if (mins == null) return null;
  const exact = minutesToUtcOffsetLabel(mins);
  if (allowed.includes(exact)) return exact;
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const v of allowed) {
    const vm = parseUtcOffsetLabelToMinutes(v);
    if (vm == null) continue;
    const d = Math.abs(vm - mins);
    if (d < bestDiff) {
      bestDiff = d;
      best = v;
    }
  }
  return best;
}