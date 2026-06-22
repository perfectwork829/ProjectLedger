import { fetchGoogleDriveFileImageBlob } from '@/lib/cloud/googleDrive';

type CacheEntry = {
  url: string;
  refCount: number;
  promise: Promise<string> | null;
  released: boolean;
};

const cache = new Map<string, CacheEntry>();

function finalizeEntry(fileId: string, entry: CacheEntry, url: string): string {
  entry.url = url;
  entry.promise = null;
  if (entry.released || entry.refCount <= 0) {
    URL.revokeObjectURL(url);
    cache.delete(fileId);
    throw new Error('Drive image request cancelled');
  }
  return url;
}

/** Reuse blob URLs for the same Drive file id across remounts / carousel slides. */
export async function acquireDriveImageBlobUrl(fileId: string): Promise<string> {
  const existing = cache.get(fileId);
  if (existing) {
    existing.refCount += 1;
    existing.released = false;
    if (existing.promise) return existing.promise;
    if (existing.url) return existing.url;
  }

  const entry: CacheEntry = { url: '', refCount: 1, promise: null, released: false };
  cache.set(fileId, entry);

  entry.promise = fetchGoogleDriveFileImageBlob(fileId)
    .then((blob) => finalizeEntry(fileId, entry, URL.createObjectURL(blob)))
    .catch((err) => {
      if (cache.get(fileId) === entry) cache.delete(fileId);
      throw err;
    });

  return entry.promise;
}

export function releaseDriveImageBlobUrl(fileId: string): void {
  const entry = cache.get(fileId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;
  entry.released = true;
  if (entry.promise) return;
  if (entry.url) URL.revokeObjectURL(entry.url);
  cache.delete(fileId);
}
