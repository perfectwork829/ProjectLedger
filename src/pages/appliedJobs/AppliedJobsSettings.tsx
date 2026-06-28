import { useJobApplicationSettings } from '@/hooks/useJobApplicationSettings';
import { COMMON_TIMEZONES, timezoneDisplayName } from '@/lib/timezones';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function AppliedJobsSettings() {
  const { settings, loading, save } = useJobApplicationSettings();
  const { toast } = useToast();

  if (loading || !settings) {
    return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const patch = async (p: Record<string, unknown>) => {
    const { error } = await save(p);
    if (error) toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Settings saved' });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-serif text-3xl font-semibold">Settings</h2>
        <p className="text-muted-foreground">Personalize your job search workspace.</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Appearance</CardTitle><p className="text-sm text-muted-foreground">Theme and text preferences (stored per user).</p></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={settings.theme} onValueChange={(v) => void patch({ theme: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Font family</Label>
            <Select value={settings.font_family} onValueChange={(v) => void patch({ font_family: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sans">Sans</SelectItem><SelectItem value="serif">Serif</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Font size</Label>
            <Select value={settings.font_size} onValueChange={(v) => void patch({ font_size: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Timezone</CardTitle><p className="text-sm text-muted-foreground">Used for daily counts and dates.</p></CardHeader>
        <CardContent>
          <Select value={settings.timezone} onValueChange={(v) => void patch({ timezone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {COMMON_TIMEZONES.map((tz) => <SelectItem key={tz.zone} value={tz.zone}>{timezoneDisplayName(tz.zone, tz.offset)}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Weekly application target</CardTitle><p className="text-sm text-muted-foreground">Drives the counter on your overview.</p></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Input type="number" className="w-24" value={settings.weekly_target} onChange={(e) => void patch({ weekly_target: Number(e.target.value) || 25 })} />
          <span className="text-sm text-muted-foreground">apps / week</span>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Data retention</CardTitle><p className="text-sm text-muted-foreground">Applications older than this are hidden from lists (days).</p></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Input type="number" className="w-24" value={settings.retention_days} onChange={(e) => void patch({ retention_days: Number(e.target.value) || 90 })} />
          <span className="text-sm text-muted-foreground">days (default 90 ≈ 3 months)</span>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Cover letter defaults</CardTitle><p className="text-sm text-muted-foreground">Name and greeting used when generating cover letters on the Record page.</p></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Number of sentences</Label><Input type="number" value={settings.cover_letter_sentences} onChange={(e) => void patch({ cover_letter_sentences: Number(e.target.value) })} /></div>
          <div className="space-y-2"><Label>Your name</Label><Input value={settings.cover_letter_name || ''} onChange={(e) => void patch({ cover_letter_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Prefix (greeting)</Label><Input value={settings.cover_letter_prefix} onChange={(e) => void patch({ cover_letter_prefix: e.target.value })} /></div>
          <div className="space-y-2"><Label>Infix (sign-off)</Label><Input value={settings.cover_letter_infix} onChange={(e) => void patch({ cover_letter_infix: e.target.value })} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
