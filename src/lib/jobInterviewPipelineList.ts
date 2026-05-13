import { resolveIanaForBooking } from '@/lib/interviewTimezone';
import type { JobInterviewStageRow } from '@/lib/jobInterviewStages';

/** Short labels for dense list rows (dashboard job interviews). */
export function shortPipelineStepLabel(stageType: string): string {
  const map: Record<string, string> = {
    recruiter: 'Recruiter',
    technical: 'Technical',
    developer_call: 'Dev call',
    project_call: 'PM / project',
    team_call: 'Team call',
    culture: 'Culture',
    final: 'Final',
    other: 'Other',
  };
  return map[stageType] || stageType.replace(/_/g, ' ');
}

export type PipelineListCursor = {
  stepType: string;
  stepShort: string;
  instant: Date;
  wallIana: string;
  /** True when the step has no own `scheduled_at` yet; wall time is the main interview slot. */
  usingMainInterviewSlot: boolean;
};

/**
 * Next open pipeline step for list UI: first incomplete stage by `sort_order`.
 * Time = that stage's `scheduled_at` if set, otherwise the main interview slot.
 */
export function getPipelineListCursor(
  stages: JobInterviewStageRow[] | undefined,
  interview: { scheduled_at: string; interview_timezone: string },
): PipelineListCursor {
  const mainIana = resolveIanaForBooking(interview.interview_timezone) || interview.interview_timezone;
  const mainInstant = new Date(interview.scheduled_at);

  if (!stages?.length) {
    return {
      stepType: 'interview',
      stepShort: 'Interview',
      instant: mainInstant,
      wallIana: mainIana,
      usingMainInterviewSlot: true,
    };
  }

  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const open = sorted.find((s) => !s.completed_at);
  if (!open) {
    return {
      stepType: 'done',
      stepShort: 'Pipeline done',
      instant: mainInstant,
      wallIana: mainIana,
      usingMainInterviewSlot: true,
    };
  }

  const wall = resolveIanaForBooking(open.interview_timezone || interview.interview_timezone) || mainIana;
  if (open.scheduled_at) {
    return {
      stepType: open.stage_type,
      stepShort: shortPipelineStepLabel(open.stage_type),
      instant: new Date(open.scheduled_at),
      wallIana: wall,
      usingMainInterviewSlot: false,
    };
  }

  return {
    stepType: open.stage_type,
    stepShort: shortPipelineStepLabel(open.stage_type),
    instant: mainInstant,
    wallIana: mainIana,
    usingMainInterviewSlot: true,
  };
}

/**
 * Same clock as the job interview list "Upcoming" column: first incomplete stage time, else main slot.
 * Used with status (scheduled | in_progress) for "Active pipeline only". Excludes past instants and fully-done pipelines.
 */
export function passesActivePipelineSlotClock(
  interview: { scheduled_at: string; interview_timezone: string },
  stages: JobInterviewStageRow[] | undefined,
  nowMs: number = Date.now(),
): boolean {
  const c = getPipelineListCursor(stages, interview);
  if (c.stepType === 'done') return false;
  return c.instant.getTime() >= nowMs;
}
