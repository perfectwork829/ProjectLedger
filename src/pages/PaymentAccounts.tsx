import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentAccount {
  id: string;
  user_id: string;
  provider: string;
  label: string;
  account_identifier: string | null;
  is_default: boolean;
  status: string;
  notes: string | null;
  created_at: string;
}

const PROVIDERS = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'wise', label: 'Wise' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'payoneer', label: 'Payoneer' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'other', label: 'Other' },
];

const emptyForm = { provider: '', label: '', account_identifier: '', is_default: false, status: 'active', notes: '' };

export default function PaymentAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading accounts', description: error.message, variant: 'destructive' });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (acc: PaymentAccount) => {
    setEditingId(acc.id);
    setForm({
      provider: acc.provider,
      label: acc.label,
      account_identifier: acc.account_identifier || '',
      is_default: acc.is_default,
      status: acc.status,
      notes: acc.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.provider || !form.label) {
      toast({ title: 'Provider and label are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      provider: form.provider,
      label: form.label,
      account_identifier: form.account_identifier || null,
      is_default: form.is_default,
      status: form.status,
      notes: form.notes || null,
      user_id: user!.id,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('payment_accounts').update(payload).eq('id', editingId);
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Account updated' });
    } else {
      const { error } = await supabase.from('payment_accounts').insert(payload);
      if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Account created' });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('payment_accounts').delete().eq('id', id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Account deleted' }); fetchAccounts(); }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    await handleDelete(id);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Payment Accounts</h2>
          <p className="text-sm text-muted-foreground">Manage where you receive payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Payment Account' : 'Add Payment Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Main PayPal" />
              </div>
              <div className="space-y-2">
                <Label>Account Identifier</Label>
                <Input value={form.account_identifier} onChange={(e) => setForm({ ...form, account_identifier: e.target.value })} placeholder="Email, IBAN, or account ID" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Default Account</Label>
                <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." rows={3} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Saving...' : editingId ? 'Update Account' : 'Create Account'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-foreground">No payment accounts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add a payment method to receive freelance income</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" />Add Account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="group relative transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    {PROVIDERS.find(p => p.value === acc.provider)?.label || acc.provider}
                    {acc.is_default && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{acc.label}</p>
                </div>
                <Badge variant={acc.status === 'active' ? 'default' : 'secondary'}>
                  {acc.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {acc.account_identifier && (
                  <p className="text-sm font-mono text-muted-foreground">{acc.account_identifier}</p>
                )}
                {acc.notes && <p className="text-sm text-muted-foreground line-clamp-2">{acc.notes}</p>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(acc)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const providerLabel = PROVIDERS.find((p) => p.value === acc.provider)?.label || acc.provider;
                      setDeleteConfirm({ id: acc.id, label: `${providerLabel} — ${acc.label}` });
                    }}
                    className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.label}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
