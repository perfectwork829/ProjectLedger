/** Extract Google Drive file id from common sharing / view URLs. */
export function extractGoogleDriveFileId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /[?&]id=([a-zA-Z0-9_-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com/i.test(url);
}

/** Google Drive folder sharing URL (not a single file). */
export function extractGoogleDriveFolderId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (folderMatch?.[1]) return folderMatch[1];
  return null;
}

export function isGoogleDriveFolderUrl(url: string): boolean {
  return isGoogleDriveUrl(url) && extractGoogleDriveFolderId(url) !== null;
}

/** Grid embed for a public Drive folder (no OAuth; works when folder is shared with link). */
export function googleDriveEmbeddedFolderUrl(folderUrlOrId: string): string | null {
  const id = extractGoogleDriveFolderId(folderUrlOrId) ?? (/^[a-zA-Z0-9_-]{10,}$/.test(folderUrlOrId.trim()) ? folderUrlOrId.trim() : null);
  if (!id) return null;
  return `https://drive.google.com/embeddedfolderview?id=${id}#grid`;
}

/** URL suitable for `<img src>` — converts Drive view links to export/view when possible. */
export function toEmbeddableImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return `https://drive.google.com/uc?export=view&id=${driveId}`;
  }

  if (/dropbox\.com/i.test(trimmed)) {
    return trimmed.replace(/\?dl=0\b/, '?raw=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
  }

  return trimmed;
}

/** Google Drive embedded preview (works for many shared files when img export fails). */
export function googleDrivePreviewUrl(url: string): string | null {
  const id = extractGoogleDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function parseUrlLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
