import { supabase } from '@/lib/supabase';
import type { ProjectPriority, ProjectStatus, SourceStorageType } from '@/lib/projects';

export type TaskPoolStatus = ProjectStatus;
export type PoolSubtaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

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
  deadline: string | null;
  budget_type: 'fixed' | 'hourly';
  budget_amount: number | null;
  currency: string;
  github_url: string | null;
  status: TaskPoolStatus;
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

/** DB RPC (SECURITY DEFINER): copies into `projects` and links `promoted_project_id`. Safe if already promoted. */
export async function promoteCompletedPoolItemToProject(poolItemId: string): Promise<{ projectId: string | null; error?: string }> {
  const { data, error } = await supabase.rpc('promote_task_pool_to_project', { p_pool_id: poolItemId });
  if (error) return { projectId: null, error: error.message };
  return { projectId: (data as string | null) ?? null };
}
