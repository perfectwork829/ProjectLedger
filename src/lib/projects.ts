import { supabase } from '@/lib/supabase';

export type ProjectStatus = 'planning' | 'active' | 'blocked' | 'qa' | 'completed' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectBudgetType = 'fixed' | 'hourly';
export const SOURCE_STORAGE_PROVIDER_OPTIONS = [
  'drive',
  'google_drive',
  'mega',
  'pcloud',
  'box',
  'filen',
  'koofr',
  'icedrive',
  'sync_com',
  'proton_drive',
  'icloud_drive',
  'dropbox',
  'onedrive',
  'other',
] as const;

export type SourceStorageType = (typeof SOURCE_STORAGE_PROVIDER_OPTIONS)[number];

export interface ProjectRecord {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  project_source: string | null;
  main_stack: string | null;
  skillset_csv: string | null;
  tags_csv: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
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
  github_links: unknown;
  source_storage_urls: unknown;
  initial_document_urls: unknown;
  published_links: unknown;
  deadline: string | null;
  budget_type: ProjectBudgetType;
  budget_amount: number | null;
  currency: string;
  github_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectScreenshot {
  id: string;
  project_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_personnel_id: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority: ProjectPriority;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_links: unknown;
}

export interface ProjectChatMessage {
  id: string;
  project_id: string;
  author_user_id: string | null;
  message: string;
  attachments_json: unknown[];
  created_at: string;
}

export interface ClientRef {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  country: string | null;
  timezone: string | null;
}

export interface AccountRef {
  id: string;
  platform: string;
  username: string;
  country: string | null;
  timezone: string | null;
  badge_status?: string | null;
}

export interface PersonnelRef {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export async function loadProjectDependencies() {
  const [clientsRes, accountsRes, personnelRes] = await Promise.all([
    supabase.from('clients').select('id, first_name, last_name, company_name, country, timezone').order('first_name'),
    supabase.from('freelancing_accounts').select('id, platform, username, country, timezone, badge_status').order('platform'),
    supabase.from('personnel').select('id, first_name, last_name, role').order('first_name'),
  ]);

  return {
    clients: (clientsRes.data || []) as ClientRef[],
    accounts: (accountsRes.data || []) as AccountRef[],
    personnel: (personnelRes.data || []) as PersonnelRef[],
    error: clientsRes.error || accountsRes.error || personnelRes.error,
  };
}

export function parseCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function toCsv(values: string[]): string {
  return values.map((v) => v.trim()).filter(Boolean).join(', ');
}
