import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_JOB_APPLICATION_SETTINGS,
  type JobApplicationSettingsRow,
} from '@/lib/jobApplications';

export function useJobApplicationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<JobApplicationSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setSettings(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('job_application_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      setSettings({
        user_id: user.id,
        ...DEFAULT_JOB_APPLICATION_SETTINGS,
        updated_at: new Date().toISOString(),
      });
    } else {
      setSettings(data as JobApplicationSettingsRow);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<JobApplicationSettingsRow>) => {
      if (!user?.id) return { error: new Error('Not signed in') };
      const payload = {
        user_id: user.id,
        ...DEFAULT_JOB_APPLICATION_SETTINGS,
        ...settings,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('job_application_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();
      if (!error && data) setSettings(data as JobApplicationSettingsRow);
      return { error };
    },
    [user?.id, settings],
  );

  return { settings, loading, reload: load, save };
}
