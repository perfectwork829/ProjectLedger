export interface JobInterviewRow {
  id: string;
  user_id: string;
  developer_personnel_id: string;
  recruiter_personnel_id: string | null;
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
