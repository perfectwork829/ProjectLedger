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
        Paste the shared folder link, then Save. Set the folder and each image file to &quot;Anyone with the link&quot;
        (use PNG/JPG uploads, not Google Docs). The Screenshots tab builds the slider from that folder.
      </p>
    </div>
  );
}
