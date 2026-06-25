import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ImportantNoteCard({
  note,
  className,
}: {
  note: string | null | undefined;
  className?: string;
}) {
  if (!note?.trim()) return null;
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30',
        className,
      )}
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
        <StickyNote className="h-3.5 w-3.5" />
        Important note
      </p>
      <p className="whitespace-pre-line text-sm text-foreground/90">{note}</p>
    </div>
  );
}
