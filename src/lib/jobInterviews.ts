import { calendarDateKeyInZone } from '@/lib/interviewTimezone';

export interface JobInterviewRow {
  id: string;
  user_id: string;
  developer_personnel_id: string;
  recruiter_personnel_id: string | null;
  /** Personnel with role caller; optional until set in admin. */
  caller_personnel_id?: string | null;
  interview_timezone: string;
  scheduled_at: string;
  job_source: string | null;
  job_posting_url: string | null;
  job_title: string;
  description: string | null;
  resume_url: string | null;
  status: string;
  next_followup_at: string | null;
  followup_notes: string | null;
}

export interface JobInterviewPersonnelMini {
  first_name: string;
  last_name: string;
}

function personnelLabel(map: Record<string, JobInterviewPersonnelMini>, id: string | null | undefined): string {
  if (!id) return '';
  const p = map[id];
  if (!p) return '';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '';
}

/** Open pipeline: still on calendar / in motion (lists default to this). */
export function isJobInterviewActivePipelineStatus(status: string): boolean {
  return status === 'scheduled' || status === 'in_progress';
}

export function jobInterviewRowsMatchingSearch(
  rows: JobInterviewRow[],
  search: string,
  personnelMap: Record<string, JobInterviewPersonnelMini>,
): JobInterviewRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    const blob = [
      r.job_title,
      r.job_source,
      r.description,
      r.job_posting_url,
      r.status,
      personnelLabel(personnelMap, r.developer_personnel_id),
      personnelLabel(personnelMap, r.recruiter_personnel_id),
      personnelLabel(personnelMap, r.caller_personnel_id),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}

export function filterJobInterviewsByScheduleAndMode(
  rows: JobInterviewRow[],
  opts: {
    activePipelineOnly: boolean;
    scheduledFromYmd?: string;
    scheduledToYmd?: string;
    viewerIana: string;
  },
): JobInterviewRow[] {
  let out = rows;
  if (opts.activePipelineOnly) {
    out = out.filter((r) => isJobInterviewActivePipelineStatus(r.status));
  }
  const from = opts.scheduledFromYmd?.trim();
  const to = opts.scheduledToYmd?.trim();
  if (from || to) {
    out = out.filter((r) => {
      const key = calendarDateKeyInZone(new Date(r.scheduled_at), opts.viewerIana);
      if (from && key < from) return false;
      if (to && key > to) return false;
      return true;
    });
  }
  return out;
}
