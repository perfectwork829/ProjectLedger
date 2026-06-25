import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useJobApplicationSettings } from '@/hooks/useJobApplicationSettings';
import { useAppliedJobsBase } from '@/lib/useAppliedJobsBase';
import {
  activeApplications,
  applicationsMatchingSearch,
  applicationStatusLabel,
  parseCustomSources,
  SOURCE_PLATFORMS,
  sourcePlatformColor,
  sourcePlatformLabel,
  type JobApplicationRow,
} from '@/lib/jobApplications';
import { applicationsTodayCount, weeklyTargetProgress } from '@/lib/jobApplicationAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { Clock, Download, Plus, Target, CalendarClock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

function exportCsv(rows: JobApplicationRow[]) {
  const header = ['Company', 'Job Title', 'Status', 'Source', 'Location', 'Applied', 'Link'];
  const lines = rows.map((r) =>
    [r.company_name, r.job_title, applicationStatusLabel(r.application_status), r.source_platform || '', r.location || '', r.applied_at, r.job_link || '']
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AppliedJobsOverview() {
  const { user } = useAuth();
  const base = useAppliedJobsBase();
  const { settings } = useJobApplicationSettings();
  const tz = settings?.timezone || 'America/New_York';
  const [items, setItems] = useState<JobApplicationRow[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('any');
  const [pageSize, setPageSize] = useState(10);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const retentionDays = settings?.retention_days ?? 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const [appsRes, interviewsRes] = await Promise.all([
      supabase.from('job_applications').select('*').is('archived_at', null).gte('applied_at', cutoff.toISOString()).order('applied_at', { ascending: false }),
      supabase.from('job_interviews').select('id', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()).in('status', ['scheduled', 'in_progress']),
    ]);
    setItems((appsRes.data || []) as JobApplicationRow[]);
    setUpcomingInterviews(interviewsRes.count ?? 0);
    setLoading(false);
  }, [user?.id, settings?.retention_days]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const customSources = parseCustomSources(settings?.custom_sources);
  const active = useMemo(() => activeApplications(items), [items]);
  const todayCount = applicationsTodayCount(active, tz, now);
  const weekProgress = weeklyTargetProgress(active, settings?.weekly_target ?? 25, tz, now);

  const filtered = useMemo(() => {
    let rows = applicationsMatchingSearch(active, search);
    if (sourceFilter !== 'all') rows = rows.filter((r) => (r.source_platform || 'other') === sourceFilter);
    if (timeFilter === '7d') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
      rows = rows.filter((r) => new Date(r.applied_at) >= cutoff);
    } else if (timeFilter === '30d') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      rows = rows.filter((r) => new Date(r.applied_at) >= cutoff);
    }
    return rows;
  }, [active, search, sourceFilter, timeFilter]);

  const shown = filtered.slice(0, pageSize);
  const clockLabel = formatInTimeZone(now, tz, "EEEE, MMMM d, yyyy 'at' hh:mm:ss a");

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            You applied <span className="text-primary">{todayCount}</span> job{todayCount === 1 ? '' : 's'} today
          </h2>
          <Badge variant="secondary" className="mt-3 gap-1.5 px-3 py-1.5 text-xs font-normal">
            <Clock className="h-3.5 w-3.5" />{clockLabel}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl shadow-md">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />Weekly target</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{weekProgress.thisWeek} / {weekProgress.weeklyTarget}</p>
            <p className="mt-1 text-sm text-muted-foreground">Apply {weekProgress.perDaySuggested} today · {weekProgress.remaining} left</p>
            <Progress value={Math.min(100, (weekProgress.thisWeek / Math.max(1, weekProgress.weeklyTarget)) * 100)} className="mt-4 h-2" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-md">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" />Upcoming interviews</CardTitle></CardHeader>
          <CardContent>
            {upcomingInterviews > 0 ? (
              <><p className="text-3xl font-semibold">{upcomingInterviews}</p><Button variant="link" className="mt-2 h-auto p-0" asChild><Link to={`${base}/interviews`}>View schedule →</Link></Button></>
            ) : <p className="text-muted-foreground">No interviews scheduled.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={sourceFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSourceFilter('all')}>All sources</Badge>
        {SOURCE_PLATFORMS.map((s) => (
          <Badge key={s.value} variant={sourceFilter === s.value ? 'default' : 'outline'} className="cursor-pointer gap-1.5" onClick={() => setSourceFilter(s.value)}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
          </Badge>
        ))}
      </div>

      <Card className="rounded-2xl shadow-md">
        <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-serif text-xl">Applied jobs</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(filtered)}><Download className="h-4 w-4" />Export</Button>
            <Button size="sm" className="gap-1.5" asChild><Link to={`${base}/record`}><Plus className="h-4 w-4" />Add</Link></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <ModuleSearchBar value={search} onChange={setSearch} placeholder="Search by company or job title…" id="applied-jobs-search" className="flex-1" />
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-full lg:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{shown.length} of {filtered.length} shown</p>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">No applications match. Press <strong>Add</strong> to record one.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Company</th><th className="px-3 py-2">Job title</th><th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Source</th><th className="px-3 py-2">Applied</th><th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{row.company_name}</td>
                      <td className="px-3 py-2">{row.job_title || '—'}</td>
                      <td className="px-3 py-2"><Badge variant="secondary">{applicationStatusLabel(row.application_status)}</Badge></td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sourcePlatformColor(row.source_platform) }} />
                          {sourcePlatformLabel(row.source_platform, customSources)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{formatInTimeZone(new Date(row.applied_at), tz, 'MMM d, yyyy')}</td>
                      <td className="px-3 py-2"><Button size="sm" variant="ghost" asChild><Link to={`${base}/record/${row.id}`}>Edit</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
