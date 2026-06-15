import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { googleDrivePreviewUrl, isGoogleDriveUrl, toEmbeddableImageUrl } from '@/lib/externalImageUrl';

type Props = {
  url: string;
  alt?: string;
  className?: string;
  /** Fixed height for carousel slides (e.g. h-[320px]). */
  frameClassName?: string;
};

/**
 * Renders a screenshot from a direct image URL or cloud link (Google Drive, etc.).
 * Falls back to Drive preview iframe, then an open-link panel.
 */
export default function ScreenshotImage({ url, alt = 'Screenshot', className, frameClassName }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const embedSrc = toEmbeddableImageUrl(url);
  const drivePreview = googleDrivePreviewUrl(url);
  const frame = frameClassName ?? 'h-[320px] w-full';

  if (imgFailed && drivePreview) {
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

  if (imgFailed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex flex-col items-center justify-center gap-2 rounded border border-dashed bg-muted/30 p-4 text-center text-sm text-primary hover:bg-muted/50 ${frame} ${className ?? ''}`}
      >
        <ExternalLink className="h-5 w-5" />
        <span>Open screenshot link</span>
        {isGoogleDriveUrl(url) ? (
          <span className="text-xs text-muted-foreground max-w-md">
            Set sharing to &quot;Anyone with the link&quot; on Google Drive for inline preview.
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
