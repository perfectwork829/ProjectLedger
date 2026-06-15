import { CopyDescriptionButton } from '@/components/CopyDescriptionButton';

const PROSE_CLASS =
  'prose prose-sm mt-2 max-w-none text-muted-foreground break-words [overflow-wrap:anywhere] [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-primary [&_a]:break-all [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted/40 [&_th]:p-2 [&_td]:p-2 [&_th]:text-left [&_td]:align-top';

const DEFAULT_EMPTY = '<p>No README yet. Use Edit to add overview, installation, known issues, and versions.</p>';

type ReadmePanelProps = {
  readme: string | null | undefined;
  emptyHtml?: string;
  className?: string;
};

export function ReadmePanel({ readme, emptyHtml = DEFAULT_EMPTY, className }: ReadmePanelProps) {
  return (
    <div className={className ?? 'rounded-lg border p-3'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">README</p>
        <CopyDescriptionButton description={readme ?? null} />
      </div>
      <div
        className={PROSE_CLASS}
        dangerouslySetInnerHTML={{ __html: readme?.trim() ? readme : emptyHtml }}
      />
    </div>
  );
}

export const README_EDITOR_PLACEHOLDER =
  'Overview, how to install or run, known issues, version history…';
