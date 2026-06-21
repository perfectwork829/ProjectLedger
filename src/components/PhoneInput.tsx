import { Input } from '@/components/ui/input';
import { formatPhoneAsYouType, phoneInputPlaceholder } from '@/lib/phoneFormat';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Free-text country from the form (e.g. Mexico, Poland) — used when number has no + prefix. */
  countryHint?: string | null;
  placeholder?: string;
  className?: string;
  id?: string;
};

export default function PhoneInput({ value, onChange, countryHint, placeholder, className, id }: Props) {
  return (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      onChange={(e) => onChange(formatPhoneAsYouType(e.target.value, countryHint))}
      placeholder={placeholder ?? phoneInputPlaceholder(countryHint)}
      className={className}
    />
  );
}
