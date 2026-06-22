import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { acquireDriveImageBlobUrl, releaseDriveImageBlobUrl } from '@/lib/driveImageBlobCache';
import {
  extractGoogleDriveFileId,
  googleDrivePreviewUrl,
  isGoogleDriveUrl,
  toEmbeddableImageUrl,
} from '@/lib/externalImageUrl';

type Props = {
  url: string;
  alt?: string;
  className?: string;
  /** Fixed height for carousel slides (e.g. h-[320px]). */
  frameClassName?: string;
};

/**
 * Renders a screenshot from a direct image URL or cloud link (Google Drive, etc.).
 * Google Drive files load through an authenticated edge proxy for private folders.
 */
export default function ScreenshotImage({ url, alt = 'Screenshot', className, frameClassName }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyFailed, setProxyFailed] = useState(false);

  const driveId = isGoogleDriveUrl(url) ? extractGoogleDriveFileId(url) : null;
  const embedSrc = toEmbeddableImageUrl(url);
  const drivePreview = googleDrivePreviewUrl(url);
  const frame = frameClassName ?? 'h-[320px] w-full';

  useEffect(() => {
    if (!driveId) {
      setProxyUrl(null);
      setProxyLoading(false);
      setProxyFailed(false);
      return;
    }

    let cancelled = false;
    setProxyLoading(true);
    setProxyFailed(false);
    setImgFailed(false);

    void acquireDriveImageBlobUrl(driveId)
      .then((blobUrl) => {
        if (cancelled) {
          releaseDriveImageBlobUrl(driveId);
          return;
        }
        setProxyUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setProxyFailed(true);
      })
      .finally(() => {
        if (!cancelled) setProxyLoading(false);
      });

    return () => {
      cancelled = true;
      releaseDriveImageBlobUrl(driveId);
    };
  }, [driveId]);

  if (driveId && proxyLoading && !proxyUrl) {
    return (
      <div className={`flex items-center justify-center rounded border bg-muted/20 ${frame}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (driveId && proxyUrl) {
    return (
      <img
        src={proxyUrl}
        alt={alt}
        className={className ?? `${frame} object-contain bg-muted/30`}
        loading="lazy"
      />
    );
  }

  if (imgFailed && drivePreview && !(driveId && proxyFailed)) {
    return (
      <div className={`flex flex-col overflow-hidden rounded border bg-muted/20 ${frame}`}>
        <iframe
          src={drivePreview}
          title={alt}
          className="min-h-0 flex-1 w-full border-0"
          allow="autoplay"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 border-t bg-muted/40 px-2 py-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open in Google Drive
        </a>
      </div>
    );
  }

  if (imgFailed || (driveId && proxyFailed)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex flex-col items-center justify-center gap-2 rounded border border-dashed bg-muted/30 p-4 text-center text-sm text-primary hover:bg-muted/50 ${frame} ${className ?? ''}`}
      >
        <ExternalLink className="h-5 w-5" />
        <span>Open screenshot in Google Drive</span>
        {driveId ? (
          <span className="max-w-md text-xs text-muted-foreground">
            Could not load via proxy — connect Google Drive in Admin → Settings, or open the file directly.
          </span>
        ) : null}
      </a>
    );
  }

  return (
    <img
      src={embedSrc}
      alt={alt}
      className={className ?? `${frame} object-contain bg-muted/30`}
      onError={() => setImgFailed(true)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
}
