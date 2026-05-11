/** Shared category keys for `useful_links` (Help & links). */

export const USEFUL_LINK_CATEGORIES = [
  { value: 'resume_builder', label: 'Resume Builder' },
  { value: 'job_sites', label: 'Job Sites' },
  { value: 'telephone_sms', label: 'Telephone & SMS' },
  { value: 'chatbot_ai', label: 'ChatBot & AI' },
  { value: 'smtp_test', label: 'SMTP Test' },
  { value: 'file_transfer', label: 'File Transfer' },
  { value: 'design_tools', label: 'Design Tools' },
  { value: 'dev_tools', label: 'Dev Tools' },
  { value: 'node', label: 'Node.js' },
  { value: 'react_native', label: 'React Native' },
  { value: 'laravel', label: 'Laravel' },
  { value: 'xampp', label: 'XAMPP / local stack' },
  { value: 'staging', label: 'Staging / deploy' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'general', label: 'General' },
] as const;

export type UsefulLinkCategoryValue = (typeof USEFUL_LINK_CATEGORIES)[number]['value'];

export function usefulLinkCategoryLabel(value: string): string {
  return USEFUL_LINK_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Known category order first, then any other keys present in data (e.g. legacy values). */
export function orderedUsefulLinkCategoryKeys(grouped: Record<string, unknown[]>): string[] {
  const keys = new Set(Object.keys(grouped));
  const ordered: string[] = [];
  for (const c of USEFUL_LINK_CATEGORIES) {
    if (keys.has(c.value)) ordered.push(c.value);
  }
  for (const k of [...keys].sort()) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
}
