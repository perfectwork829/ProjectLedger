/** Shared labels for payment rails (UI + admin pickers). */
export const PAYMENT_PROVIDER_OPTIONS = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'payoneer', label: 'Payoneer' },
  { value: 'wise', label: 'Wise' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'coinbase', label: 'Coinbase' },
  { value: 'binance', label: 'Binance' },
  { value: 'kraken', label: 'Kraken' },
  { value: 'mexc', label: 'MEXC' },
  { value: 'bitrue', label: 'Bitrue' },
  { value: 'crypto_exchange', label: 'Other crypto exchange' },
  { value: 'crypto_wallet', label: 'Crypto wallet' },
  { value: 'other', label: 'Other' },
] as const;

export function paymentProviderLabel(provider: string): string {
  return PAYMENT_PROVIDER_OPTIONS.find((p) => p.value === provider)?.label ?? provider;
}
