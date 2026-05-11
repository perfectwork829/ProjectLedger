import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ViewerTimezonePicker } from '@/components/ViewerTimezonePicker';
import {
  formatDualInterviewTime,
  getViewerIanaTimezone,
  resolveIanaForBooking,
  utcInstantFromDeveloperWallClock,
} from '@/lib/interviewTimezone';
import { formatInTimeZone } from 'date-fns-tz';
import type { JobInterviewRow } from '@/lib/jobInterviews';
import type { JobInterviewStageRow } from '@/lib/jobInterviewStages';
import { STAGE_TYPES } from '@/lib/jobInterviewStages';
import { seedInitialRecruiterStage } from '@/lib/jobInterviewSeed';
import {
  ensureSupabaseAccessTokenFresh,
  isJwtExpiredErrorMessage,
  withSupabaseJwtRetry,
} from '@/lib/supabaseJwtRetry';
import { JobInterviewDeveloperProfile, type DeveloperPersonnelRecord } from '@/components/JobInterviewDeveloperProfile';
import { TimezoneSelect } from '@/components/TimezoneSelect';

const JOB_SOURCES: { value: string; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'djinni', label: 'Djinni' },
  { value: 'glassdoor', label: 'Glassdoor' },
  { value: 'wellfound', label: 'Wellfound' },
  { value: 'tokyodev', label: 'TokyoDev' },
  { value: 'startup_jobs', label: 'Startup.jobs' },
  { value: 'remotefront', label: 'RemoteFront' },
  { value: 'empllo', label: 'Empllo' },
  { value: 'totaljobs', label: 'Totaljobs' },
  { value: 'remoteineurope', label: 'Remote in Europe' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'justremote', label: 'JustRemote' },
  { value: 'other', label: 'Other' },
];

function jobSourceLabel(v: string | null | undefined) {
  return JOB_SOURCES.find((s) => s.value === v)?.label || v || '—';
}

function stageLabel(v: string) {
  return STAGE_TYPES.find((s) => s.value === v)?.label || v;
}

function personnelName(p: { first_name?: string | null; last_name?: string | null } | null) {
  if (!p) return '—';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
}

function CopyIconButton({ value, title: titleProp }: { value: string; title?: string }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      title={titleProp || 'Copy'}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        toast({ title: 'Copied', description: value });
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
    >
      <Copy className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

type ScreenshotRow = { id: string; image_url: string; tab_label: string | null; created_at: string };

export default function JobInterviewDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole('admin');
  const base = location.pathname.startsWith('/admin') ? '/admin' : '/dashboard';
  const listHref = `${base}/job-interviews`;

  const [viewerTz, setViewerTz] = useState(() => getViewerIanaTimezone());
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<JobInterviewRow | null>(null);
  const [developer, setDeveloper] = useState<DeveloperPersonnelRecord | null>(null);
  const [recruiter, setRecruiter] = useState<DeveloperPersonnelRecord | null>(null);
  const [stages, setStages] = useState<JobInterviewStageRow[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotRow[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [newStage, setNewStage] = useState({
    stage_type: 'technical' as string,
    dateYmd: '',
    timeHm: '',
    interview_timezone: '',
    next_expected_local: '',
    notes: '',
  });

  const [completeOpen, setCompleteOpen] = useState<JobInterviewStageRow | null>(null);
  const [outcome, setOutcome] = useState('pass');
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const onTz = () => setViewerTz(getViewerIanaTimezone());
    window.addEventListener('benchhub-viewer-timezone', onTz);
    return () => window.removeEventListener('benchhub-viewer-timezone', onTz);
  }, []);

  const loadStages = useCallback(async (interviewId: string) => {
    const { data, error } = await supabase
      .from('job_interview_stages')
      .select('*')
      .eq('interview_id', interviewId)
      .order('sort_order', { ascending: true });
    if (error) {
      toast({ title: 'Stages failed', description: error.message, variant: 'destructive' });
      return;
    }
    setStages((data || []) as JobInterviewStageRow[]);
  }, [toast]);

  const loadScreenshots = useCallback(async (interviewId: string) => {
    const { data, error } = await supabase
      .from('job_interview_profile_screenshots')
      .select('id, image_url, tab_label, created_at')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: false });
    if (error) {
      if (!error.message.includes('does not exist')) {
        toast({ title: 'Screenshots failed', description: error.message, variant: 'destructive' });
      }
      return;
    }
    setScreenshots((data || []) as ScreenshotRow[]);
  }, [toast]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    await ensureSupabaseAccessTokenFresh();
    const { data: row, error: iErr } = await supabase.from('job_interviews').select('*').eq('id', id).maybeSingle();
    if (iErr || !row) {
      toast({ title: 'Not found', description: iErr?.message || 'Interview missing', variant: 'destructive' });
      setInterview(null);
      setLoading(false);
      return;
    }
    const inv = row as JobInterviewRow;
    setInterview(inv);

    const [{ data: dev, error: dErr }, { data: stData }] = await Promise.all([
      supabase.from('personnel').select('*').eq('id', inv.developer_personnel_id).maybeSingle(),
      supabase.from('job_interview_stages').select('*').eq('interview_id', id).order('sort_order', { ascending: true }),
    ]);
    if (dErr || !dev) {
      toast({ title: 'Caller not found', description: dErr?.message, variant: 'destructive' });
      setDeveloper(null);
    } else {
      setDeveloper(dev as DeveloperPersonnelRecord);
    }

    let st = (stData || []) as JobInterviewStageRow[];
    if (st.length === 0 && isAdmin) {
      try {
        await seedInitialRecruiterStage(supabase, id, inv.scheduled_at, resolveIanaForBooking(inv.interview_timezone) || inv.interview_timezone);
        const { data: st2 } = await supabase
          .from('job_interview_stages')
          .select('*')
          .eq('interview_id', id)
          .order('sort_order', { ascending: true });
        st = (st2 || []) as JobInterviewStageRow[];
      } catch (e) {
        toast({
          title: 'Pipeline init skipped',
          description: e instanceof Error ? e.message : 'Could not create default recruiter stage.',
          variant: 'destructive',
        });
      }
    }
    setStages(st);

    if (inv.recruiter_personnel_id) {
      const { data: rec } = await supabase.from('personnel').select('*').eq('id', inv.recruiter_personnel_id).maybeSingle();
      setRecruiter(rec ? (rec as DeveloperPersonnelRecord) : null);
    } else {
      setRecruiter(null);
    }

    await loadScreenshots(id);
    setLoading(false);
  }, [id, toast, loadScreenshots, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const mainDual = useMemo(() => {
    if (!interview) return null;
    const iana = resolveIanaForBooking(interview.interview_timezone) || interview.interview_timezone;
    return formatDualInterviewTime(new Date(interview.scheduled_at), iana, viewerTz);
  }, [interview, viewerTz]);

  const openAddStage = () => {
    if (!interview) return;
    const iana = resolveIanaForBooking(interview.interview_timezone) || interview.interview_timezone;
    setNewStage({
      stage_type: 'technical',
      dateYmd: '',
      timeHm: '',
      interview_timezone: interview.interview_timezone || iana,
      next_expected_local: '',
      notes: '',
    });
    setAddOpen(true);
  };

  const submitNewStage = async () => {
    if (!interview?.id || !isAdmin) return;
    const iana = resolveIanaForBooking(newStage.interview_timezone);
    if (!iana) {
      toast({ title: 'Invalid timezone', variant: 'destructive' });
      return;
    }
    let scheduledAt: string | null = null;
    if (newStage.dateYmd && newStage.timeHm) {
      try {
        scheduledAt = utcInstantFromDeveloperWallClock(newStage.dateYmd, newStage.timeHm, iana).toISOString();
      } catch {
        toast({ title: 'Invalid date/time', variant: 'destructive' });
        return;
      }
    }
    let nextExpected: string | null = null;
    if (newStage.next_expected_local.trim()) {
      const d = new Date(newStage.next_expected_local);
      if (!Number.isNaN(d.getTime())) nextExpected = d.toISOString();
    }
    const maxOrder = stages.reduce((m, s) => Math.max(m, s.sort_order), -1);
    setSavingStage(true);
    const { error } = await withSupabaseJwtRetry(() =>
      supabase.from('job_interview_stages').insert({
        interview_id: interview.id,
        stage_type: newStage.stage_type,
        sort_order: maxOrder + 1,
        scheduled_at: scheduledAt,
        interview_timezone: iana,
        next_step_expected_at: nextExpected,
        notes: newStage.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }),
    );
    setSavingStage(false);
    if (error) {
      toast({
        title: 'Add stage failed',
        description: isJwtExpiredErrorMessage(error.message)
          ? 'Your session could not be renewed. Please sign out and sign in again.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Stage added' });
    setAddOpen(false);
    await loadStages(interview.id);
  };

  const submitComplete = async () => {
    if (!completeOpen?.id || !interview?.id) return;
    setCompleting(true);
    const { error } = await withSupabaseJwtRetry(() =>
      supabase
        .from('job_interview_stages')
        .update({
          completed_at: new Date().toISOString(),
          outcome,
          updated_at: new Date().toISOString(),
        })
        .eq('id', completeOpen.id),
    );
    setCompleting(false);
    if (error) {
      toast({
        title: 'Update failed',
        description: isJwtExpiredErrorMessage(error.message)
          ? 'Your session could not be renewed. Please sign out and sign in again.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Stage marked complete' });
    setCompleteOpen(null);
    await loadStages(interview.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!interview || !developer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={listHref} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to interviews
          </Link>
        </Button>
        <p className="text-muted-foreground">This interview could not be loaded.</p>
      </div>
    );
  }

  const ianaMain = resolveIanaForBooking(interview.interview_timezone) || interview.interview_timezone;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit gap-2">
            <Link to={listHref}>
              <ArrowLeft className="h-4 w-4" />
              Job interviews
            </Link>
          </Button>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{interview.job_title}</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{interview.status}</Badge>
            <Badge variant="outline">{jobSourceLabel(interview.job_source)}</Badge>
            <Badge variant="outline">{personnelName(developer)}</Badge>
          </div>
        </div>
        <ViewerTimezonePicker id="interview-detail-tz" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interview slot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {mainDual && (
            <>
              <p className="font-medium text-foreground">{mainDual.developerLine}</p>
              <p className="text-muted-foreground">{mainDual.viewerLine} (your time, {viewerTz})</p>
              <p className="text-xs text-muted-foreground">{mainDual.shortSummary}</p>
            </>
          )}
          {interview.job_posting_url ? (
            <a
              href={interview.job_posting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Job posting
            </a>
          ) : null}
          {interview.resume_url ? (
            <a href={interview.resume_url} target="_blank" rel="noopener noreferrer" className="ml-4 inline-flex items-center gap-1 text-primary hover:underline">
              Resume for this job
            </a>
          ) : null}
          {interview.description ? (
            <>
              <Separator className="my-3" />
              <p className="whitespace-pre-wrap text-foreground/90">{interview.description}</p>
            </>
          ) : null}
          {(interview.next_followup_at || interview.followup_notes) && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-semibold uppercase text-muted-foreground">Interview follow-up</p>
              {interview.next_followup_at ? (
                <p className="text-sm">
                  Next check-in:{' '}
                  <span className="font-medium">
                    {formatInTimeZone(new Date(interview.next_followup_at), viewerTz, "EEE, MMM d, yyyy 'at' h:mm a")}{' '}
                  </span>
                  <span className="text-muted-foreground">({viewerTz})</span>
                </p>
              ) : null}
              {interview.followup_notes ? <p className="whitespace-pre-wrap text-sm text-foreground/90">{interview.followup_notes}</p> : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recruiter / caller</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {recruiter ? (
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">{personnelName(recruiter)}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {recruiter.email ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Email</span>
                    <span className="break-all">{recruiter.email}</span>
                    <CopyIconButton value={String(recruiter.email)} />
                  </div>
                ) : null}
                {recruiter.telegram ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Telegram</span>
                    <span>{recruiter.telegram}</span>
                    <CopyIconButton value={String(recruiter.telegram)} />
                  </div>
                ) : null}
                {recruiter.phone_number ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{recruiter.phone_number}</span>
                    <CopyIconButton value={String(recruiter.phone_number)} />
                  </div>
                ) : null}
                {recruiter.whatsapp ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">WhatsApp</span>
                    <span>{recruiter.whatsapp}</span>
                    <CopyIconButton value={String(recruiter.whatsapp)} />
                  </div>
                ) : null}
                {recruiter.discord_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Discord</span>
                    <span>{recruiter.discord_id}</span>
                    <CopyIconButton value={String(recruiter.discord_id)} />
                  </div>
                ) : null}
                {recruiter.linkedin_url ? (
                  <a href={String(recruiter.linkedin_url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    LinkedIn
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No recruiter linked on this interview.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Interview pipeline</CardTitle>
          {isAdmin ? (
            <Button size="sm" variant="outline" onClick={openAddStage}>
              Add next step
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Track each round after the recruiter screen. Set &quot;Expect reply by&quot; to get a same-day reminder in your display timezone.
          </p>
          {stages.length === 0 ? (
            <p className="text-muted-foreground">
              {isAdmin
                ? 'No stages yet — a recruiter step will be created when you add the interview from admin, or open this page once to auto-seed.'
                : 'No pipeline steps on file yet. Ask an admin to open this interview once (or add stages) to track follow-ups.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {stages.map((s) => {
                const stIana = resolveIanaForBooking(s.interview_timezone || interview.interview_timezone) || ianaMain;
                const dual =
                  s.scheduled_at != null
                    ? formatDualInterviewTime(new Date(s.scheduled_at), stIana, viewerTz)
                    : null;
                const expectLine =
                  s.next_step_expected_at && !s.completed_at
                    ? formatInTimeZone(new Date(s.next_step_expected_at), viewerTz, "EEE, MMM d, yyyy 'at' h:mm a")
                    : null;
                return (
                  <li key={s.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{stageLabel(s.stage_type)}</p>
                        {dual ? (
                          <div className="mt-1 space-y-0.5 text-xs">
                            <p className="text-foreground">{dual.developerLine}</p>
                            <p className="text-muted-foreground">{dual.viewerLine} (your time)</p>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">No time scheduled for this step.</p>
                        )}
                        {expectLine ? (
                          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                            Expect reply by: {expectLine} ({viewerTz})
                          </p>
                        ) : null}
                        {s.notes ? <p className="mt-2 whitespace-pre-wrap text-foreground/90">{s.notes}</p> : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {s.completed_at ? (
                          <Badge variant="outline">
                            Done {s.outcome ? `· ${s.outcome}` : ''}
                          </Badge>
                        ) : isAdmin ? (
                          <Button size="sm" variant="secondary" onClick={() => setCompleteOpen(s)}>
                            Mark complete
                          </Button>
                        ) : (
                          <Badge variant="secondary">Open</Badge>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile screenshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {screenshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Capture the developer profile tab above to store a shareable image link.' : 'No screenshots saved yet.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {screenshots.map((sh) => (
                <li key={sh.id} className="flex flex-wrap items-center gap-3 rounded-md border p-2">
                  <a href={sh.image_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {sh.tab_label || 'Screenshot'}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {formatInTimeZone(new Date(sh.created_at), viewerTz, 'MMM d, yyyy h:mm a')}
                  </span>
                  <CopyIconButton value={sh.image_url} title="Copy image URL" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caller profile</CardTitle>
        </CardHeader>
        <CardContent>
          <JobInterviewDeveloperProfile
            personnel={developer}
            interviewId={interview.id}
            canScreenshot={isAdmin}
            onScreenshotSaved={() => void loadScreenshots(interview.id)}
          />
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add pipeline step</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Step type</Label>
              <Select value={newStage.stage_type} onValueChange={(v) => setNewStage((p) => ({ ...p, stage_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TimezoneSelect label="Wall-clock timezone for this step" value={newStage.interview_timezone} onChange={(tz) => setNewStage((p) => ({ ...p, interview_timezone: tz }))} />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Date (optional)</Label>
                <Input type="date" value={newStage.dateYmd} onChange={(e) => setNewStage((p) => ({ ...p, dateYmd: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Time (optional)</Label>
                <Input type="time" value={newStage.timeHm} onChange={(e) => setNewStage((p) => ({ ...p, timeHm: e.target.value }))} step={60} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expect reply by (your local, optional)</Label>
              <Input
                type="datetime-local"
                value={newStage.next_expected_local}
                onChange={(e) => setNewStage((p) => ({ ...p, next_expected_local: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={newStage.notes} onChange={(e) => setNewStage((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button disabled={savingStage} onClick={() => void submitNewStage()}>
              {savingStage ? 'Saving…' : 'Add step'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeOpen} onOpenChange={(o) => !o && setCompleteOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete step</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass / advance</SelectItem>
                <SelectItem value="fail">Fail / stop</SelectItem>
                <SelectItem value="pending">Closed (other)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(null)}>
              Cancel
            </Button>
            <Button disabled={completing} onClick={() => void submitComplete()}>
              {completing ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
