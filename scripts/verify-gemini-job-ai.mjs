/**
 * Quick check that Gemini works with the same request shape as job-application-ai.
 *
 * Usage (PowerShell):
 *   $env:GEMINI_API_KEY = "AIza..."
 *   node scripts/verify-gemini-job-ai.mjs
 */

const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite';

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Get one at https://aistudio.google.com/apikey');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const body = {
  systemInstruction: {
    parts: [{ text: 'You write short professional cover letter openings. Plain text only.' }],
  },
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: 'Write one sentence for a software engineer applying to Acme Corp for a Backend Engineer role.',
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.65,
    maxOutputTokens: 256,
  },
};

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  body: JSON.stringify(body),
});

const json = await res.json();

if (!res.ok) {
  console.error('Gemini API error:', JSON.stringify(json, null, 2));
  process.exit(2);
}

const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
if (!text) {
  console.error('Gemini returned no text:', JSON.stringify(json, null, 2));
  process.exit(3);
}

console.log('OK — Gemini is working');
console.log('Model:', model);
console.log('Sample output:\n');
console.log(text);
