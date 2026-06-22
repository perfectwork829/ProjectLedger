import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Props = {
  folderUrl: string;
  onFolderUrlChange: (url: string) => void;
};

export function ScreenshotsDriveFolderField({ folderUrl, onFolderUrlChange }: Props) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Google Drive screenshots folder</Label>
      <Input
        value={folderUrl}
        onChange={(e) => onFolderUrlChange(e.target.value)}
        placeholder="https://drive.google.com/drive/folders/…"
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">
        Paste the root screenshots folder link, then Save. Images in <strong className="text-foreground">subfolders</strong>{' '}
        are included automatically. For <strong className="text-foreground">private</strong> folders, connect Google Drive
        once under <strong className="text-foreground">Admin → Settings</strong>. Use PNG/JPG files (not Google Docs).
      </p>
    </div>
  );
}
