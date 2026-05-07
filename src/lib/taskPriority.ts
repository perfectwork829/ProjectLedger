export const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const PRIORITY_BADGE_CLASS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;

export function taskDescriptionPreview(raw: string | null | undefined, maxWords = 20): string {
  if (!raw) return 'No description';
  const plain = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'No description';
  const words = plain.split(' ');
  if (words.length <= maxWords) return plain;
  return `${words.slice(0, maxWords).join(' ')}...`;
}