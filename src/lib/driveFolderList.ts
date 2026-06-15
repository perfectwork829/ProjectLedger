import { googleDriveListFolderImagesViaEdge } from '@/lib/cloud/googleDrive';
import { extractGoogleDriveFolderId } from '@/lib/externalImageUrl';

export type DriveFolderImage = {
  id: string;
  name: string;
  image_url: string;
};

function folderIdFromInput(folderUrlOrId: string): string | null {
  const t = folderUrlOrId.trim();
  return extractGoogleDriveFolderId(t) ?? (/^[a-zA-Z0-9_-]{10,}$/.test(t) ? t : null);
}

/**
 * List images in a shared Google Drive folder.
 * Uses the edge function (reads public folder HTML) — no API key or Drive connect required
 * when the folder and images are shared with Anyone with the link.
 */
export async function listDriveFolderImages(folderUrlOrId: string): Promise<DriveFolderImage[]> {
  const folderId = folderIdFromInput(folderUrlOrId);
  if (!folderId) {
    throw new Error('Invalid Google Drive folder link (use …/drive/folders/…).');
  }

  return googleDriveListFolderImagesViaEdge(folderUrlOrId);
}
