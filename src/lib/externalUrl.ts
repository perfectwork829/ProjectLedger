/**
 * Turn user-entered URLs into absolute links for <a href> and clipboard.
 * Without a scheme, browsers treat "play.google.com/..." as a path on the current host.
 */
export function normalizeExternalUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^javascript:/i.test(t)) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  return `https://${t}`;
}

/** Safe href for opening in a new tab (never empty string as href). */
export function externalHref(raw: string): string {
  const n = normalizeExternalUrl(raw);
  return n || '#';
}
