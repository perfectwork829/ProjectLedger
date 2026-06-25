import { SOURCE_PLATFORMS, type EmploymentType } from '@/lib/jobApplications';

export interface ParsedJobPosting {
  company_name: string;
  job_title: string;
  employment_types: EmploymentType[];
  compensation: string;
  location: string;
  source_platform: string;
  job_link: string;
  job_description: string;
}

const EMPLOYMENT_KEYWORDS: { type: EmploymentType; patterns: RegExp[] }[] = [
  { type: 'full_time', patterns: [/full[-\s]?time/i, /\bFTE\b/] },
  { type: 'part_time', patterns: [/part[-\s]?time/i] },
  { type: 'contract', patterns: [/contract/i, /C2C/i, /corp[-\s]?to[-\s]?corp/i] },
  { type: 'freelance', patterns: [/freelance/i, /1099/i] },
  { type: 'remote', patterns: [/remote/i, /work from home/i, /WFH/i] },
  { type: 'hybrid', patterns: [/hybrid/i] },
  { type: 'onsite', patterns: [/on[-\s]?site/i, /in[-\s]?office/i] },
];

function firstUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  return m ? m[0].replace(/[.,;]+$/, '') : '';
}

function detectSourceFromUrl(url: string): string {
  const host = url.toLowerCase();
  if (host.includes('linkedin.com')) return 'linkedin';
  if (host.includes('indeed.com')) return 'indeed';
  if (host.includes('ziprecruiter.com')) return 'ziprecruiter';
  if (host.includes('dice.com')) return 'dice';
  if (host.includes('glassdoor.com')) return 'glassdoor';
  if (host.includes('monster.com')) return 'monster';
  return 'company_website';
}

function lineValue(text: string, labels: string[]): string {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    for (const label of labels) {
      const re = new RegExp(`^${label}\\s*[:\\-–]\\s*(.+)$`, 'i');
      const m = trimmed.match(re);
      if (m?.[1]) return m[1].trim();
    }
  }
  return '';
}

function detectEmploymentTypes(text: string): EmploymentType[] {
  const found = new Set<EmploymentType>();
  for (const { type, patterns } of EMPLOYMENT_KEYWORDS) {
    if (patterns.some((p) => p.test(text))) found.add(type);
  }
  return [...found];
}

function guessJobTitle(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titleFromLabel = lineValue(text, ['job title', 'position', 'role', 'title']);
  if (titleFromLabel) return titleFromLabel.slice(0, 200);

  for (const line of lines.slice(0, 8)) {
    if (line.length < 8 || line.length > 120) continue;
    if (/^(about|description|responsibilities|requirements|qualifications|benefits)\b/i.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/\bat\b/i.test(line) && line.length < 80) return line;
    if (/engineer|developer|manager|designer|analyst|architect|lead|director|specialist/i.test(line)) {
      return line.slice(0, 200);
    }
  }
  return lines[0]?.slice(0, 200) || '';
}

function guessCompanyName(text: string, jobTitle: string): string {
  const fromLabel = lineValue(text, ['company', 'employer', 'organization', 'hiring company']);
  if (fromLabel) return fromLabel.slice(0, 200);

  const atMatch = jobTitle.match(/\bat\s+(.+)$/i);
  if (atMatch?.[1]) return atMatch[1].trim().slice(0, 200);

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    const m = line.match(/(?:hiring|join)\s+(?:at\s+)?([A-Z][\w&.'\- ]{2,60})/i);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function guessCompensation(text: string): string {
  const fromLabel = lineValue(text, ['salary', 'compensation', 'pay', 'rate']);
  if (fromLabel) return fromLabel.slice(0, 120);
  const m = text.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*\/\s*(?:yr|year|hour|hr|annum))?/i);
  return m ? m[0] : '';
}

function guessLocation(text: string): string {
  const fromLabel = lineValue(text, ['location', 'city', 'office location', 'work location']);
  if (fromLabel) return fromLabel.slice(0, 200);
  const m = text.match(/\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})\b/);
  return m ? m[0] : '';
}

/** Heuristic parser for pasted job postings (works offline; AI can replace later). */
export function parseJobPostingPaste(raw: string): ParsedJobPosting {
  const text = raw.trim();
  const job_link = firstUrl(text);
  const source_platform = job_link ? detectSourceFromUrl(job_link) : 'other';
  const job_title = guessJobTitle(text);
  const company_name = guessCompanyName(text, job_title);
  const employment_types = detectEmploymentTypes(text);
  const compensation = guessCompensation(text);
  const location = guessLocation(text);

  let job_description = text;
  const descHeader = text.search(/\b(job description|about (?:the )?role|responsibilities|what you(?:'|')?ll do)\b/i);
  if (descHeader > 0 && descHeader < 800) {
    job_description = text.slice(descHeader).trim();
  }

  return {
    company_name,
    job_title: job_title.replace(/\s+at\s+.+$/i, '').trim(),
    employment_types,
    compensation,
    location,
    source_platform,
    job_link,
    job_description,
  };
}

export function allSourceOptions(customSources: string[] = []): { value: string; label: string }[] {
  const base = SOURCE_PLATFORMS.map((s) => ({ value: s.value, label: s.label }));
  const extras = customSources
    .filter((s) => !base.some((b) => b.value === s.toLowerCase().replace(/\s+/g, '_')))
    .map((s) => ({ value: s.toLowerCase().replace(/\s+/g, '_'), label: s }));
  return [...base, ...extras];
}
