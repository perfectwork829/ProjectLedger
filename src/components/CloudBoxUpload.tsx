import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { boxDisconnect, boxOAuthUrl, fetchBoxConnectionRow, uploadFileToBox } from '@/lib/cloud/box';

type Props = {
  accept: string;
  title: string;
  onUrlAdded: (url: string) => void;
};

export function CloudBoxUpload({ accept, title, onUrlAdded }: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refreshStatus = useCallback(async () => {
    const { data } = await fetchBoxConnectionRow();
    setEmail((data?.account_email as string) || (data ? 'Connected' : null));
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connect = async () => {
    setLoading(true);
    try {
      sessionStorage.setItem('box_oauth_return', `${window.location.pathname}${window.location.search}`);
      const state = crypto.randomUUID();
      sessionStorage.setItem('box_oauth_state', state);
      const redirect = `${window.location.origin}/oauth/box/callback`;
      const { data, error } = await boxOAuthUrl(redirect, state);
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || 'No auth URL returned');
      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Box', description: e instanceof Error ? e.message : 'Could not start OAuth', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      const { error } = await boxDisconnect();
      if (error) throw error;
      setEmail(null);
      toast({ title: 'Box disconnected' });
    } catch (e) {
      toast({ title: 'Disconnect failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFileToBox(file);
      onUrlAdded(url);
      toast({ title: 'Uploaded to Box', description: file.name });
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">{title}</Label>
        <div className="flex flex-wrap gap-2">
          {email ? (
            <>
              <span className="text-xs text-muted-foreground self-center max-w-[200px] truncate" title={email}>
                {email}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => void disconnect()} disabled={loading}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => void connect()} disabled={loading}>
              {loading ? 'Redirecting…' : 'Connect Box'}
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Files upload to your Box account. Ensure the Edge Function <code className="text-xs">cloud-storage-box</code> is deployed and{' '}
        <code className="text-xs">BOX_CLIENT_ID</code> / <code className="text-xs">BOX_CLIENT_SECRET</code> are set in Supabase.
      </p>
      <div>
        <input
          type="file"
          accept={accept}
          disabled={!email || uploading}
          className="text-sm file:mr-2 file:rounded file:border file:bg-background file:px-2 file:py-1"
          onChange={(ev) => void onFile(ev)}
        />
        {uploading ? <span className="ml-2 text-xs text-muted-foreground">Uploading…</span> : null}
      </div>
    </div>
  );
}