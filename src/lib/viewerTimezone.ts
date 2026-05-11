import { matchTimezone } from '@/lib/timezones';

const STORAGE_KEY = 'benchhub-viewer-timezone';

/** Browser-reported IANA zone (no override). */
export function getBrowserIanaTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC';
  } catch {
    return 'Etc/UTC';
  }
}

/**
 * Zone used for "your time" in job interview UI and reminders.
 * If user set `benchhub-viewer-timezone` in localStorage to a valid IANA name, use it (e.g. Asia/Tokyo).
 */
export function getViewerIanaTimezoneForDisplay(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim();
    if (raw) {
      const m = matchTimezone(raw);
      if (m) return m;
    }
  } catch {
    /* ignore */
  }
  return getBrowserIanaTimezone();
}

export function setViewerIanaTimezoneOverride(ianaOrEmpty: string): void {
  try {
    const t = ianaOrEmpty.trim();
    if (!t) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      const m = matchTimezone(t);
      localStorage.setItem(STORAGE_KEY, m || t);
    }
    window.dispatchEvent(new Event('benchhub-viewer-timezone'));
  } catch {
    /* ignore */
  }
}

export function getStoredViewerTimezoneRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}
