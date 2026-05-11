import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBrowserIanaTimezone, getStoredViewerTimezoneRaw, setViewerIanaTimezoneOverride } from '@/lib/viewerTimezone';

const BASE_OPTIONS = [
  { value: '__browser__', label: 'Use browser timezone' },
  { value: 'Asia/Tokyo', label: 'Japan (Asia/Tokyo)' },
  { value: 'Europe/Kyiv', label: 'Ukraine (Europe/Kyiv)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Europe/Berlin)' },
  { value: 'Europe/London', label: 'UK (Europe/London)' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
  { value: 'Etc/UTC', label: 'UTC' },
];

/**
 * Override how "your time" is shown for job interviews and reminders (e.g. force Asia/Tokyo).
 */
export function ViewerTimezonePicker({ id }: { id?: string }) {
  const stored = getStoredViewerTimezoneRaw();
  const browser = getBrowserIanaTimezone();
  const options = useMemo(() => {
    if (stored && !BASE_OPTIONS.some((o) => o.value === stored)) {
      return [...BASE_OPTIONS, { value: stored, label: `Saved (${stored})` }];
    }
    return BASE_OPTIONS;
  }, [stored]);

  const selectValue = stored || '__browser__';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          Your display timezone
        </Label>
        <Select
          value={options.some((o) => o.value === selectValue) ? selectValue : '__browser__'}
          onValueChange={(v) => {
            if (v === '__browser__') setViewerIanaTimezoneOverride('');
            else setViewerIanaTimezoneOverride(v);
          }}
        >
          <SelectTrigger id={id} className="h-9 w-[260px] text-left text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.value === '__browser__' ? `${o.label} (${browser})` : o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground max-w-md pb-0.5">
        Interview times show developer local time and this zone as &quot;your time&quot;. Pick Japan if your PC is not set to Asia/Tokyo.
      </p>
    </div>
  );
}
