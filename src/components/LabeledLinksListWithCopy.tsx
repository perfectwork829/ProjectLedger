import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { externalHref, normalizeExternalUrl } from '@/lib/externalUrl';
import type { LabeledLink } from '@/lib/taskPool';
import { Copy } from 'lucide-react';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function UrlFieldWithCopy({ label, url }: { label: string; url: string | null }) {
  const { toast } = useToast();
  const trimmed = url?.trim() || '';
  return (
    <div className="rounded border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground">{label}</p>
      {trimmed ? (
        <div className="mt-1 flex items-start gap-2">
          <a href={externalHref(trimmed)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all flex-1 min-w-0">
            {trimmed}
          </a>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            title="Copy link"
            onClick={async () => {
              const ok = await copyToClipboard(normalizeExternalUrl(trimmed) || trimmed);
              if (ok) toast({ title: 'Copied', description: 'Link copied to clipboard.' });
              else toast({ title: 'Copy failed', variant: 'destructive' });
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-1">N/A</p>
      )}
    </div>
  );
}

export function LabeledLinksListWithCopy({
  title,
  links,
  className,
  embedded,
  emptyHint,
}: {
  title: string;
  links: LabeledLink[];
  className?: string;
  /** Inline under another card (no outer panel). */
  embedded?: boolean;
  /** Override default empty-state message. */
  emptyHint?: string;
}) {
  const { toast } = useToast();

  const shell = embedded
    ? `space-y-1 ${className ?? ''}`
    : `rounded border p-3 bg-muted/20 ${className ?? ''}`;
  const titleCls = embedded ? 'text-[11px] font-medium text-muted-foreground' : 'text-xs text-muted-foreground mb-2';
  const emptyCls = embedded ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground';
  const linkCls = embedded ? 'text-xs text-primary hover:underline break-all' : 'text-sm text-primary hover:underline break-all';
  const btnCls = embedded ? 'h-7 w-7 shrink-0' : 'h-8 w-8 shrink-0';

  const defaultEmpty =
    emptyHint ??
    (embedded
      ? 'No published links for this task yet.'
      : 'No published links yet. Add them in Edit → “Published / live site / app store links” (or the same block on task pool items).');

  return (
    <div className={shell}>
      {title ? <p className={titleCls}>{title}</p> : null}
      {links.length === 0 ? (
        <p className={emptyCls}>{defaultEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l, i) => (
            <li key={`${l.url}-${i}`} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-foreground">{l.label}: </span>
                <a href={externalHref(l.url)} target="_blank" rel="noopener noreferrer" className={linkCls}>
                  {l.url}
                </a>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={btnCls}
                title="Copy link"
                onClick={async () => {
                  const ok = await copyToClipboard(normalizeExternalUrl(l.url) || l.url);
                  if (ok) toast({ title: 'Copied', description: 'Link copied to clipboard.' });
                  else toast({ title: 'Copy failed', variant: 'destructive' });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
