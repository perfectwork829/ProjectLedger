import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleDriveExchangeCode } from '@/lib/cloud/googleDrive';
import { useToast } from '@/hooks/use-toast';

export default function OAuthGoogleDriveCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState('Connecting Google Drive…');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const err = params.get('error');

      const returnTo = () => {
        const r = sessionStorage.getItem('gdrv_oauth_return') || '/admin/tasks';
        sessionStorage.removeItem('gdrv_oauth_return');
        return r;
      };

      if (err) {
        if (!cancelled) {
          setMessage('Google sign-in was cancelled.');
          toast({ title: 'Google Drive', description: err, variant: 'destructive' });
          navigate(returnTo(), { replace: true });
        }
        return;
      }

      if (!code) {
        if (!cancelled) {
          setMessage('Missing authorization code.');
          toast({ title: 'Google Drive', description: 'Missing code in callback URL.', variant: 'destructive' });
          navigate(returnTo(), { replace: true });
        }
        return;
      }

      const saved = sessionStorage.getItem('gdrv_oauth_state');
      if (state && saved && state !== saved) {
        if (!cancelled) {
          setMessage('Invalid OAuth state. Try again.');
          toast({ title: 'Google Drive', description: 'Security check failed (state).', variant: 'destructive' });
          navigate(returnTo(), { replace: true });
        }
        return;
      }
      sessionStorage.removeItem('gdrv_oauth_state');

      const redirectUri = `${window.location.origin}/oauth/google-drive/callback`;
      const { data, error } = await googleDriveExchangeCode(code, redirectUri);

      if (cancelled) return;

      if (error || data?.error) {
        setMessage('Could not finish connection.');
        toast({
          title: 'Google Drive connection failed',
          description: error?.message || data?.error || 'Unknown error',
          variant: 'destructive',
        });
        navigate(returnTo(), { replace: true });
        return;
      }

      toast({
        title: 'Google Drive connected',
        description: data?.email ? `Signed in as ${data.email}` : 'You can upload files from the task or project form.',
      });
      navigate(returnTo(), { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
