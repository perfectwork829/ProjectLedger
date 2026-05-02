import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
import { Trash2, Plus } from 'lucide-react';

type AppRole = 'admin' | 'moderator' | 'user';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  email?: string;
}

export default function AdminRoles() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('user');
  const [assigning, setAssigning] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; role: AppRole; userId: string } | null>(null);

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('user_roles').select('*');
    if (error) {
      toast({ title: 'Error loading roles', description: error.message, variant: 'destructive' });
    } else {
      setRoles(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasRole('admin')) fetchRoles();
  }, []);

  const handleAssign = async () => {
    if (!newEmail) return;
    setAssigning(true);

    // Look up user by email via profiles or auth — using a simple approach
    // We'll insert by looking up the user_id from auth.users via an RPC or direct query
    // For simplicity, we ask admin to provide the user_id or we try to find it
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .single();

    if (!userData) {
      toast({ title: 'User not found', description: `No user with email ${newEmail}`, variant: 'destructive' });
      setAssigning(false);
      return;
    }

    const { error } = await supabase.from('user_roles').insert({
      user_id: userData.id,
      role: newRole,
    });

    if (error) {
      toast({ title: 'Error assigning role', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role assigned' });
      setNewEmail('');
      fetchRoles();
    }
    setAssigning(false);
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error removing role', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role removed' });
      fetchRoles();
    }
  };

  const executeRemoveRole = async () => {
    if (!removeConfirm) return;
    const { id } = removeConfirm;
    setRemoveConfirm(null);
    await handleRemove(id);
  };

  if (!hasRole('admin')) {
    return <p className="text-muted-foreground">Admin access required.</p>;
  }

  const roleColor = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'destructive' as const;
      case 'moderator': return 'default' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Manage Roles</h2>
        <p className="text-muted-foreground mt-1">Assign and manage user roles</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium">User Email</label>
          <Input
            placeholder="user@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        <div className="w-40 space-y-1.5">
          <label className="text-sm font-medium">Role</label>
          <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAssign} disabled={assigning} className="gap-2">
          <Plus className="h-4 w-4" />
          Assign
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No roles assigned yet
                </TableCell>
              </TableRow>
            ) : (
              roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.user_id}</TableCell>
                  <TableCell>
                    <Badge variant={roleColor(r.role)} className="capitalize">
                      {r.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoveConfirm({ id: r.id, role: r.role, userId: r.user_id })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove role assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the <strong className="capitalize">{removeConfirm?.role}</strong> role for user{' '}
              <strong className="font-mono text-xs">{removeConfirm?.userId}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeRemoveRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
