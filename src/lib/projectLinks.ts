import { supabase } from '@/lib/supabase';
import { normalizeExternalUrl } from '@/lib/externalUrl';
import {
  mergeSkillTags,
  parseSkillTagsCsv,
  skillTagFromMainStack,
} from '@/lib/projectLinkSkills';
import { parseLabeledLinks, type LabeledLink, type TaskPoolItemRecord } from '@/lib/taskPool';

export type ProjectLinkSourceType = 'own_project' | 'external';

export interface ProjectLinkRecord {
  id: string;
  user_id: string;
  title: string;
  url: string;
  overview: string | null;
  skill_tags: string[];
  source_type: ProjectLinkSourceType;
  source_project_id: string | null;
  source_pool_item_id: string | null;
  source_note: string | null;
  screenshots: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectLinkInsert = {
  user_id: string;
  title: string;
  url: string;
  overview?: string | null;
  skill_tags?: string[];
  source_type: ProjectLinkSourceType;
  source_project_id?: string | null;
  source_pool_item_id?: string | null;
  source_note?: string | null;
  screenshots?: string[];
  is_pinned?: boolean;
};

export function parseScreenshotUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
}

export function normalizeProjectLinkRow(row: Record<string, unknown>): ProjectLinkRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title ?? ''),
    url: String(row.url ?? ''),
    overview: (row.overview as string | null) ?? null,
    skill_tags: Array.isArray(row.skill_tags)
      ? (row.skill_tags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
      : [],
    source_type: row.source_type === 'external' ? 'external' : 'own_project',
    source_project_id: (row.source_project_id as string | null) ?? null,
    source_pool_item_id: (row.source_pool_item_id as string | null) ?? null,
    source_note: (row.source_note as string | null) ?? null,
    screenshots: parseScreenshotUrls(row.screenshots),
    is_pinned: Boolean(row.is_pinned),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function fetchProjectLinks(): Promise<{ data: ProjectLinkRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from('project_links')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r) => normalizeProjectLinkRow(r as Record<string, unknown>)),
    error: null,
  };
}

export function skillTagsFromPoolItem(task: Pick<TaskPoolItemRecord, 'main_stack' | 'skillset_csv' | 'tags_csv'>): string[] {
  return mergeSkillTags(
    skillTagFromMainStack(task.main_stack) ? [skillTagFromMainStack(task.main_stack)!] : [],
    parseSkillTagsCsv(task.skillset_csv),
    parseSkillTagsCsv(task.tags_csv),
  );
}

export function publishedLinksFromPoolItem(task: Pick<TaskPoolItemRecord, 'published_links'>): LabeledLink[] {
  return parseLabeledLinks(task.published_links, null, 'Link').filter((l) => l.url.trim());
}

/** Strip HTML to a short plain overview for imports. */
export function plainOverviewFromHtml(html: string | null | undefined, maxLen = 280): string {
  if (!html?.trim()) return '';
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}…`;
}

export type ProjectLinkImportCandidate = {
  label: string;
  url: string;
  selected: boolean;
};

export function candidatesFromPublishedLinks(links: LabeledLink[]): ProjectLinkImportCandidate[] {
  return links.map((l) => ({
    label: l.label?.trim() || 'Link',
    url: normalizeExternalUrl(l.url.trim()) || l.url.trim(),
    selected: true,
  }));
}

export async function insertProjectLinks(
  rows: ProjectLinkInsert[],
): Promise<{ data: ProjectLinkRecord[]; error: string | null }> {
  if (rows.length === 0) return { data: [], error: null };
  const payload = rows.map((r) => ({
    user_id: r.user_id,
    title: r.title.trim(),
    url: normalizeExternalUrl(r.url.trim()) || r.url.trim(),
    overview: r.overview?.trim() || null,
    skill_tags: r.skill_tags ?? [],
    source_type: r.source_type,
    source_project_id: r.source_project_id ?? null,
    source_pool_item_id: r.source_pool_item_id ?? null,
    source_note: r.source_note?.trim() || null,
    screenshots: r.screenshots ?? [],
    is_pinned: r.is_pinned ?? false,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from('project_links').insert(payload).select('*');
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r) => normalizeProjectLinkRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function createProjectLinksFromCompletedTask(opts: {
  userId: string;
  task: TaskPoolItemRecord;
  candidates: ProjectLinkImportCandidate[];
  skillTags?: string[];
}): Promise<{ data: ProjectLinkRecord[]; error: string | null }> {
  const selected = opts.candidates.filter((c) => c.selected && c.url.trim());
  if (selected.length === 0) return { data: [], error: null };

  const skills = opts.skillTags ?? skillTagsFromPoolItem(opts.task);
  const overview = plainOverviewFromHtml(opts.task.description);
  const projectId = opts.task.promoted_project_id;

  const rows: ProjectLinkInsert[] = selected.map((c) => ({
    user_id: opts.userId,
    title: selected.length === 1 ? opts.task.name : `${opts.task.name} — ${c.label}`,
    url: c.url,
    overview: overview || null,
    skill_tags: skills,
    source_type: 'own_project',
    source_project_id: projectId,
    source_pool_item_id: opts.task.id,
    source_note: projectId
      ? 'Imported from completed task (linked project).'
      : 'Imported from completed task pool item.',
    screenshots: [],
  }));

  return insertProjectLinks(rows);
}

export function filterProjectLinks(
  items: ProjectLinkRecord[],
  opts: { search?: string; skill?: string | null },
): ProjectLinkRecord[] {
  const skill = opts.skill?.trim().toLowerCase() || null;
  const q = opts.search?.trim().toLowerCase() || '';
  return items.filter((item) => {
    if (skill && !item.skill_tags.some((t) => t.toLowerCase() === skill)) return false;
    if (!q) return true;
    const blob = [
      item.title,
      item.url,
      item.overview,
      item.source_note,
      item.source_type,
      ...item.skill_tags,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}
