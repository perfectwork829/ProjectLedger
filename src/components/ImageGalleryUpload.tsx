import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function isLikelyImageUrl(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(lower);
}

interface ImageGalleryUploadProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  accept?: string;
  addLabel?: string;
}

export default function ImageGalleryUpload({
  urls,
  onChange,
  folder = 'identity-docs',
  accept = 'image/*,application/pdf',
  addLabel = 'Add file',
}: ImageGalleryUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from('account-files').upload(fileName, file);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const { data: urlData } = supabase.storage.from('account-files').getPublicUrl(fileName);
    onChange([...urls, urlData.publicUrl]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    onChange(urls.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {urls.map((url, i) => (
          <div key={`${url}-${i}`} className="relative group rounded-lg border bg-muted/30 overflow-hidden aspect-[4/3]">
            {isLikelyImageUrl(url) ? (
              <img src={url} alt="" className="w-full h-full object-cover" />
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center h-full min-h-[80px] gap-1 p-2 text-center text-xs text-primary hover:underline"
              >
                <FileText className="h-8 w-8 text-muted-foreground" />
                <span className="line-clamp-2">PDF / Document</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Uploading...' : addLabel}
      </Button>
      <input ref={inputRef} type="file" accept={accept} onChange={handleUpload} className="hidden" />
    </div>
  );
}
