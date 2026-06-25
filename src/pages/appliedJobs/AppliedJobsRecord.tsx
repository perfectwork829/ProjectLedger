import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useJobApplicationSettings } from '@/hooks/useJobApplicationSettings';
import { useAppliedJobsBase } from '@/lib/useAppliedJobsBase';
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  applicationStatusLabel,
  parseCustomSources,
  type EmploymentType,
  type JobApplicationRow,
} from '@/lib/jobApplications';
import { allSourceOptions, parseJobPostingPaste } from '@/lib/jobApplicationParse';
import { generateCoverLetter, generateTailoredResume } from '@/lib/jobApplicationCoverLetter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Download, Sparkles } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';

const emptyForm = {
  company_name: '',
  job_title: '',
  employment_types: [] as EmploymentType[],
  compensation: '',
  location: '',
  source_platform: 'other',
  job_link: '',
  job_description: '',
  cover_letter: '',
  tailored_resume_text: '',
  application_status: 'applied',
  applied_at: new Date().toISOString().slice(0, 16),
  raw_posting_paste: '',
};

export default function AppliedJobsRecord() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = useAppliedJobsBase();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useJobApplicationSettings();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [companyHistory, setCompanyHistory] = useState<JobApplicationRow[]>([]);
  const [newSource, setNewSource] = useState('');
  const customSources = parseCustomSources(settings?.custom_sources);
  const sourceOptions = allSourceOptions(customSources);
  const tz = settings?.timezone || 'America/New_York';

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((p) => ({ ...p, [key]: value }));

  const load = useCallback(async () => {
    if (!id || !user?.id) return;
    const { data } = await supabase.from('job_applications').select('*').eq('id', id).maybeSingle();
    if (!data) return;
    const row = data as JobApplicationRow;
    setForm({
      company_name: row.company_name,
      job_title: row.job_title,
      employment_types: (row.employment_types || []) as EmploymentType[],
      compensation: row.compensation || '',
      location: row.location || '',
      source_platform: row.source_platform || 'other',
      job_link: row.job_link || '',
      job_description: row.job_description || '',
      cover_letter: row.cover_letter || '',
      tailored_resume_text: row.tailored_resume_text || '',
      application_status: row.application_status,
      applied_at: row.applied_at.slice(0, 16),
      raw_posting_paste: row.raw_posting_paste || '',
    });
  }, [id, user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!form.company_name.trim() || !user?.id) { setCompanyHistory([]); return; }
    void supabase
      .from('job_applications')
      .select('*')
      .ilike('company_name', form.company_name.trim())
      .neq('id', id || '00000000-0000-0000-0000-000000000000')
      .order('applied_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setCompanyHistory((data || []) as JobApplicationRow[]));
  }, [form.company_name, id, user?.id]);

  const toggleEmployment = (type: EmploymentType) => {
    setForm((p) => ({
      ...p,
      employment_types: p.employment_types.includes(type)
        ? p.employment_types.filter((t) => t !== type)
        : [...p.employment_types, type],
    }));
  };

  const parsePaste = () => {
    if (!form.raw_posting_paste.trim()) return;
    const parsed = parseJobPostingPaste(form.raw_posting_paste);
    setForm((p) => {
      const next = {
        ...p,
        company_name: parsed.company_name || p.company_name,
        job_title: parsed.job_title || p.job_title,
        employment_types: parsed.employment_types.length ? parsed.employment_types : p.employment_types,
        compensation: parsed.compensation || p.compensation,
        location: parsed.location || p.location,
        source_platform: parsed.source_platform || p.source_platform,
        job_link: parsed.job_link || p.job_link,
        job_description: parsed.job_description || p.job_description,
      };
      return next;
    });
    if (settings) {
      const letter = generateCoverLetter({
        company_name: parsed.company_name,
        job_title: parsed.job_title,
        job_description: parsed.job_description,
        settings,
      });
      set('cover_letter', letter);
    }
    toast({ title: 'Fields filled from posting' });
  };

  const regenCoverLetter = () => {
    if (!settings) return;
    const letter = generateCoverLetter({
      company_name: form.company_name,
      job_title: form.job_title,
      job_description: form.job_description,
      settings,
    });
    set('cover_letter', letter);
  };

  const regenResume = () => {
    const text = generateTailoredResume({
      job_title: form.job_title,
      job_description: form.job_description,
      master_resume_text: settings?.master_resume_text || '',
    });
    set('tailored_resume_text', text);
  };

  const handleSave = async () => {
    if (!user?.id || !form.company_name.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      company_name: form.company_name.trim(),
      job_title: form.job_title.trim(),
      employment_types: form.employment_types,
      compensation: form.compensation || null,
      location: form.location || null,
      source_platform: form.source_platform || null,
      job_link: form.job_link || null,
      job_description: form.job_description || null,
      cover_letter: form.cover_letter || null,
      tailored_resume_text: form.tailored_resume_text || null,
      application_status: form.application_status,
      applied_at: new Date(form.applied_at).toISOString(),
      raw_posting_paste: form.raw_posting_paste || null,
      updated_at: new Date().toISOString(),
    };
    const res = id
      ? await supabase.from('job_applications').update(payload).eq('id', id)
      : await supabase.from('job_applications').insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ title: 'Save failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: id ? 'Application updated' : 'Application recorded' });
    navigate(base);
  };

  const addCustomSource = async () => {
    const label = newSource.trim();
    if (!label || !settings || !user?.id) return;
    const next = [...customSources, label];
    await supabase.from('job_application_settings').upsert({
      user_id: user.id,
      custom_sources: next,
      updated_at: new Date().toISOString(),
    });
    set('source_platform', label.toLowerCase().replace(/\s+/g, '_'));
    setNewSource('');
    toast({ title: 'Source added' });
  };

  const title = id ? 'Edit application' : 'Record an application';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" className="gap-1.5" asChild>
        <Link to={base}><ArrowLeft className="h-4 w-4" />Back to overview</Link>
      </Button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New entry</p>
        <h2 className="font-serif text-3xl font-semibold">{title}</h2>
      </div>

      <Card className="rounded-2xl shadow-md">
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Paste full job posting</Label>
            <Textarea
              value={form.raw_posting_paste}
              onChange={(e) => set('raw_posting_paste', e.target.value)}
              rows={6}
              className="border-dashed"
              placeholder="Paste the company description, title, location, salary, full responsibilities… Fields will fill automatically."
            />
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={parsePaste}>
              <Sparkles className="h-4 w-4" />Parse posting
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Company name *</Label><Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Job title</Label><Input value={form.job_title} onChange={(e) => set('job_title', e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2">
              <Label>Employment type</Label>
              <div className="flex flex-wrap gap-3">
                {EMPLOYMENT_TYPES.map((e) => (
                  <label key={e.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.employment_types.includes(e.value)} onCheckedChange={() => toggleEmployment(e.value)} />
                    {e.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Compensation / salary</Label><Input value={form.compensation} onChange={(e) => set('compensation', e.target.value)} /></div>
            <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Source</Label>
              <div className="flex gap-2">
                <Select value={form.source_platform} onValueChange={(v) => set('source_platform', v)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{sourceOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="w-28" placeholder="New" value={newSource} onChange={(e) => setNewSource(e.target.value)} />
                <Button type="button" variant="outline" onClick={() => void addCustomSource()}>+</Button>
              </div>
            </div>
            <div className="space-y-2"><Label>Job link</Label><Input value={form.job_link} onChange={(e) => set('job_link', e.target.value)} placeholder="https://…" /></div>
            <div className="space-y-2"><Label>Date applied</Label><Input type="datetime-local" value={form.applied_at} onChange={(e) => set('applied_at', e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Application status</Label>
              <Select value={form.application_status} onValueChange={(v) => set('application_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{APPLICATION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Job description</Label>
            <Textarea value={form.job_description} onChange={(e) => set('job_description', e.target.value)} rows={8} />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Cover letter</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(form.cover_letter); toast({ title: 'Copied' }); }}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
                <Button type="button" size="sm" variant="outline" onClick={regenCoverLetter}>Re-generate</Button>
                <Button type="button" size="sm" variant="outline" onClick={regenResume}>Generate resume</Button>
              </div>
            </div>
            <Textarea value={form.cover_letter} onChange={(e) => set('cover_letter', e.target.value)} rows={10} placeholder="Paste a job posting above to auto-generate." />
          </div>

          {form.tailored_resume_text ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tailored resume</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  const blob = new Blob([form.tailored_resume_text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'resume-tailored.txt'; a.click();
                }}><Download className="h-3.5 w-3.5 mr-1" />Download</Button>
              </div>
              <Textarea value={form.tailored_resume_text} onChange={(e) => set('tailored_resume_text', e.target.value)} rows={12} />
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild><Link to={base}>Cancel</Link></Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Add application'}</Button>
          </div>
        </CardContent>
      </Card>

      {companyHistory.length > 0 ? (
        <Card className="rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Previous applications at this company</CardTitle>
            <p className="text-sm text-muted-foreground">History for matching company name.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {companyHistory.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{h.job_title || 'Untitled role'}</p>
                  <p className="text-muted-foreground">{formatInTimeZone(new Date(h.applied_at), tz, 'MMM d, yyyy')} · {applicationStatusLabel(h.application_status)}</p>
                </div>
                <Button size="sm" variant="ghost" asChild><Link to={`${base}/record/${h.id}`}>View</Link></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
