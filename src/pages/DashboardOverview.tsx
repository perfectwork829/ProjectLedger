import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Users, CreditCard, ClipboardList } from 'lucide-react';

export default function DashboardOverview() {
  const { user, roles } = useAuth();

  const stats = [
    { label: 'Projects', value: '—', icon: FolderKanban },
    { label: 'Clients', value: '—', icon: Users },
    { label: 'Accounts', value: '—', icon: CreditCard },
    { label: 'Tasks', value: '—', icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h2>
        <div className="mt-1 text-muted-foreground">
          {user?.email}
          {roles.length > 0 && (
            <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">
                  {r}
                </Badge>
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
