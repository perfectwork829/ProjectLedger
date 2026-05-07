import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

type TagChipsInputProps = {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

function splitTokens(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TagChipsInput({ label, values, onChange, placeholder }: TagChipsInputProps) {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const parts = splitTokens(draft);
    if (parts.length === 0) return;
    const next = [...values];
    for (const p of parts) {
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft('');
  };

  const remove = (v: string) => {
    onChange(values.filter((x) => x !== v));
  };

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
    </div>
  );
}
