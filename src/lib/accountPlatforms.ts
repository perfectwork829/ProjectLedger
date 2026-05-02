/** Freelancing marketplace / profile platforms — show marketplace-specific fields */
export const FREELANCER_PLATFORM_VALUES = [
  'upwork',
  'freelancer',
  'fiverr',
  'guru',
  'toptal',
  'linkedin',
  'other',
] as const;

export type FreelancerPlatformValue = (typeof FREELANCER_PLATFORM_VALUES)[number];

/** Email, messaging, dev tools — simplified form; hide marketplace-only fields */
export const GENERIC_ACCOUNT_PLATFORM_VALUES = [
  'gmail',
  'microsoft_teams',
  'telegram',
  'whatsapp',
  'outlook',
  'github',
  'dropbox',
] as const;

export type GenericAccountPlatformValue = (typeof GENERIC_ACCOUNT_PLATFORM_VALUES)[number];

export function isFreelancerPlatform(platform: string): boolean {
  return (FREELANCER_PLATFORM_VALUES as readonly string[]).includes(platform);
}

export function isGenericAccountPlatform(platform: string): boolean {
  return (GENERIC_ACCOUNT_PLATFORM_VALUES as readonly string[]).includes(platform);
}

export function parseScreenshotUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  return [];
}

export function isLikelyImageUrl(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(lower);
}
