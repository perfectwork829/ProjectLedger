import type { JobApplicationSettingsRow } from '@/lib/jobApplications';

function extractResumeBullets(resume: string, max = 6): string[] {
  return resume
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-*]+/, '').trim())
    .filter((l) => l.length > 20)
    .slice(0, max);
}

function matchKeywords(jobDescription: string, resume: string): string[] {
  const desc = jobDescription.toLowerCase();
  const words = resume
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 3);
  const unique = [...new Set(words)];
  return unique.filter((w) => desc.includes(w)).slice(0, 12);
}

export function generateCoverLetter(opts: {
  company_name: string;
  job_title: string;
  job_description: string;
  settings: Pick<
    JobApplicationSettingsRow,
    'cover_letter_name' | 'cover_letter_prefix' | 'cover_letter_infix' | 'cover_letter_sentences' | 'master_resume_text'
  >;
}): string {
  const { company_name, job_title, job_description, settings } = opts;
  const name = settings.cover_letter_name?.trim() || 'Your Name';
  const keywords = matchKeywords(job_description, settings.master_resume_text || '');
  const bullets = extractResumeBullets(settings.master_resume_text || '', settings.cover_letter_sentences);

  const intro = `${settings.cover_letter_prefix},\n\nI am writing to express my interest in the ${job_title || 'open'} position${company_name ? ` at ${company_name}` : ''}.`;

  const skillLine =
    keywords.length > 0
      ? `My background aligns with your needs in areas such as ${keywords.slice(0, 5).join(', ')}.`
      : 'My experience aligns closely with the responsibilities outlined in your posting.';

  const body =
    bullets.length > 0
      ? bullets.map((b) => `• ${b}`).join('\n')
      : '• I bring relevant hands-on experience and a track record of delivering quality work on schedule.';

  const closing = `I would welcome the opportunity to discuss how I can contribute to your team.\n\n${settings.cover_letter_infix},\n${name}`;

  return [intro, skillLine, body, closing].join('\n\n');
}

export function generateTailoredResume(opts: {
  job_title: string;
  job_description: string;
  master_resume_text: string;
}): string {
  const { job_title, job_description, master_resume_text } = opts;
  if (!master_resume_text.trim()) {
    return 'Add your master resume on this page (paste or attach .docx) to generate tailored versions.';
  }
  const keywords = matchKeywords(job_description, master_resume_text);
  const header = job_title ? `TARGET ROLE: ${job_title}\n\n` : '';
  const keywordLine = keywords.length > 0 ? `KEYWORDS MATCHED FOR ATS:\n${keywords.join(' · ')}\n\n` : '';
  return `${header}${keywordLine}${master_resume_text.trim()}`;
}
