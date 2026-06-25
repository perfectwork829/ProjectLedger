import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppliedJobsBase } from '@/lib/useAppliedJobsBase';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, Copy, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { ViewerTimezonePicker } from '@/components/ViewerTimezonePicker';
import { useToast } from '@/hooks/use-toast';
import {
  calendarDateKeyInZone,
  formatUpcomingSlotWallLine,
  getViewerIanaTimezone,
  gmtOffsetLabelForInstant,
  nextCalendarDateKeyInZone,
  nextCalendarDayTitleInZone,
} from '@/lib/interviewTimezone';
import {
  type JobInterviewRow,
  filterJobInterviewsByScheduleAndMode,
  jobInterviewRowsMatchingSearch,
} from '@/lib/jobInterviews';
import type { JobInterviewStageRow } from '@/lib/jobInterviewStages';
import { getPipelineListCursor, passesActivePipelineSlotClock } from '@/lib/jobInterviewPipelineList';

interface PersonnelMini {
  id: string;
  first_name: string;
  last_name: string;
}

function name(p: PersonnelMini | undefined) {
  if (!p) return '—';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
}

function personnelDashboardHref(personnelId: string) {
  return `/dashboard/personnel?id=${encodeURIComponent(personnelId)}`;
}

function postingHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

function PostingCopyButton({ url }: { url: string }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      title="Copy posting URL"
      aria-label="Copy posting URL"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void navigator.clipboard.writeText(url);
        toast({ title: 'Copied', description: url });
      }}
      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

type InterviewTableProps = {
  rows: JobInterviewRow[];
  personnelMap: Record<string, PersonnelMini>;
  stagesByInterview: Record<string, JobInterviewStageRow[]>;
  viewerTz: string;
  interviewsPathBase: string;
};

function InterviewScheduleTable({ rows, personnelMap, stagesByInterview, viewerTz, interviewsPathBase }: InterviewTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Current step</th>
            <th className="px-3 py-2 min-w-[240px]">Upcoming</th>
            <th className="px-3 py-2">Job</th>
            <th className="px-3 py-2">Posting</th>
            <th className="px-3 py-2">Developer (for job)</th>
            <th className="px-3 py-2">Recruiter</th>
            <th className="px-3 py-2">Caller</th>
            <th className="px-3 py-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const developerForJob = personnelMap[r.developer_personnel_id];
            const recruiter = r.recruiter_personnel_id ? personnelMap[r.recruiter_personnel_id] : undefined;
            const caller = r.caller_personnel_id ? personnelMap[r.caller_personnel_id] : undefined;
            const cursor = getPipelineListCursor(stagesByInterview[r.id], r);
            const stepGmt = gmtOffsetLabelForInstant(cursor.instant, cursor.wallIana);
            const stepWhen = formatUpcomingSlotWallLine(cursor.instant, cursor.wallIana);
            const yourGmt = gmtOffsetLabelForInstant(cursor.instant, viewerTz);
            const yourWhen = formatUpcomingSlotWallLine(cursor.instant, viewerTz);
            return (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="secondary" className="w-fit text-xs font-medium">
                      {cursor.stepShort}
                    </Badge>
                    {cursor.usingMainInterviewSlot && cursor.stepType !== 'interview' && cursor.stepType !== 'done' ? (
                      <span className="text-[10px] leading-tight text-muted-foreground">→ main slot time</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 align-top min-w-[240px]">
                  <div className="max-w-[min(100vw,380px)] space-y-1.5 whitespace-pre-line leading-snug">
                    <div className="text-sm font-semibold text-muted-foreground">Step Zone({stepGmt})</div>
                    <div className="break-words font-mono text-base font-semibold text-foreground sm:text-lg">{stepWhen}</div>
                    <div className="pt-1 text-sm font-semibold text-muted-foreground">Your time ({yourGmt})</div>
                    <div className="break-words font-mono text-base font-semibold text-foreground/85 sm:text-lg">{yourWhen}</div>
                  </div>
                </td>
                <td className="px-3 py-2 align-top font-medium">
                  <Link to={`${interviewsPathBase}/${r.id}`} className="text-primary hover:underline">
                    {r.job_title}
                  </Link>
                </td>
                <td className="px-3 py-2 align-top">
                  {r.job_posting_url ? (
                    <div className="flex max-w-[min(100vw,17rem)] items-start gap-1">
                      <a
                        href={r.job_posting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-0 flex-1 flex-col gap-0.5 text-sm font-medium text-primary hover:underline"
                        title={r.job_posting_url}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Open posting
                        </span>
                        <span className="break-all text-xs font-normal text-muted-foreground">{postingHostname(r.job_posting_url)}</span>
                      </a>
                      <PostingCopyButton url={r.job_posting_url} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {developerForJob ? (
                    <a
                      href={personnelDashboardHref(developerForJob.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {name(developerForJob)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {recruiter ? (
                    <a
                      href={personnelDashboardHref(recruiter.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {name(recruiter)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {caller ? (
                    <a
                      href={personnelDashboardHref(caller.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {name(caller)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <Badge variant="outline">{r.job_source || '—'}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function JobInterviews() {
  const base = useAppliedJobsBase();
  const interviewsPathBase = `${base}/interviews`;
  const { toast } = useToast();
  const [viewerTz, setViewerTz] = useState(() => getViewerIanaTimezone());
  useEffect(() => {
    const onTz = () => setViewerTz(getViewerIanaTimezone());
    window.addEventListener('benchhub-viewer-timezone', onTz);
    return () => window.removeEventListener('benchhub-viewer-timezone', onTz);
  }, []);
  const [rows, setRows] = useState<JobInterviewRow[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelMini[]>([]);
  const [stagesByInterview, setStagesByInterview] = useState<Record<string, JobInterviewStageRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activePipelineOnly, setActivePipelineOnly] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    const { error: rpcErr } = await supabase.rpc('mark_past_job_interviews_failed');
    if (rpcErr) console.warn('mark_past_job_interviews_failed:', rpcErr.message);
    const [{ data: pData, error: pErr }, { data: iData, error: iErr }] = await Promise.all([
      supabase.from('personnel').select('id, first_name, last_name'),
      supabase.from('job_interviews').select('*').order('scheduled_at', { ascending: true }),
    ]);
    if (pErr) toast({ title: 'Error', description: pErr.message, variant: 'destructive' });
    else setPersonnel((pData || []) as PersonnelMini[]);
    if (iErr) {
      toast({ title: 'Error', description: iErr.message, variant: 'destructive' });
      setRows([]);
      setStagesByInterview({});
    } else {
      const list = (iData || []) as JobInterviewRow[];
      setRows(list);
      if (list.length) {
        const ids = list.map((r) => r.id);
        const { data: stData, error: stErr } = await supabase
          .from('job_interview_stages')
          .select('*')
          .in('interview_id', ids)
          .order('sort_order', { ascending: true });
        if (stErr) {
          setStagesByInterview({});
        } else {
          const by: Record<string, JobInterviewStageRow[]> = {};
          for (const s of (stData || []) as JobInterviewStageRow[]) {
            if (!by[s.interview_id]) by[s.interview_id] = [];
            by[s.interview_id].push(s);
          }
          setStagesByInterview(by);
        }
      } else {
        setStagesByInterview({});
      }
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const map = useMemo(() => Object.fromEntries(personnel.map((p) => [p.id, p])), [personnel]);

  const listRows = useMemo(() => {
    const searched = jobInterviewRowsMatchingSearch(rows, search, map);
    let out = filterJobInterviewsByScheduleAndMode(searched, {
      activePipelineOnly,
      scheduledFromYmd: dateFrom || undefined,
      scheduledToYmd: dateTo || undefined,
      viewerIana: viewerTz,
    });
    if (activePipelineOnly) {
      out = out.filter((r) => passesActivePipelineSlotClock(r, stagesByInterview[r.id]));
    }
    return out;
  }, [rows, search, map, activePipelineOnly, dateFrom, dateTo, viewerTz, stagesByInterview]);

  const { mainRows, tomorrowRows, tomorrowTitle } = useMemo(() => {
    const tomorrowKey = nextCalendarDateKeyInZone(viewerTz);
    const main: JobInterviewRow[] = [];
    const tomorrow: JobInterviewRow[] = [];
    for (const r of listRows) {
      const cursor = getPipelineListCursor(stagesByInterview[r.id], r);
      const key = calendarDateKeyInZone(cursor.instant, viewerTz);
      (key === tomorrowKey ? tomorrow : main).push(r);
    }
    const byCursorTime = (a: JobInterviewRow, b: JobInterviewRow) =>
      getPipelineListCursor(stagesByInterview[a.id], a).instant.getTime() -
      getPipelineListCursor(stagesByInterview[b.id], b).instant.getTime();
    main.sort(byCursorTime);
    tomorrow.sort(byCursorTime);
    return {
      mainRows: main,
      tomorrowRows: tomorrow,
      tomorrowTitle: nextCalendarDayTitleInZone(viewerTz),
    };
  }, [listRows, stagesByInterview, viewerTz]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">Interview schedule</h2>
        <ViewerTimezonePicker id="job-interviews-list-tz" />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <ModuleSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search title, source, status, developer, recruiter, caller…"
          id="dashboard-job-interviews-search"
          className="sm:min-w-[240px]"
        />
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <Checkbox
            id="dash-ji-active-only"
            checked={activePipelineOnly}
            onCheckedChange={(v) => setActivePipelineOnly(v === true)}
          />
          <Label htmlFor="dash-ji-active-only" className="cursor-pointer text-sm font-normal">
            Active pipeline only
          </Label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="dash-ji-from" className="text-xs text-muted-foreground">
              From (scheduled day in {viewerTz})
            </Label>
            <Input id="dash-ji-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[11rem]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dash-ji-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id="dash-ji-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[11rem]" />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="mb-2 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">No interviews scheduled</p>
            <p className="mt-1 text-sm text-muted-foreground">Admins can add interviews under Applied jobs → Interviews.</p>
          </CardContent>
        </Card>
      ) : listRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="mb-2 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">No interviews match the current filters</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Try clearing search, widening the date range, or turning off “Active pipeline only” to include completed, failed, or closed rows.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {mainRows.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Interview schedule</h3>
              <p className="text-sm text-muted-foreground">
                Excludes only rows whose upcoming pipeline time is <strong>tomorrow</strong> in {viewerTz} (those appear in the section
                below).
              </p>
              <InterviewScheduleTable personnelMap={map} stagesByInterview={stagesByInterview} viewerTz={viewerTz} rows={mainRows} interviewsPathBase={interviewsPathBase} />
            </section>
          ) : null}

          {mainRows.length === 0 && tomorrowRows.length > 0 ? (
            <p className="text-sm text-muted-foreground">No interviews before tomorrow in your display timezone ({viewerTz}).</p>
          ) : null}

          {tomorrowRows.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                Tomorrow <span className="text-base font-normal text-muted-foreground">({tomorrowTitle})</span>
              </h3>
              <p className="text-sm text-muted-foreground">
                The next pipeline slot for these rows falls on this calendar day in {viewerTz}.
              </p>
              <InterviewScheduleTable personnelMap={map} stagesByInterview={stagesByInterview} viewerTz={viewerTz} rows={tomorrowRows} interviewsPathBase={interviewsPathBase} />
            </section>
          ) : null}

          {tomorrowRows.length === 0 && mainRows.length > 0 ? (
            <p className="text-sm text-muted-foreground">No interviews scheduled for tomorrow in {viewerTz}.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
