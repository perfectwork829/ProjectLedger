import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGoogleDriveConnection } from '@/hooks/useGoogleDriveConnection';

type Props = {
  returnPath?: string;
};

export default function GoogleDriveConnectionCard({ returnPath = '/admin/settings' }: Props) {
  const { email, connected, loading, checking, connect, disconnect } = useGoogleDriveConnection(returnPath);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Drive</CardTitle>
        <CardDescription>
          Connect once to load private screenshot folders on projects and tasks. This is linked to your app login,
          not to individual personnel records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Connection status</p>
            {checking ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking…
              </p>
            ) : connected ? (
              <p className="truncate text-sm text-muted-foreground" title={email ?? undefined}>
                Connected as {email}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not connected</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {connected ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void disconnect()} disabled={loading || checking}>
                Disconnect
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => void connect()} disabled={loading || checking}>
                {loading ? 'Redirecting…' : 'Connect Google Drive'}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Private folders:</strong> sign in with the Google account that owns or
            can view the screenshot folder. Public &quot;Anyone with the link&quot; folders work without connecting.
          </p>
          <p>
            <strong className="text-foreground">OAuth redirect URI</strong> (must match Google Cloud Console exactly):{' '}
            <code className="break-all text-[11px]">{`${typeof window !== 'undefined' ? window.location.origin : ''}/oauth/google-drive/callback`}</code>
          </p>
          <p>
            Server setup: deploy <code className="text-[11px]">cloud-storage-google</code> with{' '}
            <code className="text-[11px]">GOOGLE_CLIENT_ID</code> and{' '}
            <code className="text-[11px]">GOOGLE_CLIENT_SECRET</code> in Supabase Edge Function secrets.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
