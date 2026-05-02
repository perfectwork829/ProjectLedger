import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Pencil, Trash2, ExternalLink, Eye, EyeOff, ChevronRight, ArrowLeft,
  Award, Star, Clock, Briefcase, GraduationCap, Trophy, MessageSquare,
  Image, FolderKanban, MapPin, Shield, CreditCard, Mail, Phone,
  CheckCircle, XCircle, Github, Linkedin,
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ImageGalleryUpload from '@/components/ImageGalleryUpload';
import { useToast } from '@/hooks/use-toast';
import { isFreelancerPlatform, parseScreenshotUrls, isLikelyImageUrl } from '@/lib/accountPlatforms';
import { formatBirthday } from '@/lib/identityDocuments';
import { cn } from '@/lib/utils';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { FREELANCING_ACCOUNT_SEARCH_COLUMNS } from '@/lib/supabaseSearch';
import { filterItemsBySearch } from '@/lib/clientSearch';

export interface FreelancingAccount {
  id: string;
  user_id: string;
  platform: string;
  username: string;
  profile_url: string | null;
  status: string;
  notes: string | null;
  profile_title: string | null;
  profile_overview: string | null;
  skills: string | null;
  portfolio_url: string | null;
  employment_history: string | null;
  achievements: string | null;
  certifications: string | null;
  badge_status: string | null;
  job_success_score: number | null;
  working_hours: string | null;
  recent_projects: string | null;
  reviews: string | null;
  secret_key: string | null;
  security_answer: string | null;
  connected_payment_type: string | null;
  profile_screenshot_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  connected_email: string | null;
  telephone: string | null;
  purchase_way: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  anydesk_id: string | null;
  anydesk_password: string | null;
  account_password: string | null;
  payment_account_id: string | null;
  verified_status: boolean | null;
  verified_date: string | null;
  timezone: string | null;
  uploaded_id_card_url: string | null;
  disabled_at: string | null;
  created_at: string;
  birthday: string | null;
  country: string | null;
  backup_codes: string | null;
  authenticator_enabled: boolean | null;
  screenshot_urls: string[] | null;
}

const FREELANCING_PLATFORM_OPTIONS = [
  { value: 'upwork', label: 'Upwork' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'fiverr', label: 'Fiverr' },
  { value: 'guru', label: 'Guru' },
  { value: 'toptal', label: 'Toptal' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other (marketplace)' },
];

const GENERIC_ACCOUNT_OPTIONS = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook (email)' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'github', label: 'GitHub' },
  { value: 'dropbox', label: 'Dropbox' },
];

const PLATFORMS: Record<string, { label: string; color: string; icon: string }> = {
  upwork: { label: 'Upwork', color: 'bg-emerald-500', icon: '💼' },
  freelancer: { label: 'Freelancer', color: 'bg-blue-500', icon: '🌐' },
  fiverr: { label: 'Fiverr', color: 'bg-emerald-600', icon: '🎯' },
  guru: { label: 'Guru', color: 'bg-indigo-500', icon: '🧑‍💻' },
  toptal: { label: 'Toptal', color: 'bg-violet-500', icon: '⭐' },
  linkedin: { label: 'LinkedIn', color: 'bg-blue-600', icon: '🔗' },
  other: { label: 'Other', color: 'bg-muted-foreground', icon: '📋' },
  gmail: { label: 'Gmail', color: 'bg-red-500', icon: '✉️' },
  outlook: { label: 'Outlook', color: 'bg-sky-600', icon: '📧' },
  microsoft_teams: { label: 'Microsoft Teams', color: 'bg-purple-600', icon: '👥' },
  telegram: { label: 'Telegram', color: 'bg-sky-500', icon: '✈️' },
  whatsapp: { label: 'WhatsApp', color: 'bg-green-600', icon: '💬' },
  github: { label: 'GitHub', color: 'bg-neutral-800', icon: '🐙' },
  dropbox: { label: 'Dropbox', color: 'bg-blue-700', icon: '📦' },
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'good', label: 'Good' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'closed', label: 'Closed' },
];

const BADGE_OPTIONS = [
  { value: 'top_rated', label: 'Top Rated' },
  { value: 'top_rated_plus', label: 'Top Rated Plus' },
  { value: 'rising_talent', label: 'Rising Talent' },
  { value: 'expert_vetted', label: 'Expert-Vetted' },
  { value: 'none', label: 'None' },
];

const PAYMENT_TYPES = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'wise', label: 'Wise' },
  { value: 'payoneer', label: 'Payoneer' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'po', label: 'PO (Purchase Order)' },
  { value: 'other', label: 'Other' },
];

const PURCHASE_WAY_OPTIONS = [
  { value: 'broker', label: 'Broker' },
  { value: 'real_man', label: 'Real Man' },
  { value: 'self', label: 'Self-Created' },
  { value: 'other', label: 'Other' },
];

const BADGES: Record<string, string> = {
  top_rated: 'Top Rated',
  top_rated_plus: 'Top Rated Plus',
  rising_talent: 'Rising Talent',
  expert_vetted: 'Expert-Vetted',
};

const statusColor: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  good: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
  disabled: 'bg-red-100 text-red-800',
  closed: 'bg-muted text-muted-foreground',
};

interface PaymentAccountOption {
  id: string;
  provider: string;
  account_identifier: string | null;
}

const emptyForm = {
  platform: '', username: '', profile_url: '', status: 'active', notes: '',
  profile_title: '', profile_overview: '', skills: '', portfolio_url: '',
  employment_history: '', achievements: '', certifications: '',
  badge_status: 'none', job_success_score: '', working_hours: '',
  recent_projects: '', reviews: '', secret_key: '', security_answer: '',
  connected_payment_type: '', profile_screenshot_url: '', github_url: '',
  linkedin_url: '', connected_email: '', telephone: '', purchase_way: '',
  address: '', city: '', state: '', zip: '', anydesk_id: '',
  anydesk_password: '', account_password: '', payment_account_id: '',
  verified_status: false, verified_date: '', timezone: '',
  uploaded_id_card_url: '', disabled_at: '',
  birthday: '', country: '', backup_codes: '', authenticator_enabled: false,
  screenshot_urls: [] as string[],
};

type View = 'platforms' | 'list' | 'detail';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1">
      <span className="text-sm font-medium text-muted-foreground min-w-[140px]">{label}</span>
      <span className="text-sm text-foreground/80">{value}</span>
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

export default function AdminAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<FreelancingAccount[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showSecurityAnswer, setShowSecurityAnswer] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showAnydeskPassword, setShowAnydeskPassword] = useState(false);

  // 3-level navigation state
  const [view, setView] = useState<View>('platforms');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string; navigateAfter?: () => void } | null>(null);

  const fetchAccounts = async () => {
    const [accountsRes, paymentsRes] = await Promise.all([
      supabase.from('freelancing_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('payment_accounts').select('id, provider, account_identifier').order('provider'),
    ]);
    if (accountsRes.error) {
      toast({ title: 'Error loading accounts', description: accountsRes.error.message, variant: 'destructive' });
    } else {
      setAccounts(accountsRes.data || []);
    }
    setPaymentAccounts(paymentsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const openCreate = (platform?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, platform: platform || '' });
    setShowSecret(false);
    setShowSecurityAnswer(false);
    setShowAccountPassword(false);
    setShowAnydeskPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (acc: FreelancingAccount) => {
    setEditingId(acc.id);
    setForm({
      platform: acc.platform, username: acc.username,
      profile_url: acc.profile_url || '', status: acc.status,
      notes: acc.notes || '', profile_title: acc.profile_title || '',
      profile_overview: acc.profile_overview || '', skills: acc.skills || '',
      portfolio_url: acc.portfolio_url || '', employment_history: acc.employment_history || '',
      achievements: acc.achievements || '', certifications: acc.certifications || '',
      badge_status: acc.badge_status || 'none',
      job_success_score: acc.job_success_score?.toString() || '',
      working_hours: acc.working_hours || '', recent_projects: acc.recent_projects || '',
      reviews: acc.reviews || '', secret_key: acc.secret_key || '',
      security_answer: acc.security_answer || '',
      connected_payment_type: acc.connected_payment_type || '',
      profile_screenshot_url: acc.profile_screenshot_url || '',
      github_url: acc.github_url || '', linkedin_url: acc.linkedin_url || '',
      connected_email: acc.connected_email || '', telephone: acc.telephone || '',
      purchase_way: acc.purchase_way || '', address: acc.address || '',
      city: acc.city || '', state: acc.state || '', zip: acc.zip || '',
      anydesk_id: acc.anydesk_id || '', anydesk_password: acc.anydesk_password || '',
      account_password: acc.account_password || '',
      payment_account_id: acc.payment_account_id || '',
      verified_status: acc.verified_status || false,
      verified_date: acc.verified_date || '', timezone: acc.timezone || '',
      uploaded_id_card_url: acc.uploaded_id_card_url || '',
      disabled_at: acc.disabled_at || '',
      birthday: acc.birthday ? (acc.birthday.includes('T') ? acc.birthday.slice(0, 10) : acc.birthday) : '',
      country: acc.country || '',
      backup_codes: acc.backup_codes || '',
      authenticator_enabled: acc.authenticator_enabled || false,
      screenshot_urls: parseScreenshotUrls(acc.screenshot_urls),
    });
    setShowSecret(false); setShowSecurityAnswer(false);
    setShowAccountPassword(false); setShowAnydeskPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.platform || !form.username) {
      toast({ title: 'Platform and username are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      platform: form.platform, username: form.username,
      profile_url: form.profile_url || null, status: form.status,
      notes: form.notes || null, profile_title: form.profile_title || null,
      profile_overview: form.profile_overview || null, skills: form.skills || null,
      portfolio_url: form.portfolio_url || null, employment_history: form.employment_history || null,
      achievements: form.achievements || null, certifications: form.certifications || null,
      badge_status: form.badge_status === 'none' ? null : form.badge_status,
      job_success_score: form.job_success_score ? parseInt(form.job_success_score) : null,
      working_hours: form.working_hours || null, recent_projects: form.recent_projects || null,
      reviews: form.reviews || null, secret_key: form.secret_key || null,
      security_answer: form.security_answer || null,
      connected_payment_type: form.connected_payment_type || null,
      profile_screenshot_url: form.profile_screenshot_url || null,
      github_url: form.github_url || null, linkedin_url: form.linkedin_url || null,
      connected_email: form.connected_email || null, telephone: form.telephone || null,
      purchase_way: form.purchase_way || null, address: form.address || null,
      city: form.city || null, state: form.state || null, zip: form.zip || null,
      anydesk_id: form.anydesk_id || null, anydesk_password: form.anydesk_password || null,
      account_password: form.account_password || null,
      payment_account_id: form.payment_account_id && form.payment_account_id !== 'none' ? form.payment_account_id : null,
      verified_status: form.verified_status || false,
      verified_date: form.verified_date || null, timezone: form.timezone || null,
      uploaded_id_card_url: form.uploaded_id_card_url || null,
      disabled_at: form.status === 'disabled' ? (form.disabled_at || new Date().toISOString()) : null,
      birthday: form.birthday?.trim() ? form.birthday.trim() : null,
      country: form.country?.trim() ? form.country.trim() : null,
      backup_codes: form.backup_codes?.trim() ? form.backup_codes.trim() : null,
      authenticator_enabled: form.authenticator_enabled,
      screenshot_urls: (form.screenshot_urls as string[]).length > 0 ? (form.screenshot_urls as string[]) : null,
      user_id: user!.id, updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('freelancing_accounts').update(payload).eq('id', editingId);
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Account updated' });
    } else {
      const { error } = await supabase.from('freelancing_accounts').insert(payload);
      if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Account created' });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('freelancing_accounts').delete().eq('id', id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account deleted' }); fetchAccounts(); }
  };

  const executeDeleteAccount = async () => {
    if (!deleteConfirm) return;
    const { id, navigateAfter } = deleteConfirm;
    setDeleteConfirm(null);
    await handleDelete(id);
    navigateAfter?.();
  };

  const set = (key: string, value: string | boolean | string[]) => setForm(prev => ({ ...prev, [key]: value }));

  const searchFiltered = useMemo(
    () => filterItemsBySearch(accounts, searchInput, FREELANCING_ACCOUNT_SEARCH_COLUMNS),
    [accounts, searchInput],
  );

  const displayAccounts = useMemo(() => {
    if (view === 'list' && selectedPlatform) return searchFiltered.filter((a) => a.platform === selectedPlatform);
    return searchFiltered;
  }, [searchFiltered, view, selectedPlatform]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  // Group accounts by platform (after client-side keyword + list filter)
  const grouped = displayAccounts.reduce<Record<string, FreelancingAccount[]>>((acc, item) => {
    const key = item.platform;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const platformList = Object.entries(grouped).map(([platform, accs]) => ({
    platform,
    info: PLATFORMS[platform] || PLATFORMS.other,
    count: accs.length,
    activeCount: accs.filter(a => a.status === 'active' || a.status === 'good').length,
  }));

  const filteredAccounts = selectedPlatform ? grouped[selectedPlatform] || [] : [];
  const selectedAccount = selectedAccountId ? accounts.find(a => a.id === selectedAccountId) : null;
  const linkedPayment = selectedAccount?.payment_account_id
    ? paymentAccounts.find(p => p.id === selectedAccount.payment_account_id) || null
    : null;

  const goToPlatforms = () => { setView('platforms'); setSelectedPlatform(null); setSelectedAccountId(null); };
  const goToList = (platform: string) => { setView('list'); setSelectedPlatform(platform); setSelectedAccountId(null); };
  const goToDetail = (id: string) => { setView('detail'); setSelectedAccountId(id); };

  const platformLabel = selectedPlatform ? (PLATFORMS[selectedPlatform] || PLATFORMS.other).label : '';

  const searchPlaceholder =
    view === 'list' && selectedPlatform
      ? `Search ${(PLATFORMS[selectedPlatform] || PLATFORMS.other).label} accounts…`
      : 'Search accounts by keyword (name, email, platform, notes…)';

  const freelancerMode = isFreelancerPlatform(form.platform);
  const genericMode = form.platform && !freelancerMode;

  // ---- Form Dialog (shared) ----
  const FormDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{editingId ? 'Edit Account' : 'Add Account'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <div className="px-6 pb-6">
            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="location">Location & Access</TabsTrigger>
                <TabsTrigger value="links">Links & Contact</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Platform *</Label>
                    <Select value={form.platform} onValueChange={(v) => set('platform', v)}>
                      <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Freelancing platforms</SelectLabel>
                          {FREELANCING_PLATFORM_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Accounts & workspace</SelectLabel>
                          {GENERIC_ACCOUNT_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{freelancerMode ? 'Username *' : 'Login / username *'}</Label>
                    <Input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder={freelancerMode ? 'Platform username' : 'Email, phone, or handle'} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => set('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {freelancerMode && (
                    <div className="space-y-2">
                      <Label>Badge / Tier</Label>
                      <Select value={form.badge_status} onValueChange={(v) => set('badge_status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BADGE_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {form.status === 'disabled' && (
                  <div className="space-y-2">
                    <Label>Disabled Date</Label>
                    <Input type="datetime-local" value={form.disabled_at ? form.disabled_at.slice(0, 16) : ''} onChange={(e) => set('disabled_at', e.target.value ? new Date(e.target.value).toISOString() : '')} />
                  </div>
                )}
                {freelancerMode && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Job Success Score (%)</Label>
                        <Input type="number" min={0} max={100} value={form.job_success_score} onChange={(e) => set('job_success_score', e.target.value)} placeholder="e.g. 97" />
                      </div>
                      <div className="space-y-2">
                        <Label>Working Hours</Label>
                        <Input value={form.working_hours} onChange={(e) => set('working_hours', e.target.value)} placeholder="e.g. 30+ hrs/week" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Way</Label>
                      <Select value={form.purchase_way} onValueChange={(v) => set('purchase_way', v)}>
                        <SelectTrigger><SelectValue placeholder="How was this acquired?" /></SelectTrigger>
                        <SelectContent>
                          {PURCHASE_WAY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="e.g. America/New_York" />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" />
                  </div>
                </div>
                {freelancerMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Connected Payment Type</Label>
                      <Select value={form.connected_payment_type} onValueChange={(v) => set('connected_payment_type', v)}>
                        <SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Linked Payment Account</Label>
                      <Select value={form.payment_account_id} onValueChange={(v) => set('payment_account_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Link to payment account" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {paymentAccounts.map((pa) => (
                            <SelectItem key={pa.id} value={pa.id}>{pa.provider}{pa.account_identifier ? ` — ${pa.account_identifier}` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Birthday</Label>
                    <Input type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Verified</Label>
                    <Select value={form.verified_status ? 'true' : 'false'} onValueChange={(v) => set('verified_status', v === 'true')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Verified Date</Label>
                    <Input type="date" value={form.verified_date ? form.verified_date.slice(0, 10) : ''} onChange={(e) => set('verified_date', e.target.value || '')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Uploaded ID Card</Label>
                  <FileUpload value={form.uploaded_id_card_url} onChange={(url) => set('uploaded_id_card_url', url)} folder="id-cards" label="Upload ID Card" />
                </div>
                {genericMode && (
                  <div className="space-y-2">
                    <Label>Screenshots</Label>
                    <p className="text-xs text-muted-foreground">Multiple images or PDFs (dashboard, settings, etc.)</p>
                    <ImageGalleryUpload
                      urls={form.screenshot_urls as string[]}
                      onChange={(urls) => set('screenshot_urls', urls)}
                      folder="account-screenshots"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal notes..." rows={3} />
                </div>
              </TabsContent>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{freelancerMode ? 'Profile Title' : 'Display name'}</Label>
                  <Input value={form.profile_title} onChange={(e) => set('profile_title', e.target.value)} placeholder={freelancerMode ? 'e.g. Senior Full-Stack Developer' : 'Name on account'} />
                </div>
                <div className="space-y-2">
                  <Label>{freelancerMode ? 'Profile Overview' : 'Description'}</Label>
                  <Textarea value={form.profile_overview} onChange={(e) => set('profile_overview', e.target.value)} placeholder={freelancerMode ? 'Professional summary...' : 'Notes about this account...'} rows={4} />
                </div>
                {freelancerMode && (
                  <>
                    <div className="space-y-2"><Label>Skills (comma-separated)</Label><Textarea value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="React, TypeScript..." rows={2} /></div>
                    <div className="space-y-2"><Label>Employment History</Label><Textarea value={form.employment_history} onChange={(e) => set('employment_history', e.target.value)} rows={3} /></div>
                    <div className="space-y-2"><Label>Achievements</Label><Textarea value={form.achievements} onChange={(e) => set('achievements', e.target.value)} rows={3} /></div>
                    <div className="space-y-2"><Label>Certifications</Label><Textarea value={form.certifications} onChange={(e) => set('certifications', e.target.value)} rows={2} /></div>
                    <div className="space-y-2"><Label>Recent Projects</Label><Textarea value={form.recent_projects} onChange={(e) => set('recent_projects', e.target.value)} rows={3} /></div>
                    <div className="space-y-2"><Label>Reviews / Feedback</Label><Textarea value={form.reviews} onChange={(e) => set('reviews', e.target.value)} rows={3} /></div>
                  </>
                )}
              </TabsContent>

              {/* Location & Access Tab */}
              <TabsContent value="location" className="space-y-4 pt-4">
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
                  <div className="space-y-2"><Label>State / Region</Label><Input value={form.state} onChange={(e) => set('state', e.target.value)} /></div>
                  <div className="space-y-2"><Label>{genericMode ? 'ZIP / Pin code' : 'ZIP'}</Label><Input value={form.zip} onChange={(e) => set('zip', e.target.value)} /></div>
                </div>
                {freelancerMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>AnyDesk ID</Label><Input value={form.anydesk_id} onChange={(e) => set('anydesk_id', e.target.value)} /></div>
                    <div className="space-y-2">
                      <Label>AnyDesk Password</Label>
                      <div className="relative">
                        <Input type={showAnydeskPassword ? 'text' : 'password'} value={form.anydesk_password} onChange={(e) => set('anydesk_password', e.target.value)} className="pr-10" />
                        <button type="button" onClick={() => setShowAnydeskPassword(!showAnydeskPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showAnydeskPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Links & Contact Tab */}
              <TabsContent value="links" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{form.platform === 'github' ? 'GitHub profile URL *' : 'Profile / service URL'}</Label>
                  <Input value={form.profile_url} onChange={(e) => set('profile_url', e.target.value)} placeholder="https://..." />
                </div>
                {freelancerMode && (
                  <>
                    <div className="space-y-2"><Label>Portfolio URL</Label><Input value={form.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} /></div>
                    <div className="space-y-2"><Label>GitHub URL</Label><Input value={form.github_url} onChange={(e) => set('github_url', e.target.value)} /></div>
                    <div className="space-y-2"><Label>LinkedIn URL</Label><Input value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Profile Screenshot</Label><FileUpload value={form.profile_screenshot_url} onChange={(url) => set('profile_screenshot_url', url)} folder="screenshots" label="Upload Screenshot" /></div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email (login / connected)</Label><Input type="email" value={form.connected_email} onChange={(e) => set('connected_email', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Phone number</Label><Input type="tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} /></div>
                </div>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="space-y-4 pt-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">⚠️ Sensitive information — only visible to admins</p>
                </div>
                {genericMode && (
                  <>
                    <div className="flex items-center gap-3 p-3 border rounded-md">
                      <input type="checkbox" id="auth-app" checked={form.authenticator_enabled} onChange={(e) => set('authenticator_enabled', e.target.checked)} className="rounded" />
                      <Label htmlFor="auth-app" className="cursor-pointer">Authenticator (2FA) enabled</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Backup codes</Label>
                      <Textarea value={form.backup_codes} onChange={(e) => set('backup_codes', e.target.value)} placeholder="Store recovery / backup codes (one per line)" rows={4} className="font-mono text-sm" />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Account Password</Label>
                  <div className="relative">
                    <Input type={showAccountPassword ? 'text' : 'password'} value={form.account_password} onChange={(e) => set('account_password', e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowAccountPassword(!showAccountPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showAccountPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <div className="relative">
                    <Input type={showSecret ? 'text' : 'password'} value={form.secret_key} onChange={(e) => set('secret_key', e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Security Answer</Label>
                  <div className="relative">
                    <Input type={showSecurityAnswer ? 'text' : 'password'} value={form.security_answer} onChange={(e) => set('security_answer', e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowSecurityAnswer(!showSecurityAnswer)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSecurityAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <Button onClick={handleSave} disabled={saving} className="mt-6 w-full">
              {saving ? 'Saving...' : editingId ? 'Update Account' : 'Create Account'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  // ---- Detail View ----
  const renderDetail = () => {
    if (!selectedAccount) return null;
    const acc = selectedAccount;
    const platformInfo = PLATFORMS[acc.platform] || PLATFORMS.other;
    const accFreelancer = isFreelancerPlatform(acc.platform);
    const galleryShots = parseScreenshotUrls(acc.screenshot_urls);
    const locationParts = [acc.address, acc.city, acc.state, acc.zip].filter(Boolean);
    const fullAddress = locationParts.join(', ');

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-foreground">{platformInfo.label}</h2>
              <Badge variant="secondary" className={statusColor[acc.status] || ''}>{acc.status.charAt(0).toUpperCase() + acc.status.slice(1)}</Badge>
              {acc.verified_status && <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300"><CheckCircle className="h-3 w-3" /> Verified</Badge>}
            </div>
            <p className="text-lg text-muted-foreground">@{acc.username}</p>
            {acc.profile_title && <p className="text-base text-foreground/80">{acc.profile_title}</p>}
            <p className="text-xs text-muted-foreground">Created {new Date(acc.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(acc)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" />Edit</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDeleteConfirm({
                  id: acc.id,
                  label: `${platformInfo.label} @${acc.username}`,
                  navigateAfter: () => goToList(acc.platform),
                })
              }
              className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />Delete
            </Button>
          </div>
        </div>

        {accFreelancer && (
          <div className="flex flex-wrap items-center gap-2">
            {acc.badge_status && BADGES[acc.badge_status] && <Badge variant="outline" className="gap-1.5 py-1"><Award className="h-3.5 w-3.5 text-amber-500" />{BADGES[acc.badge_status]}</Badge>}
            {acc.job_success_score != null && <Badge variant="outline" className="gap-1.5 py-1"><Star className="h-3.5 w-3.5 text-amber-500" />{acc.job_success_score}% Success</Badge>}
            {acc.working_hours && <Badge variant="outline" className="gap-1.5 py-1"><Clock className="h-3.5 w-3.5" />{acc.working_hours}</Badge>}
            {acc.purchase_way && <Badge variant="outline" className="gap-1.5 py-1">{PURCHASE_WAY_OPTIONS.find(p => p.value === acc.purchase_way)?.label || acc.purchase_way}</Badge>}
          </div>
        )}

        {acc.status === 'disabled' && acc.disabled_at && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">Account disabled on {new Date(acc.disabled_at).toLocaleDateString()}</p>
          </div>
        )}

        <Separator />

        {accFreelancer && acc.profile_screenshot_url && <DetailSection icon={Image} title="Profile Screenshot"><img src={acc.profile_screenshot_url} alt="Profile screenshot" className="rounded-lg border max-h-64 object-cover w-full" /></DetailSection>}
        {!accFreelancer && galleryShots.length > 0 && (
          <DetailSection icon={Image} title="Screenshots">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {galleryShots.map((url, i) => (
                <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border overflow-hidden aspect-video bg-muted">
                  {isLikelyImageUrl(url) ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex items-center justify-center h-full min-h-[80px] text-xs text-primary p-2 text-center">Open file</span>
                  )}
                </a>
              ))}
            </div>
          </DetailSection>
        )}
        {acc.profile_overview && <DetailSection icon={Briefcase} title={accFreelancer ? 'Overview' : 'Description'}><p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.profile_overview}</p></DetailSection>}
        {accFreelancer && acc.skills && <DetailSection icon={Star} title="Skills"><div className="flex flex-wrap gap-2">{acc.skills.split(',').map((s, i) => <Badge key={i} variant="secondary" className="text-sm font-normal">{s.trim()}</Badge>)}</div></DetailSection>}
        {accFreelancer && acc.employment_history && <DetailSection icon={Briefcase} title="Employment History"><p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.employment_history}</p></DetailSection>}
        {accFreelancer && acc.achievements && <DetailSection icon={Trophy} title="Achievements"><p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.achievements}</p></DetailSection>}
        {accFreelancer && acc.certifications && <DetailSection icon={GraduationCap} title="Certifications"><p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.certifications}</p></DetailSection>}
        {accFreelancer && acc.recent_projects && <DetailSection icon={FolderKanban} title="Recent Projects"><p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.recent_projects}</p></DetailSection>}
        {accFreelancer && acc.reviews && <DetailSection icon={MessageSquare} title="Reviews"><p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.reviews}</p></DetailSection>}

        <Separator />

        {(fullAddress || acc.timezone || (accFreelancer && acc.anydesk_id) || acc.country || acc.birthday) && (
          <DetailSection icon={MapPin} title={accFreelancer ? 'Location & Access' : 'Location'}>
            <div className="space-y-1">
              <InfoRow label="Birthday" value={formatBirthday(acc.birthday)} />
              <InfoRow label="Country" value={acc.country} />
              <InfoRow label="Address" value={fullAddress || null} />
              <InfoRow label="Timezone" value={acc.timezone} />
              {accFreelancer && <InfoRow label="AnyDesk ID" value={acc.anydesk_id} />}
            </div>
          </DetailSection>
        )}

        {(acc.verified_status || acc.verified_date || acc.uploaded_id_card_url) && (
          <DetailSection icon={Shield} title="Verification">
            <div className="space-y-2">
              <InfoRow label="Verified" value={acc.verified_status ? 'Yes' : 'No'} />
              <InfoRow label="Verified Date" value={acc.verified_date ? new Date(acc.verified_date).toLocaleDateString() : null} />
              {acc.uploaded_id_card_url && <div className="pt-1"><span className="text-sm font-medium text-muted-foreground">ID Card:</span><img src={acc.uploaded_id_card_url} alt="Uploaded ID" className="mt-2 rounded-lg border max-h-48 object-contain" /></div>}
            </div>
          </DetailSection>
        )}

        <DetailSection icon={ExternalLink} title="Links">
          <div className="flex flex-wrap gap-4">
            {acc.profile_url && <a href={acc.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ExternalLink className="h-4 w-4" />{acc.platform === 'github' ? 'GitHub' : 'Profile'}</a>}
            {accFreelancer && acc.github_url && acc.platform !== 'github' && <a href={acc.github_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Github className="h-4 w-4" />GitHub</a>}
            {accFreelancer && acc.linkedin_url && <a href={acc.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Linkedin className="h-4 w-4" />LinkedIn</a>}
            {accFreelancer && acc.portfolio_url && <a href={acc.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" />Portfolio</a>}
          </div>
        </DetailSection>

        <DetailSection icon={Mail} title="Contact">
          <div className="flex flex-wrap gap-6">
            {acc.connected_email && <span className="flex items-center gap-2 text-sm text-foreground/80"><Mail className="h-4 w-4 text-muted-foreground" />{acc.connected_email}</span>}
            {acc.telephone && <span className="flex items-center gap-2 text-sm text-foreground/80"><Phone className="h-4 w-4 text-muted-foreground" />{acc.telephone}</span>}
          </div>
        </DetailSection>

        {(accFreelancer || acc.connected_payment_type || linkedPayment) && (
          <DetailSection icon={CreditCard} title="Payment">
            <div className="space-y-1">
              <InfoRow label="Payment Type" value={acc.connected_payment_type?.replace('_', ' ') || null} />
              {linkedPayment && <InfoRow label="Linked Account" value={`${linkedPayment.provider}${linkedPayment.account_identifier ? ' — ' + linkedPayment.account_identifier : ''}`} />}
            </div>
          </DetailSection>
        )}

        {!accFreelancer && (acc.authenticator_enabled || acc.backup_codes) && (
          <DetailSection icon={Shield} title="Authenticator & backup">
            <InfoRow label="Authenticator (2FA)" value={acc.authenticator_enabled ? 'Enabled' : 'Off'} />
            {acc.backup_codes && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Backup codes</p>
                <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap font-mono">{acc.backup_codes}</pre>
              </div>
            )}
          </DetailSection>
        )}

        {acc.notes && (<><Separator /><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p><p className="text-sm text-foreground/80 whitespace-pre-line">{acc.notes}</p></div></>)}
      </div>
    );
  };

  const DeleteDialog = (
    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete account</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{deleteConfirm?.label}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={executeDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
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
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Manage Accounts</h2>
            <p className="text-sm text-muted-foreground">Freelancing profiles and workspace accounts (Gmail, Teams, GitHub, etc.)</p>
          </div>
          {view !== 'detail' && (
            <ModuleSearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder={searchPlaceholder}
              id="admin-accounts-search"
            />
          )}
        </div>
        <Button onClick={() => openCreate(selectedPlatform || undefined)} className="gap-2 shrink-0"><Plus className="h-4 w-4" />Add Account</Button>
      </div>

      {/* Breadcrumb */}
      {view !== 'platforms' && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goToPlatforms} className="text-primary hover:underline font-medium">All Platforms</button>
          {selectedPlatform && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {view === 'detail' ? (
                <button onClick={() => goToList(selectedPlatform)} className="text-primary hover:underline font-medium">{platformLabel}</button>
              ) : (
                <span className="text-foreground font-medium">{platformLabel}</span>
              )}
            </>
          )}
          {view === 'detail' && selectedAccount && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-medium">@{selectedAccount.username}</span>
            </>
          )}
        </div>
      )}

      {/* Platform Cards */}
      {view === 'platforms' && (
        accounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium text-foreground">No accounts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add the first freelancing account</p>
              <Button onClick={() => openCreate()} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" />Add Account</Button>
            </CardContent>
          </Card>
        ) : platformList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching accounts' : 'No accounts'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput.trim() ? 'Try different keywords or clear the search.' : 'Add an account to get started.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platformList.map(({ platform, info, count, activeCount }) => (
              <Card key={platform} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group" onClick={() => goToList(platform)}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-lg text-white', info.color)}>{info.icon}</div>
                    <CardTitle className="text-lg">{info.label}</CardTitle>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-sm text-muted-foreground">{activeCount} active</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Account List */}
      {view === 'list' && (
        <div className="space-y-3">
          {filteredAccounts.length === 0 ? (
            <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">{searchInput.trim() ? 'No matching accounts' : 'No accounts for this platform'}</p><p className="mt-1 text-sm text-muted-foreground">{searchInput.trim() ? 'Try different keywords or clear the search.' : ''}</p></CardContent></Card>
          ) : filteredAccounts.map((acc) => (
            <Card key={acc.id} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => goToDetail(acc.id)}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <p className="font-medium text-foreground">@{acc.username}</p>
                    {acc.profile_title && <p className="text-sm text-muted-foreground truncate max-w-[300px]">{acc.profile_title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className={statusColor[acc.status] || ''}>{acc.status}</Badge>
                  {isFreelancerPlatform(acc.platform) && acc.job_success_score != null && <span className="text-sm font-medium">{acc.job_success_score}%</span>}
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(acc); }}><Pencil className="h-4 w-4" /></Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        const info = PLATFORMS[acc.platform] || PLATFORMS.other;
                        setDeleteConfirm({ id: acc.id, label: `${info.label} @${acc.username}` });
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail View */}
      {view === 'detail' && renderDetail()}
    </div>
  );
}
