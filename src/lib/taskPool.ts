import { supabase } from '@/lib/supabase';
import type { ProjectPriority, ProjectStatus, SourceStorageType } from '@/lib/projects';
import { addDaysToJstYmd, compareJstYmd, formatJstYmd, getJstMondayYmd } from '@/lib/jst';

/** Parent lead / pool item — same lifecycle as projects (not Trello columns). */
export type TaskPoolItemStatus = ProjectStatus;

export const TASK_POOL_ITEM_STATUS_OPTIONS = [
  'planning',
  'active',
  'blocked',
  'qa',
  'completed',
  'cancelled',
] as const satisfies readonly ProjectStatus[];

const POOL_ITEM_STATUS_LABELS: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  blocked: 'Blocked',
  qa: 'QA',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function taskPoolItemStatusLabel(status: string): string {
  return POOL_ITEM_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/** Per-item Trello / Kanban columns on subtasks. */
export const TASK_POOL_SUBTASK_BOARD_STATUSES = [
  'todo',
  'doing',
  'done',
  'bug_list',
  'cancelled',
] as const;

export type PoolSubtaskStatus = (typeof TASK_POOL_SUBTASK_BOARD_STATUSES)[number];

const SUBTASK_BOARD_LABELS: Record<string, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  bug_list: 'Bug list',
  cancelled: 'Cancelled',
};

export function poolSubtaskBoardLabel(status: string): string {
  return SUBTASK_BOARD_LABELS[status] ?? status.replace(/_/g, ' ');
}

const LEGACY_SUBTASK_STATUS_MAP: Partial<Record<string, PoolSubtaskStatus>> = {
  in_progress: 'doing',
  review: 'doing',
  blocked: 'bug_list',
  things_to_do: 'todo',
};

/** Maps DB or legacy dev-task values onto the board. */
export function coercePoolSubtaskStatus(raw: string | null | undefined): PoolSubtaskStatus {
  const s = (raw ?? '').trim();
  if (!s) return 'todo';
  if ((TASK_POOL_SUBTASK_BOARD_STATUSES as readonly string[]).includes(s)) return s as PoolSubtaskStatus;
  const mapped = LEGACY_SUBTASK_STATUS_MAP[s];
  if (mapped) return mapped;
  return 'todo';
}

export interface TaskPoolItemRecord {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  skillset_csv: string | null;
  tags_csv: string | null;
  main_stack: string | null;
  task_source: string | null;
  client_id: string | null;
  client_name_override: string | null;
  client_country: string | null;
  client_timezone: string | null;
  account_id: string | null;
  chat_history: string | null;
  metadata_json: Record<string, unknown> | null;
  initial_document_url: string | null;
  source_storage_type: SourceStorageType;
  source_storage_url: string | null;
  task_received_at: string | null;
  deadline: string | null;
  budget_type: 'fixed' | 'hourly';
  /** When `fixed` + `recurring`, amount per installment; when `fixed` + `project`, total contract; when `fixed` + `milestone`, sum of milestone amounts; when `hourly`, optional weekly cap in currency (informational). */
  budget_amount: number | null;
  fixed_budget_mode: 'project' | 'recurring' | 'milestone';
  /** When `fixed_budget_mode` is `milestone`, line items with optional `confirmed_at` (ISO) after payment ack. */
  milestones_json: unknown;
  recurring_cadence: 'weekly' | 'biweekly' | 'monthly' | null;
  next_payment_due_at: string | null;
  hourly_rate: number | null;
  weekly_hours_cap: number | null;
  hourly_last_ack_week_monday: string | null;
  github_links: unknown;
  source_storage_urls: unknown;
  initial_document_urls: unknown;
  upwork_connection_fee: number;
  convert_fee: number;
  transfer_fee: number;
  upwork_fee: number;
  withdraw_fee: number;
  withdrawn_amount: number;
  currency: string;
  github_url: string | null;
  status: TaskPoolItemStatus;
  priority: ProjectPriority;
  promoted_project_id: string | null;
  promoted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskPoolScreenshot {
  id: string;
  pool_item_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface TaskPoolSourceFile {
  id: string;
  pool_item_id: string;
  file_url: string;
  sort_order: number;
  created_at: string;
}

export interface PoolSubtask {
  id: string;
  pool_item_id: string;
  title: string;
  description: string | null;
  assignee_personnel_id: string | null;
  status: PoolSubtaskStatus;
  priority: ProjectPriority;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoolChatMessage {
  id: string;
  pool_item_id: string;
  author_user_id: string | null;
  message: string;
  attachments_json: unknown[];
  created_at: string;
}

export { loadProjectDependencies } from '@/lib/projects';
export type { ClientRef, AccountRef, PersonnelRef } from '@/lib/projects';
export { toCsv, parseCsv } from '@/lib/projects';

export interface LabeledLink {
  label: string;
  url: string;
}

export function parseLabeledLinks(raw: unknown, legacyUrl: string | null | undefined, defaultLabel: string): LabeledLink[] {
  if (!Array.isArray(raw)) {
    return legacyUrl?.trim() ? [{ label: defaultLabel, url: legacyUrl.trim() }] : [];
  }
  const out: LabeledLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const url = String(rec.url ?? '').trim();
    if (!url) continue;
    const label = String(rec.label ?? '').trim() || defaultLabel;
    out.push({ label, url });
  }
  if (out.length === 0 && legacyUrl?.trim()) return [{ label: defaultLabel, url: legacyUrl.trim() }];
  return out;
}

export function serializeLabeledLinks(links: LabeledLink[]): LabeledLink[] {
  return links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter((l) => l.url);
}

export interface TaskMilestone {
  id: string;
  title: string;
  amount: number;
  confirmed_at: string | null;
}

export function parseMilestones(raw: unknown): TaskMilestone[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskMilestone[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const title = String(rec.title ?? '').trim() || 'Milestone';
    const amount = Number(rec.amount ?? 0);
    const confirmed = rec.confirmed_at;
    const confirmed_at = typeof confirmed === 'string' && confirmed.trim() ? confirmed.trim() : null;
    let id = String(rec.id ?? '').trim();
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `m-${out.length}-${Date.now()}`;
    }
    out.push({ id, title, amount, confirmed_at });
  }
  return out;
}

export function sumMilestoneGross(milestones: TaskMilestone[]): number {
  return milestones.reduce((s, m) => s + Math.max(0, Number(m.amount) || 0), 0);
}

export function taskPoolFixedMode(row: TaskPoolItemRecord): 'project' | 'recurring' | 'milestone' {
  const m = row.fixed_budget_mode ?? 'project';
  if (m === 'recurring' || m === 'milestone') return m;
  return 'project';
}

/** Gross contract amount for display and summaries (milestone = sum of milestones). */
export function taskPoolContractGross(row: TaskPoolItemRecord): number {
  if (row.budget_type === 'fixed' && taskPoolFixedMode(row) === 'milestone') {
    return sumMilestoneGross(parseMilestones(row.milestones_json));
  }
  return Number(row.budget_amount ?? 0);
}

export function firstPendingMilestone(row: TaskPoolItemRecord): TaskMilestone | null {
  if (row.budget_type !== 'fixed' || taskPoolFixedMode(row) !== 'milestone') return null;
  return (
    parseMilestones(row.milestones_json).find((m) => !m.confirmed_at && Number(m.amount) > 0) ?? null
  );
}

export function hasPendingMilestonePayment(row: TaskPoolItemRecord): boolean {
  return firstPendingMilestone(row) !== null && !['completed', 'cancelled'].includes(row.status);
}

export function taskUsesAccrualPayments(row: TaskPoolItemRecord): boolean {
  if (row.budget_type === 'hourly') return true;
  return row.budget_type === 'fixed' && taskPoolFixedMode(row) === 'recurring';
}

export function needsRecurringPaymentAck(row: TaskPoolItemRecord, now = new Date()): boolean {
  if (row.budget_type !== 'fixed' || taskPoolFixedMode(row) !== 'recurring') return false;
  if (!row.recurring_cadence || !row.next_payment_due_at) return false;
  if (['completed', 'cancelled'].includes(row.status)) return false;
  const today = formatJstYmd(now);
  return compareJstYmd(today, row.next_payment_due_at) >= 0;
}

export function needsHourlyWeekAck(row: TaskPoolItemRecord, now = new Date()): boolean {
  if (row.budget_type !== 'hourly') return false;
  if (['completed', 'cancelled'].includes(row.status)) return false;
  const anchor = row.task_received_at || row.created_at;
  if (!anchor) return false;
  const startMonday = getJstMondayYmd(new Date(anchor));
  const currentMonday = getJstMondayYmd(now);
  const firstDueMonday = addDaysToJstYmd(startMonday, 7);
  const lastAck = row.hourly_last_ack_week_monday;
  if (!lastAck) {
    return compareJstYmd(currentMonday, firstDueMonday) >= 0;
  }
  return compareJstYmd(currentMonday, addDaysToJstYmd(lastAck, 7)) > 0;
}

export function taskPoolNeedsAccrualAck(row: TaskPoolItemRecord, now = new Date()): boolean {
  return needsRecurringPaymentAck(row, now) || needsHourlyWeekAck(row, now);
}

/** DB RPC (SECURITY DEFINER): copies into `projects` and links `promoted_project_id`. Safe if already promoted. */
export async function promoteCompletedPoolItemToProject(poolItemId: string): Promise<{ projectId: string | null; error?: string }> {
  const { data, error } = await supabase.rpc('promote_task_pool_to_project', { p_pool_id: poolItemId });
  if (error) return { projectId: null, error: error.message };
  return { projectId: (data as string | null) ?? null };
}
