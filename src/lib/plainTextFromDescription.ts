/** Strip HTML for clipboard / search; keeps plain text descriptions as-is. */
export function plainTextFromDescription(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const looksLikeHtml = /<[a-z!/][\s\S]*>/i.test(s);
  if (!looksLikeHtml) return s;
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.innerHTML = s;
    return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
  }
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
