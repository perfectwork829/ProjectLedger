import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

type TagChipsInputProps = {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional default / suggested tags shown as clickable chips. */
  suggestions?: readonly string[];
};

function splitTokens(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TagChipsInput({ label, values, onChange, placeholder, suggestions }: TagChipsInputProps) {
  const [draft, setDraft] = useState('');

  const addTags = (parts: string[]) => {
    if (parts.length === 0) return;
    const next = [...values];
    for (const p of parts) {
      const t = p.trim();
      if (!t) continue;
      if (!next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    }
    onChange(next);
  };

  const commitDraft = () => {
    const parts = splitTokens(draft);
    if (parts.length === 0) return;
    addTags(parts);
    setDraft('');
  };

  const remove = (v: string) => {
    onChange(values.filter((x) => x !== v));
  };

  const unusedSuggestions = (suggestions || []).filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2 min-h-[42px] items-center">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1 font-normal">
            {v}
            <button
              type="button"
              className="rounded-sm p-0.5 hover:bg-muted hover:text-destructive"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          className="h-8 min-w-[140px] flex-1 border-0 shadow-none focus-visible:ring-0 px-2"
          value={draft}
          placeholder={placeholder || 'Type and press Enter or comma'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commitDraft();
            } else if (e.key === 'Backspace' && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commitDraft();
          }}
        />
      </div>
      {unusedSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {unusedSuggestions.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-normal text-muted-foreground"
              onClick={() => addTags([s])}
            >
              + {s}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
