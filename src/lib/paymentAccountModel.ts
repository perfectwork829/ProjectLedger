/** Row shape for `payment_accounts` (no password column). */
export interface PaymentAccount {
  id: string;
  user_id: string;
  provider: string;
  label: string;
  account_identifier: string | null;
  is_default: boolean;
  status: string;
  notes: string | null;
  email: string | null;
  full_name: string | null;
  payment_details: string | null;
  verified: boolean;
  verified_at: string | null;
  backup_info: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  id_card_drive_url: string | null;
  connected_phone: string | null;
  purchase_way: string | null;
  credentials_note: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type PaymentAccountFormState = {
  provider: string;
  label: string;
  account_identifier: string;
  is_default: boolean;
  status: 'good' | 'disabled';
  notes: string;
  email: string;
  full_name: string;
  payment_details: string;
  verified: boolean;
  verified_at: string;
  backup_info: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  id_card_drive_url: string;
  connected_phone: string;
  purchase_way: string;
  credentials_note: string;
};

export function emptyPaymentAccountForm(): PaymentAccountFormState {
  return {
    provider: '',
    label: '',
    account_identifier: '',
    is_default: false,
    status: 'good',
    notes: '',
    email: '',
    full_name: '',
    payment_details: '',
    verified: false,
    verified_at: '',
    backup_info: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    id_card_drive_url: '',
    connected_phone: '',
    purchase_way: '',
    credentials_note: '',
  };
}

export function paymentAccountToForm(acc: PaymentAccount): PaymentAccountFormState {
  return {
    provider: acc.provider,
    label: acc.label,
    account_identifier: acc.account_identifier || '',
    is_default: acc.is_default,
    status: acc.status === 'disabled' ? 'disabled' : 'good',
    notes: acc.notes || '',
    email: acc.email || '',
    full_name: acc.full_name || '',
    payment_details: acc.payment_details || '',
    verified: acc.verified,
    verified_at: acc.verified_at ? acc.verified_at.slice(0, 10) : '',
    backup_info: acc.backup_info || '',
    address: acc.address || '',
    city: acc.city || '',
    state: acc.state || '',
    zip: acc.zip || '',
    id_card_drive_url: acc.id_card_drive_url || '',
    connected_phone: acc.connected_phone || '',
    purchase_way: acc.purchase_way || '',
    credentials_note: acc.credentials_note || '',
  };
}
