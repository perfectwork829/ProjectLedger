import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ExternalLink, Github, Linkedin, Mail, Phone, User, MapPin,
  Heart, Briefcase, Star, GraduationCap, ChevronRight, Copy,
  ThumbsUp, Globe, DollarSign, Building, Languages, Images, Search, X,
} from 'lucide-react';
import { PERSONNEL_SEARCH_COLUMNS } from '@/lib/supabaseSearch';
import { filterItemsBySearch } from '@/lib/clientSearch';
import { IdentityDocumentsGallery } from '@/components/IdentityDocumentsFields';
import { formatBirthday, normalizeIdentityDocuments } from '@/lib/identityDocuments';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { parseProfileBlocks, type ProfileBlock, type WorkHistoryEntry } from '@/lib/personnelProfileBlocks';

interface PersonnelItem {
  id: string;
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
  working_type: string | null;
  good_fit: boolean | null;
  birthday: string | null;
  identity_documents: unknown | null;
  profile_titles_json?: unknown;
  profile_overviews_json?: unknown;
  profile_skills_json?: unknown;
  profile_achievements_json?: unknown;
  profile_blocks_json?: unknown;
}

const SEX_OPTIONS: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other' };
interface UniEntry { name: string; course: string; start_date: string; end_date: string }

const ROLES = [
  { value: 'caller', label: 'Caller', icon: '📞', color: 'bg-blue-500' },
  { value: 'developer_for_job', label: 'Developer For Job', icon: '🧑‍💼', color: 'bg-cyan-500' },
  { value: 'developer', label: 'Developer', icon: '💻', color: 'bg-emerald-500' },
  { value: 'broker', label: 'Broker', icon: '🤝', color: 'bg-amber-500' },
  { value: 'recruiter', label: 'Recruiter', icon: '🎯', color: 'bg-rose-500' },
  { value: 'friend', label: 'Friend', icon: '👋', color: 'bg-violet-500' },
];

const ROLES_MAP: Record<string, typeof ROLES[0]> = Object.fromEntries(ROLES.map(r => [r.value, r]));
const MARRIAGE: Record<string, string> = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widowed' };
const MET_PLACES: Record<string, string> = { skype: 'Skype', discord: 'Discord', email: 'Email', linkedin: 'LinkedIn', fiverr: 'Fiverr', freelancer: 'Freelancer', upwork: 'Upwork', telegram: 'Telegram', whatsapp: 'WhatsApp', other: 'Other' };
const EMPLOYMENT: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', not_employed: 'Not Employed' };

const availColor: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  busy: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

type View = 'roles' | 'list' | 'detail';

interface LangEntry { language: string; level: string }

const parseUniversities = (val: string | null): UniEntry[] => {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
};
const parseWorkHistoryEntries = (val: string | null): WorkHistoryEntry[] => {
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
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
};
const parseTextItems = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
};
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

function DefaultAvatar({ name, sex, size = 'lg' }: { name: string; sex?: string | null; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm';
  const bg = sex === 'female' ? 'bg-pink-100' : sex === 'male' ? 'bg-blue-100' : 'bg-muted';
  const fg = sex === 'female' ? 'text-pink-500' : sex === 'male' ? 'text-blue-500' : 'text-muted-foreground';
  return (
    <div className={`${cls} rounded-full ${bg} flex items-center justify-center border shrink-0`}>
      <span className={`font-bold ${fg}`}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export default function Personnel() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id')?.trim() ?? '';
  const lastOpenedPersonnelIdParam = useRef<string | null>(null);
  const [people, setPeople] = useState<PersonnelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('roles');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [listViewMode, setListViewMode] = useState<'card' | 'list' | 'line' | 'table'>('card');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('personnel').select('*').order('created_at', { ascending: false });
        if (cancelled) return;
        if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
        else setPeople(data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    if (!selectedId) return;
    if (!people.some((p) => p.id === selectedId)) {
      setSelectedId(null);
      setView(selectedRole ? 'list' : 'roles');
    }
  }, [people, selectedId, selectedRole]);

  /** Open a person from links such as Job interviews → `/dashboard/personnel?id=…`. */
  useEffect(() => {
    if (loading || !people.length) return;
    if (!idParam) {
      lastOpenedPersonnelIdParam.current = null;
      return;
    }
    if (lastOpenedPersonnelIdParam.current === idParam) return;
    const p = people.find((x) => x.id === idParam);
    if (!p) return;
    lastOpenedPersonnelIdParam.current = idParam;
    setSelectedRole(p.role);
    setSelectedId(idParam);
    setView('detail');
  }, [loading, people, idParam]);

  const searchFilteredPeople = useMemo(
    () => filterItemsBySearch(people, searchInput, PERSONNEL_SEARCH_COLUMNS),
    [people, searchInput],
  );

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const grouped = searchFilteredPeople.reduce<Record<string, PersonnelItem[]>>((acc, p) => { if (!acc[p.role]) acc[p.role] = []; acc[p.role].push(p); return acc; }, {});
  const roleList = ROLES.map(r => ({ ...r, count: (grouped[r.value] || []).length, availableCount: (grouped[r.value] || []).filter(p => p.availability_status === 'available').length }));
  const filteredPeople = selectedRole ? grouped[selectedRole] || [] : [];
  const selectedPerson = selectedId ? people.find(p => p.id === selectedId) : null;
  const roleLabel = selectedRole ? (ROLES_MAP[selectedRole]?.label || selectedRole) : '';

  const goToRoles = () => { setView('roles'); setSelectedRole(null); setSelectedId(null); };
  const goToList = (role: string) => { setView('list'); setSelectedRole(role); setSelectedId(null); };
  const goToDetail = (id: string) => { setView('detail'); setSelectedId(id); };

  const parseLanguages = (val: string | null): LangEntry[] => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  };

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
              <Badge variant="outline">{EMPLOYMENT[p.employment_status || ''] || p.employment_status}</Badge>
              {p.working_type && <Badge variant="outline"><Building className="h-3 w-3 mr-1" />{p.working_type === 'agency' ? 'Agency' : 'Individual'}</Badge>}
              {p.timezone && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />{p.timezone}</Badge>}
            </div>
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

        {p.main_skill_list && <DetailSection icon={Star} title="Main Skills"><div className="flex flex-wrap gap-2">{p.main_skill_list.split(',').map((s, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection>}

        {(p.hourly_rate_main || p.hourly_rate_discussed || p.expected_monthly_salary) && (
          <DetailSection icon={DollarSign} title="Rates & Salary">
            <InfoRow label="Main Hourly Rate" value={p.hourly_rate_main ? `$${p.hourly_rate_main}/hr` : null} />
            <InfoRow label="Discussed Hourly Rate" value={p.hourly_rate_discussed ? `$${p.hourly_rate_discussed}/hr` : null} />
            <InfoRow label="Expected Monthly Salary" value={p.expected_monthly_salary ? `$${p.expected_monthly_salary}` : null} />
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
          </div>
        </DetailSection>

        {p.resume_cv_url && <DetailSection icon={Briefcase} title="Resume/CV"><a href={p.resume_cv_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">View Resume</a></DetailSection>}

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

        <DetailSection icon={GraduationCap} title="Education">
          {(() => { const unis = parseUniversities(p.universities); return unis.length > 0 ? unis.map((u, i) => (
            <div key={i} className="mb-2 p-2 bg-muted/30 rounded">
              <p className="text-sm font-medium">{u.name}</p>
              {u.course && <p className="text-xs text-muted-foreground">{u.course}</p>}
              {(u.start_date || u.end_date) && <p className="text-xs text-muted-foreground">{u.start_date} – {u.end_date || 'Present'}</p>}
            </div>
          )) : null; })()}
          <InfoRow label="Religion" value={p.religion} />
          <InfoRow label="Sex" value={p.sex ? SEX_OPTIONS[p.sex] || p.sex : null} />
        </DetailSection>

        <DetailSection icon={Heart} title="Family">
          <InfoRow label="Marriage" value={MARRIAGE[p.marriage_status || ''] || p.marriage_status} />
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
          <InfoRow label="Met Place" value={MET_PLACES[p.met_place || ''] || p.met_place} />
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
                const rows = parseWorkHistoryEntries(p.working_history);
                if (rows.length === 0) {
                  return (
                    <div
                      className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5"
                      dangerouslySetInnerHTML={{ __html: p.working_history }}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Personnel</h2>
          <p className="text-sm text-muted-foreground">Browse team members</p>
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

      {people.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center">
          <p className="text-lg font-medium text-foreground">No personnel</p>
          <p className="mt-1 text-sm text-muted-foreground">Personnel are managed by admins</p>
        </div>
      ) : searchFilteredPeople.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center">
          <p className="text-lg font-medium text-foreground">No matching personnel</p>
          <p className="mt-1 text-sm text-muted-foreground">Try different keywords or clear the search.</p>
        </div>
      ) : (
        <>
      {view !== 'roles' && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goToRoles} className="text-primary hover:underline font-medium">All Roles</button>
          {selectedRole && (<><ChevronRight className="h-4 w-4 text-muted-foreground" />{view === 'detail' ? <button onClick={() => goToList(selectedRole)} className="text-primary hover:underline font-medium">{roleLabel}s</button> : <span className="text-foreground font-medium">{roleLabel}s</span>}</>)}
          {view === 'detail' && selectedPerson && (<><ChevronRight className="h-4 w-4 text-muted-foreground" /><span className="text-foreground font-medium">{selectedPerson.first_name} {selectedPerson.last_name}</span></>)}
        </div>
      )}

      {view === 'roles' && (
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
          {filteredPeople.length === 0 ? (
            <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">{searchInput.trim() ? `No ${roleLabel}s match your search` : `No ${roleLabel}s`}</p></CardContent></Card>
          ) : listViewMode === 'card' ? filteredPeople.map(p => {
            const mainSkills = p.main_skill_list ? p.main_skill_list.split(',').slice(0, 3).map(s => s.trim()) : [];
            return (
              <Card key={p.id} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => goToDetail(p.id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {p.profile_photo_url ? <img src={p.profile_photo_url} alt="" className="h-10 w-10 rounded-full object-cover border" /> : <DefaultAvatar name={p.first_name} sex={p.sex} size="sm" />}
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
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          }) : listViewMode === 'line' ? (
            <Card>
              <CardContent className="p-0">
                {filteredPeople.map((p) => (
                  <button key={p.id} type="button" onClick={() => goToDetail(p.id)} className="flex w-full items-center justify-between border-t px-3 py-2 text-left first:border-t-0 hover:bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-muted-foreground">{p.title || 'N/A'}{p.country ? ` · ${p.country}` : ''}</p>
                    </div>
                    <Badge variant="secondary" className={availColor[p.availability_status || ''] || ''}>{p.availability_status || 'N/A'}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : listViewMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">Timezone</th>
                    <th className="px-3 py-2">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map((p) => (
                    <tr key={p.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => goToDetail(p.id)}>
                      <td className="px-3 py-2 font-medium">{p.first_name} {p.last_name}</td>
                      <td className="px-3 py-2">{p.title || '-'}</td>
                      <td className="px-3 py-2">{p.country || '-'}</td>
                      <td className="px-3 py-2">{p.timezone || '-'}</td>
                      <td className="px-3 py-2">{p.availability_status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPeople.map((p) => (
                <Card key={p.id} className="cursor-pointer hover:border-primary/40" onClick={() => goToDetail(p.id)}>
                  <CardContent className="space-y-2 p-4">
                    <p className="font-medium">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.title || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{p.country || 'N/A'} · {p.timezone || 'N/A'}</p>
                    <Badge variant="secondary" className={availColor[p.availability_status || ''] || ''}>{p.availability_status || 'N/A'}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'detail' && renderDetail()}
        </>
      )}
    </div>
  );
}
