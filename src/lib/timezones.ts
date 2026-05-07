export type TimezoneOption = {
  zone: string;
  offset: string;
};

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { zone: 'Etc/UTC', offset: 'GMT' },
  { zone: 'Pacific/Honolulu', offset: 'GMT-10' },
  { zone: 'America/Anchorage', offset: 'GMT-8' },
  { zone: 'America/Los_Angeles', offset: 'GMT-7' },
  { zone: 'America/Denver', offset: 'GMT-6' },
  { zone: 'America/Chicago', offset: 'GMT-5' },
  { zone: 'America/New_York', offset: 'GMT-4' },
  { zone: 'America/Halifax', offset: 'GMT-3' },
  { zone: 'America/Sao_Paulo', offset: 'GMT-3' },
  { zone: 'America/Argentina/Buenos_Aires', offset: 'GMT-3' },
  { zone: 'Atlantic/Azores', offset: 'GMT' },
  { zone: 'Europe/London', offset: 'GMT+1' },
  { zone: 'Europe/Dublin', offset: 'GMT+1' },
  { zone: 'Europe/Paris', offset: 'GMT+2' },
  { zone: 'Europe/Berlin', offset: 'GMT+2' },
  { zone: 'Europe/Madrid', offset: 'GMT+2' },
  { zone: 'Europe/Rome', offset: 'GMT+2' },
  { zone: 'Europe/Warsaw', offset: 'GMT+2' },
  { zone: 'Europe/Athens', offset: 'GMT+3' },
  { zone: 'Europe/Bucharest', offset: 'GMT+3' },
  { zone: 'Europe/Helsinki', offset: 'GMT+3' },
  { zone: 'Europe/Istanbul', offset: 'GMT+3' },
  { zone: 'Europe/Moscow', offset: 'GMT+3' },
  { zone: 'Africa/Cairo', offset: 'GMT+3' },
  { zone: 'Africa/Johannesburg', offset: 'GMT+2' },
  { zone: 'Africa/Nairobi', offset: 'GMT+3' },
  { zone: 'Asia/Dubai', offset: 'GMT+4' },
  { zone: 'Asia/Karachi', offset: 'GMT+5' },
  { zone: 'Asia/Kolkata', offset: 'GMT+5:30' },
  { zone: 'Asia/Dhaka', offset: 'GMT+6' },
  { zone: 'Asia/Bangkok', offset: 'GMT+7' },
  { zone: 'Asia/Singapore', offset: 'GMT+8' },
  { zone: 'Asia/Hong_Kong', offset: 'GMT+8' },
  { zone: 'Asia/Shanghai', offset: 'GMT+8' },
  { zone: 'Asia/Taipei', offset: 'GMT+8' },
  { zone: 'Asia/Seoul', offset: 'GMT+9' },
  { zone: 'Asia/Tokyo', offset: 'GMT+9' },
  { zone: 'Australia/Perth', offset: 'GMT+8' },
  { zone: 'Australia/Adelaide', offset: 'GMT+9:30' },
  { zone: 'Australia/Darwin', offset: 'GMT+9:30' },
  { zone: 'Australia/Sydney', offset: 'GMT+10' },
  { zone: 'Australia/Brisbane', offset: 'GMT+10' },
  { zone: 'Pacific/Auckland', offset: 'GMT+12' },
];

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
  if (!stored || !stored.trim()) return '';
  const m = matchTimezone(stored);
  return m ?? stored.trim();
}