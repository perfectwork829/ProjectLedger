import { matchCountry } from '@/lib/countries';
import { AsYouType, type CountryCode, getExampleNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';

export function countryNameToIso(country: string | null | undefined): CountryCode | undefined {
  if (!country?.trim()) return undefined;
  const matched = matchCountry(country);
  if (!matched) return undefined;
  return matched.code as CountryCode;
}

/** Format while typing; uses +country code or optional default country from form. */
export function formatPhoneAsYouType(raw: string, countryHint?: string | null): string {
  if (!raw) return '';
  const defaultCountry = countryNameToIso(countryHint);
  const formatter = new AsYouType(defaultCountry);
  const hasPlus = raw.includes('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return hasPlus ? '+' : '';
  const input = hasPlus ? `+${digits}` : digits;
  return formatter.input(input);
}

/** Pretty international display for read-only views. */
export function formatPhoneDisplay(value: string | null | undefined, countryHint?: string | null): string {
  if (!value?.trim()) return '';
  const defaultCountry = countryNameToIso(countryHint);
  const parsed = parsePhoneNumberFromString(value, defaultCountry);
  if (parsed) return parsed.formatInternational();
  return value;
}

export function phoneInputPlaceholder(countryHint?: string | null): string {
  const iso = countryNameToIso(countryHint);
  if (iso) {
    try {
      const example = getExampleNumber(iso, examples);
      if (example) return example.formatInternational();
    } catch {
      /* fall through */
    }
  }
  return '+country code, then number';
}
