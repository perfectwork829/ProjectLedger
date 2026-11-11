/** Default skill / category tags for Project Links (free-form; these are suggestions). */

export const DEFAULT_PROJECT_LINK_SKILLS = [
  'Node',
  'Express',
  'React',
  'React Native',
  'Next.js',
  'Vue',
  'Angular',
  'Ruby on Rails',
  'Laravel',
  'Django',
  'Flutter',
  'Python',
  'TypeScript',
  'PHP',
  'Go',
  'Mobile',
  'Full stack',
  'Other',
] as const;

export type DefaultProjectLinkSkill = (typeof DEFAULT_PROJECT_LINK_SKILLS)[number];

/** Split CSV / comma skill strings into unique trimmed tags. */
export function parseSkillTagsCsv(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n]+/)) {
    const t = part.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Map main_stack slug (e.g. react_native) to a display skill tag. */
export function skillTagFromMainStack(mainStack: string | null | undefined): string | null {
  const s = (mainStack || '').trim().toLowerCase();
  if (!s || s === 'other' || s === 'uncategorized') return null;
  const map: Record<string, string> = {
    angular: 'Angular',
    react: 'React',
    react_native: 'React Native',
    vue: 'Vue',
    nextjs: 'Next.js',
    nodejs: 'Node',
    laravel: 'Laravel',
    django: 'Django',
    flutter: 'Flutter',
    ruby_on_rails: 'Ruby on Rails',
    rails: 'Ruby on Rails',
    express: 'Express',
  };
  if (map[s]) return map[s];
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function mergeSkillTags(...lists: (string[] | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const raw of list) {
      const t = raw.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/** Stable order: default skills that appear first, then remaining A–Z. */
export function orderedSkillTagKeys(present: Iterable<string>): string[] {
  const keys = new Set([...present].map((t) => t.trim()).filter(Boolean));
  const ordered: string[] = [];
  const lowerToActual = new Map<string, string>();
  for (const k of keys) lowerToActual.set(k.toLowerCase(), k);

  for (const d of DEFAULT_PROJECT_LINK_SKILLS) {
    const actual = lowerToActual.get(d.toLowerCase());
    if (actual) {
      ordered.push(actual);
      keys.delete(actual);
    }
  }
  for (const k of [...keys].sort((a, b) => a.localeCompare(b))) {
    ordered.push(k);
  }
  return ordered;
}
