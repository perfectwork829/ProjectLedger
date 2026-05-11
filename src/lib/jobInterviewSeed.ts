import type { SupabaseClient } from '@supabase/supabase-js';

/** First pipeline step: recruiter screen aligned with the main interview slot. */
export async function seedInitialRecruiterStage(
  supabase: SupabaseClient,
  interviewId: string,
  scheduledAtIso: string,
  interviewTimezoneIana: string,
): Promise<void> {
  const { count, error: cErr } = await supabase
    .from('job_interview_stages')
    .select('*', { count: 'exact', head: true })
    .eq('interview_id', interviewId);
  if (cErr) throw cErr;
  if ((count ?? 0) > 0) return;

  const { error } = await supabase.from('job_interview_stages').insert({
    interview_id: interviewId,
    stage_type: 'recruiter',
    sort_order: 0,
    scheduled_at: scheduledAtIso,
    interview_timezone: interviewTimezoneIana,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
