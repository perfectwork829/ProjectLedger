import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useJobApplicationSettings } from '@/hooks/useJobApplicationSettings';
import {
  activeApplications,
  employmentTypeLabel,
  sourcePlatformLabel,
  type JobApplicationRow,
} from '@/lib/jobApplications';
import {
  analyticsSummary,
  applicationsInRange,
  dailyApplicationSeries,
  employmentDistribution,
  monthlyApplicationSeries,
  sourceDistribution,
  topCompanies,
  weeklyApplicationSeries,
  type AnalyticsRange,
} from '@/lib/jobApplicationAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Bar, BarChart } from 'recharts';

const ranges: AnalyticsRange[] = ['7d', '14d', '30d', '90d'];

export default function AppliedJobsAnalytics() {
  const { user } = useAuth();
  const { settings } = useJobApplicationSettings();
  const tz = settings?.timezone || 'America/New_York';
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [apps, setApps] = useState<JobApplicationRow[]>([]);
  const [interviewStats, setInterviewStats] = useState({ total: 0, scheduled: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [appsRes, intRes] = await Promise.all([
      supabase.from('job_applications').select('*').is('archived_at', null).order('applied_at', { ascending: false }),
      supabase.from('job_interviews').select('status'),
    ]);
    setApps((appsRes.data || []) as JobApplicationRow[]);
    const interviews = intRes.data || [];
    setInterviewStats({
      total: interviews.length,
      scheduled: interviews.filter((i) => i.status === 'scheduled' || i.status === 'in_progress').length,
      completed: interviews.filter((i) => ['completed', 'offer', 'rejected', 'failed'].includes(i.status)).length,
    });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const active = useMemo(() => activeApplications(apps), [apps]);
  const inRange = useMemo(() => applicationsInRange(active, range, tz), [active, range, tz]);
  const summary = useMemo(
    () => analyticsSummary(inRange, interviewStats.total, interviewStats.scheduled, interviewStats.completed),
    [inRange, interviewStats],
  );
  const daily = useMemo(() => dailyApplicationSeries(active, range, tz), [active, range, tz]);
  const weekly = useMemo(() => weeklyApplicationSeries(active, range, tz), [active, range, tz]);
  const monthly = useMemo(() => monthlyApplicationSeries(active, tz), [active, tz]);
  const bySource = useMemo(() => sourceDistribution(inRange), [inRange]);
  const byEmployment = useMemo(() => employmentDistribution(inRange), [inRange]);
  const companies = useMemo(() => topCompanies(inRange), [inRange]);
  const avgPerDay = inRange.length / Math.max(1, daily.length);

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Analytics</p>
          <h2 className="font-serif text-3xl font-semibold">Activity overview</h2>
          <p className="text-sm text-muted-foreground">{tz}</p>
        </div>
        <div className="flex gap-1 rounded-full border bg-card p-1">
          {ranges.map((r) => (
            <Button key={r} size="sm" variant={range === r ? 'default' : 'ghost'} className="rounded-full" onClick={() => setRange(r)}>{r}</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Applications', value: summary.totalApplications },
          { label: 'Avg / day', value: avgPerDay.toFixed(1) },
          { label: 'Interviews scheduled', value: summary.scheduledInterviews },
          { label: 'Interviews completed', value: summary.completedInterviews },
        ].map((m) => (
          <Card key={m.label} className="rounded-2xl"><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">{m.label}</p><p className="text-3xl font-semibold">{m.value}</p></CardContent></Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="font-serif">Daily applications</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: 'Applications', color: 'hsl(var(--primary))' } }} className="h-[280px] w-full">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-serif text-lg">Weekly</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ count: { label: 'Apps', color: 'hsl(var(--primary))' } }} className="h-[220px] w-full">
              <BarChart data={weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis allowDecimals={false} /><Bar dataKey="count" fill="var(--color-count)" radius={4} /></BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-serif text-lg">Monthly trend</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ count: { label: 'Apps', color: 'hsl(var(--primary))' } }} className="h-[220px] w-full">
              <LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} /></LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">By source</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bySource.map((s) => (
              <div key={s.source} className="flex justify-between text-sm"><span>{sourcePlatformLabel(s.source)}</span><span className="font-medium">{s.count}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Employment types</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byEmployment.map((e) => (
              <div key={e.type} className="flex justify-between text-sm"><span>{employmentTypeLabel(e.type)}</span><span className="font-medium">{e.count}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Most applied companies</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {companies.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : companies.map((c) => (
            <div key={c.company} className="flex justify-between text-sm"><span>{c.company}</span><span className="font-medium">{c.count}</span></div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Interview-to-application</p><p className="text-2xl font-semibold">{summary.interviewRatio}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Offer-to-interview</p><p className="text-2xl font-semibold">{summary.offerRatio}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Success rate</p><p className="text-2xl font-semibold">{summary.successRate}%</p></CardContent></Card>
      </div>
    </div>
  );
}
