import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  action: 'cover_letter' | 'tailored_resume';
  company_name?: string;
  job_title?: string;
  job_description?: string;
  master_resume_text?: string;
  cover_letter_name?: string;
  cover_letter_prefix?: string;
  cover_letter_infix?: string;
  cover_letter_sentences?: number;
  location?: string;
  compensation?: string;
};

const MAX_JOB_DESC_CHARS = 12_000;
const MAX_RESUME_CHARS = 20_000;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[truncated for length]`;
}

function buildCoverLetterPrompt(body: Body): { system: string; user: string } {
  const name = body.cover_letter_name?.trim() || 'Your Name';
  const prefix = body.cover_letter_prefix?.trim() || 'Dear Hiring Manager';
  const infix = body.cover_letter_infix?.trim() || 'Sincerely';
  const sentences = Math.min(Math.max(body.cover_letter_sentences ?? 4, 2), 8);

  const system = `You write professional job application cover letters. Output plain text only (no markdown, no code fences). Be specific and natural. Never invent employers, degrees, certifications, or skills that are not supported by the candidate resume.`;

  const parts = [
    `Write a tailored cover letter for this job application.`,
    `Opening greeting: start with "${prefix}"`,
    `Closing: end with "${infix}," on its own line, then "${name}" on the next line.`,
    `Length: about ${sentences} concise paragraphs (or short paragraphs plus a few bullet points drawn from real resume experience).`,
    `Mirror relevant keywords from the job description only where they honestly match the resume.`,
    ``,
    `Company: ${body.company_name?.trim() || '(not specified)'}`,
    `Role: ${body.job_title?.trim() || '(not specified)'}`,
  ];
  if (body.location?.trim()) parts.push(`Location: ${body.location.trim()}`);
  if (body.compensation?.trim()) parts.push(`Compensation: ${body.compensation.trim()}`);
  parts.push(
    ``,
    `Job description:`,
    truncate(body.job_description || '', MAX_JOB_DESC_CHARS) || '(not provided)',
    ``,
    `Candidate master resume:`,
    truncate(body.master_resume_text || '', MAX_RESUME_CHARS) || '(not provided — write a general letter without fabricated experience)',
  );

  return { system, user: parts.join('\n') };
}

function buildTailoredResumePrompt(body: Body): { system: string; user: string } {
  const system = `You are an expert resume writer and ATS specialist. Output a plain-text tailored resume only (no markdown, no code fences). Rules:
- Keep all facts truthful: do not invent jobs, dates, companies, titles, or skills.
- Reorganize and rephrase existing content to emphasize relevance to the target role.
- Use clear section headings (e.g. SUMMARY, EXPERIENCE, SKILLS, EDUCATION) when the source resume has that structure.
- Prefer bullet points for achievements.
- Naturally weave in ATS keywords from the job description only when supported by the resume.`;

  const user = [
    `Tailor this master resume for the target role.`,
    ``,
    `Target role: ${body.job_title?.trim() || '(not specified)'}`,
    `Company: ${body.company_name?.trim() || '(not specified)'}`,
    ``,
    `Job description:`,
    truncate(body.job_description || '', MAX_JOB_DESC_CHARS) || '(not provided)',
    ``,
    `Master resume:`,
    truncate(body.master_resume_text || '', MAX_RESUME_CHARS),
  ].join('\n');

  return { system, user };
}

async function callGemini(
  apiKey: string,
  system: string,
  user: string,
  maxOutputTokens: number,
): Promise<string> {
  const model = Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: user }],
        },
      ],
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens,
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    const msg =
      (json.error?.message as string) ||
      (json.error?.status as string) ||
      `Gemini request failed (${res.status})`;
    if (/API key not valid|API_KEY_INVALID/i.test(msg)) {
      throw new Error(
        `${msg} Use a Gemini key from https://aistudio.google.com/apikey (not a Google Drive–only key).`,
      );
    }
    if (/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) {
      throw new Error(`${msg} Free tier daily limit may be reached — try again later or switch GEMINI_MODEL.`);
    }
    throw new Error(msg);
  }

  const parts = json.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p.text || '').join('').trim()
    : '';
  if (!text) {
    const blockReason = json.candidates?.[0]?.finishReason as string | undefined;
    throw new Error(blockReason ? `Gemini blocked response: ${blockReason}` : 'Gemini returned an empty response');
  }

  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return json(
        { error: userErr?.message || 'Unauthorized — sign in and try again' },
        401,
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      return json(
        {
          error:
            'Server missing GEMINI_API_KEY. Create a free key at https://aistudio.google.com/apikey (Generative Language API), then run: supabase secrets set GEMINI_API_KEY=AIza... --project-ref udxgnisxhcnhzrndnmdc and redeploy job-application-ai. Note: GOOGLE_API_KEY for Google Drive is not the same key.',
        },
        500,
      );
    }

    const body = (await req.json()) as Body;
    if (body.action !== 'cover_letter' && body.action !== 'tailored_resume') {
      return json({ error: 'action must be cover_letter or tailored_resume' }, 400);
    }

    if (body.action === 'tailored_resume' && !body.master_resume_text?.trim()) {
      return json({ error: 'master_resume_text is required for tailored resume' }, 400);
    }

    const prompts =
      body.action === 'cover_letter'
        ? buildCoverLetterPrompt(body)
        : buildTailoredResumePrompt(body);

    const model = Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
    const text = await callGemini(
      apiKey,
      prompts.system,
      prompts.user,
      body.action === 'cover_letter' ? 2048 : 8192,
    );

    return json({ text, model, provider: 'gemini' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
