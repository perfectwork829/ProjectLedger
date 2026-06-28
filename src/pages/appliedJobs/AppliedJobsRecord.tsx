import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { invokeJobApplicationAi } from '@/lib/jobApplicationAi';
import { downloadTextAsDocx, downloadTextAsPdf, safeDownloadBasename } from '@/lib/jobApplicationDocuments';
import { extractDocxText } from '@/lib/resumeDocxExtract';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Download, Sparkles, Upload, Loader2 } from 'lucide-react';
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
  master_resume_text: '',
  master_resume_url: '',
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
  const [resumeUploading, setResumeUploading] = useState(false);
  const [aiCoverLoading, setAiCoverLoading] = useState(false);
  const [aiResumeLoading, setAiResumeLoading] = useState(false);
  const resumeFileRef = useRef<HTMLInputElement>(null);
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
      master_resume_text: row.master_resume_text || '',
      master_resume_url: row.master_resume_url || '',
    });
  }, [id, user?.id]);

  useEffect(() => {
    if (id || !settings) return;
    setForm((p) => ({
      ...p,
      master_resume_text: p.master_resume_text || settings.master_resume_text || '',
    }));
  }, [id, settings]);

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

  const letterSettings = useMemo(() => {
    if (!settings) return null;
    return { ...settings, master_resume_text: form.master_resume_text || settings.master_resume_text || '' };
  }, [settings, form.master_resume_text]);

  const downloadBase = safeDownloadBasename(form.company_name, form.job_title, 'resume');
  const coverBase = safeDownloadBasename(form.company_name, form.job_title, 'cover-letter');

  const toggleEmployment = (type: EmploymentType) => {
    setForm((p) => ({
      ...p,
      employment_types: p.employment_types.includes(type)
        ? p.employment_types.filter((t) => t !== type)
        : [...p.employment_types, type],
    }));
  };

  const handleResumeDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast({ title: 'Please upload a .docx file', variant: 'destructive' });
      return;
    }
    setResumeUploading(true);
    try {
      const text = await extractDocxText(file);
      if (!text) {
        toast({ title: 'Could not read resume text', description: 'Try pasting the content manually.', variant: 'destructive' });
        return;
      }
      set('master_resume_text', text);

      const ext = file.name.split('.').pop();
      const fileName = `job-applications/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('account-files').upload(fileName, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('account-files').getPublicUrl(fileName);
        set('master_resume_url', urlData.publicUrl);
      }
      toast({ title: 'Master resume loaded from .docx' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setResumeUploading(false);
      if (resumeFileRef.current) resumeFileRef.current.value = '';
    }
  };

  const generateCoverLetterWithAi = async (overrides?: {
    company_name?: string;
    job_title?: string;
    job_description?: string;
    location?: string;
    compensation?: string;
  }) => {
    if (!letterSettings) return;
    setAiCoverLoading(true);
    try {
      const { text } = await invokeJobApplicationAi({
        action: 'cover_letter',
        company_name: overrides?.company_name ?? form.company_name,
        job_title: overrides?.job_title ?? form.job_title,
        job_description: overrides?.job_description ?? form.job_description,
        master_resume_text: letterSettings.master_resume_text || '',
        cover_letter_name: letterSettings.cover_letter_name,
        cover_letter_prefix: letterSettings.cover_letter_prefix,
        cover_letter_infix: letterSettings.cover_letter_infix,
        cover_letter_sentences: letterSettings.cover_letter_sentences,
        location: overrides?.location ?? form.location,
        compensation: overrides?.compensation ?? form.compensation,
      });
      set('cover_letter', text);
      toast({ title: 'Cover letter generated with Gemini' });
    } catch (err) {
      const letter = generateCoverLetter({
        company_name: overrides?.company_name ?? form.company_name,
        job_title: overrides?.job_title ?? form.job_title,
        job_description: overrides?.job_description ?? form.job_description,
        settings: letterSettings,
      });
      set('cover_letter', letter);
      toast({
        title: 'AI unavailable — used local template',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAiCoverLoading(false);
    }
  };

  const parsePaste = () => {
    if (!form.raw_posting_paste.trim()) return;
    const parsed = parseJobPostingPaste(form.raw_posting_paste);
    setForm((p) => ({
      ...p,
      company_name: parsed.company_name || p.company_name,
      job_title: parsed.job_title || p.job_title,
      employment_types: parsed.employment_types.length ? parsed.employment_types : p.employment_types,
      compensation: parsed.compensation || p.compensation,
      location: parsed.location || p.location,
      source_platform: parsed.source_platform || p.source_platform,
      job_link: parsed.job_link || p.job_link,
      job_description: parsed.job_description || p.job_description,
    }));
    void generateCoverLetterWithAi({
      company_name: parsed.company_name,
      job_title: parsed.job_title,
      job_description: parsed.job_description,
      location: parsed.location,
      compensation: parsed.compensation,
    });
    toast({ title: 'Fields filled from posting' });
  };

  const regenCoverLetter = () => {
    void generateCoverLetterWithAi();
  };

  const regenResume = async () => {
    if (!form.master_resume_text.trim()) {
      toast({ title: 'Add your master resume first', variant: 'destructive' });
      return;
    }
    setAiResumeLoading(true);
    try {
      const { text } = await invokeJobApplicationAi({
        action: 'tailored_resume',
        company_name: form.company_name,
        job_title: form.job_title,
        job_description: form.job_description,
        master_resume_text: form.master_resume_text,
      });
      set('tailored_resume_text', text);
      toast({ title: 'Tailored resume generated with Gemini' });
    } catch (err) {
      const text = generateTailoredResume({
        job_title: form.job_title,
        job_description: form.job_description,
        master_resume_text: form.master_resume_text,
      });
      set('tailored_resume_text', text);
      toast({
        title: 'AI unavailable — used local template',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAiResumeLoading(false);
    }
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
      master_resume_text: form.master_resume_text || null,
      master_resume_url: form.master_resume_url || null,
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

          <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>Your master resume</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paste your resume or attach a .docx — used to generate the tailored resume and cover letter for this application.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={resumeUploading} onClick={() => resumeFileRef.current?.click()}>
                {resumeUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Attach .docx
              </Button>
              <input ref={resumeFileRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => void handleResumeDocxUpload(e)} />
            </div>
            {form.master_resume_url ? (
              <p className="text-xs text-muted-foreground">
                Attached file: <a href={form.master_resume_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open uploaded .docx</a>
              </p>
            ) : null}
            <Textarea
              value={form.master_resume_text}
              onChange={(e) => set('master_resume_text', e.target.value)}
              rows={10}
              placeholder="Paste your resume here — experience, skills, achievements, education…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Cover letter</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={!form.cover_letter.trim()} onClick={() => { void navigator.clipboard.writeText(form.cover_letter); toast({ title: 'Copied' }); }}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
                <Button type="button" size="sm" variant="outline" disabled={!form.cover_letter.trim()} onClick={() => void downloadTextAsDocx(form.cover_letter, coverBase)}><Download className="h-3.5 w-3.5 mr-1" />Download .docx</Button>
                <Button type="button" size="sm" variant="outline" disabled={aiCoverLoading} onClick={regenCoverLetter}>
                  {aiCoverLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Re-generate
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={aiResumeLoading} onClick={() => void regenResume()}>
                  {aiResumeLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Generate resume
                </Button>
              </div>
            </div>
            <Textarea value={form.cover_letter} onChange={(e) => set('cover_letter', e.target.value)} rows={10} placeholder="Paste a job posting above to auto-generate." />
          </div>

          {form.tailored_resume_text ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Tailored resume</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void downloadTextAsDocx(form.tailored_resume_text, downloadBase)}>
                    <Download className="h-3.5 w-3.5 mr-1" />Download .docx
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => downloadTextAsPdf(form.tailored_resume_text, downloadBase)}>
                    <Download className="h-3.5 w-3.5 mr-1" />Download .pdf
                  </Button>
                </div>
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

      <p className="text-xs text-muted-foreground">
        Cover letter and resume generation uses Google Gemini (free tier) via a secure edge function. If the API is unavailable, a local template is used instead.
      </p>

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
