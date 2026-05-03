import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ExternalLink, Github, Linkedin, Mail, Phone, Clock, Award, Star,
  Briefcase, GraduationCap, Trophy, MessageSquare, Image, FolderKanban,
  MapPin, Shield, CreditCard, CheckCircle, XCircle, ArrowLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FREELANCING_ACCOUNT_SEARCH_COLUMNS } from '@/lib/supabaseSearch';
import { filterItemsBySearch } from '@/lib/clientSearch';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { isFreelancerPlatform, parseScreenshotUrls, isLikelyImageUrl } from '@/lib/accountPlatforms';
import { formatBirthday } from '@/lib/identityDocuments';
import { paymentProviderLabel } from '@/lib/paymentAccounts';
import type { PaymentAccount } from '@/lib/paymentAccountModel';
import { useAuth } from '@/contexts/AuthContext';

interface FreelancingAccount {
  id: string;
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

const BADGES: Record<string, string> = {
  top_rated: 'Top Rated',
  top_rated_plus: 'Top Rated Plus',
  rising_talent: 'Rising Talent',
  expert_vetted: 'Expert-Vetted',
};

const PURCHASE_WAYS: Record<string, string> = {
  broker: 'Broker',
  real_man: 'Real Man',
  self: 'Self-Created',
  other: 'Other',
};

const statusColor: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  disabled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  closed: 'bg-muted text-muted-foreground',
};

type View = 'platforms' | 'list' | 'detail';

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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1">
      <span className="text-sm font-medium text-muted-foreground min-w-[140px]">{label}</span>
      <span className="text-sm text-foreground/80">{value}</span>
    </div>
  );
}

function AccountDetail({ account, paymentAccount }: { account: FreelancingAccount; paymentAccount?: PaymentAccount | null }) {
  const acc = account;
  const accFreelancer = isFreelancerPlatform(acc.platform);
  const galleryShots = parseScreenshotUrls(acc.screenshot_urls);
  const locationParts = [acc.address, acc.city, acc.state, acc.zip].filter(Boolean);
  const fullAddress = locationParts.join(', ');
  const platformInfo = PLATFORMS[acc.platform] || PLATFORMS.other;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-foreground">{platformInfo.label}</h2>
            <Badge variant="secondary" className={statusColor[acc.status] || ''}>
              {acc.status.charAt(0).toUpperCase() + acc.status.slice(1)}
            </Badge>
            {acc.verified_status && (
              <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300">
                <CheckCircle className="h-3 w-3" /> Verified
              </Badge>
            )}
          </div>
          <p className="text-lg text-muted-foreground">@{acc.username}</p>
          {acc.profile_title && <p className="text-base text-foreground/80">{acc.profile_title}</p>}
          {acc.created_at && <p className="text-xs text-muted-foreground">Created {new Date(acc.created_at).toLocaleString()}</p>}
        </div>
        {accFreelancer && (
          <div className="flex flex-wrap items-center gap-2">
            {acc.badge_status && BADGES[acc.badge_status] && (
              <Badge variant="outline" className="gap-1.5 py-1"><Award className="h-3.5 w-3.5 text-amber-500" />{BADGES[acc.badge_status]}</Badge>
            )}
            {acc.job_success_score != null && (
              <Badge variant="outline" className="gap-1.5 py-1"><Star className="h-3.5 w-3.5 text-amber-500" />{acc.job_success_score}% Success</Badge>
            )}
            {acc.working_hours && (
              <Badge variant="outline" className="gap-1.5 py-1"><Clock className="h-3.5 w-3.5" />{acc.working_hours}</Badge>
            )}
            {acc.purchase_way && (
              <Badge variant="outline" className="gap-1.5 py-1">{PURCHASE_WAYS[acc.purchase_way] || acc.purchase_way}</Badge>
            )}
          </div>
        )}
      </div>

      {acc.status === 'disabled' && acc.disabled_at && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">Account disabled on {new Date(acc.disabled_at).toLocaleDateString()}</p>
        </div>
      )}

      <Separator />

      {accFreelancer && acc.profile_screenshot_url && (
        <DetailSection icon={Image} title="Profile Screenshot">
          <img src={acc.profile_screenshot_url} alt="Profile screenshot" className="rounded-lg border max-h-64 object-cover w-full" />
        </DetailSection>
      )}

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

      {acc.profile_overview && (
        <DetailSection icon={Briefcase} title={accFreelancer ? 'Overview' : 'Description'}>
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.profile_overview}</p>
        </DetailSection>
      )}

      {accFreelancer && acc.skills && (
        <DetailSection icon={Star} title="Skills">
          <div className="flex flex-wrap gap-2">
            {acc.skills.split(',').map((s, i) => (
              <Badge key={i} variant="secondary" className="text-sm font-normal">{s.trim()}</Badge>
            ))}
          </div>
        </DetailSection>
      )}

      {accFreelancer && acc.employment_history && (
        <DetailSection icon={Briefcase} title="Employment History">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.employment_history}</p>
        </DetailSection>
      )}

      {accFreelancer && acc.achievements && (
        <DetailSection icon={Trophy} title="Achievements">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.achievements}</p>
        </DetailSection>
      )}

      {accFreelancer && acc.certifications && (
        <DetailSection icon={GraduationCap} title="Certifications">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.certifications}</p>
        </DetailSection>
      )}

      {accFreelancer && acc.recent_projects && (
        <DetailSection icon={FolderKanban} title="Recent Projects">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.recent_projects}</p>
        </DetailSection>
      )}

      {accFreelancer && acc.reviews && (
        <DetailSection icon={MessageSquare} title="Reviews">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{acc.reviews}</p>
        </DetailSection>
      )}

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
            {acc.uploaded_id_card_url && (
              <div className="pt-1">
                <span className="text-sm font-medium text-muted-foreground">ID Card:</span>
                <img src={acc.uploaded_id_card_url} alt="Uploaded ID" className="mt-2 rounded-lg border max-h-48 object-contain" />
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {!accFreelancer && acc.authenticator_enabled != null && (
        <DetailSection icon={Shield} title="Security">
          <InfoRow label="Authenticator (2FA)" value={acc.authenticator_enabled ? 'Enabled' : 'Not enabled'} />
        </DetailSection>
      )}

      <DetailSection icon={ExternalLink} title="Links">
        <div className="flex flex-wrap gap-4">
          {acc.profile_url && (
            <a href={acc.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ExternalLink className="h-4 w-4" />{acc.platform === 'github' ? 'GitHub' : 'Profile'}
            </a>
          )}
          {accFreelancer && acc.github_url && acc.platform !== 'github' && (
            <a href={acc.github_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Github className="h-4 w-4" />GitHub
            </a>
          )}
          {accFreelancer && acc.linkedin_url && (
            <a href={acc.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Linkedin className="h-4 w-4" />LinkedIn
            </a>
          )}
          {accFreelancer && acc.portfolio_url && (
            <a href={acc.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />Portfolio
            </a>
          )}
          {!acc.profile_url && !(accFreelancer && acc.github_url) && !(accFreelancer && acc.linkedin_url) && !(accFreelancer && acc.portfolio_url) && (
            <p className="text-sm text-muted-foreground">No links available</p>
          )}
        </div>
      </DetailSection>

      <DetailSection icon={Mail} title="Contact">
        <div className="flex flex-wrap gap-6">
          {acc.connected_email && (
            <span className="flex items-center gap-2 text-sm text-foreground/80"><Mail className="h-4 w-4 text-muted-foreground" />{acc.connected_email}</span>
          )}
          {acc.telephone && (
            <span className="flex items-center gap-2 text-sm text-foreground/80"><Phone className="h-4 w-4 text-muted-foreground" />{acc.telephone}</span>
          )}
          {!acc.connected_email && !acc.telephone && <p className="text-sm text-muted-foreground">No contact info available</p>}
        </div>
      </DetailSection>

      {(accFreelancer || acc.connected_payment_type || paymentAccount) && (
        <DetailSection icon={CreditCard} title="Payment">
          <div className="space-y-1">
            <InfoRow label="Payment Type" value={acc.connected_payment_type ? acc.connected_payment_type.replace('_', ' ') : null} />
            {paymentAccount && (
              <InfoRow
                label="Linked payment account"
                value={`${paymentProviderLabel(paymentAccount.provider)} — ${paymentAccount.label || '—'}${paymentAccount.account_identifier ? ` (${paymentAccount.account_identifier})` : ''}`}
              />
            )}
            {!acc.connected_payment_type && !paymentAccount && <p className="text-sm text-muted-foreground">No payment info</p>}
          </div>
        </DetailSection>
      )}

      {acc.notes && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-foreground/80 whitespace-pre-line">{acc.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default function FreelancingAccounts() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [allAccounts, setAllAccounts] = useState<FreelancingAccount[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<View>('platforms');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPaymentAccountsLoading(true);
      const { data, error } = await supabase
        .from('payment_accounts')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) toast({ title: 'Error loading payment accounts', description: error.message, variant: 'destructive' });
      else setPaymentAccounts((data as PaymentAccount[]) || []);
      setPaymentAccountsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('freelancing_accounts').select('*').order('created_at', { ascending: false });
        if (cancelled) return;
        if (error) toast({ title: 'Error loading accounts', description: error.message, variant: 'destructive' });
        else setAllAccounts(data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    if (!selectedAccountId) return;
    if (!allAccounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(null);
      setView(selectedPlatform ? 'list' : 'platforms');
    }
  }, [allAccounts, selectedAccountId, selectedPlatform]);

  const searchFiltered = useMemo(
    () => filterItemsBySearch(allAccounts, searchInput, FREELANCING_ACCOUNT_SEARCH_COLUMNS),
    [allAccounts, searchInput],
  );

  const displayAccounts = useMemo(() => {
    if (view === 'list' && selectedPlatform) return searchFiltered.filter((a) => a.platform === selectedPlatform);
    return searchFiltered;
  }, [searchFiltered, view, selectedPlatform]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  // Group accounts by platform (respects search + platform list context)
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
  const selectedAccount = selectedAccountId ? allAccounts.find(a => a.id === selectedAccountId) : null;
  const linkedPayment = selectedAccount?.payment_account_id
    ? paymentAccounts.find(p => p.id === selectedAccount.payment_account_id) || null
    : null;

  // Breadcrumb navigation
  const goToPlatforms = () => { setView('platforms'); setSelectedPlatform(null); setSelectedAccountId(null); };
  const goToList = (platform: string) => { setView('list'); setSelectedPlatform(platform); setSelectedAccountId(null); };
  const goToDetail = (id: string) => { setView('detail'); setSelectedAccountId(id); };

  const searchPlaceholder =
    view === 'list' && selectedPlatform
      ? `Search ${(PLATFORMS[selectedPlatform] || PLATFORMS.other).label} accounts…`
      : 'Search accounts by keyword (name, email, platform, notes…)';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Accounts</h2>
          <p className="text-sm text-muted-foreground">Freelancing profiles, workspace tools, and payment payout accounts</p>
        </div>
        {view !== 'detail' && (
          <ModuleSearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder={searchPlaceholder}
            id="accounts-search"
          />
        )}
      </div>

      {/* Breadcrumb */}
      {view !== 'platforms' && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goToPlatforms} className="text-primary hover:underline font-medium">All Platforms</button>
          {selectedPlatform && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {view === 'detail' ? (
                <button onClick={() => goToList(selectedPlatform)} className="text-primary hover:underline font-medium">
                  {(PLATFORMS[selectedPlatform] || PLATFORMS.other).label}
                </button>
              ) : (
                <span className="text-foreground font-medium">{(PLATFORMS[selectedPlatform] || PLATFORMS.other).label}</span>
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

      {/* Platform cards + payout payment methods (same tab) */}
      {view === 'platforms' && (
        <div className="space-y-10">
          {platformList.length === 0 ? (
            <div className="rounded-lg border bg-card py-12 text-center">
              <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching accounts' : 'No accounts'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput.trim() ? 'Try different keywords or clear the search.' : 'Accounts are managed by admins'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platformList.map(({ platform, info, count, activeCount }) => (
                <Card
                  key={platform}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
                  onClick={() => goToList(platform)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-lg', info.color, 'text-white')}>
                        {info.icon}
                      </div>
                      <CardTitle className="text-lg">{info.label}</CardTitle>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{count}</p>
                        <p className="text-xs text-muted-foreground">Total Accounts</p>
                      </div>
                      <Separator orientation="vertical" className="h-10" />
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Separator />

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Payment methods</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Payout accounts (PayPal, Wise, Payoneer, crypto, etc.) are read-only here. Admins manage them under{' '}
                <strong>Admin → Manage Accounts → Payment methods</strong>.
              </p>
              {isAdmin && (
                <p className="mt-2 text-sm">
                  <Link to="/admin/accounts#payment" className="font-medium text-primary hover:underline">
                    Open Admin → Accounts → Payment methods
                  </Link>
                </p>
              )}
            </div>
            {paymentAccountsLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : paymentAccounts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No payment accounts on file for your user. Ask an admin to add them in Manage Accounts.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paymentAccounts.map((acc) => (
                  <Card key={acc.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base font-medium">
                        {paymentProviderLabel(acc.provider)}
                        {acc.is_default && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{acc.label}</p>
                      <Badge variant={acc.status === 'good' ? 'default' : 'secondary'} className="w-fit">
                        {acc.status === 'good' ? 'Good' : 'Disabled'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                      {acc.account_identifier && <p className="break-all font-mono text-xs">{acc.account_identifier}</p>}
                      {acc.connected_phone && <p>Phone: {acc.connected_phone}</p>}
                      {acc.email && <p>Email: {acc.email}</p>}
                      {acc.id_card_drive_url && (
                        <a
                          href={acc.id_card_drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> ID (Drive)
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Account List View */}
      {view === 'list' && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={goToPlatforms} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to platforms
          </Button>
          {filteredAccounts.length === 0 ? (
            <div className="rounded-lg border bg-card py-12 text-center">
              <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching accounts' : 'No accounts for this platform'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput.trim() ? 'Try different keywords or clear the search.' : 'Choose another platform or contact an admin.'}
              </p>
            </div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAccounts.map((acc) => (
              <Card
                key={acc.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
                onClick={() => goToDetail(acc.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">@{acc.username}</p>
                      {acc.profile_title && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{acc.profile_title}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2">
                      <Badge variant="secondary" className={cn('text-xs', statusColor[acc.status] || '')}>
                        {acc.status.charAt(0).toUpperCase() + acc.status.slice(1)}
                      </Badge>
                      {isFreelancerPlatform(acc.platform) && acc.badge_status && BADGES[acc.badge_status] && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Award className="h-3 w-3 text-amber-500" />
                          {BADGES[acc.badge_status]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {isFreelancerPlatform(acc.platform) && acc.job_success_score != null && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          {acc.job_success_score}%
                        </span>
                      )}
                      {acc.verified_status && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-3.5 w-3.5" /> Verified
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Detail View */}
      {view === 'detail' && selectedAccount && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => goToList(selectedPlatform!)} className="gap-2 text-muted-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to {(PLATFORMS[selectedPlatform!] || PLATFORMS.other).label} accounts
          </Button>
          <AccountDetail account={selectedAccount} paymentAccount={linkedPayment} />
        </div>
      )}
    </div>
  );
}
