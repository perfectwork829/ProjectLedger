import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Pencil, Trash2, CalendarClock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import {
  formatDualInterviewTime,
  getViewerIanaTimezone,
  resolveIanaForBooking,
  utcInstantFromDeveloperWallClock,
} from '@/lib/interviewTimezone';
import { formatInTimeZone } from 'date-fns-tz';
import {
  type JobInterviewRow,
  filterJobInterviewsByScheduleAndMode,
  jobInterviewRowsMatchingSearch,
} from '@/lib/jobInterviews';
import type { JobInterviewStageRow } from '@/lib/jobInterviewStages';
import { passesActivePipelineSlotClock } from '@/lib/jobInterviewPipelineList';
import { seedInitialRecruiterStage } from '@/lib/jobInterviewSeed';

const JOB_SOURCES = [
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
] as const;

const STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'failed', label: 'Failed' },
] as const;

interface PersonnelMini {
  id: string;
  first_name: string;
  last_name: string;
  timezone: string | null;
  role: string;
}

function personnelName(p: PersonnelMini | undefined) {
  if (!p) return '—';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
}

function personnelDashboardHref(personnelId: string) {
  return `/dashboard/personnel?id=${encodeURIComponent(personnelId)}`;
}

const emptyForm = () => ({
  developer_personnel_id: '',
  recruiter_personnel_id: '' as string | '',
  caller_personnel_id: '' as string | '',
  interview_timezone: '',
  dateYmd: '',
  timeHm: '10:00',
  job_source: 'linkedin',
  job_posting_url: '',
  job_title: '',
  description: '',
  resume_url: '',
  status: 'scheduled' as (typeof STATUSES)[number]['value'],
  next_followup_at: '' as string,
  followup_notes: '',
});

export default function AdminJobInterviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewerTz, setViewerTz] = useState(() => getViewerIanaTimezone());
  useEffect(() => {
    const onTz = () => setViewerTz(getViewerIanaTimezone());
    window.addEventListener('benchhub-viewer-timezone', onTz);
    return () => window.removeEventListener('benchhub-viewer-timezone', onTz);
  }, []);
  const [rows, setRows] = useState<JobInterviewRow[]>([]);
  const [stagesByInterview, setStagesByInterview] = useState<Record<string, JobInterviewStageRow[]>>({});
  const [personnel, setPersonnel] = useState<PersonnelMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activePipelineOnly, setActivePipelineOnly] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const set = useCallback((k: string, v: string) => setForm((p) => ({ ...p, [k]: v })), []);

  const load = useCallback(async () => {
    const { error: rpcErr } = await supabase.rpc('mark_past_job_interviews_failed');
    if (rpcErr) console.warn('mark_past_job_interviews_failed:', rpcErr.message);
    const [{ data: pData, error: pErr }, { data: iData, error: iErr }] = await Promise.all([
      supabase.from('personnel').select('id, first_name, last_name, timezone, role').order('last_name'),
      supabase.from('job_interviews').select('*').order('scheduled_at', { ascending: true }),
    ]);
    if (pErr) toast({ title: 'Failed to load personnel', description: pErr.message, variant: 'destructive' });
    else setPersonnel((pData || []) as PersonnelMini[]);
    if (iErr) toast({ title: 'Failed to load interviews', description: iErr.message, variant: 'destructive' });
    else {
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

  const developersForJob = useMemo(() => personnel.filter((p) => p.role === 'developer_for_job'), [personnel]);
  const recruiters = useMemo(() => personnel.filter((p) => p.role === 'recruiter'), [personnel]);
  const callers = useMemo(() => personnel.filter((p) => p.role === 'caller'), [personnel]);

  const personnelMap = useMemo(() => Object.fromEntries(personnel.map((p) => [p.id, p])), [personnel]);

  const searchedRows = useMemo(
    () => jobInterviewRowsMatchingSearch(rows, search, personnelMap),
    [rows, search, personnelMap],
  );

  const visibleRows = useMemo(() => {
    let out = filterJobInterviewsByScheduleAndMode(searchedRows, {
      activePipelineOnly,
      scheduledFromYmd: dateFrom || undefined,
      scheduledToYmd: dateTo || undefined,
      viewerIana: viewerTz,
    });
    if (activePipelineOnly) {
      out = out.filter((r) => passesActivePipelineSlotClock(r, stagesByInterview[r.id]));
    }
    return out;
  }, [searchedRows, activePipelineOnly, dateFrom, dateTo, viewerTz, stagesByInterview]);

  const dualPreview = useMemo(() => {
    if (!form.dateYmd || !form.timeHm || !form.interview_timezone) return null;
    const iana = resolveIanaForBooking(form.interview_timezone);
    if (!iana) return null;
    try {
      const utc = utcInstantFromDeveloperWallClock(form.dateYmd, form.timeHm, iana);
      return formatDualInterviewTime(utc, iana, viewerTz);
    } catch {
      return null;
    }
  }, [form.dateYmd, form.timeHm, form.interview_timezone, viewerTz]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (r: JobInterviewRow) => {
    setEditingId(r.id);
    const iana = r.interview_timezone;
    const utc = new Date(r.scheduled_at);
    const dateYmd = formatInTimeZone(utc, resolveIanaForBooking(iana) || viewerTz, 'yyyy-MM-dd');
    const timeHm = formatInTimeZone(utc, resolveIanaForBooking(iana) || viewerTz, 'HH:mm');
    setForm({
      developer_personnel_id: r.developer_personnel_id,
      recruiter_personnel_id: r.recruiter_personnel_id || '',
      caller_personnel_id: r.caller_personnel_id || '',
      interview_timezone: iana,
      dateYmd,
      timeHm,
      job_source: r.job_source || 'other',
      job_posting_url: r.job_posting_url || '',
      job_title: r.job_title,
      description: r.description || '',
      resume_url: r.resume_url || '',
      status: (r.status as (typeof STATUSES)[number]['value']) || 'scheduled',
      next_followup_at: r.next_followup_at ? formatInTimeZone(new Date(r.next_followup_at), viewerTz, "yyyy-MM-dd'T'HH:mm") : '',
      followup_notes: r.followup_notes || '',
    });
    setDialogOpen(true);
  };

  const onDeveloperForJobChange = (id: string) => {
    const dev = personnelMap[id];
    const tz = dev?.timezone ? resolveIanaForBooking(dev.timezone) : null;
    setForm((p) => ({
      ...p,
      developer_personnel_id: id,
      interview_timezone: tz ? dev!.timezone!.trim() : p.interview_timezone,
    }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.developer_personnel_id) {
      toast({ title: 'Pick a developer (for job)', variant: 'destructive' });
      return;
    }
    if (!form.job_title.trim()) {
      toast({ title: 'Job title is required', variant: 'destructive' });
      return;
    }
    const iana = resolveIanaForBooking(form.interview_timezone);
    if (!iana) {
      toast({
        title: 'Invalid interview timezone',
        description: 'Choose a valid IANA timezone (e.g. Europe/Kyiv).',
        variant: 'destructive',
      });
      return;
    }
    if (!form.dateYmd || !form.timeHm) {
      toast({ title: 'Date and time required', variant: 'destructive' });
      return;
    }
    let scheduledAt: Date;
    try {
      scheduledAt = utcInstantFromDeveloperWallClock(form.dateYmd, form.timeHm, iana);
    } catch {
      toast({ title: 'Invalid date/time', variant: 'destructive' });
      return;
    }

    let nextFollowup: string | null = null;
    if (form.next_followup_at?.trim()) {
      try {
        const local = new Date(form.next_followup_at);
        if (!Number.isNaN(local.getTime())) nextFollowup = local.toISOString();
      } catch {
        /* ignore */
      }
    }

    setSaving(true);
    const payload = {
      user_id: user.id,
      developer_personnel_id: form.developer_personnel_id,
      recruiter_personnel_id: form.recruiter_personnel_id || null,
      caller_personnel_id: form.caller_personnel_id || null,
      interview_timezone: iana,
      scheduled_at: scheduledAt.toISOString(),
      job_source: form.job_source || null,
      job_posting_url: form.job_posting_url || null,
      job_title: form.job_title.trim(),
      description: form.description || null,
      resume_url: form.resume_url || null,
      status: form.status,
      next_followup_at: nextFollowup,
      followup_notes: form.followup_notes || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('job_interviews').update(payload).eq('id', editingId);
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Interview updated' });
    } else {
      const { data: created, error } = await supabase.from('job_interviews').insert(payload).select('id').single();
      if (error) {
        toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Interview scheduled' });
        if (created?.id) {
          try {
            await seedInitialRecruiterStage(supabase, created.id, scheduledAt.toISOString(), iana);
          } catch (e) {
            toast({
              title: 'Pipeline step not created',
              description: e instanceof Error ? e.message : 'Could not add default recruiter stage.',
              variant: 'destructive',
            });
          }
        }
      }
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('job_interviews').delete().eq('id', deleteId);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Interview deleted' });
    setDeleteId(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Job interviews</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Slots use the developer&apos;s personnel timezone; previews use <strong>your time</strong> ({viewerTz}).
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <ModuleSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search title, source, status, developer, recruiter, caller…"
            id="job-interviews-search"
            className="min-w-0 flex-1 max-w-none sm:max-w-2xl"
          />
          <Button onClick={openCreate} className="h-10 shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            New interview
          </Button>
          <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3">
            <Checkbox
              id="admin-ji-active-only"
              checked={activePipelineOnly}
              onCheckedChange={(v) => setActivePipelineOnly(v === true)}
            />
            <Label htmlFor="admin-ji-active-only" className="cursor-pointer whitespace-nowrap text-sm font-normal leading-none">
              Active pipeline only
            </Label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <Label htmlFor="admin-ji-from" className="text-xs text-muted-foreground">
                From ({viewerTz})
              </Label>
              <Input id="admin-ji-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-[11rem]" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="admin-ji-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input id="admin-ji-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-[11rem]" />
            </div>
          </div>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="mb-2 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">
              {rows.length === 0 ? 'No interviews yet' : 'No interviews match the current filters'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {rows.length === 0
                ? 'Add one to track dates in the developer&apos;s timezone.'
                : 'Try clearing search, widening the date range, or turning off “Active pipeline only” to see completed, failed, or closed rows.'}
            </p>
            {rows.length === 0 && (
              <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New interview
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Developer (for job)</th>
                <th className="px-3 py-2">Recruiter</th>
                <th className="px-3 py-2">Caller</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const developerForJob = personnelMap[r.developer_personnel_id];
                const recruiterPerson = r.recruiter_personnel_id ? personnelMap[r.recruiter_personnel_id] : undefined;
                const callerPerson = r.caller_personnel_id ? personnelMap[r.caller_personnel_id] : undefined;
                const iana = resolveIanaForBooking(r.interview_timezone) || r.interview_timezone;
                const dual = formatDualInterviewTime(new Date(r.scheduled_at), iana, viewerTz);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 align-top">
                      <div className="max-w-[280px] space-y-0.5 text-xs">
                        <div className="font-medium text-foreground">{dual.developerLine}</div>
                        <div className="text-muted-foreground">{dual.viewerLine} (your time)</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top font-medium">
                      <Link to={`/admin/job-interviews/${r.id}`} className="text-primary hover:underline">
                        {r.job_title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {developerForJob ? (
                        <a
                          href={personnelDashboardHref(developerForJob.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          {personnelName(developerForJob)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {recruiterPerson ? (
                        <a
                          href={personnelDashboardHref(recruiterPerson.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          {personnelName(recruiterPerson)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {callerPerson ? (
                        <a
                          href={personnelDashboardHref(callerPerson.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          {personnelName(callerPerson)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge variant="outline">{r.job_source || '—'}</Badge>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge variant={r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" className="gap-1" asChild>
                          <Link to={`/admin/job-interviews/${r.id}`}>View</Link>
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editingId ? 'Edit interview' : 'New interview'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] px-6 pb-6">
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Developer (for job) *</Label>
                <Select value={form.developer_personnel_id} onValueChange={onDeveloperForJobChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select developer (for job)" />
                  </SelectTrigger>
                  <SelectContent>
                    {developersForJob.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {personnelName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recruiter (personnel)</Label>
                <Select value={form.recruiter_personnel_id || '__none__'} onValueChange={(v) => set('recruiter_personnel_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {recruiters.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {personnelName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Caller (personnel)</Label>
                <Select value={form.caller_personnel_id || '__none__'} onValueChange={(v) => set('caller_personnel_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {callers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {personnelName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">Interview time zone</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Date and time below are interpreted in this zone (defaults from the developer you select above, using their personnel timezone).
                </p>
                <div className="mt-3">
                  <TimezoneSelect label="Wall-clock timezone" value={form.interview_timezone} onChange={(tz) => set('interview_timezone', tz)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={form.dateYmd} onChange={(e) => set('dateYmd', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Time *</Label>
                  <Input type="time" value={form.timeHm} onChange={(e) => set('timeHm', e.target.value)} step={60} />
                </div>
              </div>

              {dualPreview && (
                <div className="rounded-md border border-primary/25 bg-primary/5 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Preview</p>
                  <p className="mt-1 text-foreground">{dualPreview.developerLine}</p>
                  <p className="text-muted-foreground">{dualPreview.viewerLine} — your time</p>
                  <p className="mt-2 text-xs text-muted-foreground">{dualPreview.shortSummary}</p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Job title *</Label>
                <Input value={form.job_title} onChange={(e) => set('job_title', e.target.value)} placeholder="e.g. Senior Full-Stack Engineer" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={form.job_source} onValueChange={(v) => set('job_source', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set('status', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Job posting URL</Label>
                <Input value={form.job_posting_url} onChange={(e) => set('job_posting_url', e.target.value)} placeholder="https://…" />
              </div>

              <div className="space-y-2">
                <Label>Resume link (e.g. Drive)</Label>
                <Input value={form.resume_url} onChange={(e) => set('resume_url', e.target.value)} placeholder="https://…" />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Interview context…" />
              </div>

              <div className="space-y-2">
                <Label>Next follow-up (your local, optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.next_followup_at}
                  onChange={(e) => set('next_followup_at', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Follow-up notes</Label>
                <Input value={form.followup_notes} onChange={(e) => set('followup_notes', e.target.value)} placeholder="Waiting for next step…" />
              </div>

              <Button className="w-full" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create interview'}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete interview?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
