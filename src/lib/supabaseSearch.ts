/**
 * Utilities for PostgREST / Supabase `.or()` filters with `ilike`.
 * Reuse across modules (personnel, clients, accounts, etc.).
 */

/** Escape `%`, `_`, and `\` so user input cannot broaden a LIKE pattern. */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Wrap for case-insensitive substring match. */
export function ilikeContainsPattern(trimmedSearch: string): string {
  return `%${escapeIlikePattern(trimmedSearch)}%`;
}

/**
 * Build `query.or(...)` argument: `col1.ilike.%pat%,col2.ilike.%pat%,...`
 * Same pattern applied to every column (OR semantics).
 */
export function buildIlikeOr(columns: readonly string[], trimmedSearch: string): string {
  const pat = ilikeContainsPattern(trimmedSearch);
  return columns.map((col) => `${col}.ilike.${pat}`).join(',');
}

/** Columns searched on `personnel` list (frontend + admin). */
export const PERSONNEL_SEARCH_COLUMNS = [
  'first_name',
  'middle_name',
  'last_name',
  'title',
  'email',
  'country',
  'phone_number',
  'telegram',
  'whatsapp',
  'main_skill_list',
  'notes',
  'important_note',
  'overview',
] as const;

/** `clients` table — keyword search on user-facing + admin lists. */
export const CLIENT_SEARCH_COLUMNS = [
  'first_name',
  'middle_name',
  'last_name',
  'title',
  'email',
  'company_name',
  'country',
  'phone_number',
  'telegram',
  'whatsapp',
  'main_skill_list',
  'notes',
  'important_note',
  'overview',
  'client_source',
  'industry',
] as const;

/** `freelancing_accounts` — includes `platform` so global search can match “upwork”. */
export const FREELANCING_ACCOUNT_SEARCH_COLUMNS = [
  'platform',
  'username',
  'profile_title',
  'profile_overview',
  'connected_email',
  'telephone',
  'notes',
  'skills',
  'country',
  'city',
  'linkedin_url',
  'github_url',
  'profile_url',
  'portfolio_url',
] as const;

/** `useful_links` — text fields (not JSON `links`). */
export const USEFUL_LINK_SEARCH_COLUMNS = [
  'title',
  'purpose',
  'description',
  'how_to_use',
  'tags',
  'category',
] as const;

/** `payment_accounts`. */
export const PAYMENT_ACCOUNT_SEARCH_COLUMNS = [
  'provider',
  'label',
  'account_identifier',
  'notes',
  'status',
  'email',
  'full_name',
  'payment_details',
  'connected_phone',
  'purchase_way',
  'credentials_note',
  'city',
  'state',
  'zip',
  'address',
] as const;
