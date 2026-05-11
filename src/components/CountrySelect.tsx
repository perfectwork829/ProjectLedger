import { COUNTRIES, flagEmojiFromIso2, matchCountry } from '@/lib/countries';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NONE = '__country_none__';

const LEGACY_PREFIX = 'legacy:';

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (countryName: string) => void;
  disabled?: boolean;
};

function rowForValue(value: string): { code: string; name: string; legacy?: boolean } | null {
  if (!value.trim()) return null;
  const hit = matchCountry(value);
  if (hit) return { code: hit.code, name: hit.name };
  return { code: '', name: value.trim(), legacy: true };
}

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

export function CountrySelect({ id, label, value, onChange, disabled }: Props) {
  const row = rowForValue(value);
  const inList = row && !row.legacy;
  const selectValue = !value.trim() ? NONE : inList ? row!.name : legacyToken(row!.name);

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        disabled={disabled}
        value={selectValue}
        onValueChange={(v) => {
          if (v === NONE) onChange('');
          else {
            const legacy = parseLegacyToken(v);
            if (legacy !== null) onChange(legacy);
            else onChange(v);
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select country…" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(320px,70vh)]">
          <SelectItem value={NONE} textValue="None">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
          {row?.legacy ? (
            <SelectItem value={legacyToken(row.name)} textValue={row.name}>
              <span className="flex items-center gap-2">
                <span className="text-lg leading-none w-7 text-center" aria-hidden>
                  🌍
                </span>
                <span className="flex flex-col items-start gap-0">
                  <span>{row.name}</span>
                  <span className="text-[11px] text-muted-foreground">Saved value - pick a country below to normalize</span>
                </span>
              </span>
            </SelectItem>
          ) : null}
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.name} textValue={c.name}>
              <span className="flex items-center gap-2">
                <span className="text-lg leading-none w-7 text-center" aria-hidden>
                  {flagEmojiFromIso2(c.code)}
                </span>
                <span>{c.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
