import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import ScreenshotCarousel, { type ScreenshotSlide } from '@/components/ScreenshotCarousel';
import { Button } from '@/components/ui/button';
import { googleDriveEmbeddedFolderUrl } from '@/lib/externalImageUrl';
import { resolveScreenshotSlides } from '@/lib/screenshotDriveFolder';

type Row = { id: string; image_url: string; caption?: string | null };

type Props = {
  rows: Row[];
  folderUrl?: string | null;
  emptyMessage?: string;
};

export default function ResolvedScreenshotCarousel({
  rows,
  folderUrl,
  emptyMessage = 'No screenshots yet.',
}: Props) {
  const [slides, setSlides] = useState<ScreenshotSlide[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const rowsKey = useMemo(
    () => rows.map((r) => `${r.id}:${r.image_url}`).join('|'),
    [rows],
  );

  const folderKey = folderUrl?.trim() ?? '';

  useEffect(() => {
    let cancelled = false;
    const currentRows = rowsRef.current;

    if (!folderKey && currentRows.length === 0) {
      setSlides([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const resolved = await resolveScreenshotSlides(currentRows, folderUrl);
        if (cancelled) return;
        setSlides(
          resolved.map((s) => ({
            id: s.id,
            image_url: s.image_url,
            caption: s.caption,
          })),
        );
        if (resolved.length === 0 && folderKey) {
          setError(
            'No images found in this folder. Use a /drive/folders/… link, share the folder and each image as Anyone with the link, and upload PNG/JPG files (not Google Docs).',
          );
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not load screenshots');
        setSlides([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rowsKey, folderKey, folderUrl, reloadToken]);

  const embeddedFolder = folderUrl ? googleDriveEmbeddedFolderUrl(folderUrl) : null;
  const showInitialLoading = loading && slides.length === 0;

  return (
    <div className="space-y-3">
      {folderUrl ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground break-all flex-1 min-w-0">
            Drive folder:{' '}
            <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {folderUrl}
            </a>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 shrink-0"
            onClick={() => setReloadToken((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading && slides.length > 0 ? 'animate-spin' : ''}`} />
            Reload
          </Button>
        </div>
      ) : null}

      {showInitialLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading screenshots…
        </div>
      ) : null}

      {!showInitialLoading && error && slides.length === 0 ? (
        <p className="whitespace-pre-wrap text-sm text-amber-700 dark:text-amber-400">{error}</p>
      ) : null}

      {slides.length > 0 ? (
        <div className="relative">
          {loading ? (
            <div className="absolute right-0 top-0 z-10 flex items-center gap-1 rounded-md border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </div>
          ) : null}
          <ScreenshotCarousel slides={slides} emptyMessage={emptyMessage} />
        </div>
      ) : null}

      {!showInitialLoading && slides.length === 0 && embeddedFolder ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Folder preview (open in Drive if images do not load above).</p>
          <div className="overflow-hidden rounded-lg border bg-muted/20">
            <iframe
              src={embeddedFolder}
              title="Google Drive screenshots folder"
              className="h-[min(440px,52vh)] w-full border-0"
              allow="autoplay"
            />
          </div>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={folderUrl!} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open folder in Google Drive
            </a>
          </Button>
        </div>
      ) : null}

      {!showInitialLoading && slides.length === 0 && !embeddedFolder && !folderUrl ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
