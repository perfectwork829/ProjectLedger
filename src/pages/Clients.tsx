import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ExternalLink, Github, Linkedin, Mail, Phone, User, MapPin,
  Heart, Briefcase, Star, GraduationCap, ChevronRight, Copy,
  ThumbsUp, Globe, DollarSign, Building, Languages, Images,
} from 'lucide-react';
import { IdentityDocumentsGallery } from '@/components/IdentityDocumentsFields';
import { formatBirthday, normalizeIdentityDocuments } from '@/lib/identityDocuments';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { CLIENT_SEARCH_COLUMNS } from '@/lib/supabaseSearch';
import { filterItemsBySearch } from '@/lib/clientSearch';

interface ClientItem {
  id: string;
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
  working_type: string | null;
  good_fit: boolean | null;
  budget: string | null;
  payment_terms: string | null;
  project_history: string | null;
  client_source: string | null;
  client_status: string | null;
  birthday: string | null;
  identity_documents: unknown | null;
}

const SEX_OPTIONS: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other' };
interface UniEntry { name: string; course: string; start_date: string; end_date: string }

const parseUniversities = (val: string | null): UniEntry[] => {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
};

const CLIENT_TYPES = [
  { value: 'individual', label: 'Individual', icon: '👤', color: 'bg-blue-500' },
  { value: 'company', label: 'Company', icon: '🏢', color: 'bg-emerald-500' },
  { value: 'agency', label: 'Agency', icon: '🏗️', color: 'bg-amber-500' },
  { value: 'startup', label: 'Startup', icon: '🚀', color: 'bg-violet-500' },
];

const CLIENT_TYPES_MAP: Record<string, typeof CLIENT_TYPES[0]> = Object.fromEntries(CLIENT_TYPES.map(t => [t.value, t]));
const MARRIAGE: Record<string, string> = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widowed' };
const MET_PLACES: Record<string, string> = { skype: 'Skype', discord: 'Discord', email: 'Email', linkedin: 'LinkedIn', fiverr: 'Fiverr', freelancer: 'Freelancer', upwork: 'Upwork', telegram: 'Telegram', whatsapp: 'WhatsApp', referral: 'Referral', website: 'Website', other: 'Other' };
const EMPLOYMENT: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', not_employed: 'Not Employed' };

const availColor: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  busy: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusColor: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  prospect: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

type View = 'types' | 'list' | 'detail';
interface LangEntry { language: string; level: string }

function CopyButton({ value }: { value: string }) {
  const { toast } = useToast();
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); toast({ title: 'Copied!', description: value }); }}
      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent transition-colors" title="Copy">
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

export default function Clients() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('types');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [listViewMode, setListViewMode] = useState<'card' | 'list' | 'line' | 'table'>('card');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else setClients(data || []);
      setLoading(false);
    })();
  }, []);

  const searchFilteredClients = useMemo(
    () => filterItemsBySearch(clients, searchInput, CLIENT_SEARCH_COLUMNS),
    [clients, searchInput],
  );

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const grouped = searchFilteredClients.reduce<Record<string, ClientItem[]>>((acc, c) => { if (!acc[c.client_type]) acc[c.client_type] = []; acc[c.client_type].push(c); return acc; }, {});
  const typeList = CLIENT_TYPES.map(t => ({ ...t, count: (grouped[t.value] || []).length, activeCount: (grouped[t.value] || []).filter(c => c.client_status === 'active').length }));
  const filteredClients = selectedType ? grouped[selectedType] || [] : [];
  const selectedClient = selectedId ? clients.find(c => c.id === selectedId) : null;
  const typeLabel = selectedType ? (CLIENT_TYPES_MAP[selectedType]?.label || selectedType) : '';

  const goToTypes = () => { setView('types'); setSelectedType(null); setSelectedId(null); };
  const goToList = (type: string) => { setView('list'); setSelectedType(type); setSelectedId(null); };
  const goToDetail = (id: string) => { setView('detail'); setSelectedId(id); };

  const parseLanguages = (val: string | null): LangEntry[] => {
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
              <Badge variant="outline">{EMPLOYMENT[c.employment_status || ''] || c.employment_status}</Badge>
              {c.working_type && <Badge variant="outline"><Building className="h-3 w-3 mr-1" />{c.working_type === 'agency' ? 'Agency' : 'Individual'}</Badge>}
              {c.timezone && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />{c.timezone}</Badge>}
            </div>
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

        {c.main_skill_list && <DetailSection icon={Star} title="Main Skills"><div className="flex flex-wrap gap-2">{c.main_skill_list.split(',').map((s, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection>}

        {(c.hourly_rate_main || c.hourly_rate_discussed || c.expected_monthly_salary) && (
          <DetailSection icon={DollarSign} title="Rates & Salary">
            <InfoRow label="Main Hourly Rate" value={c.hourly_rate_main ? `$${c.hourly_rate_main}/hr` : null} />
            <InfoRow label="Discussed Hourly Rate" value={c.hourly_rate_discussed ? `$${c.hourly_rate_discussed}/hr` : null} />
            <InfoRow label="Expected Monthly Salary" value={c.expected_monthly_salary ? `$${c.expected_monthly_salary}` : null} />
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

        {c.resume_cv_url && <DetailSection icon={Briefcase} title="Resume/CV"><a href={c.resume_cv_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">View Document</a></DetailSection>}

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
          <InfoRow label="Sex" value={c.sex ? SEX_OPTIONS[c.sex] || c.sex : null} />
        </DetailSection>

        <DetailSection icon={Heart} title="Family">
          <InfoRow label="Marriage" value={MARRIAGE[c.marriage_status || ''] || c.marriage_status} />
          <InfoRow label="Children" value={c.children_status} />
        </DetailSection>

        {c.skills && <DetailSection icon={Star} title="Skills"><div className="flex flex-wrap gap-2">{c.skills.split(',').map((s, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection>}
        {c.achievements && <DetailSection icon={Star} title="Achievements"><div className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: c.achievements }} /></DetailSection>}
        {c.project_history && <DetailSection icon={Briefcase} title="Project History"><div className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: c.project_history }} /></DetailSection>}

        <Separator />

        <DetailSection icon={Briefcase} title="Work">
          <InfoRow label="Working Project" value={c.working_project_name} />
          <InfoRow label="Met Place" value={MET_PLACES[c.met_place || ''] || c.met_place} />
          <InfoRow label="Client Source" value={c.client_source} />
          {c.working_history && <div className="mt-2"><p className="text-xs font-semibold text-muted-foreground mb-1">Working History</p><div className="prose prose-sm max-w-none text-foreground/80 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: c.working_history }} /></div>}
          {c.activity_notes && <div className="mt-2"><p className="text-xs font-semibold text-muted-foreground mb-1">Activity Notes</p><p className="text-sm text-foreground/80 whitespace-pre-line">{c.activity_notes}</p></div>}
        </DetailSection>

        {c.notes && (<><Separator /><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p><p className="text-sm text-foreground/80 whitespace-pre-line">{c.notes}</p></div></>)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Clients</h2>
          <p className="text-sm text-muted-foreground">Browse clients</p>
        </div>
        <ModuleSearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search name, email, company, skills…"
          id="clients-search"
        />
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center">
          <p className="text-lg font-medium text-foreground">No clients</p>
          <p className="mt-1 text-sm text-muted-foreground">Clients are managed by admins</p>
        </div>
      ) : searchFilteredClients.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center">
          <p className="text-lg font-medium text-foreground">No matching clients</p>
          <p className="mt-1 text-sm text-muted-foreground">Try different keywords or clear the search.</p>
        </div>
      ) : (
        <>
      {view !== 'types' && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goToTypes} className="text-primary hover:underline font-medium">All Types</button>
          {selectedType && (<><ChevronRight className="h-4 w-4 text-muted-foreground" />{view === 'detail' ? <button onClick={() => goToList(selectedType)} className="text-primary hover:underline font-medium">{typeLabel}s</button> : <span className="text-foreground font-medium">{typeLabel}s</span>}</>)}
          {view === 'detail' && selectedClient && (<><ChevronRight className="h-4 w-4 text-muted-foreground" /><span className="text-foreground font-medium">{selectedClient.first_name} {selectedClient.last_name}</span></>)}
        </div>
      )}

      {view === 'types' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {typeList.filter(t => t.count > 0).map(t => (
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
            <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">{searchInput.trim() ? `No ${typeLabel} clients match your search` : `No ${typeLabel} clients`}</p></CardContent></Card>
          ) : listViewMode === 'card' ? filteredClients.map(c => {
            const mainSkills = c.main_skill_list ? c.main_skill_list.split(',').slice(0, 3).map(s => s.trim()) : [];
            return (
              <Card key={c.id} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => goToDetail(c.id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {c.profile_photo_url ? <img src={c.profile_photo_url} alt="" className="h-10 w-10 rounded-full object-cover border" /> : <DefaultAvatar name={c.first_name} sex={c.sex} size="sm" />}
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
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          }) : listViewMode === 'line' ? (
            <Card>
              <CardContent className="p-0">
                {filteredClients.map((c) => (
                  <button key={c.id} type="button" onClick={() => goToDetail(c.id)} className="flex w-full items-center justify-between border-t px-3 py-2 text-left first:border-t-0 hover:bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground">{c.company_name || c.title || 'N/A'}</p>
                    </div>
                    <Badge variant="secondary" className={statusColor[c.client_status || ''] || ''}>{c.client_status || 'N/A'}</Badge>
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
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((c) => (
                    <tr key={c.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => goToDetail(c.id)}>
                      <td className="px-3 py-2 font-medium">{c.first_name} {c.last_name}</td>
                      <td className="px-3 py-2">{c.company_name || '-'}</td>
                      <td className="px-3 py-2">{c.country || '-'}</td>
                      <td className="px-3 py-2">{c.client_status || '-'}</td>
                      <td className="px-3 py-2">{c.client_source || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClients.map((c) => (
                <Card key={c.id} className="cursor-pointer hover:border-primary/40" onClick={() => goToDetail(c.id)}>
                  <CardContent className="space-y-2 p-4">
                    <p className="font-medium">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-muted-foreground">{c.company_name || 'No company'}</p>
                    <p className="text-xs text-muted-foreground">{c.country || 'N/A'}</p>
                    <Badge variant="secondary" className={statusColor[c.client_status || ''] || ''}>{c.client_status || 'N/A'}</Badge>
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
