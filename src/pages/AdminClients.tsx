import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import 'react-quill-new/dist/quill.snow.css';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Pencil, Trash2, ChevronRight, User, MapPin, Phone, Mail,
  Github, Linkedin, ExternalLink, GraduationCap, Heart, Briefcase,
  Star, X, Copy, ThumbsUp, Globe, DollarSign, Building, Languages, Images,
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import PhoneInput from '@/components/PhoneInput';
import { IdentityDocumentsEditor, IdentityDocumentsGallery } from '@/components/IdentityDocumentsFields';
import { useToast } from '@/hooks/use-toast';
import type { IdentityDocuments } from '@/lib/identityDocuments';
import { identityDocumentsForDb, formatBirthday, normalizeIdentityDocuments } from '@/lib/identityDocuments';
import { cn } from '@/lib/utils';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { ClientLinkedProjectsSection } from '@/components/ClientLinkedProjectsSection';
import { ClientLinkedTasksSection } from '@/components/ClientLinkedTasksSection';
import { CLIENT_SEARCH_COLUMNS } from '@/lib/supabaseSearch';
import { filterItemsBySearch } from '@/lib/clientSearch';
import { suggestedTimezoneForCountry } from '@/lib/timezones';
import { CountrySelect } from '@/components/CountrySelect';
import { TimezoneSelect } from '@/components/TimezoneSelect';

interface Client {
  id: string;
  user_id: string;
  client_type: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  sex: string | null;
  profile_photo_url: string | null;
  company_name: string | null;
  industry: string | null;
  country: string | null;
  address: string | null;
  timezone: string | null;
  phone_number: string | null;
  telegram: string | null;
  whatsapp: string | null;
  discord_id: string | null;
  email: string | null;
  teams: string | null;
  other_communication: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  personal_site_url: string | null;
  portfolio_url: string | null;
  instagram_url: string | null;
  upwork_url: string | null;
  freelancer_url: string | null;
  fiverr_url: string | null;
  guru_url: string | null;
  other_link: string | null;
  resume_cv_url: string | null;
  weight: string | null;
  height: string | null;
  skin_color: string | null;
  hobby: string | null;
  characteristics: string | null;
  universities: string | null;
  religion: string | null;
  marriage_status: string | null;
  children_status: string | null;
  skills: string | null;
  achievements: string | null;
  availability_status: string | null;
  employment_status: string | null;
  activity_notes: string | null;
  working_project_name: string | null;
  working_history: string | null;
  main_skill_list: string | null;
  met_place: string | null;
  notes: string | null;
  overview: string | null;
  languages: string | null;
  hourly_rate_main: number | null;
  hourly_rate_discussed: number | null;
  expected_monthly_salary: number | null;
  preferred_payments: string | null;
  working_type: string | null;
  good_fit: boolean | null;
  budget: string | null;
  payment_terms: string | null;
  project_history: string | null;
  client_source: string | null;
  source_account_id: string | null;
  source_account_label: string | null;
  client_status: string | null;
  birthday: string | null;
  identity_documents: IdentityDocuments | null;
  created_at: string;
}

interface SourceAccountOption {
  id: string;
  platform: string;
  username: string;
}

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

interface UniEntry { name: string; course: string; start_date: string; end_date: string }

function UniversityEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const entries: UniEntry[] = value ? (() => { try { return JSON.parse(value); } catch { return []; } })() : [];
  const update = (e: UniEntry[]) => onChange(JSON.stringify(e));
  const add = () => update([...entries, { name: '', course: '', start_date: '', end_date: '' }]);
  const remove = (i: number) => update(entries.filter((_, idx) => idx !== i));
  const setEntry = (i: number, key: keyof UniEntry, val: string) => {
    const next = [...entries]; next[i] = { ...next[i], [key]: val }; update(next);
  };
  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Universities</Label>
      {entries.map((entry, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">University {i + 1}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(i)} className="text-destructive h-6 w-6"><X className="h-3.5 w-3.5" /></Button>
          </div>
          <Input value={entry.name} onChange={(e) => setEntry(i, 'name', e.target.value)} placeholder="University name" />
          <Input value={entry.course} onChange={(e) => setEntry(i, 'course', e.target.value)} placeholder="Course / Degree" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={entry.start_date} onChange={(e) => setEntry(i, 'start_date', e.target.value)} placeholder="Start date" />
            <Input type="date" value={entry.end_date} onChange={(e) => setEntry(i, 'end_date', e.target.value)} placeholder="End date" />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1"><Plus className="h-3.5 w-3.5" />Add University</Button>
    </div>
  );
}

const CLIENT_TYPES = [
  { value: 'individual', label: 'Individual', icon: '👤', color: 'bg-blue-500' },
  { value: 'company', label: 'Company', icon: '🏢', color: 'bg-emerald-500' },
  { value: 'agency', label: 'Agency', icon: '🏗️', color: 'bg-amber-500' },
  { value: 'startup', label: 'Startup', icon: '🚀', color: 'bg-violet-500' },
];

const CLIENT_TYPES_MAP: Record<string, typeof CLIENT_TYPES[0]> = Object.fromEntries(CLIENT_TYPES.map(r => [r.value, r]));

const AVAILABILITY = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
];

const EMPLOYMENT = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'not_employed', label: 'Not Employed' },
];

const CLIENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'lost', label: 'Lost' },
];

const MARRIAGE = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];

const WORKING_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'agency', label: 'Agency' },
];

const SKILL_OPTIONS = [
  'Web Development', 'Mobile Development', 'Desktop Application',
  'Frontend (React)', 'Frontend (Vue)', 'Frontend (Angular)',
  'Backend (Node.js)', 'Backend (Python)', 'Backend (Java)', 'Backend (PHP)', 'Backend (.NET)',
  'Full Stack', 'DevOps / CI-CD', 'Cloud (AWS)', 'Cloud (Azure)', 'Cloud (GCP)',
  'Database (SQL)', 'Database (NoSQL)', 'UI/UX Design',
  'Machine Learning / AI', 'Data Science', 'Blockchain / Web3',
  'Game Development', 'Embedded / IoT', 'Cybersecurity',
  'QA / Testing', 'Project Management', 'Technical Writing',
  'WordPress / CMS', 'Shopify / E-commerce', 'SEO / Marketing',
];

const LANGUAGE_LEVELS = ['Native', 'Fluent (C1-C2)', 'Intermediate (B1-B2)', 'Basic (A1-A2)'];

const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean',
  'Russian', 'Arabic', 'Portuguese', 'Italian', 'Hindi', 'Turkish', 'Polish',
  'Dutch', 'Swedish', 'Vietnamese', 'Thai', 'Indonesian', 'Ukrainian',
];

const MET_PLACES = [
  { value: 'skype', label: 'Skype' },
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'fiverr', label: 'Fiverr' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'upwork', label: 'Upwork' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
];

const PLATFORM_ACCOUNT_SOURCES = ['upwork', 'freelancer', 'guru', 'linkedin', 'discord'] as const;

const availColor: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-red-100 text-red-800',
};

const statusColor: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-gray-100 text-gray-800',
  prospect: 'bg-blue-100 text-blue-800',
  lost: 'bg-red-100 text-red-800',
};

const emptyForm = {
  client_type: 'individual', title: '', first_name: '', middle_name: '', last_name: '',
  sex: '',
  profile_photo_url: '', company_name: '', industry: '',
  country: '', address: '', timezone: '',
  phone_number: '', telegram: '', whatsapp: '', discord_id: '', email: '', teams: '',
  other_communication: '', linkedin_url: '', github_url: '',
  personal_site_url: '', portfolio_url: '', instagram_url: '',
  upwork_url: '', freelancer_url: '', fiverr_url: '', guru_url: '',
  other_link: '',
  resume_cv_url: '', weight: '', height: '', skin_color: '', hobby: '',
  characteristics: '', universities: '' as string, religion: '',
  marriage_status: '', children_status: '', skills: '' as string, achievements: '' as string,
  availability_status: 'available', employment_status: 'not_employed',
  activity_notes: '', working_project_name: '', working_history: '' as string,
  main_skill_list: '' as string, met_place: '', notes: '',
  overview: '', languages: '' as string,
  hourly_rate_main: '', hourly_rate_discussed: '', expected_monthly_salary: '',
  preferred_payments: [] as string[],
  working_type: 'individual', good_fit: false as boolean,
  budget: '', payment_terms: '', project_history: '' as string,
  client_source: '', client_status: 'prospect',
  source_account_id: '',
  source_account_label: '',
  birthday: '',
  identity_documents: {} as IdentityDocuments,
};

type View = 'types' | 'list' | 'detail';

function CopyButton({ value }: { value: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); toast({ title: 'Copied!', description: value }); }}
      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent transition-colors"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function InfoRow({ label, value, copyable }: { label: string; value: string | null | undefined; copyable?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1 items-center">
      <span className="text-sm font-medium text-muted-foreground min-w-[140px]">{label}</span>
      <span className="text-sm text-foreground/80">{value}</span>
      {copyable && <CopyButton value={value} />}
    </div>
  );
}

function DetailSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder?: string }) {
  const ReactQuill = React.lazy(() => import('react-quill-new'));
  return (
    <React.Suspense fallback={<div className="h-[200px] border rounded-md flex items-center justify-center text-sm text-muted-foreground">Loading editor...</div>}>
      <div className="rich-editor [&_.ql-editor]:min-h-[180px]">
        <ReactQuill theme="snow" value={value} onChange={onChange}
          modules={{ toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] }}
          placeholder={placeholder || "Write here..."} />
      </div>
    </React.Suspense>
  );
}

function SkillMultiSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const allSkills = [...SKILL_OPTIONS, ...customSkills.filter(s => !SKILL_OPTIONS.includes(s))];
  const filtered = allSkills.filter(s => s.toLowerCase().includes(search.toLowerCase()) && !selected.includes(s));
  const showAddCustom = search.trim() && !allSkills.some(s => s.toLowerCase() === search.trim().toLowerCase()) && !selected.includes(search.trim());

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (skill: string) => {
    const next = selected.includes(skill) ? selected.filter(s => s !== skill) : [...selected, skill];
    onChange(next.join(', '));
  };
  const addCustom = () => {
    const trimmed = search.trim();
    if (trimmed && !selected.includes(trimmed)) {
      setCustomSkills(prev => [...prev, trimmed]);
      onChange([...selected, trimmed].join(', '));
      setSearch('');
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div ref={ref} className="relative">
        <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[40px] cursor-text" onClick={() => setOpen(true)}>
          {selected.map(s => (
            <Badge key={s} variant="secondary" className="gap-1 text-xs">
              {s}
              <button onClick={(e) => { e.stopPropagation(); toggle(s); }} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          <input value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? "Search or add skills..." : ""} className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground" />
        </div>
        {open && (filtered.length > 0 || showAddCustom) && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(skill => (
              <button key={skill} onClick={() => { toggle(skill); setSearch(''); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors">{skill}</button>
            ))}
            {showAddCustom && (
              <button onClick={addCustom} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors text-primary font-medium">+ Add "{search.trim()}"</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface LangEntry { language: string; level: string }

function LanguageEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const entries: LangEntry[] = value ? (() => { try { return JSON.parse(value); } catch { return []; } })() : [];
  const update = (newEntries: LangEntry[]) => onChange(JSON.stringify(newEntries));
  const add = () => update([...entries, { language: '', level: 'Basic (A1-A2)' }]);
  const remove = (i: number) => update(entries.filter((_, idx) => idx !== i));
  const setEntry = (i: number, key: keyof LangEntry, val: string) => {
    const next = [...entries]; next[i] = { ...next[i], [key]: val }; update(next);
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2"><Languages className="h-4 w-4" /> Languages</Label>
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={entry.language} onValueChange={(v) => setEntry(i, 'language', v)}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent>{COMMON_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={entry.level} onValueChange={(v) => setEntry(i, 'level', v)}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Level" /></SelectTrigger>
            <SelectContent>{LANGUAGE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={() => remove(i)} className="text-destructive shrink-0"><X className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Language</Button>
    </div>
  );
}


export default function AdminClients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<SourceAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const [view, setView] = useState<View>('types');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [listViewMode, setListViewMode] = useState<'card' | 'list' | 'line' | 'table'>('card');

  const fetchClients = async () => {
    const [clientsRes, accountsRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('freelancing_accounts').select('id, platform, username').order('created_at', { ascending: false }),
    ]);
    if (clientsRes.error) {
      toast({ title: 'Error loading clients', description: clientsRes.error.message, variant: 'destructive' });
    } else {
      setClients((clientsRes.data || []) as Client[]);
    }
    if (accountsRes.error) {
      toast({ title: 'Error loading source accounts', description: accountsRes.error.message, variant: 'destructive' });
    } else {
      setSourceAccounts((accountsRes.data || []) as SourceAccountOption[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  useEffect(() => {
    if (loading) return;
    const id = searchParams.get('client');
    if (!id) return;
    const c = clients.find((x) => x.id === id);
    if (!c) {
      toast({
        title: 'Client not found',
        description: 'The link may be outdated or this client may have been removed.',
        variant: 'destructive',
      });
      setSearchParams({}, { replace: true });
      return;
    }
    setView('detail');
    setSelectedId(c.id);
    setSelectedType(c.client_type);
  }, [loading, clients, searchParams, setSearchParams, toast]);

  const openCreate = (type?: string) => { setEditingId(null); setForm({ ...emptyForm, client_type: type || 'individual' }); setDialogOpen(true); };

  const openEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({
      client_type: c.client_type, title: c.title || '', first_name: c.first_name, middle_name: c.middle_name || '',
      last_name: c.last_name, sex: c.sex || '', profile_photo_url: c.profile_photo_url || '',
      company_name: c.company_name || '', industry: c.industry || '',
      country: c.country || '', address: c.address || '', timezone: c.timezone || '',
      phone_number: c.phone_number || '', telegram: c.telegram || '',
      whatsapp: c.whatsapp || '', discord_id: c.discord_id || '', email: c.email || '', teams: c.teams || '',
      other_communication: c.other_communication || '', linkedin_url: c.linkedin_url || '',
      github_url: c.github_url || '', personal_site_url: c.personal_site_url || '',
      portfolio_url: c.portfolio_url || '', instagram_url: c.instagram_url || '',
      upwork_url: c.upwork_url || '', freelancer_url: c.freelancer_url || '',
      fiverr_url: c.fiverr_url || '', guru_url: c.guru_url || '',
      other_link: c.other_link || '', resume_cv_url: c.resume_cv_url || '',
      weight: c.weight || '', height: c.height || '', skin_color: c.skin_color || '',
      hobby: c.hobby || '', characteristics: c.characteristics || '',
      universities: c.universities || '', religion: c.religion || '',
      marriage_status: c.marriage_status || '', children_status: c.children_status || '',
      skills: c.skills || '', achievements: c.achievements || '',
      availability_status: c.availability_status || 'available',
      employment_status: c.employment_status || 'not_employed',
      activity_notes: c.activity_notes || '', working_project_name: c.working_project_name || '',
      working_history: c.working_history || '', main_skill_list: c.main_skill_list || '',
      met_place: c.met_place || '', notes: c.notes || '',
      overview: c.overview || '', languages: c.languages || '',
      hourly_rate_main: c.hourly_rate_main?.toString() || '',
      hourly_rate_discussed: c.hourly_rate_discussed?.toString() || '',
      expected_monthly_salary: c.expected_monthly_salary?.toString() || '',
      preferred_payments: c.preferred_payments ? c.preferred_payments.split(',') : [],
      working_type: c.working_type || 'individual', good_fit: c.good_fit || false,
      budget: c.budget || '', payment_terms: c.payment_terms || '',
      project_history: c.project_history || '',       client_source: c.client_source || '',
      source_account_id: c.source_account_id || '',
      source_account_label: c.source_account_label || '',
      client_status: c.client_status || 'prospect',
      birthday: c.birthday ? (c.birthday.includes('T') ? c.birthday.slice(0, 10) : c.birthday) : '',
      identity_documents: normalizeIdentityDocuments(c.identity_documents ?? null),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: 'First name and last name are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      client_type: form.client_type, title: form.title || null, first_name: form.first_name,
      middle_name: form.middle_name || null, last_name: form.last_name,
      sex: form.sex || null, profile_photo_url: form.profile_photo_url || null,
      company_name: form.company_name || null, industry: form.industry || null,
      country: form.country || null, address: form.address || null,
      timezone: form.timezone || null, phone_number: form.phone_number || null,
      telegram: form.telegram || null, whatsapp: form.whatsapp || null,
      discord_id: form.discord_id || null,
      email: form.email || null, teams: form.teams || null,
      other_communication: form.other_communication || null,
      linkedin_url: form.linkedin_url || null, github_url: form.github_url || null,
      personal_site_url: form.personal_site_url || null,
      portfolio_url: form.portfolio_url || null, instagram_url: form.instagram_url || null,
      upwork_url: form.upwork_url || null, freelancer_url: form.freelancer_url || null,
      fiverr_url: form.fiverr_url || null, guru_url: form.guru_url || null,
      other_link: form.other_link || null, resume_cv_url: form.resume_cv_url || null,
      weight: form.weight || null, height: form.height || null,
      skin_color: form.skin_color || null, hobby: form.hobby || null,
      characteristics: form.characteristics || null, universities: form.universities || null,
      religion: form.religion || null,
      marriage_status: form.marriage_status || null,
      children_status: form.children_status || null,
      skills: form.skills || null, achievements: form.achievements || null,
      availability_status: form.availability_status,
      employment_status: form.employment_status,
      activity_notes: form.activity_notes || null,
      working_project_name: form.working_project_name || null,
      working_history: form.working_history || null,
      main_skill_list: form.main_skill_list || null,
      met_place: form.met_place || null, notes: form.notes || null,
      overview: form.overview || null, languages: form.languages || null,
      hourly_rate_main: form.hourly_rate_main ? parseFloat(form.hourly_rate_main) : null,
      hourly_rate_discussed: form.hourly_rate_discussed ? parseFloat(form.hourly_rate_discussed) : null,
      expected_monthly_salary: form.expected_monthly_salary ? parseFloat(form.expected_monthly_salary) : null,
      preferred_payments: (form.preferred_payments as string[]).length > 0 ? (form.preferred_payments as string[]).join(',') : null,
      working_type: form.working_type || null, good_fit: form.good_fit,
      budget: form.budget || null, payment_terms: form.payment_terms || null,
      project_history: form.project_history || null,
      client_source: form.client_source || null, client_status: form.client_status || null,
      source_account_id: form.source_account_id || null,
      source_account_label: form.source_account_label || null,
      birthday: form.birthday?.trim() ? form.birthday.trim() : null,
      identity_documents: identityDocumentsForDb(form.identity_documents as IdentityDocuments),
      user_id: user!.id, updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editingId);
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Client updated' });
    } else {
      const { error } = await supabase.from('clients').insert(payload);
      if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Client added' });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Client deleted' }); fetchClients(); }
  };

  const confirmDelete = (id: string, name: string) => setDeleteConfirm({ id, name });
  const executeDelete = async () => {
    if (!deleteConfirm) return;
    await handleDelete(deleteConfirm.id);
    setDeleteConfirm(null);
    if (view === 'detail') goToList(selectedType!);
  };

  const set = (key: string, value: string | boolean | number | string[] | IdentityDocuments) => setForm(prev => ({ ...prev, [key]: value }));

  const searchFiltered = useMemo(
    () => filterItemsBySearch(clients, searchInput, CLIENT_SEARCH_COLUMNS),
    [clients, searchInput],
  );
  const filteredSourceAccounts = useMemo(() => {
    const met = (form.met_place || '').toLowerCase();
    if (!PLATFORM_ACCOUNT_SOURCES.includes(met as (typeof PLATFORM_ACCOUNT_SOURCES)[number])) return sourceAccounts;
    return sourceAccounts.filter((acc) => {
      const platform = (acc.platform || '').toLowerCase();
      if (platform === met) return true;
      return platform.includes(met);
    });
  }, [form.met_place, sourceAccounts]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const grouped = searchFiltered.reduce<Record<string, Client[]>>((acc, c) => { if (!acc[c.client_type]) acc[c.client_type] = []; acc[c.client_type].push(c); return acc; }, {});
  const typeList = CLIENT_TYPES.map(t => ({ ...t, count: (grouped[t.value] || []).length, activeCount: (grouped[t.value] || []).filter(c => c.client_status === 'active').length }));
  const filteredClients = selectedType ? grouped[selectedType] || [] : [];
  const selectedClient = selectedId ? clients.find(c => c.id === selectedId) : null;
  const selectedSourceAccount = selectedClient?.source_account_id
    ? sourceAccounts.find((a) => a.id === selectedClient.source_account_id)
    : null;
  const sourceAccountDisplay =
    selectedSourceAccount
      ? `${selectedSourceAccount.platform} @${selectedSourceAccount.username}`
      : (selectedClient?.source_account_label || null);
  const typeLabel = selectedType ? (CLIENT_TYPES_MAP[selectedType]?.label || selectedType) : '';

  const goToTypes = () => {
    setSearchParams({}, { replace: true });
    setView('types');
    setSelectedType(null);
    setSelectedId(null);
  };
  const goToList = (type: string) => {
    setSearchParams({}, { replace: true });
    setView('list');
    setSelectedType(type);
    setSelectedId(null);
  };
  const goToDetail = (id: string) => { setView('detail'); setSelectedId(id); };

  const DefaultAvatar = ({ name, sex }: { name: string; sex?: string | null }) => (
    <div className={cn("h-16 w-16 rounded-full flex items-center justify-center border", sex === 'female' ? 'bg-pink-100' : sex === 'male' ? 'bg-blue-100' : 'bg-muted')}>
      <span className={cn("text-xl font-bold", sex === 'female' ? 'text-pink-500' : sex === 'male' ? 'text-blue-500' : 'text-muted-foreground')}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );

  const SmallAvatar = ({ name, sex }: { name: string; sex?: string | null }) => (
    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center border shrink-0", sex === 'female' ? 'bg-pink-100' : sex === 'male' ? 'bg-blue-100' : 'bg-muted')}>
      <span className={cn("text-sm font-bold", sex === 'female' ? 'text-pink-500' : sex === 'male' ? 'text-blue-500' : 'text-muted-foreground')}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );

  const parseLanguages = (val: string | null): LangEntry[] => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  };

  const parseUniversities = (val: string | null): UniEntry[] => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  };

  const renderDetail = () => {
    if (!selectedClient) return null;
    const c = selectedClient;
    const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');
    const langs = parseLanguages(c.languages);

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {c.profile_photo_url ? <img src={c.profile_photo_url} alt={fullName} className="h-16 w-16 rounded-full object-cover border" /> : <DefaultAvatar name={c.first_name} sex={c.sex} />}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-foreground">{fullName}</h2>
                {c.good_fit && <span title="Good Fit"><ThumbsUp className="h-5 w-5 text-emerald-500" /></span>}
              </div>
              {c.title && <p className="text-lg text-muted-foreground">{c.title}</p>}
              {c.company_name && <p className="text-sm text-muted-foreground flex items-center gap-1"><Building className="h-3.5 w-3.5" />{c.company_name}{c.industry && ` · ${c.industry}`}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary">{CLIENT_TYPES_MAP[c.client_type]?.label || c.client_type}</Badge>
                <Badge variant="secondary" className={statusColor[c.client_status || ''] || ''}>{c.client_status || 'N/A'}</Badge>
                <Badge variant="secondary" className={availColor[c.availability_status || ''] || ''}>{c.availability_status || 'N/A'}</Badge>
                {c.working_type && <Badge variant="outline"><Building className="h-3 w-3 mr-1" />{c.working_type === 'agency' ? 'Agency' : 'Individual'}</Badge>}
                {c.timezone && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />{c.timezone}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            <Button size="sm" variant="outline" onClick={() => confirmDelete(c.id, fullName)} className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" />Delete</Button>
          </div>
        </div>

        {c.overview && <div className="bg-muted/50 rounded-lg p-4"><p className="text-sm text-foreground/80 whitespace-pre-line">{c.overview}</p></div>}

        <Separator />

        {(c.budget || c.payment_terms) && (
          <DetailSection icon={DollarSign} title="Budget & Payment">
            <InfoRow label="Budget" value={c.budget} />
            <InfoRow label="Payment Terms" value={c.payment_terms} />
          </DetailSection>
        )}

        {c.main_skill_list && <DetailSection icon={Star} title="Main Skills"><div className="flex flex-wrap gap-2">{c.main_skill_list.split(',').map((s, i) => <Badge key={i} variant="outline" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection>}

        {(c.hourly_rate_main || c.hourly_rate_discussed || c.expected_monthly_salary || c.preferred_payments) && (
          <DetailSection icon={DollarSign} title="Rates & Salary">
            <InfoRow label="Main Hourly Rate" value={c.hourly_rate_main ? `$${c.hourly_rate_main}/hr` : null} />
            <InfoRow label="Discussed Hourly Rate" value={c.hourly_rate_discussed ? `$${c.hourly_rate_discussed}/hr` : null} />
            <InfoRow label="Expected Monthly Salary" value={c.expected_monthly_salary ? `$${c.expected_monthly_salary}` : null} />
            {c.preferred_payments && <div className="space-y-1"><span className="text-sm text-muted-foreground">Preferred Payments</span><div className="flex flex-wrap gap-1.5">{c.preferred_payments.split(',').map((pm, i) => <Badge key={i} variant="secondary">{pm.trim()}</Badge>)}</div></div>}
          </DetailSection>
        )}

        {langs.length > 0 && (
          <DetailSection icon={Languages} title="Languages">
            <div className="flex flex-wrap gap-2">{langs.map((l, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{l.language}: {l.level}</Badge>)}</div>
          </DetailSection>
        )}

        <DetailSection icon={MapPin} title="Location">
          <InfoRow label="Country" value={c.country} />
          <InfoRow label="Address" value={c.address} />
          <InfoRow label="Timezone" value={c.timezone} />
        </DetailSection>

        <DetailSection icon={Phone} title="Communication">
          <InfoRow label="Phone" value={c.phone_number} copyable />
          <InfoRow label="Email" value={c.email} copyable />
          <InfoRow label="Telegram" value={c.telegram} copyable />
          <InfoRow label="WhatsApp" value={c.whatsapp} copyable />
          <InfoRow label="Teams" value={c.teams} copyable />
          <InfoRow label="Discord" value={c.discord_id} copyable />
          <InfoRow label="Other" value={c.other_communication} />
        </DetailSection>

        <DetailSection icon={ExternalLink} title="Links">
          <div className="flex flex-wrap gap-4">
            {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><Linkedin className="h-4 w-4" />LinkedIn</a>}
            {c.github_url && <a href={c.github_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Github className="h-4 w-4" />GitHub</a>}
            {c.upwork_url && <a href={c.upwork_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Upwork</a>}
            {c.freelancer_url && <a href={c.freelancer_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Freelancer</a>}
            {c.fiverr_url && <a href={c.fiverr_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Fiverr</a>}
            {c.guru_url && <a href={c.guru_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Guru</a>}
            {c.personal_site_url && <a href={c.personal_site_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Website</a>}
            {c.portfolio_url && <a href={c.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Portfolio</a>}
            {c.instagram_url && <a href={c.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Instagram</a>}
          </div>
        </DetailSection>

        <DetailSection icon={User} title="Personal Details">
          <InfoRow label="Birthday" value={formatBirthday(c.birthday)} />
          <InfoRow label="Weight" value={c.weight} />
          <InfoRow label="Height" value={c.height} />
          <InfoRow label="Skin Color" value={c.skin_color} />
          <InfoRow label="Hobby" value={c.hobby} />
          <InfoRow label="Characteristics" value={c.characteristics} />
        </DetailSection>

        {Object.keys(normalizeIdentityDocuments(c.identity_documents)).length > 0 && (
          <DetailSection icon={Images} title="Identity documents">
            <IdentityDocumentsGallery documents={c.identity_documents} />
          </DetailSection>
        )}

        <DetailSection icon={GraduationCap} title="Education">
          {(() => { const unis = parseUniversities(c.universities); return unis.length > 0 ? unis.map((u, i) => (
            <div key={i} className="mb-2 p-2 bg-muted/30 rounded">
              <p className="text-sm font-medium">{u.name}</p>
              {u.course && <p className="text-xs text-muted-foreground">{u.course}</p>}
              {(u.start_date || u.end_date) && <p className="text-xs text-muted-foreground">{u.start_date} – {u.end_date || 'Present'}</p>}
            </div>
          )) : null; })()}
          <InfoRow label="Religion" value={c.religion} />
          <InfoRow label="Sex" value={c.sex ? SEX_OPTIONS.find(s => s.value === c.sex)?.label || c.sex : null} />
        </DetailSection>

        <DetailSection icon={Heart} title="Family">
          <InfoRow label="Marriage" value={MARRIAGE.find(m => m.value === c.marriage_status)?.label || c.marriage_status} />
          <InfoRow label="Children" value={c.children_status} />
        </DetailSection>

        {c.skills && <DetailSection icon={Star} title="Skills"><div className="flex flex-wrap gap-2">{c.skills.split(',').map((s, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection>}
        {c.achievements && <DetailSection icon={Star} title="Achievements"><div className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: c.achievements }} /></DetailSection>}
        <DetailSection icon={Briefcase} title="Project history">
          <div className="space-y-4">
            <ClientLinkedProjectsSection clientId={c.id} projectsBasePath="/admin/projects" emptyState="hidden" />
            <ClientLinkedTasksSection clientId={c.id} tasksBasePath="/admin/tasks" emptyState="hidden" />
            {c.project_history ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Additional notes (rich text)</p>
                <div
                  className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: c.project_history }}
                />
              </div>
            ) : null}
          </div>
        </DetailSection>

        <Separator />

        <DetailSection icon={Briefcase} title="Work">
          <InfoRow label="Working Project" value={c.working_project_name} />
          <InfoRow label="Met Place" value={MET_PLACES.find(m => m.value === c.met_place)?.label || c.met_place} />
          <InfoRow label="Source Account" value={sourceAccountDisplay} />
          <InfoRow label="Client Source" value={c.client_source} />
          {c.working_history && <div className="mt-2"><p className="text-xs font-semibold text-muted-foreground mb-1">Working History</p><div className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: c.working_history }} /></div>}
          {c.activity_notes && <div className="mt-2"><p className="text-xs font-semibold text-muted-foreground mb-1">Activity Notes</p><p className="text-sm text-foreground/80 whitespace-pre-line">{c.activity_notes}</p></div>}
        </DetailSection>

        {c.notes && (<><Separator /><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p><p className="text-sm text-foreground/80 whitespace-pre-line">{c.notes}</p></div></>)}
      </div>
    );
  };

  const FormDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{editingId ? 'Edit Client' : 'Add Client'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <div className="px-6 pb-6">
            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="client">Client</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="communication">Comm</TabsTrigger>
                <TabsTrigger value="links">Links</TabsTrigger>
                <TabsTrigger value="work">Work</TabsTrigger>
                <TabsTrigger value="rates">Rates</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Middle Name</Label><Input value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Last Name *</Label><Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. CEO, CTO" /></div>
                  <div className="space-y-2">
                    <Label>Client Type</Label>
                    <Select value={form.client_type} onValueChange={(v) => set('client_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sex</Label>
                    <Select value={form.sex} onValueChange={(v) => set('sex', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{SEX_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Overview</Label><Textarea value={form.overview} onChange={(e) => set('overview', e.target.value)} rows={3} placeholder="Brief overview..." /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Met Place</Label>
                    <Select
                      value={form.met_place}
                      onValueChange={(v) => {
                        set('met_place', v);
                        const lower = v.toLowerCase();
                        if (!PLATFORM_ACCOUNT_SOURCES.includes(lower as (typeof PLATFORM_ACCOUNT_SOURCES)[number])) {
                          set('source_account_id', '');
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Where did you meet?" /></SelectTrigger>
                      <SelectContent>{MET_PLACES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Working Type</Label>
                    <Select value={form.working_type} onValueChange={(v) => set('working_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{WORKING_TYPES.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source Account (optional)</Label>
                    <Select value={form.source_account_id || 'none'} onValueChange={(v) => set('source_account_id', v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select account used to meet this client" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {filteredSourceAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.platform} @{a.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source Label / Note</Label>
                    <Input
                      value={form.source_account_label}
                      onChange={(e) => set('source_account_label', e.target.value)}
                      placeholder="e.g. Discord server, LinkedIn profile, Guru team account"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Availability</Label>
                    <Select value={form.availability_status} onValueChange={(v) => set('availability_status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AVAILABILITY.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Status</Label>
                    <Select value={form.employment_status} onValueChange={(v) => set('employment_status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EMPLOYMENT.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-md">
                  <input type="checkbox" checked={form.good_fit} onChange={(e) => set('good_fit', e.target.checked)} className="rounded" />
                  <Label className="flex items-center gap-2 cursor-pointer"><ThumbsUp className="h-4 w-4 text-emerald-500" /> Mark as Good Fit</Label>
                </div>
                <div className="space-y-2"><Label>Profile Photo</Label><FileUpload value={form.profile_photo_url} onChange={(url) => set('profile_photo_url', url)} folder="client-photos" label="Upload Photo" /></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CountrySelect
                    label="Country"
                    value={form.country}
                    onChange={(country) =>
                      setForm((prev) => {
                        const suggested = suggestedTimezoneForCountry(country);
                        return { ...prev, country, ...(suggested ? { timezone: suggested } : {}) };
                      })
                    }
                  />
                  <TimezoneSelect label="Timezone" value={form.timezone} onChange={(tz) => set('timezone', tz)} />
                </div>
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
              </TabsContent>

              <TabsContent value="client" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Company Name</Label><Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Industry</Label><Input value={form.industry} onChange={(e) => set('industry', e.target.value)} placeholder="e.g. Technology, Finance" /></div>
                </div>
                <div className="space-y-2">
                  <Label>Client Status</Label>
                  <Select value={form.client_status} onValueChange={(v) => set('client_status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLIENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Client Source</Label><Input value={form.client_source} onChange={(e) => set('client_source', e.target.value)} placeholder="e.g. Referral, Upwork, Website" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Budget</Label><Input value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="e.g. $5,000-$10,000" /></div>
                  <div className="space-y-2"><Label>Payment Terms</Label><Input value={form.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} placeholder="e.g. Net 30, Milestone-based" /></div>
                </div>
                <div className="space-y-4">
                  <ClientLinkedProjectsSection
                    clientId={editingId}
                    projectsBasePath="/admin/projects"
                    emptyState={editingId ? 'hidden' : 'hint'}
                  />
                  <ClientLinkedTasksSection
                    clientId={editingId}
                    tasksBasePath="/admin/tasks"
                    emptyState={editingId ? 'hidden' : 'hint'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional project history (rich text)</Label>
                  <p className="text-xs text-muted-foreground">
                    Linked rows from <strong className="text-foreground">Admin → Projects</strong> and{' '}
                    <strong className="text-foreground">Admin → Tasks</strong> (Client linked) appear above. Use the editor for meetings, context, or work that is
                    not stored as a project or task lead.
                  </p>
                  <RichTextEditor
                    value={form.project_history}
                    onChange={(val) => set('project_history', val)}
                    placeholder="Optional narrative: milestones, meetings, legacy work…"
                  />
                </div>
              </TabsContent>

              <TabsContent value="personal" className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Birthday</Label><Input type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Weight</Label><Input value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="e.g. 75kg" /></div>
                  <div className="space-y-2"><Label>Height</Label><Input value={form.height} onChange={(e) => set('height', e.target.value)} placeholder="e.g. 180cm" /></div>
                  <div className="space-y-2"><Label>Skin Color</Label><Input value={form.skin_color} onChange={(e) => set('skin_color', e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Hobby</Label><Textarea value={form.hobby} onChange={(e) => set('hobby', e.target.value)} rows={2} /></div>
                <div className="space-y-2"><Label>Characteristics</Label><Textarea value={form.characteristics} onChange={(e) => set('characteristics', e.target.value)} rows={3} /></div>
                <UniversityEditor value={form.universities} onChange={(v) => set('universities', v)} />
                <div className="space-y-2"><Label>Religion</Label><Input value={form.religion} onChange={(e) => set('religion', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marriage Status</Label>
                    <Select value={form.marriage_status} onValueChange={(v) => set('marriage_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{MARRIAGE.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Children Status</Label><Input value={form.children_status} onChange={(e) => set('children_status', e.target.value)} placeholder="e.g. 2 sons" /></div>
                </div>
                <LanguageEditor value={form.languages} onChange={(v) => set('languages', v)} />
                <IdentityDocumentsEditor
                  value={form.identity_documents as IdentityDocuments}
                  onChange={(next) => set('identity_documents', next)}
                  folder="client-identity"
                />
              </TabsContent>

              <TabsContent value="communication" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Phone Number</Label><PhoneInput value={form.phone_number} onChange={(v) => set('phone_number', v)} countryHint={form.country} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Telegram</Label><Input value={form.telegram} onChange={(e) => set('telegram', e.target.value)} /></div>
                  <div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Teams</Label><Input value={form.teams} onChange={(e) => set('teams', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Discord ID</Label><Input value={form.discord_id} onChange={(e) => set('discord_id', e.target.value)} placeholder="username#1234" /></div>
                </div>
                <div className="space-y-2"><Label>Other</Label><Input value={form.other_communication} onChange={(e) => set('other_communication', e.target.value)} /></div>
              </TabsContent>

              <TabsContent value="links" className="space-y-4 pt-4">
                <div className="space-y-2"><Label>LinkedIn URL</Label><Input value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} /></div>
                <div className="space-y-2"><Label>GitHub URL</Label><Input value={form.github_url} onChange={(e) => set('github_url', e.target.value)} /></div>
                <Separator />
                <p className="text-sm font-medium text-muted-foreground">Freelancer Platforms</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Upwork URL</Label><Input value={form.upwork_url} onChange={(e) => set('upwork_url', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Freelancer URL</Label><Input value={form.freelancer_url} onChange={(e) => set('freelancer_url', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Fiverr URL</Label><Input value={form.fiverr_url} onChange={(e) => set('fiverr_url', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Guru URL</Label><Input value={form.guru_url} onChange={(e) => set('guru_url', e.target.value)} /></div>
                </div>
                <Separator />
                <div className="space-y-2"><Label>Personal Site</Label><Input value={form.personal_site_url} onChange={(e) => set('personal_site_url', e.target.value)} /></div>
                <div className="space-y-2"><Label>Portfolio URL</Label><Input value={form.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} /></div>
                <div className="space-y-2"><Label>Instagram URL</Label><Input value={form.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} /></div>
                <div className="space-y-2"><Label>Other Link</Label><Input value={form.other_link} onChange={(e) => set('other_link', e.target.value)} /></div>
                <div className="space-y-2"><Label>Resume / CV</Label><FileUpload value={form.resume_cv_url} onChange={(url) => set('resume_cv_url', url)} folder="client-docs" accept=".pdf,.doc,.docx,image/*" label="Upload Document" /></div>
              </TabsContent>

              <TabsContent value="work" className="space-y-4 pt-4">
                <SkillMultiSelect value={form.skills} onChange={(v) => set('skills', v)} label="Skills" />
                <SkillMultiSelect value={form.main_skill_list} onChange={(v) => set('main_skill_list', v)} label="Main Skill List" />
                <div className="space-y-2"><Label>Achievements</Label><RichTextEditor value={form.achievements} onChange={(val) => set('achievements', val)} placeholder="Add achievements..." /></div>
                <div className="space-y-2"><Label>Working Project Name</Label><Input value={form.working_project_name} onChange={(e) => set('working_project_name', e.target.value)} /></div>
                <div className="space-y-2"><Label>Working History</Label><RichTextEditor value={form.working_history} onChange={(val) => set('working_history', val)} placeholder="Working history..." /></div>
                <div className="space-y-2"><Label>Activity Notes</Label><Textarea value={form.activity_notes} onChange={(e) => set('activity_notes', e.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} /></div>
              </TabsContent>

              <TabsContent value="rates" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Main Hourly Rate ($)</Label><Input type="number" value={form.hourly_rate_main} onChange={(e) => set('hourly_rate_main', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Discussed Hourly Rate ($)</Label><Input type="number" value={form.hourly_rate_discussed} onChange={(e) => set('hourly_rate_discussed', e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Expected Monthly Salary ($)</Label><Input type="number" value={form.expected_monthly_salary} onChange={(e) => set('expected_monthly_salary', e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Preferred Payment Methods (max 2)</Label>
                  <div className="flex flex-wrap gap-2">
                    {['PayPal', 'Payoneer', 'Crypto', 'Wise', 'Bank Transfer', 'Stripe', 'Skrill'].map((pm) => {
                      const selected = (form.preferred_payments as string[]).includes(pm);
                      return (
                        <Badge key={pm} variant={selected ? 'default' : 'outline'} className="cursor-pointer select-none" onClick={() => {
                          const current = form.preferred_payments as string[];
                          if (selected) set('preferred_payments', current.filter(p => p !== pm));
                          else if (current.length < 2) set('preferred_payments', [...current, pm]);
                        }}>{pm}</Badge>
                      );
                    })}
                  </div>
                  {(form.preferred_payments as string[]).length >= 2 && <p className="text-xs text-muted-foreground">Maximum 2 selected</p>}
                </div>
              </TabsContent>
            </Tabs>
            <Button onClick={handleSave} disabled={saving} className="mt-6 w-full">
              {saving ? 'Saving...' : editingId ? 'Update Client' : 'Add Client'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  const DeleteDialog = (
    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Client</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="space-y-6">
      {FormDialog}
      {DeleteDialog}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-1 lg:justify-start lg:gap-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Manage Clients</h2>
            <p className="text-sm text-muted-foreground">Individual, company, agency, and startup clients</p>
          </div>
          <ModuleSearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name, email, company, skills…"
            id="admin-clients-search"
          />
        </div>
        <Button onClick={() => openCreate(selectedType || undefined)} className="gap-2 shrink-0"><Plus className="h-4 w-4" />Add Client</Button>
      </div>

      {view !== 'types' && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goToTypes} className="text-primary hover:underline font-medium">All Types</button>
          {selectedType && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {view === 'detail' ? (
                <button onClick={() => goToList(selectedType)} className="text-primary hover:underline font-medium">{typeLabel}s</button>
              ) : (
                <span className="text-foreground font-medium">{typeLabel}s</span>
              )}
            </>
          )}
          {view === 'detail' && selectedClient && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{selectedClient.first_name} {selectedClient.last_name}</span>
            </>
          )}
        </div>
      )}

      {view === 'types' && (
        clients.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center"><p className="text-lg font-medium">No clients yet</p><Button onClick={() => openCreate()} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" />Add Client</Button></CardContent></Card>
        ) : searchFiltered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center"><p className="text-lg font-medium">No matching clients</p><p className="mt-1 text-sm text-muted-foreground">Try different keywords or clear the search.</p></CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {typeList.map(t => (
              <Card key={t.value} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group" onClick={() => goToList(t.value)}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-lg text-white', t.color)}>{t.icon}</div>
                    <CardTitle className="text-lg">{t.label}s</CardTitle>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{t.count}</p>
                  <p className="text-sm text-muted-foreground">{t.activeCount} active</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {view === 'list' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Select value={listViewMode} onValueChange={(v) => setListViewMode(v as 'card' | 'list' | 'line' | 'table')}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card mode</SelectItem>
                <SelectItem value="list">List mode</SelectItem>
                <SelectItem value="line">Line mode</SelectItem>
                <SelectItem value="table">Table mode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredClients.length === 0 ? (
            <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">{searchInput.trim() ? `No ${typeLabel} clients match your search` : `No ${typeLabel} clients yet`}</p></CardContent></Card>
          ) : listViewMode === 'card' ? filteredClients.map(c => {
            const mainSkills = c.main_skill_list ? c.main_skill_list.split(',').slice(0, 3).map(s => s.trim()) : [];
            return (
              <Card key={c.id} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => goToDetail(c.id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {c.profile_photo_url ? <img src={c.profile_photo_url} alt="" className="h-10 w-10 rounded-full object-cover border" /> : <SmallAvatar name={c.first_name} sex={c.sex} />}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{c.first_name} {c.last_name}</p>
                        {c.good_fit && <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {c.title && <span>{c.title}</span>}
                        {c.company_name && <span>· {c.company_name}</span>}
                        {c.country && <><span>·</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.country}</span></>}
                        {c.timezone && <><span>·</span><span className="flex items-center gap-1"><Globe className="h-3 w-3" />{c.timezone}</span></>}
                      </div>
                      {mainSkills.length > 0 && <div className="flex gap-1 mt-1">{mainSkills.map((s, i) => <Badge key={i} variant="outline" className="text-xs py-0">{s}</Badge>)}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={statusColor[c.client_status || ''] || ''}>{c.client_status}</Badge>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); confirmDelete(c.id, `${c.first_name} ${c.last_name}`); }} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          }) : listViewMode === 'line' ? (
            <Card><CardContent className="p-0">
              {filteredClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-t px-3 py-2 first:border-t-0">
                  <button type="button" onClick={() => goToDetail(c.id)} className="text-left">
                    <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-muted-foreground">{c.company_name || c.title || 'N/A'}</p>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirmDelete(c.id, `${c.first_name} ${c.last_name}`)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent></Card>
          ) : listViewMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
                </thead>
                <tbody>
                  {filteredClients.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 cursor-pointer font-medium" onClick={() => goToDetail(c.id)}>{c.first_name} {c.last_name}</td>
                      <td className="px-3 py-2">{c.company_name || '-'}</td>
                      <td className="px-3 py-2">{c.country || '-'}</td>
                      <td className="px-3 py-2">{c.client_status || '-'}</td>
                      <td className="px-3 py-2 text-right"><Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClients.map((c) => (
                <Card key={c.id} className="hover:border-primary/40">
                  <CardContent className="space-y-2 p-4">
                    <button type="button" onClick={() => goToDetail(c.id)} className="w-full text-left">
                      <p className="font-medium">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground">{c.company_name || 'No company'}</p>
                    </button>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className={statusColor[c.client_status || ''] || ''}>{c.client_status || 'N/A'}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'detail' && renderDetail()}
    </div>
  );
}
