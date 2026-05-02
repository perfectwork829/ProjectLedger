import { USEFUL_LINK_SEARCH_COLUMNS } from '@/lib/supabaseSearch';

/**
 * Case-insensitive substring match across selected object fields (client-side only).
 */
export function filterItemsBySearch<T extends object>(
  items: T[],
  query: string,
  fieldKeys: readonly string[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const blob = fieldKeys
      .map((k) => (item as Record<string, unknown>)[k])
      .filter((v) => v != null && v !== '')
      .map((v) => String(v))
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}

/** Useful links: table columns plus JSON `links` entries (label + URL). */
export function filterUsefulLinks<T extends { links?: { label: string; url: string }[] }>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const colBlob = USEFUL_LINK_SEARCH_COLUMNS.map((k) => (item as Record<string, unknown>)[k])
      .filter((v) => v != null && v !== '')
      .map((v) => String(v))
      .join(' ')
      .toLowerCase();
    if (colBlob.includes(q)) return true;
    const linksBlob = (item.links || [])
      .map((l) => `${l.label} ${l.url}`)
      .join(' ')
      .toLowerCase();
    return linksBlob.includes(q);
  });
}
