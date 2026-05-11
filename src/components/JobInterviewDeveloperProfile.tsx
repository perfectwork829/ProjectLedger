import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ExternalLink, Github, Linkedin, Mail, Phone, User, MapPin,
  Heart, Briefcase, Star, GraduationCap, Copy, Globe, DollarSign, Building, Languages, Images,
} from 'lucide-react';
import { IdentityDocumentsGallery } from '@/components/IdentityDocumentsFields';
import { formatBirthday, normalizeIdentityDocuments } from '@/lib/identityDocuments';
import { parseProfileBlocks } from '@/lib/personnelProfileBlocks';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';

/**
 * shadcn stores `--background` as space-separated H S% L% (no `hsl()` wrapper).
 * html2canvas parses `backgroundColor` as a single CSS color — raw triples throw
 * "multiple values found when expecting only one".
 */
function canvasRootBackgroundColor(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  if (/^\d/.test(raw) && /%/.test(raw)) {
    return `hsl(${raw.replace(/\s+/g, ' ')})`;
  }
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
    return bodyBg;
  }
  return '#ffffff';
}

/** Personnel row from select('*') — same shape as Personnel page. */
export type DeveloperPersonnelRecord = Record<string, unknown> & {
  id: string;
  role: string;
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
  universities: string | null;
  religion: string | null;
  marriage_status: string | null;
  children_status: string | null;
  skills: string | null;
  achievements: string | null;
  availability_status: string | null;
  employment_status: string | null;
  working_project_name: string | null;
  working_history: string | null;
  main_skill_list: string | null;
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
  preferred_payments?: string | null;
};

interface UniEntry {
  name: string;
  course: string;
  start_date: string;
  end_date: string;
}

function parseUniversities(val: string | null): UniEntry[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function parseTextItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
}

function CopyButton({ value }: { value: string }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value);
        toast({ title: 'Copied', description: value });
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function InfoRow({ label, value, copyable }: { label: string; value: string | null | undefined; copyable?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="min-w-[140px] text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground/90">{value}</span>
      {copyable ? <CopyButton value={value} /> : null}
    </div>
  );
}

function DetailSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

const SEX_OPTIONS: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other' };
const MARRIAGE: Record<string, string> = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widowed' };
const EMPLOYMENT: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', not_employed: 'Not Employed' };

interface LangEntry {
  language: string;
  level: string;
}

function parseLanguages(val: string | null): LangEntry[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

type Props = {
  personnel: DeveloperPersonnelRecord;
  interviewId: string;
  canScreenshot: boolean;
  onScreenshotSaved?: () => void;
};

function BlockTabPanel({ b }: { b: ReturnType<typeof parseProfileBlocks>[0] }) {
  return (
    <div className="space-y-6">
      {b.overview ? (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Overview</p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{b.overview}</p>
        </div>
      ) : null}
      {b.skills.length > 0 && (
        <DetailSection icon={Star} title="Skills">
          <div className="flex flex-wrap gap-2">
            {b.skills.map((s, j) => (
              <Badge key={j} variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
        </DetailSection>
      )}
      {b.achievements.length > 0 && (
        <DetailSection icon={Star} title="Achievements">
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {b.achievements.map((a, j) => (
              <li key={j}>{a}</li>
            ))}
          </ul>
        </DetailSection>
      )}
      {b.experience.length > 0 && (
        <DetailSection icon={Briefcase} title="Experience">
          <div className="space-y-2">
            {b.experience.map((ex, j) => (
              <div key={j} className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{ex.title}</p>
                {(ex.start_date || ex.end_date) && (
                  <p className="text-xs text-muted-foreground">
                    {ex.start_date} – {ex.end_date || 'Present'}
                  </p>
                )}
                {ex.overview ? <p className="mt-1 whitespace-pre-line text-foreground/80">{ex.overview}</p> : null}
              </div>
            ))}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

export function JobInterviewDeveloperProfile({ personnel: p, interviewId, canScreenshot, onScreenshotSaved }: Props) {
  const { toast } = useToast();
  const captureRef = useRef<HTMLDivElement>(null);
  const [shotting, setShotting] = useState(false);
  const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
  const profileBlocks = useMemo(() => parseProfileBlocks(p.profile_blocks_json), [p.profile_blocks_json]);
  const profileOverviews = parseTextItems(p.profile_overviews_json);
  const profileSkills = parseTextItems(p.profile_skills_json);
  const profileAchievements = parseTextItems(p.profile_achievements_json);
  const isDevForJob = p.role === 'developer_for_job';

  const tabValues = useMemo(() => {
    if (profileBlocks.length > 0) {
      return profileBlocks.map((b, i) => ({ value: String(i), label: b.title || `Profile ${i + 1}` }));
    }
    return [{ value: 'summary', label: 'Profile' }];
  }, [profileBlocks]);

  const [activeTab, setActiveTab] = useState(tabValues[0]?.value ?? 'summary');

  const captureScreenshot = async () => {
    const el = captureRef.current;
    if (!el) {
      toast({ title: 'Nothing to capture', variant: 'destructive' });
      return;
    }
    setShotting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: canvasRootBackgroundColor(),
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No image');
      const fileName = `interview-${interviewId}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from('account-files').upload(fileName, blob, { contentType: 'image/png', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('account-files').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;
      const tabLabel = tabValues.find((t) => t.value === activeTab)?.label ?? 'Profile';
      const { error: dbErr } = await supabase.from('job_interview_profile_screenshots').insert({
        interview_id: interviewId,
        image_url: imageUrl,
        tab_label: tabLabel,
      });
      if (dbErr) throw dbErr;
      toast({ title: 'Screenshot saved', description: 'Link is in the list below — copy to share.' });
      onScreenshotSaved?.();
    } catch (e) {
      toast({
        title: 'Screenshot failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setShotting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {p.profile_photo_url ? (
            <img src={p.profile_photo_url} alt="" className="h-16 w-16 rounded-full border object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted text-lg font-semibold text-muted-foreground">
              {p.first_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold text-foreground">{fullName}</h3>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="secondary">{p.role}</Badge>
              {p.timezone ? (
                <Badge variant="outline">
                  <Globe className="mr-1 h-3 w-3" />
                  {String(p.timezone)}
                </Badge>
              ) : null}
              {p.availability_status ? <Badge variant="outline">{String(p.availability_status)}</Badge> : null}
            </div>
          </div>
        </div>
        {canScreenshot ? (
          <Button type="button" variant="outline" size="sm" disabled={shotting} onClick={() => void captureScreenshot()}>
            {shotting ? 'Capturing…' : 'Screenshot this tab'}
          </Button>
        ) : null}
      </div>

      {isDevForJob && profileBlocks.length > 0 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
            {tabValues.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs sm:text-sm">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {profileBlocks.map((b, i) => (
            <TabsContent key={i} value={String(i)} className="mt-4" ref={activeTab === String(i) ? captureRef : undefined}>
              <BlockTabPanel b={b} />
            </TabsContent>
          ))}
        </Tabs>
      ) : isDevForJob && profileOverviews.length > 0 ? (
        <div ref={captureRef} className="space-y-3 rounded-lg border bg-muted/20 p-4">
          {profileOverviews.map((o, i) => (
            <p key={i} className="whitespace-pre-line text-sm text-foreground/90">
              - {o}
            </p>
          ))}
        </div>
      ) : (
        <div ref={captureRef} className="rounded-lg border bg-muted/20 p-4">
          {p.overview ? <p className="whitespace-pre-line text-sm text-foreground/90">{String(p.overview)}</p> : <p className="text-sm text-muted-foreground">No overview on file.</p>}
        </div>
      )}

      {isDevForJob && profileBlocks.length === 0 && profileSkills.length > 0 && (
        <DetailSection icon={Star} title="Skills">
          <div className="flex flex-wrap gap-2">
            {profileSkills.map((s, i) => (
              <Badge key={i} variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
        </DetailSection>
      )}

      <Separator />

      {(p.hourly_rate_main || p.hourly_rate_discussed || p.expected_monthly_salary) && (
        <DetailSection icon={DollarSign} title="Rates & salary">
          <InfoRow label="Hourly (main)" value={p.hourly_rate_main != null ? `$${p.hourly_rate_main}/hr` : undefined} />
          <InfoRow label="Hourly (discussed)" value={p.hourly_rate_discussed != null ? `$${p.hourly_rate_discussed}/hr` : undefined} />
          <InfoRow label="Expected monthly" value={p.expected_monthly_salary != null ? `$${p.expected_monthly_salary}` : undefined} />
        </DetailSection>
      )}

      {parseLanguages(p.languages).length > 0 && (
        <DetailSection icon={Languages} title="Languages">
          <div className="flex flex-wrap gap-2">
            {parseLanguages(p.languages).map((l, i) => (
              <Badge key={i} variant="secondary">
                {l.language}: {l.level}
              </Badge>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection icon={MapPin} title="Location">
        <InfoRow label="Country" value={p.country ?? undefined} />
        <InfoRow label="Address" value={p.address ?? undefined} />
      </DetailSection>

      <DetailSection icon={Phone} title="Communication">
        <InfoRow label="Phone" value={p.phone_number ?? undefined} copyable />
        <InfoRow label="Email" value={p.email ?? undefined} copyable />
        <InfoRow label="Telegram" value={p.telegram ?? undefined} copyable />
        <InfoRow label="WhatsApp" value={p.whatsapp ?? undefined} copyable />
        <InfoRow label="Teams" value={p.teams ?? undefined} copyable />
        <InfoRow label="Discord" value={p.discord_id ?? undefined} copyable />
      </DetailSection>

      {p.preferred_payments ? (
        <DetailSection icon={DollarSign} title="Preferred payments">
          <p className="text-sm text-foreground/90 whitespace-pre-line">{String(p.preferred_payments)}</p>
        </DetailSection>
      ) : null}

      <DetailSection icon={ExternalLink} title="Links">
        <div className="flex flex-wrap gap-3">
          {p.linkedin_url ? (
            <a href={String(p.linkedin_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
          ) : null}
          {p.github_url ? (
            <a href={String(p.github_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Github className="h-4 w-4" />
              GitHub
            </a>
          ) : null}
          {p.portfolio_url ? (
            <a href={String(p.portfolio_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />
              Portfolio
            </a>
          ) : null}
          {p.personal_site_url ? (
            <a href={String(p.personal_site_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Website
            </a>
          ) : null}
        </div>
      </DetailSection>

      {p.resume_cv_url ? (
        <DetailSection icon={Briefcase} title="Resume / CV">
          <a href={String(p.resume_cv_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            Open resume
          </a>
        </DetailSection>
      ) : null}

      <DetailSection icon={User} title="Personal">
        <InfoRow label="Birthday" value={formatBirthday(p.birthday)} />
        <InfoRow label="Employment" value={EMPLOYMENT[String(p.employment_status)] || (p.employment_status ?? undefined)} />
        <InfoRow label="Working type" value={p.working_type === 'agency' ? 'Agency' : p.working_type === 'individual' ? 'Individual' : (p.working_type ?? undefined)} />
      </DetailSection>

      {Object.keys(normalizeIdentityDocuments(p.identity_documents)).length > 0 ? (
        <DetailSection icon={Images} title="Identity documents">
          <IdentityDocumentsGallery documents={p.identity_documents} />
        </DetailSection>
      ) : null}

      <DetailSection icon={GraduationCap} title="Education">
        {parseUniversities(p.universities ?? null).map((u, i) => (
          <div key={i} className="mb-2 rounded bg-muted/30 p-2 text-sm">
            <p className="font-medium">{u.name}</p>
            {u.course ? <p className="text-xs text-muted-foreground">{u.course}</p> : null}
            {(u.start_date || u.end_date) && (
              <p className="text-xs text-muted-foreground">
                {u.start_date} – {u.end_date || 'Present'}
              </p>
            )}
          </div>
        ))}
        <InfoRow label="Religion" value={p.religion ?? undefined} />
        <InfoRow label="Sex" value={p.sex ? SEX_OPTIONS[String(p.sex)] || String(p.sex) : undefined} />
      </DetailSection>

      <DetailSection icon={Heart} title="Family">
        <InfoRow label="Marriage" value={MARRIAGE[String(p.marriage_status)] || (p.marriage_status ?? undefined)} />
        <InfoRow label="Children" value={p.children_status ?? undefined} />
      </DetailSection>

      {p.working_history ? (
        <DetailSection icon={Briefcase} title="Working history">
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{String(p.working_history)}</p>
        </DetailSection>
      ) : null}

      {p.achievements && !isDevForJob ? (
        <DetailSection icon={Star} title="Achievements">
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{String(p.achievements)}</p>
        </DetailSection>
      ) : null}
    </div>
  );
}
