import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ClipboardList,
  Users,
  CreditCard,
  FolderKanban,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Timer,
  ShieldCheck,
} from 'lucide-react';
import {
  buildTaskAutoRows,
  filterRowsByMode,
  getPaymentPeriods,
  normalizeManualRows,
  summarizeRows,
  type PaymentEntryRecord,
  type TaskFinanceRow,
  type UnifiedPaymentRow,
} from '@/lib/payments';
import {
  isWithinRange,
} from '@/lib/taskPoolFinance';
import { taskPoolItemStatusLabel, TASK_POOL_ITEM_STATUS_OPTIONS } from '@/lib/taskPool';

type TaskOverviewRow = {
  id: string;
  name: string | null;
  currency: string;
  task_received_at: string | null;
  created_at: string;
  status: string;
  budget_type: 'fixed' | 'hourly';
  fixed_budget_mode?: 'project' | 'recurring' | null;
  budget_amount: number | null;
  withdrawn_amount: number | null;
  upwork_connection_fee: number;
  convert_fee: number;
  transfer_fee: number;
  upwork_fee: number;
  withdraw_fee: number;
  deadline: string | null;
};

type ClientOverviewRow = {
  client_status: string | null;
  availability_status: string | null;
  client_type: string | null;
};

type PersonnelOverviewRow = {
  role: string;
  availability_status: string | null;
  first_name: string | null;
  last_name: string | null;
};

type AccountOverviewRow = {
  status: string;
  verified_status: boolean | null;
};

type ProjectOverviewRow = {
  status: string;
};

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  href,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  href?: string;
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-red-600'
          : 'text-foreground';

  const inner = (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link to={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function DashboardOverview() {
  const { user, roles } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskOverviewRow[]>([]);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntryRecord[]>([]);
  const [clients, setClients] = useState<ClientOverviewRow[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelOverviewRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOverviewRow[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{ status: string }>>([]);
  const [projects, setProjects] = useState<ProjectOverviewRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [tasksRes, paymentsRes, clientsRes, personnelRes, accountsRes, paymentAccountsRes, projectsRes] = await Promise.all([
          supabase
            .from('task_pool_items')
            .select(
              'id,name,currency,task_received_at,created_at,status,budget_type,fixed_budget_mode,budget_amount,withdrawn_amount,upwork_connection_fee,convert_fee,transfer_fee,upwork_fee,withdraw_fee,deadline',
            )
            .order('created_at', { ascending: false }),
          supabase.from('payment_entries').select('*').order('occurred_at', { ascending: false }),
          supabase.from('clients').select('client_status,availability_status,client_type').order('created_at', { ascending: false }),
          supabase.from('personnel').select('role,availability_status,first_name,last_name').order('created_at', { ascending: false }),
          supabase.from('freelancing_accounts').select('status,verified_status').order('created_at', { ascending: false }),
          supabase.from('payment_accounts').select('status').order('created_at', { ascending: false }),
          supabase.from('projects').select('status').order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;

        if (tasksRes.error) toast({ title: 'Error loading tasks', description: tasksRes.error.message, variant: 'destructive' });
        if (paymentsRes.error) toast({ title: 'Error loading payments', description: paymentsRes.error.message, variant: 'destructive' });
        if (clientsRes.error) toast({ title: 'Error loading clients', description: clientsRes.error.message, variant: 'destructive' });
        if (personnelRes.error) toast({ title: 'Error loading personnel', description: personnelRes.error.message, variant: 'destructive' });
        if (accountsRes.error) toast({ title: 'Error loading accounts', description: accountsRes.error.message, variant: 'destructive' });
        if (paymentAccountsRes.error) toast({ title: 'Error loading payment accounts', description: paymentAccountsRes.error.message, variant: 'destructive' });
        if (projectsRes.error) toast({ title: 'Error loading projects', description: projectsRes.error.message, variant: 'destructive' });

        setTasks((tasksRes.data || []) as TaskOverviewRow[]);
        setPaymentEntries((paymentsRes.data || []) as PaymentEntryRecord[]);
        setClients((clientsRes.data || []) as ClientOverviewRow[]);
        setPersonnel((personnelRes.data || []) as PersonnelOverviewRow[]);
        setAccounts((accountsRes.data || []) as AccountOverviewRow[]);
        setPaymentAccounts((paymentAccountsRes.data || []) as Array<{ status: string }>);
        setProjects((projectsRes.data || []) as ProjectOverviewRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const now = useMemo(() => new Date(), [tasks.length, paymentEntries.length, clients.length, personnel.length, accounts.length, projects.length]);

  const { thisPeriod, lastPeriod, yearStart, yearEnd } = useMemo(() => getPaymentPeriods(now), [now]);

  const periodLabel = useMemo(() => {
    // "This Month (May-5)" style: label uses the end boundary month.
    const end = thisPeriod.end;
    return `${end.toLocaleString('en-US', { month: 'long' })}-${end.getMonth() + 1}`;
  }, [thisPeriod.end]);

  const lastPeriodLabel = useMemo(() => {
    const end = lastPeriod.end;
    return `${end.toLocaleString('en-US', { month: 'long' })}-${end.getMonth() + 1}`;
  }, [lastPeriod.end]);

  const yearLabel = useMemo(() => yearStart.getFullYear().toString(), [yearStart]);

  const taskCurrency = useMemo(() => (tasks[0]?.currency ? tasks[0].currency : 'USD'), [tasks]);

  const tasksThisMonth = useMemo(() => {
    return tasks.filter((t) => isWithinRange(t.task_received_at || t.created_at, thisPeriod.start, thisPeriod.end));
  }, [tasks, thisPeriod.start, thisPeriod.end]);

  const tasksWorkingNowCount = useMemo(() => tasks.filter((t) => !['completed', 'cancelled'].includes(t.status)).length, [tasks]);

  const tasksCompletedThisMonthCount = useMemo(() => tasksThisMonth.filter((t) => t.status === 'completed').length, [tasksThisMonth]);

  const tasksRealBudgetThisMonth = useMemo(() => tasksThisMonth.reduce((sum, t) => sum + Number(t.budget_amount ?? 0), 0), [tasksThisMonth]);
  const tasksWithdrawnBudgetThisMonth = useMemo(() => tasksThisMonth.reduce((sum, t) => sum + Number(t.withdrawn_amount ?? 0), 0), [tasksThisMonth]);

  const taskStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;
    return TASK_POOL_ITEM_STATUS_OPTIONS.map((s) => ({ status: s, count: counts[s] || 0 }));
  }, [tasks]);

  const overdueTasks = useMemo(() => {
    const todayMs = now.getTime();
    return tasks
      .filter((t) => {
        if (!t.deadline) return false;
        if (['completed', 'cancelled'].includes(t.status)) return false;
        const ms = new Date(t.deadline).getTime();
        return ms < todayMs;
      })
      .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
      .slice(0, 5);
  }, [tasks, now]);

  const clientsStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clients) {
      const key = c.client_status || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return [
      { status: 'active', label: 'Active', count: counts['active'] || 0 },
      { status: 'prospect', label: 'Prospect', count: counts['prospect'] || 0 },
      { status: 'inactive', label: 'Inactive', count: counts['inactive'] || 0 },
      { status: 'lost', label: 'Lost', count: counts['lost'] || 0 },
    ];
  }, [clients]);

  const activeClientsCount = useMemo(() => clientsStatusCounts.find((x) => x.status === 'active')?.count || 0, [clientsStatusCounts]);

  const personnelAvailability = useMemo(() => {
    const available = personnel.filter((p) => p.availability_status === 'available').length;
    const busy = personnel.filter((p) => p.availability_status === 'busy').length;
    const byRole: Record<string, { total: number; available: number }> = {};
    for (const p of personnel) {
      if (!byRole[p.role]) byRole[p.role] = { total: 0, available: 0 };
      byRole[p.role].total += 1;
      if (p.availability_status === 'available') byRole[p.role].available += 1;
    }
    return { available, busy, byRole };
  }, [personnel]);

  const accountsStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of accounts) counts[a.status] = (counts[a.status] || 0) + 1;
    return {
      active: (counts['active'] || 0) + (counts['good'] || 0),
      paused: counts['paused'] || 0,
      suspended: counts['suspended'] || 0,
      disabled: counts['disabled'] || 0,
      closed: counts['closed'] || 0,
      verified: accounts.filter((a) => a.verified_status).length,
    };
  }, [accounts]);

  const paymentAccountsStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of paymentAccounts) counts[a.status] = (counts[a.status] || 0) + 1;
    return {
      good: counts['good'] || 0,
      disabled: counts['disabled'] || 0,
    };
  }, [paymentAccounts]);

  const paymentCurrencyLabel = useMemo(() => {
    // Keep it consistent with your payments module: show amounts as-is.
    // If multiple currencies exist, show a compact multi-currency label.
    const taskFinanceRows = tasks.map((t) => ({
      id: t.id,
      name: t.name || '',
      currency: t.currency || taskCurrency,
      task_received_at: t.task_received_at,
      created_at: t.created_at,
      budget_type: t.budget_type ?? 'fixed',
      fixed_budget_mode: t.fixed_budget_mode ?? 'project',
      withdrawn_amount: t.withdrawn_amount ?? 0,
      upwork_connection_fee: Number(t.upwork_connection_fee ?? 0),
      convert_fee: Number(t.convert_fee ?? 0),
      transfer_fee: Number(t.transfer_fee ?? 0),
      upwork_fee: Number(t.upwork_fee ?? 0),
      withdraw_fee: Number(t.withdraw_fee ?? 0),
    })) satisfies TaskFinanceRow[];

    const allPaymentRows: UnifiedPaymentRow[] = [...buildTaskAutoRows(taskFinanceRows), ...normalizeManualRows(paymentEntries)];
    const unique = Array.from(new Set(allPaymentRows.map((r) => r.currency).filter(Boolean)));
    if (unique.length === 0) return 'USD';
    if (unique.length === 1) return unique[0] || 'USD';
    return `Multi (${unique.length})`;
  }, [paymentEntries, tasks, taskCurrency]);

  const paymentSummaries = useMemo(() => {
    const taskFinanceRows = tasks.map((t) => ({
      id: t.id,
      name: t.name || '',
      currency: t.currency || taskCurrency,
      task_received_at: t.task_received_at,
      created_at: t.created_at,
      withdrawn_amount: t.withdrawn_amount ?? 0,
      upwork_connection_fee: Number(t.upwork_connection_fee ?? 0),
      convert_fee: Number(t.convert_fee ?? 0),
      transfer_fee: Number(t.transfer_fee ?? 0),
      upwork_fee: Number(t.upwork_fee ?? 0),
      withdraw_fee: Number(t.withdraw_fee ?? 0),
    })) satisfies TaskFinanceRow[];

    const allRows: UnifiedPaymentRow[] = [...buildTaskAutoRows(taskFinanceRows), ...normalizeManualRows(paymentEntries)];

    const thisRows = filterRowsByMode(allRows, 'this_period', now);
    const lastRows = filterRowsByMode(allRows, 'last_period', now);
    const yearRows = filterRowsByMode(allRows, 'this_year', now);

    return {
      thisMonth: summarizeRows(thisRows),
      lastMonth: summarizeRows(lastRows),
      year: summarizeRows(yearRows),
    };
  }, [tasks, paymentEntries, taskCurrency, now]);

  const feeTopOutgoing = useMemo(() => {
    const taskFinanceRows = tasks.map((t) => ({
      id: t.id,
      name: t.name || '',
      currency: t.currency || taskCurrency,
      task_received_at: t.task_received_at,
      created_at: t.created_at,
      budget_type: t.budget_type ?? 'fixed',
      fixed_budget_mode: t.fixed_budget_mode ?? 'project',
      withdrawn_amount: t.withdrawn_amount ?? 0,
      upwork_connection_fee: Number(t.upwork_connection_fee ?? 0),
      convert_fee: Number(t.convert_fee ?? 0),
      transfer_fee: Number(t.transfer_fee ?? 0),
      upwork_fee: Number(t.upwork_fee ?? 0),
      withdraw_fee: Number(t.withdraw_fee ?? 0),
    })) satisfies TaskFinanceRow[];

    const allRows: UnifiedPaymentRow[] = [...buildTaskAutoRows(taskFinanceRows), ...normalizeManualRows(paymentEntries)];
    const thisRows = filterRowsByMode(allRows, 'this_period', now);
    const outgoing = thisRows.filter((r) => r.entry_type === 'outgoing');

    const byCategory: Record<string, number> = {};
    for (const r of outgoing) byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;

    return Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));
  }, [tasks, paymentEntries, taskCurrency, now]);

  const overdueTone: 'neutral' | 'warn' | 'bad' = overdueTasks.length === 0 ? 'neutral' : overdueTasks.length <= 2 ? 'warn' : 'bad';
  const netTone: 'neutral' | 'good' | 'warn' | 'bad' = paymentSummaries.thisMonth.net >= 0 ? 'good' : 'bad';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h2>
          <div className="mt-1 text-muted-foreground">
            {user?.email}
            {roles.length > 0 ? (
              <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
                {roles.map((r) => (
                  <Badge key={r} variant="secondary" className="capitalize">
                    {r}
                  </Badge>
                ))}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Timer className="h-3.5 w-3.5" />
            {periodLabel}
          </Badge>
          <Badge variant="outline">
            Year {yearLabel}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Working tasks"
          value={tasksWorkingNowCount.toString()}
          sub="Not completed/cancelled"
          icon={ClipboardList}
          tone="neutral"
          href="/dashboard/tasks"
        />
        <StatCard
          title={`Completed (${periodLabel})`}
          value={tasksCompletedThisMonthCount.toString()}
          sub="This period status=completed"
          icon={ClipboardList}
          tone={tasksCompletedThisMonthCount > 0 ? 'good' : 'neutral'}
          href="/dashboard/tasks"
        />
        <StatCard
          title={`Payments net (${periodLabel})`}
          value={`${paymentSummaries.thisMonth.net.toFixed(2)}`}
          sub={`${paymentCurrencyLabel} incoming - outgoing`}
          icon={DollarSign}
          tone={netTone}
          href="/dashboard/payments"
        />
        <StatCard
          title="Active clients"
          value={activeClientsCount.toString()}
          sub="client_status = active"
          icon={Users}
          tone="neutral"
          href="/dashboard/clients"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Real budget (${periodLabel})`}
          value={`${tasksRealBudgetThisMonth.toFixed(2)}`}
          sub={taskCurrency}
          icon={FolderKanban}
          tone="neutral"
          href="/dashboard/tasks"
        />
        <StatCard
          title={`Withdrawn budget (${periodLabel})`}
          value={`${tasksWithdrawnBudgetThisMonth.toFixed(2)}`}
          sub={taskCurrency}
          icon={FolderKanban}
          tone="neutral"
          href="/dashboard/tasks"
        />
        <StatCard
          title={`Available personnel`}
          value={personnelAvailability.available.toString()}
          sub={`Busy: ${personnelAvailability.busy}`}
          icon={Users}
          tone="neutral"
          href="/dashboard/personnel"
        />
        <StatCard
          title="Active accounts"
          value={accountsStatusCounts.active.toString()}
          sub={`Verified: ${accountsStatusCounts.verified}`}
          icon={CreditCard}
          tone={accountsStatusCounts.disabled > 0 ? 'warn' : 'neutral'}
          href="/dashboard/accounts"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Task status</CardTitle>
            </div>
            <Badge variant="secondary">{tasks.length} total</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {taskStatusCounts.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{taskPoolItemStatusLabel(row.status)}</span>
                  <span className="font-medium">{row.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Clients</CardTitle>
            </div>
            <Badge variant="secondary">{clients.length} total</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clientsStatusCounts.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Accounts health</CardTitle>
            </div>
            <Badge variant="secondary">{accounts.length} accounts</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Active / Good</span>
                <span className="font-medium">{accountsStatusCounts.active}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Paused</span>
                <span className="font-medium">{accountsStatusCounts.paused}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Suspended</span>
                <span className="font-medium">{accountsStatusCounts.suspended}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Disabled</span>
                <span className="font-medium">{accountsStatusCounts.disabled}</span>
              </div>
            </div>
            {paymentAccountsStatusCounts.disabled > 0 ? (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {paymentAccountsStatusCounts.disabled} payment method(s) disabled
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Personnel availability</CardTitle>
            </div>
            <Badge variant="secondary">{personnelAvailability.available} available</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(personnelAvailability.byRole)
                .sort((a, b) => b[1].available - a[1].available)
                .slice(0, 6)
                .map(([role, v]) => (
                  <div key={role} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground capitalize">{role}</span>
                    <span className="font-medium">
                      {v.available}/{v.total}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Payments (fees top)</CardTitle>
            </div>
            <Badge variant="secondary">{periodLabel}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Incoming</span>
                <span className="font-medium text-emerald-600">{paymentSummaries.thisMonth.incoming.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Outgoing</span>
                <span className="font-medium text-red-600">{paymentSummaries.thisMonth.outgoing.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Net</span>
                <span className={`font-medium ${paymentSummaries.thisMonth.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {paymentSummaries.thisMonth.net.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top outgoing categories</p>
              {feeTopOutgoing.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outgoing fees found in this period.</p>
              ) : (
                <div className="space-y-2">
                  {feeTopOutgoing.map((r) => (
                    <div key={r.category} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground pr-2 line-clamp-1">{r.category}</span>
                      <span className="font-medium">{r.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <Button asChild variant="outline" size="sm" className="w-full gap-2" >
                <Link to="/dashboard/payments">
                  View payments
                  {paymentSummaries.thisMonth.net >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Alerts</CardTitle>
            </div>
            <Badge variant={overdueTone === 'bad' ? 'destructive' : overdueTone === 'warn' ? 'secondary' : 'secondary'}>
              {overdueTasks.length} overdue
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Overdue tasks</p>
                  <p className="text-xs text-muted-foreground">deadline &lt; today</p>
                </div>
                <p className={`text-sm font-medium ${overdueTone === 'bad' ? 'text-red-600' : overdueTone === 'warn' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {overdueTasks.length}
                </p>
              </div>

              {overdueTasks.length > 0 ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Next to fix</p>
                  <div className="space-y-2">
                    {overdueTasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground line-clamp-1 pr-2">{t.name || 'Task'}</span>
                        <span className="font-medium">{new Date(t.deadline as string).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Lost clients</p>
                  <p className="text-xs text-muted-foreground">follow-up needed</p>
                </div>
                <p className="text-sm font-medium">{clientsStatusCounts.find((x) => x.status === 'lost')?.count || 0}</p>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Disabled accounts</p>
                  <p className="text-xs text-muted-foreground">platform accounts</p>
                </div>
                <p className="text-sm font-medium">{accountsStatusCounts.disabled}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/dashboard/tasks">Tasks</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/dashboard/clients">Clients</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
