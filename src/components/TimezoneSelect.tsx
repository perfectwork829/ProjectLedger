import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMMON_TIMEZONES, matchTimezone, timezoneDisplayName } from '@/lib/timezones';

const NONE = '__tz_none__';
const LEGACY_PREFIX = 'legacy:';

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
};

function legacyToken(name: string) {
  return `${LEGACY_PREFIX}${encodeURIComponent(name)}`;
}

function parseLegacyToken(v: string): string | null {
  if (!v.startsWith(LEGACY_PREFIX)) return null;
  try {
    return decodeURIComponent(v.slice(LEGACY_PREFIX.length));
  } catch {
    return null;
  }
}

/** Strip replacement/BOM noise from DB or pasted values (avoids U+FFFD in the trigger). */
function cleanTzValue(raw: string) {
  return raw.replace(/\uFFFD/g, '').replace(/\uFEFF/g, '').trim();
}

export function TimezoneSelect({ id, label, value, onChange, disabled }: Props) {
  const trimmed = cleanTzValue(value);
  const normalized = matchTimezone(trimmed);
  const selectValue = !trimmed ? NONE : normalized ?? legacyToken(trimmed);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(v) => {
          if (v === NONE) onChange('');
          else {
            const legacy = parseLegacyToken(v);
            if (legacy !== null) onChange(legacy);
            else onChange(v);
          }
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select timezone..." />
        </SelectTrigger>
        <SelectContent className="max-h-[min(320px,70vh)]">
          <SelectItem value={NONE} textValue="None">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
          {trimmed && !normalized ? (
            <SelectItem value={legacyToken(trimmed)} textValue={trimmed}>
              <span className="flex flex-col items-start gap-0">
                <span>{trimmed}</span>
                <span className="text-[11px] text-muted-foreground">Saved value - pick timezone below to normalize</span>
              </span>
            </SelectItem>
          ) : null}
          {COMMON_TIMEZONES.map((tz) => (
            <SelectItem key={tz.zone} value={tz.zone} textValue={tz.zone}>
              {timezoneDisplayName(tz.zone, tz.offset)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}