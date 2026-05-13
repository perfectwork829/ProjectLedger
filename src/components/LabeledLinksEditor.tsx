import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LabeledLink } from '@/lib/taskPool';
import { Trash2 } from 'lucide-react';

export function LabeledLinksEditor({
  links: linksProp,
  onChange,
  newRowLabel,
}: {
  links: LabeledLink[] | undefined;
  onChange: (v: LabeledLink[]) => void;
  newRowLabel: string;
}) {
  const links = linksProp ?? [];
  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center">
          <Input
            className="max-w-[140px]"
            placeholder="Label"
            value={link.label}
            onChange={(e) => {
              const n = [...links];
              n[i] = { ...n[i], label: e.target.value };
              onChange(n);
            }}
          />
          <Input
            className="flex-1 min-w-[200px]"
            placeholder="https://…"
            value={link.url}
            onChange={(e) => {
              const n = [...links];
              n[i] = { ...n[i], url: e.target.value };
              onChange(n);
            }}
          />
          <Button type="button" size="icon" variant="outline" onClick={() => onChange(links.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...links, { label: newRowLabel, url: '' }])}>
        Add link
      </Button>
    </div>
  );
}
