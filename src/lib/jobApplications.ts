export const APPLICATION_STATUSES = [
  { value: 'applied', label: 'Applied' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'interview_completed', label: 'Interview Completed' },
  { value: 'technical_assessment', label: 'Technical Assessment' },
  { value: 'offer_received', label: 'Offer Received' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'hired', label: 'Hired' },
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]['value'];

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-Time' },
  { value: 'part_time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'Onsite' },
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]['value'];

export const SOURCE_PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { value: 'indeed', label: 'Indeed', color: '#2164F3' },
  { value: 'ziprecruiter', label: 'ZipRecruiter', color: '#6B46C1' },
  { value: 'dice', label: 'Dice', color: '#CB2026' },
  { value: 'glassdoor', label: 'Glassdoor', color: '#0CAA41' },
  { value: 'monster', label: 'Monster', color: '#6B2D8F' },
  { value: 'jobright', label: 'Jobright', color: '#06B6D4' },
  { value: 'company_website', label: 'Company Website', color: '#64748B' },
  { value: 'other', label: 'Other', color: '#94A3B8' },
] as const;

export interface JobApplicationRow {
  id: string;
  user_id: string;
  company_name: string;
  job_title: string;
  employment_types: string[];
  compensation: string | null;
  location: string | null;
  source_platform: string | null;
  job_link: string | null;
  job_description: string | null;
  cover_letter: string | null;
  tailored_resume_text: string | null;
  application_status: ApplicationStatus;
  applied_at: string;
  raw_posting_paste: string | null;
  master_resume_text: string | null;
  master_resume_url: string | null;
  metadata_json: Record<string, unknown> | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplicationSettingsRow {
  user_id: string;
  timezone: string;
  weekly_target: number;
  retention_days: number;
  cover_letter_sentences: number;
  cover_letter_name: string | null;
  cover_letter_prefix: string;
  cover_letter_infix: string;
  master_resume_text: string | null;
  application_questions: unknown;
  custom_sources: unknown;
  theme: string;
  font_family: string;
  font_size: string;
  updated_at: string;
}

export const DEFAULT_JOB_APPLICATION_SETTINGS: Omit<JobApplicationSettingsRow, 'user_id' | 'updated_at'> = {
  timezone: 'America/New_York',
  weekly_target: 25,
  retention_days: 90,
  cover_letter_sentences: 7,
  cover_letter_name: null,
  cover_letter_prefix: 'Dear hiring manager',
  cover_letter_infix: 'Kind Regards',
  master_resume_text: null,
  application_questions: [],
  custom_sources: [],
  theme: 'light',
  font_family: 'sans',
  font_size: 'medium',
};

export function applicationStatusLabel(status: string): string {
  return APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function employmentTypeLabel(value: string): string {
  return EMPLOYMENT_TYPES.find((e) => e.value === value)?.label ?? value;
}

export function sourcePlatformLabel(value: string | null | undefined, customSources: string[] = []): string {
  if (!value) return '—';
  const known = SOURCE_PLATFORMS.find((s) => s.value === value);
  if (known) return known.label;
  const custom = customSources.find((s) => s.toLowerCase() === value.toLowerCase());
  if (custom) return custom;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sourcePlatformColor(value: string | null | undefined): string {
  return SOURCE_PLATFORMS.find((s) => s.value === value)?.color ?? '#94A3B8';
}

export function parseCustomSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
}

export function parseApplicationQuestions(raw: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const row = x as { question?: unknown; answer?: unknown };
      return { question: String(row.question || '').trim(), answer: String(row.answer || '').trim() };
    })
    .filter((x) => x.question);
}

export function activeApplications(rows: JobApplicationRow[]): JobApplicationRow[] {
  return rows.filter((r) => !r.archived_at);
}

export function applicationsMatchingSearch(rows: JobApplicationRow[], q: string): JobApplicationRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) =>
    [r.company_name, r.job_title, r.location, r.source_platform, r.compensation, r.job_description, r.application_status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}
