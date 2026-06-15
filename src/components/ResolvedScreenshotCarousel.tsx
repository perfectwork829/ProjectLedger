import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async () => {
    if (!folderUrl?.trim() && rows.length === 0) {
      setSlides([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resolved = await resolveScreenshotSlides(rows, folderUrl);
      setSlides(
        resolved.map((s) => ({
          id: s.id,
          image_url: s.image_url,
          caption: s.caption,
        })),
      );
      if (resolved.length === 0 && folderUrl?.trim()) {
        setError(
          'No images found in this folder. Use a /drive/folders/… link, share the folder and each image as Anyone with the link, and upload PNG/JPG files (not Google Docs).',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load screenshots');
      setSlides([]);
    } finally {
      setLoading(false);
    }
  }, [rows, folderUrl]);

  const rowsKey = rows.map((r) => `${r.id}:${r.image_url}`).join('|');

  useEffect(() => {
    void load();
  }, [load, rowsKey, folderUrl, reloadToken]);

  const embeddedFolder = folderUrl ? googleDriveEmbeddedFolderUrl(folderUrl) : null;

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
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading screenshots…
        </div>
      ) : null}

      {!loading && error && slides.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
      ) : null}

      {!loading && slides.length > 0 ? (
        <ScreenshotCarousel slides={slides} emptyMessage={emptyMessage} />
      ) : null}

      {!loading && slides.length === 0 && embeddedFolder ? (
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

      {!loading && slides.length === 0 && !embeddedFolder && !folderUrl ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
