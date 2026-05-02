import { Label } from '@/components/ui/label';
import ImageGalleryUpload from '@/components/ImageGalleryUpload';
import {
  IDENTITY_DOC_KEYS,
  IDENTITY_DOC_LABELS,
  type IdentityDocuments,
  normalizeIdentityDocuments,
} from '@/lib/identityDocuments';

interface IdentityDocumentsEditorProps {
  value: IdentityDocuments;
  onChange: (next: IdentityDocuments) => void;
  /** Storage folder prefix under account-files bucket */
  folder: string;
}

export function IdentityDocumentsEditor({ value, onChange, folder }: IdentityDocumentsEditorProps) {
  const setKey = (key: (typeof IDENTITY_DOC_KEYS)[number], urls: string[]) => {
    const next = { ...value };
    if (urls.length === 0) delete next[key];
    else next[key] = urls;
    onChange(next);
  };

  return (
    <div className="space-y-6 rounded-lg border p-4 bg-muted/20">
      <p className="text-sm font-medium">Identity documents</p>
      <p className="text-xs text-muted-foreground">Upload photos or scans (images or PDF). Multiple files per type allowed.</p>
      {IDENTITY_DOC_KEYS.map((key) => (
        <div key={key} className="space-y-2">
          <Label>{IDENTITY_DOC_LABELS[key]}</Label>
          <ImageGalleryUpload
            urls={value[key] ?? []}
            onChange={(urls) => setKey(key, urls)}
            folder={`${folder}/${key}`}
            addLabel={`Add ${IDENTITY_DOC_LABELS[key]} file`}
          />
        </div>
      ))}
    </div>
  );
}

function isLikelyImageUrl(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(lower) === true;
}

interface IdentityDocumentsGalleryProps {
  documents: unknown;
}

export function IdentityDocumentsGallery({ documents }: IdentityDocumentsGalleryProps) {
  const docs = normalizeIdentityDocuments(documents);
  const sections = IDENTITY_DOC_KEYS.map((key) => ({
    key,
    label: IDENTITY_DOC_LABELS[key],
    urls: docs[key] ?? [],
  })).filter((s) => s.urls.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.key}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{section.label}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {section.urls.map((url, i) => (
              <a
                key={`${url}-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block rounded-lg border overflow-hidden aspect-[4/3] bg-muted hover:ring-2 hover:ring-primary/30 transition-all"
              >
                {isLikelyImageUrl(url) ? (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[100px] text-xs text-center p-2 text-primary underline">
                    Open document
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
