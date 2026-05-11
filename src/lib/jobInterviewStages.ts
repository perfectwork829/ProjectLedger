export const STAGE_TYPES = [
  { value: 'recruiter', label: 'Recruiter interview' },
  { value: 'technical', label: 'Technical interview' },
  { value: 'developer_call', label: 'Developer call' },
  { value: 'project_call', label: 'Project call' },
  { value: 'team_call', label: 'Team call' },
  { value: 'culture', label: 'Culture call' },
  { value: 'final', label: 'Final interview' },
  { value: 'other', label: 'Other' },
] as const;

export type StageTypeValue = (typeof STAGE_TYPES)[number]['value'];

export interface JobInterviewStageRow {
  id: string;
  interview_id: string;
  stage_type: string;
  sort_order: number;
  scheduled_at: string | null;
  interview_timezone: string | null;
  completed_at: string | null;
  outcome: string | null;
  notes: string | null;
  next_step_expected_at: string | null;
}
