import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ExternalLink, Github, Linkedin, Mail, Phone, Clock, Award, Star, Copy,
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
  discord: { label: 'Discord', color: 'bg-indigo-600', icon: '🎮' },
  github: { label: 'GitHub', color: 'bg-neutral-800', icon: '🐙' },
  dropbox: { label: 'Dropbox', color: 'bg-blue-700', icon: '📦' },
  general: { label: 'General', color: 'bg-slate-600', icon: '📌' },
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
  const { toast } = useToast();
  const copyText = async (text: string, kind?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: kind ? `${kind} copied to clipboard.` : 'Copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };
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
          <div className="flex items-center gap-2">
            <p className="text-lg text-muted-foreground">@{acc.username}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => void copyText(acc.username, 'Username')}
              title="Copy username"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
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
            {formatBirthday(acc.birthday) && (
              <div className="flex gap-3 py-1 items-center">
                <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Birthday</span>
                <span className="text-sm text-foreground/80 flex-1 min-w-0">{formatBirthday(acc.birthday)}</span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void copyText(formatBirthday(acc.birthday)!, 'Birthday')} title="Copy birthday">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {acc.country && (
              <div className="flex gap-3 py-1 items-center">
                <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Country</span>
                <span className="text-sm text-foreground/80 flex-1 min-w-0">{acc.country}</span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void copyText(acc.country!, 'Country')} title="Copy country">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {fullAddress && (
              <div className="flex gap-3 py-1 items-center">
                <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Address</span>
                <span className="text-sm text-foreground/80 flex-1 min-w-0 break-words">{fullAddress}</span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void copyText(fullAddress, 'Address')} title="Copy address">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {acc.timezone && (
              <div className="flex gap-3 py-1 items-center">
                <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Timezone</span>
                <span className="text-sm text-foreground/80 flex-1 min-w-0">{acc.timezone}</span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void copyText(acc.timezone!, 'Timezone')} title="Copy timezone">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {accFreelancer && acc.anydesk_id && (
              <div className="flex gap-3 py-1 items-center">
                <span className="text-sm font-medium text-muted-foreground min-w-[140px]">AnyDesk ID</span>
                <span className="text-sm text-foreground/80 flex-1 min-w-0 font-mono">{acc.anydesk_id}</span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void copyText(acc.anydesk_id!, 'AnyDesk ID')} title="Copy AnyDesk ID">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">ID Card</span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => void copyText(acc.uploaded_id_card_url!, 'ID card URL')} title="Copy ID card URL">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <img src={acc.uploaded_id_card_url} alt="Uploaded ID" className="mt-2 rounded-lg border max-h-48 object-contain" />
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {!accFreelancer && (acc.authenticator_enabled != null || !!acc.backup_codes) && (
        <DetailSection icon={Shield} title="Security">
          {acc.authenticator_enabled != null && (
            <InfoRow label="Authenticator (2FA)" value={acc.authenticator_enabled ? 'Enabled' : 'Not enabled'} />
          )}
          {acc.backup_codes && (
            <div className="mt-2">
              <div className="mb-1 flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">Backup codes</p>
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => void copyText(acc.backup_codes!, 'Backup codes')}>
                  <Copy className="h-3 w-3" />
                  Copy all
                </Button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap font-mono">{acc.backup_codes}</pre>
            </div>
          )}
        </DetailSection>
      )}

      <DetailSection icon={ExternalLink} title="Links">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {acc.profile_url && (
            <div className="inline-flex items-center gap-1">
              <a href={acc.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ExternalLink className="h-4 w-4" />{acc.platform === 'github' ? 'GitHub' : 'Profile'}
              </a>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copyText(acc.profile_url!, 'Profile URL')} title="Copy profile URL">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {accFreelancer && acc.github_url && acc.platform !== 'github' && (
            <div className="inline-flex items-center gap-1">
              <a href={acc.github_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Github className="h-4 w-4" />GitHub
              </a>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copyText(acc.github_url!, 'GitHub URL')} title="Copy GitHub URL">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {accFreelancer && acc.linkedin_url && (
            <div className="inline-flex items-center gap-1">
              <a href={acc.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Linkedin className="h-4 w-4" />LinkedIn
              </a>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copyText(acc.linkedin_url!, 'LinkedIn URL')} title="Copy LinkedIn URL">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {accFreelancer && acc.portfolio_url && (
            <div className="inline-flex items-center gap-1">
              <a href={acc.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4" />Portfolio
              </a>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copyText(acc.portfolio_url!, 'Portfolio URL')} title="Copy portfolio URL">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {!acc.profile_url && !(accFreelancer && acc.github_url) && !(accFreelancer && acc.linkedin_url) && !(accFreelancer && acc.portfolio_url) && (
            <p className="text-sm text-muted-foreground">No links available</p>
          )}
        </div>
      </DetailSection>

      <DetailSection icon={Mail} title="Contact">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
          {acc.connected_email && (
            <div className="flex min-w-0 max-w-full items-center gap-1 text-sm text-foreground/80">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-all">{acc.connected_email}</span>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copyText(acc.connected_email!, 'Email')} title="Copy email">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {acc.telephone && (
            <div className="flex items-center gap-1 text-sm text-foreground/80">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{acc.telephone}</span>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copyText(acc.telephone!, 'Phone')} title="Copy phone">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {!acc.connected_email && !acc.telephone && <p className="text-sm text-muted-foreground">No contact info available</p>}
        </div>
      </DetailSection>

      {(accFreelancer || acc.connected_payment_type || paymentAccount) && (
        <DetailSection icon={CreditCard} title="Payment">
          <div className="space-y-1">
            <InfoRow label="Payment Type" value={acc.connected_payment_type ? acc.connected_payment_type.replace('_', ' ') : null} />
            {paymentAccount && (
              <div className="flex gap-3 py-1 items-start">
                <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Linked payment account</span>
                <span className="text-sm text-foreground/80 flex-1 min-w-0 break-words">
                  {paymentProviderLabel(paymentAccount.provider)} — {paymentAccount.label || '—'}
                  {paymentAccount.account_identifier ? ` (${paymentAccount.account_identifier})` : ''}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() =>
                    void copyText(
                      `${paymentProviderLabel(paymentAccount.provider)} — ${paymentAccount.label || '—'}${paymentAccount.account_identifier ? ` (${paymentAccount.account_identifier})` : ''}`,
                      'Linked payment',
                    )
                  }
                  title="Copy linked payment summary"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {!acc.connected_payment_type && !paymentAccount && <p className="text-sm text-muted-foreground">No payment info</p>}
          </div>
        </DetailSection>
      )}

      {acc.notes && (
        <>
          <Separator />
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => void copyText(acc.notes!, 'Notes')}>
                <Copy className="h-3 w-3" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-line">{acc.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default function FreelancingAccounts() {
  const { toast } = useToast();
  const copyText = async (text: string, kind?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: kind ? `${kind} copied to clipboard.` : 'Copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };
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
  const [listViewMode, setListViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');

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
  const goToList = (platform: string) => {
    setView('list');
    setSelectedPlatform(platform);
    setSelectedAccountId(null);
    setListViewMode('table');
  };
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
          ) : listViewMode === 'card' ? (
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
          ) : listViewMode === 'line' ? (
            <Card>
              <CardContent className="p-0">
                {filteredAccounts.map((acc) => (
                  <button key={acc.id} type="button" onClick={() => goToDetail(acc.id)} className="flex w-full items-center justify-between border-t px-3 py-2 text-left first:border-t-0 hover:bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">@{acc.username}</p>
                      <p className="text-xs text-muted-foreground">{acc.profile_title || acc.platform}</p>
                    </div>
                    <Badge variant="secondary" className={cn('text-xs', statusColor[acc.status] || '')}>{acc.status}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : listViewMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Platform</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="border-t hover:bg-muted/30">
                      <td className="cursor-pointer px-3 py-2 font-medium" onClick={() => goToDetail(acc.id)}>@{acc.username}</td>
                      <td className="cursor-pointer px-3 py-2" onClick={() => goToDetail(acc.id)}>{(PLATFORMS[acc.platform] || PLATFORMS.other).label}</td>
                      <td className="cursor-pointer px-3 py-2" onClick={() => goToDetail(acc.id)}>{acc.status}</td>
                      <td className="cursor-pointer px-3 py-2" onClick={() => goToDetail(acc.id)}>{acc.job_success_score != null ? `${acc.job_success_score}%` : '-'}</td>
                      <td className="cursor-pointer px-3 py-2" onClick={() => goToDetail(acc.id)}>{new Date(acc.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Copy username"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyText(acc.username, 'Username');
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAccounts.map((acc) => (
                <Card key={acc.id} className="cursor-pointer hover:border-primary/40" onClick={() => goToDetail(acc.id)}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">@{acc.username}</p>
                      <p className="text-xs text-muted-foreground">{acc.profile_title || (PLATFORMS[acc.platform] || PLATFORMS.other).label}</p>
                    </div>
                    <Badge variant="secondary" className={cn('text-xs', statusColor[acc.status] || '')}>{acc.status}</Badge>
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
