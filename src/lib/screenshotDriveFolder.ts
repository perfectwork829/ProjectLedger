import { listDriveFolderImages, type DriveFolderImage } from '@/lib/driveFolderList';
import { isGoogleDriveFolderUrl, parseUrlLines } from '@/lib/externalImageUrl';

export const SCREENSHOTS_DRIVE_FOLDER_META_KEY = 'screenshots_drive_folder_url';

export type ScreenshotSlideRow = { id: string; image_url: string; caption: string | null };

export function screenshotsFolderFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
  const v = metadata?.[SCREENSHOTS_DRIVE_FOLDER_META_KEY];
  return typeof v === 'string' ? v.trim() : '';
}

/** Direct image URLs saved in project_screenshots / task_pool_screenshots (not folder links). */
export function storedScreenshotSlides(
  rows: { id: string; image_url: string; caption?: string | null }[],
): ScreenshotSlideRow[] {
  return rows
    .filter((r) => r.image_url?.trim() && !isGoogleDriveFolderUrl(r.image_url))
    .map((r) => ({
      id: r.id,
      image_url: r.image_url,
      caption: r.caption ?? null,
    }));
}

export function screenshotsToFormFields(
  rows: { image_url: string }[],
  metadata: Record<string, unknown> | null | undefined,
): { screenshotsDriveFolderUrl: string } {
  const fromMeta = screenshotsFolderFromMetadata(metadata);
  if (fromMeta) {
    return { screenshotsDriveFolderUrl: fromMeta };
  }
  const folderLine = rows.map((r) => r.image_url.trim()).find((u) => isGoogleDriveFolderUrl(u));
  return { screenshotsDriveFolderUrl: folderLine || '' };
}

export function validateScreenshotsFolderUrl(folderUrl: string): string | null {
  const folder = folderUrl.trim();
  if (!folder) return null;
  if (!isGoogleDriveFolderUrl(folder)) {
    throw new Error('Screenshots folder must be a Google Drive folder link (…/drive/folders/…).');
  }
  return folder;
}

/** Build carousel slides from folder URL (live) plus any extra direct URLs in the database. */
export async function resolveScreenshotSlides(
  rows: { id: string; image_url: string; caption?: string | null }[],
  folderUrlFromMeta?: string | null,
): Promise<ScreenshotSlideRow[]> {
  const extras = storedScreenshotSlides(rows);
  const folder = folderUrlFromMeta?.trim() || '';

  if (!folder) {
    return extras.length > 0
      ? extras
      : rows
          .filter((r) => r.image_url?.trim())
          .map((r) => ({ id: r.id, image_url: r.image_url, caption: r.caption ?? null }));
  }

  const images: DriveFolderImage[] = await listDriveFolderImages(folder);
  const fromFolder = images.map((img, i) => ({
    id: `folder-${img.id}-${i}`,
    image_url: img.image_url,
    caption: img.name || null,
  }));
  return [...fromFolder, ...extras];
}

/** Extra direct screenshot URLs (optional) stored in the screenshots table. */
export function parseExtraScreenshotUrls(text: string): string[] {
  return parseUrlLines(text).filter((u) => !isGoogleDriveFolderUrl(u));
}
