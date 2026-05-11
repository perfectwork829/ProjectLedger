import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';
import { formatDualInterviewTime, getViewerIanaTimezone, isInterviewTodayForViewer } from '@/lib/interviewTimezone';

type Row = {
  id: string;
  job_title: string;
  scheduled_at: string;
  interview_timezone: string;
  status: string;
};

/**
 * Shows a one-per-browser-session toast for interviews scheduled "today" in the viewer's timezone.
 */
export function JobInterviewReminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (!user || ran.current) return;
    ran.current = true;

    (async () => {
      const viewer = getViewerIanaTimezone();
      const dayKey = formatInTimeZone(new Date(), viewer, 'yyyy-MM-dd');
      const sessKey = `benchhub-interview-reminder-${dayKey}`;
      try {
        if (sessionStorage.getItem(sessKey)) return;
      } catch {
        /* ignore */
      }

      const zNow = toZonedTime(new Date(), viewer);
      const start = fromZonedTime(startOfDay(zNow), viewer);
      const end = fromZonedTime(endOfDay(zNow), viewer);

      const { data: interviewRows, error: intErr } = await supabase
        .from('job_interviews')
        .select('id, job_title, scheduled_at, interview_timezone, status')
        .in('status', ['scheduled', 'in_progress'])
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
        .order('scheduled_at', { ascending: true });

      const { data: followupRows, error: fuErr } = await supabase
        .from('job_interviews')
        .select('id, job_title, next_followup_at, interview_timezone, status')
        .in('status', ['scheduled', 'in_progress', 'completed'])
        .not('next_followup_at', 'is', null)
        .gte('next_followup_at', start.toISOString())
        .lte('next_followup_at', end.toISOString());

      const { data: stageRows, error: stErr } = await supabase
        .from('job_interview_stages')
        .select('id, next_step_expected_at, completed_at, stage_type, job_interviews(job_title)')
        .is('completed_at', null)
        .not('next_step_expected_at', 'is', null)
        .gte('next_step_expected_at', start.toISOString())
        .lte('next_step_expected_at', end.toISOString());

      if (intErr || fuErr) return;

      const todayInterviews = (interviewRows as Row[] | null)?.filter((r) =>
        isInterviewTodayForViewer(new Date(r.scheduled_at), viewer),
      ) ?? [];

      type FuRow = Row & { next_followup_at: string };
      const todayFollowups =
        (followupRows as FuRow[] | null)?.filter((r) =>
          isInterviewTodayForViewer(new Date(r.next_followup_at), viewer),
        ) ?? [];

      type StRow = {
        id: string;
        next_step_expected_at: string;
        completed_at: string | null;
        stage_type: string;
        job_interviews: { job_title: string | null } | { job_title: string | null }[] | null;
      };
      const interviewTitleFromStage = (r: StRow) => {
        const j = r.job_interviews;
        if (Array.isArray(j)) return j[0]?.job_title || 'Interview';
        return j?.job_title || 'Interview';
      };
      const todayStageExpectations =
        !stErr && Array.isArray(stageRows)
          ? (stageRows as StRow[]).filter(
              (r) => r.completed_at == null && isInterviewTodayForViewer(new Date(r.next_step_expected_at), viewer),
            )
          : [];

      if (!todayInterviews.length && !todayFollowups.length && !todayStageExpectations.length) return;

      try {
        sessionStorage.setItem(sessKey, '1');
      } catch {
        /* ignore */
      }

      const intLines = todayInterviews.map((r) => {
        const { shortSummary } = formatDualInterviewTime(
          new Date(r.scheduled_at),
          r.interview_timezone,
          viewer,
        );
        return `Interview: ${r.job_title || 'Untitled'} — ${shortSummary}`;
      });

      const fuLines = todayFollowups.map((r) => {
        const when = formatInTimeZone(new Date(r.next_followup_at), viewer, 'EEE, MMM d, h:mm a');
        return `Follow-up: ${r.job_title || 'Untitled'} — ${when} (your time)`;
      });

      const stLines = todayStageExpectations.map((r) => {
        const when = formatInTimeZone(new Date(r.next_step_expected_at), viewer, 'EEE, MMM d, h:mm a');
        return `Expected reply: ${interviewTitleFromStage(r)} — ${when} (your time)`;
      });

      toast({
        title: 'Job reminders today',
        description: [...intLines, ...fuLines, ...stLines].join(' · '),
        duration: 14_000,
      });
    })();
  }, [user, toast]);

  return null;
}
