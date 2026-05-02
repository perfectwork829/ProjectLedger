export type IdentityDocKey = 'id_card' | 'drivers_license' | 'passport';

export type IdentityDocuments = Partial<Record<IdentityDocKey, string[]>>;

export const IDENTITY_DOC_KEYS: readonly IdentityDocKey[] = ['id_card', 'drivers_license', 'passport'];

export const IDENTITY_DOC_LABELS: Record<IdentityDocKey, string> = {
  id_card: 'ID card',
  drivers_license: "Driver's license",
  passport: 'Passport',
};

export function normalizeIdentityDocuments(raw: unknown): IdentityDocuments {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: IdentityDocuments = {};
  for (const key of IDENTITY_DOC_KEYS) {
    const v = o[key];
    if (Array.isArray(v)) {
      const urls = v.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
      if (urls.length) out[key] = urls;
    }
  }
  return out;
}

export function identityDocumentsForDb(d: IdentityDocuments): IdentityDocuments | null {
  const out = normalizeIdentityDocuments(d);
  return Object.keys(out).length ? out : null;
}

export function formatBirthday(isoDate: string | null | undefined): string | null {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
