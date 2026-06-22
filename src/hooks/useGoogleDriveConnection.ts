import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchGoogleDriveConnectionRow,
  googleDriveDisconnect,
  googleDriveOAuthUrl,
} from '@/lib/cloud/googleDrive';

const OAUTH_RETURN_KEY = 'gdrv_oauth_return';
const OAUTH_STATE_KEY = 'gdrv_oauth_state';

export function useGoogleDriveConnection(returnPath = '/admin/settings') {
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    try {
      const { data, error } = await fetchGoogleDriveConnectionRow();
      if (error) {
        setEmail(null);
        return;
      }
      setEmail((data?.account_email as string) || (data ? 'Connected' : null));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connect = async () => {
    setLoading(true);
    try {
      sessionStorage.setItem(OAUTH_RETURN_KEY, returnPath);
      const state = crypto.randomUUID();
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
      const redirect = `${window.location.origin}/oauth/google-drive/callback`;
      const { data, error } = await googleDriveOAuthUrl(redirect, state);
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || 'No auth URL returned');
      window.location.href = data.url;
    } catch (e) {
      toast({
        title: 'Google Drive',
        description: e instanceof Error ? e.message : 'Could not start OAuth',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      const { error } = await googleDriveDisconnect();
      if (error) throw error;
      setEmail(null);
      toast({ title: 'Google Drive disconnected' });
    } catch (e) {
      toast({
        title: 'Disconnect failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    connected: !!email,
    loading,
    checking,
    connect,
    disconnect,
    refreshStatus,
  };
}
