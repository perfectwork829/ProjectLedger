import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  Star, Clock, Eye, EyeOff, Image, Images, MessageSquare, X, Check as CheckIcon,
  Copy, ThumbsUp, Globe, DollarSign, Building, Languages, Search,
} from 'lucide-react';
import { PERSONNEL_SEARCH_COLUMNS } from '@/lib/supabaseSearch';
import { filterItemsBySearch } from '@/lib/clientSearch';
import FileUpload from '@/components/FileUpload';
import { IdentityDocumentsEditor, IdentityDocumentsGallery } from '@/components/IdentityDocumentsFields';
import { useToast } from '@/hooks/use-toast';
import type { IdentityDocuments } from '@/lib/identityDocuments';
import { identityDocumentsForDb, formatBirthday, normalizeIdentityDocuments } from '@/lib/identityDocuments';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/RichTextEditor';
import { CloudGoogleDriveUpload } from '@/components/CloudGoogleDriveUpload';

interface Personnel {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  sex: string | null;
  profile_photo_url: string | null;
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
  gallery_urls: string[] | null;
  birthday: string | null;
  identity_documents: IdentityDocuments | null;
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
  profile_titles_json?: unknown;
  profile_overviews_json?: unknown;
  profile_skills_json?: unknown;
  profile_achievements_json?: unknown;
  profile_blocks_json?: unknown;
  created_at: string;
}

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

interface UniEntry { name: string; course: string; start_date: string; end_date: string }
interface WorkHistoryEntry { title: string; overview: string; start_date: string; end_date: string }
interface ProfileBlock {
  title: string;
  overview: string;
  skills: string[];
  achievements: string[];
  experience: WorkHistoryEntry[];
}

function parseTextItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
}

function parseProfileBlocks(raw: unknown): ProfileBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const obj = (x || {}) as Record<string, unknown>;
    const expRaw = Array.isArray(obj.experience) ? obj.experience : [];
    return {
      title: String(obj.title || ''),
      overview: String(obj.overview || ''),
      skills: parseTextItems(obj.skills),
      achievements: parseTextItems(obj.achievements),
      experience: expRaw.map((e) => {
        const eo = (e || {}) as Record<string, unknown>;
        return {
          title: String(eo.title || ''),
          overview: String(eo.overview || ''),
          start_date: String(eo.start_date || ''),
          end_date: String(eo.end_date || ''),
        };
      }),
    };
  });
}

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

const ROLES = [
  { value: 'caller', label: 'Caller', icon: '📞', color: 'bg-blue-500' },
  { value: 'developer_for_job', label: 'Developer For Job', icon: '🧑‍💼', color: 'bg-cyan-500' },
  { value: 'developer', label: 'Developer', icon: '💻', color: 'bg-emerald-500' },
  { value: 'broker', label: 'Broker', icon: '🤝', color: 'bg-amber-500' },
  { value: 'recruiter', label: 'Recruiter', icon: '🎯', color: 'bg-rose-500' },
  { value: 'friend', label: 'Friend', icon: '👋', color: 'bg-violet-500' },
];

const ROLES_MAP: Record<string, typeof ROLES[0]> = Object.fromEntries(ROLES.map(r => [r.value, r]));

const AVAILABILITY = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
];

const EMPLOYMENT = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'not_employed', label: 'Not Employed' },
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

const TIMEZONES = [
  { value: 'UTC-12:00', label: 'UTC-12:00 – Baker Island' },
  { value: 'UTC-11:00', label: 'UTC-11:00 – American Samoa' },
  { value: 'UTC-10:00', label: 'UTC-10:00 – Hawaii' },
  { value: 'UTC-09:00', label: 'UTC-09:00 – Alaska' },
  { value: 'UTC-08:00', label: 'UTC-08:00 – Pacific (US/Canada)' },
  { value: 'UTC-07:00', label: 'UTC-07:00 – Mountain (US/Canada)' },
  { value: 'UTC-06:00', label: 'UTC-06:00 – Central (US/Canada)' },
  { value: 'UTC-05:00', label: 'UTC-05:00 – Eastern (US/Canada)' },
  { value: 'UTC-04:00', label: 'UTC-04:00 – Atlantic' },
  { value: 'UTC-03:00', label: 'UTC-03:00 – Buenos Aires, São Paulo' },
  { value: 'UTC-02:00', label: 'UTC-02:00 – South Georgia' },
  { value: 'UTC-01:00', label: 'UTC-01:00 – Azores' },
  { value: 'UTC+00:00', label: 'UTC+00:00 – London, Lisbon' },
  { value: 'UTC+01:00', label: 'UTC+01:00 – Berlin, Paris, Warsaw' },
  { value: 'UTC+02:00', label: 'UTC+02:00 – Cairo, Bucharest, Kyiv' },
  { value: 'UTC+03:00', label: 'UTC+03:00 – Moscow, Istanbul' },
  { value: 'UTC+03:30', label: 'UTC+03:30 – Tehran' },
  { value: 'UTC+04:00', label: 'UTC+04:00 – Dubai, Baku' },
  { value: 'UTC+04:30', label: 'UTC+04:30 – Kabul' },
  { value: 'UTC+05:00', label: 'UTC+05:00 – Karachi, Tashkent' },
  { value: 'UTC+05:30', label: 'UTC+05:30 – Mumbai, Colombo' },
  { value: 'UTC+05:45', label: 'UTC+05:45 – Kathmandu' },
  { value: 'UTC+06:00', label: 'UTC+06:00 – Dhaka, Almaty' },
  { value: 'UTC+06:30', label: 'UTC+06:30 – Yangon' },
  { value: 'UTC+07:00', label: 'UTC+07:00 – Bangkok, Jakarta, Hanoi' },
  { value: 'UTC+08:00', label: 'UTC+08:00 – Beijing, Singapore, Manila' },
  { value: 'UTC+09:00', label: 'UTC+09:00 – Tokyo, Seoul' },
  { value: 'UTC+09:30', label: 'UTC+09:30 – Adelaide' },
  { value: 'UTC+10:00', label: 'UTC+10:00 – Sydney, Melbourne' },
  { value: 'UTC+11:00', label: 'UTC+11:00 – Solomon Islands' },
  { value: 'UTC+12:00', label: 'UTC+12:00 – Auckland, Fiji' },
  { value: 'UTC+13:00', label: 'UTC+13:00 – Samoa, Tonga' },
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
  { value: 'other', label: 'Other' },
];

const availColor: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-red-100 text-red-800',
};

const emptyForm = {
  role: 'developer', title: '', first_name: '', middle_name: '', last_name: '',
  sex: '',
  profile_photo_url: '', country: '', address: '', timezone: '',
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
  profile_titles_json: '[]',
  profile_overviews_json: '[]',
  profile_skills_json: '[]',
  profile_achievements_json: '[]',
  profile_blocks_json: '[]',
  hourly_rate_main: '', hourly_rate_discussed: '', expected_monthly_salary: '',
  preferred_payments: [] as string[],
  working_type: 'individual', good_fit: false as boolean,
  birthday: '',
  identity_documents: {} as IdentityDocuments,
};

type View = 'roles' | 'list' | 'detail';

// --- Copy to clipboard helper ---
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

function parseWorkHistoryEntries(raw: string): WorkHistoryEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => ({
      title: String((x as { title?: unknown })?.title || ''),
      overview: String((x as { overview?: unknown })?.overview || ''),
      start_date: String((x as { start_date?: unknown })?.start_date || ''),
      end_date: String((x as { end_date?: unknown })?.end_date || ''),
    }));
  } catch {
    return [];
  }
}

function WorkHistoryEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const entries = parseWorkHistoryEntries(value);
  const update = (next: WorkHistoryEntry[]) => onChange(JSON.stringify(next));
  const add = () => update([...entries, { title: '', overview: '', start_date: '', end_date: '' }]);
  const remove = (idx: number) => update(entries.filter((_, i) => i !== idx));
  const patch = (idx: number, key: keyof WorkHistoryEntry, nextVal: string) => {
    const next = [...entries];
    next[idx] = { ...next[idx], [key]: nextVal };
    update(next);
  };
  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div key={i} className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">History #{i + 1}</p>
            <Button size="icon" variant="ghost" onClick={() => remove(i)} className="h-6 w-6 text-destructive">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input value={entry.title} onChange={(e) => patch(i, 'title', e.target.value)} placeholder="Title (e.g. Fullstack Developer)" />
          <Textarea value={entry.overview} onChange={(e) => patch(i, 'overview', e.target.value)} rows={3} placeholder="Overview of responsibilities and results..." />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={entry.start_date} onChange={(e) => patch(i, 'start_date', e.target.value)} />
            <Input type="date" value={entry.end_date} onChange={(e) => patch(i, 'end_date', e.target.value)} />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Add Working History
      </Button>
    </div>
  );
}

function ProfileBlocksEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [active, setActive] = useState(0);
  const blocks = useMemo(() => {
    try {
      return parseProfileBlocks(JSON.parse(value || '[]'));
    } catch {
      return [] as ProfileBlock[];
    }
  }, [value]);
  const safeBlocks = blocks.length > 0 ? blocks : [{ title: '', overview: '', skills: [], achievements: [], experience: [] }];
  const activeIndex = Math.min(active, safeBlocks.length - 1);
  const current = safeBlocks[activeIndex];
  const save = (next: ProfileBlock[]) => onChange(JSON.stringify(next));
  const patchBlock = (idx: number, patch: Partial<ProfileBlock>) => {
    const next = [...safeBlocks];
    next[idx] = { ...next[idx], ...patch };
    save(next);
  };
  const addBlock = () => {
    const next = [...safeBlocks, { title: '', overview: '', skills: [], achievements: [], experience: [] }];
    save(next);
    setActive(next.length - 1);
  };
  const removeBlock = (idx: number) => {
    const next = safeBlocks.filter((_, i) => i !== idx);
    save(next.length ? next : [{ title: '', overview: '', skills: [], achievements: [], experience: [] }]);
    setActive(Math.max(0, idx - 1));
  };
  const setSkillsText = (txt: string) => patchBlock(activeIndex, { skills: txt.split(',').map((s) => s.trim()).filter(Boolean) });
  const setAchievementsText = (txt: string) => patchBlock(activeIndex, { achievements: txt.split('\n').map((s) => s.trim()).filter(Boolean) });
  const addExp = () => patchBlock(activeIndex, { experience: [...current.experience, { title: '', overview: '', start_date: '', end_date: '' }] });
  const patchExp = (idx: number, patch: Partial<WorkHistoryEntry>) => {
    const exp = [...current.experience];
    exp[idx] = { ...exp[idx], ...patch };
    patchBlock(activeIndex, { experience: exp });
  };
  const removeExp = (idx: number) => patchBlock(activeIndex, { experience: current.experience.filter((_, i) => i !== idx) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {safeBlocks.map((_, i) => (
          <Button key={i} type="button" size="sm" variant={i === activeIndex ? 'default' : 'outline'} onClick={() => setActive(i)}>
            Profile Tab {i + 1}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addBlock}><Plus className="h-3.5 w-3.5" />Add Tab</Button>
        {safeBlocks.length > 1 ? (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeBlock(activeIndex)}>
            Remove Current
          </Button>
        ) : null}
      </div>
      <div className="rounded-md border p-3 space-y-3">
        <div className="space-y-2"><Label>Title</Label><Input value={current.title} onChange={(e) => patchBlock(activeIndex, { title: e.target.value })} /></div>
        <div className="space-y-2"><Label>Overview</Label><Textarea rows={3} value={current.overview} onChange={(e) => patchBlock(activeIndex, { overview: e.target.value })} /></div>
        <div className="space-y-2"><Label>Skills (comma separated)</Label><Input value={current.skills.join(', ')} onChange={(e) => setSkillsText(e.target.value)} /></div>
        <div className="space-y-2"><Label>Achievements (one per line)</Label><Textarea rows={3} value={current.achievements.join('\n')} onChange={(e) => setAchievementsText(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Experience</Label>
          {current.experience.map((ex, i) => (
            <div key={i} className="rounded border p-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Experience #{i + 1}</p>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeExp(i)}><X className="h-3.5 w-3.5" /></Button>
              </div>
              <Input placeholder="Title" value={ex.title} onChange={(e) => patchExp(i, { title: e.target.value })} />
              <Textarea rows={2} placeholder="Overview" value={ex.overview} onChange={(e) => patchExp(i, { overview: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={ex.start_date} onChange={(e) => patchExp(i, { start_date: e.target.value })} />
                <Input type="date" value={ex.end_date} onChange={(e) => patchExp(i, { end_date: e.target.value })} />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addExp}><Plus className="h-3.5 w-3.5" />Add Experience</Button>
        </div>
      </div>
    </div>
  );
}

function TextItemsEditor({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const items = (() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) return [] as string[];
      return parsed.map((x) => String(x || '')).filter(Boolean);
    } catch {
      return [] as string[];
    }
  })();
  const update = (next: string[]) => onChange(JSON.stringify(next));
  const add = () => update([...(items || []), '']);
  const patch = (idx: number, nextVal: string) => {
    const next = [...(items || [])];
    next[idx] = nextVal;
    update(next);
  };
  const remove = (idx: number) => update((items || []).filter((_, i) => i !== idx));
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {(items || []).map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea value={item} onChange={(e) => patch(i, e.target.value)} rows={2} placeholder={placeholder} />
          <Button size="icon" variant="ghost" onClick={() => remove(i)} className="h-8 w-8 text-destructive">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Add item
      </Button>
    </div>
  );
}

// --- Searchable Multi-Select Skill Component ---
function SkillMultiSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const allSkills = [...SKILL_OPTIONS, ...customSkills.filter(s => !SKILL_OPTIONS.includes(s))];
  const filtered = allSkills.filter(s =>
    s.toLowerCase().includes(search.toLowerCase()) && !selected.includes(s)
  );
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
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? "Search or add skills..." : ""}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        {open && (filtered.length > 0 || showAddCustom) && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(skill => (
              <button key={skill} onClick={() => { toggle(skill); setSearch(''); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors">
                {skill}
              </button>
            ))}
            {showAddCustom && (
              <button onClick={addCustom} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors text-primary font-medium">
                + Add "{search.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Language Editor ---
interface LangEntry { language: string; level: string }

function LanguageEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const entries: LangEntry[] = value ? (() => { try { return JSON.parse(value); } catch { return []; } })() : [];

  const update = (newEntries: LangEntry[]) => onChange(JSON.stringify(newEntries));
  const add = () => update([...entries, { language: '', level: 'Basic (A1-A2)' }]);
  const remove = (i: number) => update(entries.filter((_, idx) => idx !== i));
  const setEntry = (i: number, key: keyof LangEntry, val: string) => {
    const next = [...entries];
    next[i] = { ...next[i], [key]: val };
    update(next);
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

// --- Phone Number Input ---
function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const format = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 1) return digits.length ? `+${digits}` : '';
    if (digits.length <= 4) return `+${digits.slice(0, 1)} ${digits.slice(1)}`;
    if (digits.length <= 7) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  };

  return (
    <Input
      value={value}
      onChange={(e) => onChange(format(e.target.value))}
      placeholder="+1 (555) 123-4567"
      type="tel"
    />
  );
}

export default function AdminPersonnel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [people, setPeople] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const [view, setView] = useState<View>('roles');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [listViewMode, setListViewMode] = useState<'card' | 'list' | 'line' | 'table'>('card');

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('personnel').select('*').order('created_at', { ascending: false });
      if (error) toast({ title: 'Error loading personnel', description: error.message, variant: 'destructive' });
      else setPeople(data || []);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  useEffect(() => {
    if (!selectedId) return;
    if (!people.some((p) => p.id === selectedId)) {
      setSelectedId(null);
      setView(selectedRole ? 'list' : 'roles');
    }
  }, [people, selectedId, selectedRole]);

  const openCreate = (role?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, role: role || 'developer' });
    setDialogOpen(true);
  };

  const openEdit = (p: Personnel) => {
    setEditingId(p.id);
    setForm({
      role: p.role, title: p.title || '', first_name: p.first_name, middle_name: p.middle_name || '',
      last_name: p.last_name, sex: p.sex || '', profile_photo_url: p.profile_photo_url || '',
      country: p.country || '', address: p.address || '', timezone: p.timezone || '',
      phone_number: p.phone_number || '', telegram: p.telegram || '',
      whatsapp: p.whatsapp || '', discord_id: p.discord_id || '', email: p.email || '', teams: p.teams || '',
      other_communication: p.other_communication || '', linkedin_url: p.linkedin_url || '',
      github_url: p.github_url || '', personal_site_url: p.personal_site_url || '',
      portfolio_url: p.portfolio_url || '', instagram_url: p.instagram_url || '',
      upwork_url: p.upwork_url || '', freelancer_url: p.freelancer_url || '',
      fiverr_url: p.fiverr_url || '', guru_url: p.guru_url || '',
      other_link: p.other_link || '', resume_cv_url: p.resume_cv_url || '',
      weight: p.weight || '', height: p.height || '', skin_color: p.skin_color || '',
      hobby: p.hobby || '', characteristics: p.characteristics || '',
      universities: p.universities || '', religion: p.religion || '',
      marriage_status: p.marriage_status || '', children_status: p.children_status || '',
      skills: p.skills || '', achievements: p.achievements || '',
      availability_status: p.availability_status || 'available',
      employment_status: p.employment_status || 'not_employed',
      activity_notes: p.activity_notes || '', working_project_name: p.working_project_name || '',
      working_history: p.working_history || '', main_skill_list: p.main_skill_list || '',
      met_place: p.met_place || '', notes: p.notes || '',
      overview: p.overview || '', languages: p.languages || '',
      profile_titles_json: JSON.stringify(parseTextItems(p.profile_titles_json)),
      profile_overviews_json: JSON.stringify(parseTextItems(p.profile_overviews_json)),
      profile_skills_json: JSON.stringify(parseTextItems(p.profile_skills_json)),
      profile_achievements_json: JSON.stringify(parseTextItems(p.profile_achievements_json)),
      profile_blocks_json: JSON.stringify(parseProfileBlocks(p.profile_blocks_json)),
      hourly_rate_main: p.hourly_rate_main?.toString() || '',
      hourly_rate_discussed: p.hourly_rate_discussed?.toString() || '',
      expected_monthly_salary: p.expected_monthly_salary?.toString() || '',
      preferred_payments: p.preferred_payments ? p.preferred_payments.split(',') : [],
      working_type: p.working_type || 'individual',
      good_fit: p.good_fit || false,
      birthday: p.birthday ? (p.birthday.includes('T') ? p.birthday.slice(0, 10) : p.birthday) : '',
      identity_documents: normalizeIdentityDocuments(p.identity_documents ?? null),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: 'First name and last name are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const parseFormTextItems = (raw: string): string[] => {
      try {
        const arr = JSON.parse(raw || '[]');
        if (!Array.isArray(arr)) return [];
        return arr.map((x) => String(x || '').trim()).filter(Boolean);
      } catch {
        return [];
      }
    };
    const profileTitles = parseFormTextItems(form.profile_titles_json as string);
    const profileOverviews = parseFormTextItems(form.profile_overviews_json as string);
    const profileSkills = parseFormTextItems(form.profile_skills_json as string);
    const profileAchievements = parseFormTextItems(form.profile_achievements_json as string);
    const profileBlocks = (() => {
      try {
        return parseProfileBlocks(JSON.parse((form.profile_blocks_json as string) || '[]'));
      } catch {
        return [] as ProfileBlock[];
      }
    })();
    const roleIsForJob = form.role === 'developer_for_job';
    const payload = {
      role: form.role, title: (roleIsForJob ? (profileBlocks[0]?.title || profileTitles[0] || form.title) : form.title) || null, first_name: form.first_name,
      middle_name: form.middle_name || null, last_name: form.last_name,
      sex: form.sex || null, profile_photo_url: form.profile_photo_url || null,
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
      skills: (roleIsForJob ? (profileBlocks.flatMap((b) => b.skills).join(', ') || profileSkills.join(', ') || form.skills) : form.skills) || null,
      achievements: (roleIsForJob ? (profileBlocks.flatMap((b) => b.achievements).join('\n') || profileAchievements.join('\n') || form.achievements) : form.achievements) || null,
      availability_status: form.availability_status,
      employment_status: form.employment_status,
      activity_notes: form.activity_notes || null,
      working_project_name: form.working_project_name || null,
      working_history: (roleIsForJob ? (() => {
        const joined = profileBlocks.flatMap((b) => b.experience);
        return joined.length ? JSON.stringify(joined) : form.working_history;
      })() : form.working_history) || null,
      main_skill_list: form.main_skill_list || null,
      met_place: form.met_place || null, notes: form.notes || null,
      overview: (roleIsForJob ? (profileBlocks[0]?.overview || profileOverviews[0] || form.overview) : form.overview) || null, languages: form.languages || null,
      profile_titles_json: profileTitles,
      profile_overviews_json: profileOverviews,
      profile_skills_json: profileSkills,
      profile_achievements_json: profileAchievements,
      profile_blocks_json: profileBlocks,
      hourly_rate_main: form.hourly_rate_main ? parseFloat(form.hourly_rate_main) : null,
      hourly_rate_discussed: form.hourly_rate_discussed ? parseFloat(form.hourly_rate_discussed) : null,
      expected_monthly_salary: form.expected_monthly_salary ? parseFloat(form.expected_monthly_salary) : null,
      preferred_payments: (form.preferred_payments as string[]).length > 0 ? (form.preferred_payments as string[]).join(',') : null,
      working_type: form.working_type || null,
      good_fit: form.good_fit,
      birthday: form.birthday?.trim() ? form.birthday.trim() : null,
      identity_documents: identityDocumentsForDb(form.identity_documents as IdentityDocuments),
      user_id: user!.id, updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('personnel').update(payload).eq('id', editingId);
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Person updated' });
    } else {
      const { error } = await supabase.from('personnel').insert(payload);
      if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Person added' });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchPeople();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('personnel').delete().eq('id', id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Person deleted' }); fetchPeople(); }
  };

  const confirmDelete = (id: string, name: string) => setDeleteConfirm({ id, name });
  const executeDelete = async () => {
    if (!deleteConfirm) return;
    await handleDelete(deleteConfirm.id);
    setDeleteConfirm(null);
    if (view === 'detail') goToList(selectedRole!);
  };

  const set = (key: string, value: string | boolean | number | string[] | IdentityDocuments) => setForm(prev => ({ ...prev, [key]: value }));

  const searchFiltered = useMemo(
    () => filterItemsBySearch(people, searchInput, PERSONNEL_SEARCH_COLUMNS),
    [people, searchInput],
  );

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const grouped = searchFiltered.reduce<Record<string, Personnel[]>>((acc, p) => {
    if (!acc[p.role]) acc[p.role] = [];
    acc[p.role].push(p);
    return acc;
  }, {});

  const roleList = ROLES.map(r => ({
    ...r,
    count: (grouped[r.value] || []).length,
    availableCount: (grouped[r.value] || []).filter(p => p.availability_status === 'available').length,
  }));

  const filteredPeople = selectedRole ? grouped[selectedRole] || [] : [];
  const selectedPerson = selectedId ? people.find(p => p.id === selectedId) : null;
  const roleLabel = selectedRole ? (ROLES_MAP[selectedRole]?.label || selectedRole) : '';

  const goToRoles = () => { setView('roles'); setSelectedRole(null); setSelectedId(null); };
  const goToList = (role: string) => { setView('list'); setSelectedRole(role); setSelectedId(null); };
  const goToDetail = (id: string) => { setView('detail'); setSelectedId(id); };

  const DefaultAvatar = ({ name, sex }: { name: string; sex?: string | null }) => (
    <div className={cn("h-16 w-16 rounded-full flex items-center justify-center border", sex === 'female' ? 'bg-pink-100' : sex === 'male' ? 'bg-blue-100' : 'bg-muted')}>
      <span className={cn("text-xl font-bold", sex === 'female' ? 'text-pink-500' : sex === 'male' ? 'text-blue-500' : 'text-muted-foreground')}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );

  const SmallDefaultAvatar = ({ name, sex }: { name: string; sex?: string | null }) => (
    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center border shrink-0", sex === 'female' ? 'bg-pink-100' : sex === 'male' ? 'bg-blue-100' : 'bg-muted')}>
      <span className={cn("text-sm font-bold", sex === 'female' ? 'text-pink-500' : sex === 'male' ? 'text-blue-500' : 'text-muted-foreground')}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );

  const parseUniversities = (val: string | null): UniEntry[] => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  };

  // parse languages
  const parseLanguages = (val: string | null): LangEntry[] => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  };

  // ---- Detail View ----
  const renderDetail = () => {
    if (!selectedPerson) return null;
    const p = selectedPerson;
    const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
    const langs = parseLanguages(p.languages);
    const profileTitles = parseTextItems(p.profile_titles_json);
    const profileOverviews = parseTextItems(p.profile_overviews_json);
    const profileSkills = parseTextItems(p.profile_skills_json);
    const profileAchievements = parseTextItems(p.profile_achievements_json);
    const profileBlocks = parseProfileBlocks(p.profile_blocks_json);
    const isDeveloperForJob = p.role === 'developer_for_job';

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {p.profile_photo_url ? <img src={p.profile_photo_url} alt={fullName} className="h-16 w-16 rounded-full object-cover border" /> : <DefaultAvatar name={p.first_name} sex={p.sex} />}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-foreground">{fullName}</h2>
                {p.good_fit && <span title="Good Fit"><ThumbsUp className="h-5 w-5 text-emerald-500" /></span>}
              </div>
            {isDeveloperForJob ? (
              profileBlocks.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {profileBlocks.map((b, i) => (
                    <Badge key={`${b.title}-${i}`} variant="outline">{b.title || `Profile ${i + 1}`}</Badge>
                  ))}
                </div>
              ) : profileTitles.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {profileTitles.map((t, i) => (
                    <Badge key={`${t}-${i}`} variant="outline">{t}</Badge>
                  ))}
                </div>
              ) : p.title ? <p className="text-lg text-muted-foreground">{p.title}</p> : null
            ) : (
              p.title ? <p className="text-lg text-muted-foreground">{p.title}</p> : null
            )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary">{ROLES_MAP[p.role]?.label || p.role}</Badge>
                <Badge variant="secondary" className={availColor[p.availability_status || ''] || ''}>{p.availability_status || 'N/A'}</Badge>
                <Badge variant="outline">{EMPLOYMENT.find(e => e.value === p.employment_status)?.label || p.employment_status}</Badge>
                {p.working_type && <Badge variant="outline"><Building className="h-3 w-3 mr-1" />{p.working_type === 'agency' ? 'Agency' : 'Individual'}</Badge>}
                {p.timezone && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />{p.timezone}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(p)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            <Button size="sm" variant="outline" onClick={() => confirmDelete(p.id, fullName)} className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" />Delete</Button>
          </div>
        </div>

        {isDeveloperForJob ? (
          profileBlocks.length > 0 ? (
            <div className="space-y-2">
              {profileBlocks.map((b, i) => (
                <div key={`ov-${i}`} className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b.title || `Profile ${i + 1}`}</p>
                  {b.overview ? <p className="text-sm text-foreground/80 whitespace-pre-line">{b.overview}</p> : null}
                </div>
              ))}
            </div>
          ) : profileOverviews.length > 0 ? (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {profileOverviews.map((o, i) => (
                <p key={`${o}-${i}`} className="text-sm text-foreground/80 whitespace-pre-line">- {o}</p>
              ))}
            </div>
          ) : p.overview ? <div className="bg-muted/50 rounded-lg p-4"><p className="text-sm text-foreground/80 whitespace-pre-line">{p.overview}</p></div> : null
        ) : (
          p.overview ? <div className="bg-muted/50 rounded-lg p-4"><p className="text-sm text-foreground/80 whitespace-pre-line">{p.overview}</p></div> : null
        )}

        <Separator />

        {p.main_skill_list && <DetailSection icon={Star} title="Main Skills"><div className="flex flex-wrap gap-2">{p.main_skill_list.split(',').map((s, i) => <Badge key={i} variant="outline" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection>}

        {(p.hourly_rate_main || p.hourly_rate_discussed || p.expected_monthly_salary || p.preferred_payments) && (
          <DetailSection icon={DollarSign} title="Rates & Salary">
            <InfoRow label="Main Hourly Rate" value={p.hourly_rate_main ? `$${p.hourly_rate_main}/hr` : null} />
            <InfoRow label="Discussed Hourly Rate" value={p.hourly_rate_discussed ? `$${p.hourly_rate_discussed}/hr` : null} />
            <InfoRow label="Expected Monthly Salary" value={p.expected_monthly_salary ? `$${p.expected_monthly_salary}` : null} />
            {p.preferred_payments && <div className="space-y-1"><span className="text-sm text-muted-foreground">Preferred Payments</span><div className="flex flex-wrap gap-1.5">{p.preferred_payments.split(',').map((pm, i) => <Badge key={i} variant="secondary">{pm.trim()}</Badge>)}</div></div>}
          </DetailSection>
        )}

        {langs.length > 0 && (
          <DetailSection icon={Languages} title="Languages">
            <div className="flex flex-wrap gap-2">{langs.map((l, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{l.language}: {l.level}</Badge>)}</div>
          </DetailSection>
        )}

        <DetailSection icon={MapPin} title="Location">
          <InfoRow label="Country" value={p.country} />
          <InfoRow label="Address" value={p.address} />
          <InfoRow label="Timezone" value={p.timezone} />
        </DetailSection>

        <DetailSection icon={Phone} title="Communication">
          <InfoRow label="Phone" value={p.phone_number} copyable />
          <InfoRow label="Email" value={p.email} copyable />
          <InfoRow label="Telegram" value={p.telegram} copyable />
          <InfoRow label="WhatsApp" value={p.whatsapp} copyable />
          <InfoRow label="Teams" value={p.teams} copyable />
          <InfoRow label="Discord" value={p.discord_id} copyable />
          <InfoRow label="Other" value={p.other_communication} />
        </DetailSection>

        <DetailSection icon={ExternalLink} title="Links">
          <div className="flex flex-wrap gap-4">
            {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><Linkedin className="h-4 w-4" />LinkedIn</a>}
            {p.github_url && <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Github className="h-4 w-4" />GitHub</a>}
            {p.upwork_url && <a href={p.upwork_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Upwork</a>}
            {p.freelancer_url && <a href={p.freelancer_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Freelancer</a>}
            {p.fiverr_url && <a href={p.fiverr_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Fiverr</a>}
            {p.guru_url && <a href={p.guru_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Guru</a>}
            {p.personal_site_url && <a href={p.personal_site_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Website</a>}
            {p.portfolio_url && <a href={p.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Portfolio</a>}
            {p.instagram_url && <a href={p.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Instagram</a>}
            {p.other_link && <a href={p.other_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Other</a>}
          </div>
        </DetailSection>

        {p.resume_cv_url && (
          <DetailSection icon={Briefcase} title="Resume/CV">
            <a href={p.resume_cv_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">View Resume</a>
          </DetailSection>
        )}

        <DetailSection icon={User} title="Personal Details">
          <InfoRow label="Birthday" value={formatBirthday(p.birthday)} />
          <InfoRow label="Weight" value={p.weight} />
          <InfoRow label="Height" value={p.height} />
          <InfoRow label="Skin Color" value={p.skin_color} />
          <InfoRow label="Hobby" value={p.hobby} />
          <InfoRow label="Characteristics" value={p.characteristics} />
        </DetailSection>

        {Object.keys(normalizeIdentityDocuments(p.identity_documents)).length > 0 && (
          <DetailSection icon={Images} title="Identity documents">
            <IdentityDocumentsGallery documents={p.identity_documents} />
          </DetailSection>
        )}

        <DetailSection icon={GraduationCap} title="Education & Background">
          {(() => { const unis = parseUniversities(p.universities); return unis.length > 0 ? unis.map((u, i) => (
            <div key={i} className="mb-2 p-2 bg-muted/30 rounded">
              <p className="text-sm font-medium">{u.name}</p>
              {u.course && <p className="text-xs text-muted-foreground">{u.course}</p>}
              {(u.start_date || u.end_date) && <p className="text-xs text-muted-foreground">{u.start_date} – {u.end_date || 'Present'}</p>}
            </div>
          )) : null; })()}
          <InfoRow label="Religion" value={p.religion} />
          <InfoRow label="Sex" value={p.sex ? SEX_OPTIONS.find(s => s.value === p.sex)?.label || p.sex : null} />
        </DetailSection>

        <DetailSection icon={Heart} title="Family">
          <InfoRow label="Marriage Status" value={MARRIAGE.find(m => m.value === p.marriage_status)?.label || p.marriage_status} />
          <InfoRow label="Children" value={p.children_status} />
        </DetailSection>

        {isDeveloperForJob ? (
          profileBlocks.length > 0 ? (
            <DetailSection icon={Star} title="Skills">
              <div className="space-y-2">
                {profileBlocks.map((b, i) => (
                  <div key={`sk-${i}`} className="rounded border bg-muted/20 p-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{b.title || `Profile ${i + 1}`}</p>
                    <div className="flex flex-wrap gap-2">
                      {b.skills.map((s, j) => <Badge key={`${s}-${j}`} variant="secondary" className="text-sm font-normal">{s}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
          ) : profileSkills.length > 0 ? (
            <DetailSection icon={Star} title="Skills">
              <div className="flex flex-wrap gap-2">{profileSkills.map((s, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{s}</Badge>)}</div>
            </DetailSection>
          ) : null
        ) : (
          p.skills ? <DetailSection icon={Star} title="Skills"><div className="flex flex-wrap gap-2">{p.skills.split(',').map((s, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection> : null
        )}
        {isDeveloperForJob ? (
          profileBlocks.length > 0 ? (
            <DetailSection icon={Star} title="Achievements">
              <div className="space-y-2">
                {profileBlocks.map((b, i) => (
                  <div key={`ac-${i}`} className="rounded border bg-muted/20 p-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{b.title || `Profile ${i + 1}`}</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
                      {b.achievements.map((a, j) => <li key={`${a}-${j}`}>{a}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </DetailSection>
          ) : profileAchievements.length > 0 ? (
            <DetailSection icon={Star} title="Achievements">
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
                {profileAchievements.map((a, i) => <li key={`${a}-${i}`}>{a}</li>)}
              </ul>
            </DetailSection>
          ) : null
        ) : (
          p.achievements ? <DetailSection icon={Star} title="Achievements"><div className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: p.achievements }} /></DetailSection> : null
        )}

        <Separator />

        <DetailSection icon={Briefcase} title="Work">
          <InfoRow label="Working Project" value={p.working_project_name} />
          <InfoRow label="Met Place" value={MET_PLACES.find(m => m.value === p.met_place)?.label || p.met_place} />
          {p.working_history ? (
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Working History</p>
              {(() => {
                if (isDeveloperForJob && profileBlocks.length > 0) {
                  return (
                    <div className="space-y-2">
                      {profileBlocks.map((b, i) => (
                        <div key={`exb-${i}`} className="rounded border bg-muted/20 p-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">{b.title || `Profile ${i + 1}`}</p>
                          <div className="space-y-2">
                            {b.experience.map((w, j) => (
                              <div key={`${w.title}-${j}`} className="rounded border bg-background p-2">
                                <p className="text-sm font-medium">{w.title || 'Untitled role'}</p>
                                {(w.start_date || w.end_date) ? <p className="text-xs text-muted-foreground">{w.start_date || 'Unknown'} - {w.end_date || 'Present'}</p> : null}
                                {w.overview ? <p className="mt-1 text-sm text-foreground/80 whitespace-pre-line">{w.overview}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                const rows = parseWorkHistoryEntries(p.working_history || '');
                if (rows.length === 0) {
                  return (
                    <div
                      className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5"
                      dangerouslySetInnerHTML={{ __html: p.working_history || '' }}
                    />
                  );
                }
                return (
                  <div className="space-y-2">
                    {rows.map((w, i) => (
                      <div key={`${w.title}-${i}`} className="rounded border bg-muted/20 p-2">
                        <p className="text-sm font-medium">{w.title || 'Untitled role'}</p>
                        {(w.start_date || w.end_date) ? (
                          <p className="text-xs text-muted-foreground">
                            {w.start_date || 'Unknown'} - {w.end_date || 'Present'}
                          </p>
                        ) : null}
                        {w.overview ? <p className="mt-1 text-sm text-foreground/80 whitespace-pre-line">{w.overview}</p> : null}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : null}
          {p.activity_notes && <div className="mt-2"><p className="text-xs font-semibold text-muted-foreground mb-1">Activity Notes</p><p className="text-sm text-foreground/80 whitespace-pre-line">{p.activity_notes}</p></div>}
        </DetailSection>

        {p.notes && (<><Separator /><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p><p className="text-sm text-foreground/80 whitespace-pre-line">{p.notes}</p></div></>)}
      </div>
    );
  };

  // ---- Form Dialog ----
  const FormDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{editingId ? 'Edit Person' : 'Add Person'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <div className="px-6 pb-6">
            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="communication">Comm</TabsTrigger>
                <TabsTrigger value="links">Links</TabsTrigger>
                <TabsTrigger value="work">Work & Skills</TabsTrigger>
                <TabsTrigger value="rates">Rates</TabsTrigger>
              </TabsList>

              {/* Basic */}
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Middle Name</Label><Input value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Last Name *</Label><Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Senior Developer, Project Manager" />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => set('role', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      <strong>Developer For Job</strong>: interview/catching pipeline. <strong>Developer</strong>: implementation and task delivery.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sex</Label>
                    <Select value={form.sex} onValueChange={(v) => set('sex', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{SEX_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {form.role === 'developer_for_job' ? (
                  <div className="space-y-2">
                    <Label>Profile Tabs (repeatable)</Label>
                    <ProfileBlocksEditor value={form.profile_blocks_json as string} onChange={(v) => set('profile_blocks_json', v)} />
                  </div>
                ) : (
                  <div className="space-y-2"><Label>Overview</Label><Textarea value={form.overview} onChange={(e) => set('overview', e.target.value)} rows={3} placeholder="Brief overview of this person..." /></div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Met Place</Label>
                    <Select value={form.met_place} onValueChange={(v) => set('met_place', v)}>
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
                <div className="space-y-2">
                  <Label>Profile Photo</Label>
                  <FileUpload value={form.profile_photo_url} onChange={(url) => set('profile_photo_url', url)} folder="personnel-photos" label="Upload Photo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e) => set('country', e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={form.timezone} onValueChange={(v) => set('timezone', v)}>
                      <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                      <SelectContent>{TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
              </TabsContent>

              {/* Personal */}
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
                  <div className="space-y-2"><Label>Children Status</Label><Input value={form.children_status} onChange={(e) => set('children_status', e.target.value)} placeholder="e.g. 2 sons, 1 daughter" /></div>
                </div>
                <LanguageEditor value={form.languages} onChange={(v) => set('languages', v)} />
                <IdentityDocumentsEditor
                  value={form.identity_documents as IdentityDocuments}
                  onChange={(next) => set('identity_documents', next)}
                  folder="personnel-identity"
                />
              </TabsContent>

              {/* Communication */}
              <TabsContent value="communication" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Phone Number</Label><PhoneInput value={form.phone_number} onChange={(v) => set('phone_number', v)} /></div>
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
                <div className="space-y-2"><Label>Other Communication</Label><Input value={form.other_communication} onChange={(e) => set('other_communication', e.target.value)} /></div>
              </TabsContent>

              {/* Links */}
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
                <div className="space-y-2">
                  <Label>Resume / CV URL</Label>
                  <Input value={form.resume_cv_url} onChange={(e) => set('resume_cv_url', e.target.value)} placeholder="https://drive.google.com/..." />
                </div>
                <CloudGoogleDriveUpload
                  title="Upload Resume / CV to Google Drive"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onUrlAdded={(url) => set('resume_cv_url', url)}
                />
              </TabsContent>

              {/* Work & Skills */}
              <TabsContent value="work" className="space-y-4 pt-4">
                {form.role === 'developer_for_job' ? (
                  <p className="text-xs text-muted-foreground">
                    Skills, achievements, and experience are managed inside <strong>Profile Tabs</strong> in Basic tab.
                  </p>
                ) : (
                  <>
                    <SkillMultiSelect value={form.skills} onChange={(v) => set('skills', v)} label="Skills" />
                    <SkillMultiSelect value={form.main_skill_list} onChange={(v) => set('main_skill_list', v)} label="Main Skill List (for developers)" />
                    <div className="space-y-2">
                      <Label>Achievements</Label>
                      <RichTextEditor value={form.achievements} onChange={(val) => set('achievements', val)} placeholder="Add achievements, certifications, awards..." />
                    </div>
                  </>
                )}

                <div className="space-y-2"><Label>Working Project Name</Label><Input value={form.working_project_name} onChange={(e) => set('working_project_name', e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Working History (LinkedIn/Upwork style)</Label>
                  <WorkHistoryEditor value={form.working_history} onChange={(val) => set('working_history', val)} />
                </div>
                <div className="space-y-2"><Label>Activity Notes</Label><Textarea value={form.activity_notes} onChange={(e) => set('activity_notes', e.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} /></div>
              </TabsContent>

              {/* Rates */}
              <TabsContent value="rates" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Main Hourly Rate ($)</Label><Input type="number" value={form.hourly_rate_main} onChange={(e) => set('hourly_rate_main', e.target.value)} placeholder="e.g. 25" /></div>
                  <div className="space-y-2"><Label>Discussed Hourly Rate ($)</Label><Input type="number" value={form.hourly_rate_discussed} onChange={(e) => set('hourly_rate_discussed', e.target.value)} placeholder="e.g. 20" /></div>
                </div>
                <div className="space-y-2"><Label>Expected Monthly Salary ($)</Label><Input type="number" value={form.expected_monthly_salary} onChange={(e) => set('expected_monthly_salary', e.target.value)} placeholder="e.g. 3000" /></div>
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
              {saving ? 'Saving...' : editingId ? 'Update Person' : 'Add Person'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  // Delete Confirmation
  const DeleteDialog = (
    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Personnel</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-1 sm:justify-between lg:justify-start lg:gap-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Manage Personnel</h2>
            <p className="text-sm text-muted-foreground">Callers, developers, brokers, recruiters, and friends</p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, country, skills…"
              className="pl-9 pr-9"
              aria-label="Search personnel"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <Button onClick={() => openCreate(selectedRole || undefined)} className="gap-2 shrink-0"><Plus className="h-4 w-4" />Add Person</Button>
      </div>

      {/* Breadcrumb */}
      {view !== 'roles' && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goToRoles} className="text-primary hover:underline font-medium">All Roles</button>
          {selectedRole && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {view === 'detail' ? (
                <button onClick={() => goToList(selectedRole)} className="text-primary hover:underline font-medium">{roleLabel}</button>
              ) : (
                <span className="text-foreground font-medium">{roleLabel}</span>
              )}
            </>
          )}
          {view === 'detail' && selectedPerson && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{selectedPerson.first_name} {selectedPerson.last_name}</span>
            </>
          )}
        </div>
      )}

      {/* Role Cards */}
      {view === 'roles' && (
        people.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center"><p className="text-lg font-medium">No personnel yet</p><p className="mt-1 text-sm text-muted-foreground">Add your first team member.</p><Button onClick={() => openCreate()} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" />Add Person</Button></CardContent></Card>
        ) : searchFiltered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center"><p className="text-lg font-medium">No matching personnel</p><p className="mt-1 text-sm text-muted-foreground">Try different keywords or clear the search.</p></CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {roleList.filter(r => r.count > 0).map(r => (
              <Card key={r.value} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group" onClick={() => goToList(r.value)}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-lg text-white', r.color)}>{r.icon}</div>
                    <CardTitle className="text-lg">{r.label}s</CardTitle>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{r.count}</p>
                  <p className="text-sm text-muted-foreground">{r.availableCount} available</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Person List */}
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
          {filteredPeople.length === 0 ? (
            <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">{searchInput.trim() ? `No ${roleLabel}s match your search` : `No ${roleLabel}s yet`}</p></CardContent></Card>
          ) : listViewMode === 'card' ? filteredPeople.map(p => {
            const mainSkills = p.main_skill_list ? p.main_skill_list.split(',').slice(0, 3).map(s => s.trim()) : [];
            return (
              <Card key={p.id} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => goToDetail(p.id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {p.profile_photo_url ? <img src={p.profile_photo_url} alt="" className="h-10 w-10 rounded-full object-cover border" /> : <SmallDefaultAvatar name={p.first_name} sex={p.sex} />}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{p.first_name} {p.last_name}</p>
                        {p.good_fit && <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {p.title && <span>{p.title}</span>}
                        {p.country && <><span>·</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.country}</span></>}
                        {p.timezone && <><span>·</span><span className="flex items-center gap-1"><Globe className="h-3 w-3" />{p.timezone}</span></>}
                      </div>
                      {mainSkills.length > 0 && <div className="flex gap-1 mt-1">{mainSkills.map((s, i) => <Badge key={i} variant="outline" className="text-xs py-0">{s}</Badge>)}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={availColor[p.availability_status || ''] || ''}>{p.availability_status}</Badge>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(p); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); confirmDelete(p.id, `${p.first_name} ${p.last_name}`); }} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          }) : listViewMode === 'line' ? (
            <Card><CardContent className="p-0">
              {filteredPeople.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-t px-3 py-2 first:border-t-0">
                  <button type="button" onClick={() => goToDetail(p.id)} className="text-left">
                    <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.title || 'N/A'}{p.country ? ` · ${p.country}` : ''}</p>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirmDelete(p.id, `${p.first_name} ${p.last_name}`)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent></Card>
          ) : listViewMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
                </thead>
                <tbody>
                  {filteredPeople.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 cursor-pointer font-medium" onClick={() => goToDetail(p.id)}>{p.first_name} {p.last_name}</td>
                      <td className="px-3 py-2">{p.title || '-'}</td>
                      <td className="px-3 py-2">{p.country || '-'}</td>
                      <td className="px-3 py-2">{p.availability_status || '-'}</td>
                      <td className="px-3 py-2 text-right"><Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPeople.map((p) => (
                <Card key={p.id} className="hover:border-primary/40">
                  <CardContent className="space-y-2 p-4">
                    <button type="button" onClick={() => goToDetail(p.id)} className="w-full text-left">
                      <p className="font-medium">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-muted-foreground">{p.title || 'N/A'}</p>
                    </button>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className={availColor[p.availability_status || ''] || ''}>{p.availability_status || 'N/A'}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail View */}
      {view === 'detail' && renderDetail()}
    </div>
  );
}
