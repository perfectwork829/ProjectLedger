import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { CloudGoogleDriveUpload } from '@/components/CloudGoogleDriveUpload';
import { CountrySelect } from '@/components/CountrySelect';
import { canonicalCountryNameOrLegacy } from '@/lib/countries';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { canonicalTimezoneOrLegacy } from '@/lib/timezones';
import {
  AccountRef,
  ClientRef,
  LabeledLink,
  loadProjectDependencies,
  parseLabeledLinks,
  PersonnelRef,
  PoolChatMessage,
  PoolSubtask,
  promoteCompletedPoolItemToProject,
  serializeLabeledLinks,
  taskPoolNeedsAccrualAck,
  taskUsesAccrualPayments,
  parseMilestones,
  sumMilestoneGross,
  hasPendingMilestonePayment,
  firstPendingMilestone,
  taskPoolContractGross,
  TASK_POOL_ITEM_STATUS_OPTIONS,
  TASK_POOL_SUBTASK_BOARD_STATUSES,
  poolSubtaskBoardLabel,
  taskPoolItemStatusLabel,
  taskPoolFixedMode,
  type PoolSubtaskStatus,
  TaskPoolItemRecord,
  TaskPoolScreenshot,
  TaskPoolSourceFile,
  toCsv,
} from '@/lib/taskPool';
import {
  calcWithdrawnAmount,
  getLastPeriodBounds,
  getPeriodBoundsForDate,
  getWeekBounds,
  isWithinRange,
  summarizeTaskPool,
  type TaskPoolListFilter,
} from '@/lib/taskPoolFinance';
import { SOURCE_STORAGE_PROVIDER_OPTIONS } from '@/lib/projects';
import {
  advanceRecurringDueJstYmd,
  addDaysToJstYmd,
  datetimeLocalJstToIso,
  formatIsoInJst,
  formatJstYmd,
  getJstMondayYmd,
  isoToDatetimeLocalInJst,
} from '@/lib/jst';
import { RichTextEditor } from '@/components/RichTextEditor';
import { TagChipsInput } from '@/components/TagChipsInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PoolSubtaskKanban from '@/components/PoolSubtaskKanban';
import PoolSubtaskDetailDialog from '@/components/PoolSubtaskDetailDialog';
import { AlertTriangle, ArrowLeft, Calendar, MessageSquare, Pencil, Plus, Trash2, FolderKanban, Link2, Clock, ListTodo } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;
const MAIN_STACK_OPTIONS = ['angular', 'react', 'react_native', 'vue', 'nextjs', 'nodejs', 'laravel', 'django', 'flutter', 'other'] as const;
const TASK_SOURCE_OPTIONS = ['upwork', 'freelancer', 'job_broker', 'linkedin', 'other_job_site', 'friend', 'discord_job_channel', 'telegram_channel', 'teams', 'facebook', 'github'] as const;

type PendingDel =
  | { kind: 'pool'; id: string; name: string }
  | { kind: 'subtask'; id: string; title: string }
  | { kind: 'chat'; id: string; preview: string };

const emptyForm = {
  name: '',
  description: '',
  taskSource: '',
  mainStack: '',
  skillsetTags: [] as string[],
  tagsTags: [] as string[],
  status: 'planning',
  priority: 'medium',
  clientId: '',
  clientNameOverride: '',
  clientCountry: '',
  clientTimezone: '',
  accountId: '',
  chatHistory: '',
  metadataJson: '{}',
  initialDocumentUrl: '',
  sourceStorageType: 'drive',
  sourceStorageUrl: '',
  githubLinks: [] as LabeledLink[],
  sourceStorageLinks: [] as LabeledLink[],
  initialDocLinks: [] as LabeledLink[],
  taskReceivedAt: '',
  deadline: '',
  budgetType: 'fixed' as 'fixed' | 'hourly',
  fixedBudgetMode: 'project' as 'project' | 'recurring' | 'milestone',
  milestones: [] as { id: string; title: string; amount: string; confirmedAt: string | null }[],
  recurringCadence: '' as '' | 'weekly' | 'biweekly' | 'monthly',
  nextPaymentDueAt: '',
  hourlyRate: '',
  weeklyHoursCap: '40',
  budgetAmount: '',
  upworkConnectionFee: '',
  convertFee: '',
  transferFee: '',
  upworkFee: '',
  withdrawFee: '',
  currency: 'USD',
  githubUrl: '',
  screenshotUrls: [] as string[],
  sourceFileUrls: [] as string[],
};

export default function AdminTaskPool() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TaskPoolItemRecord[]>([]);
  const [screenshots, setScreenshots] = useState<TaskPoolScreenshot[]>([]);
  const [sourceFiles, setSourceFiles] = useState<TaskPoolSourceFile[]>([]);
  const [subtasks, setSubtasks] = useState<PoolSubtask[]>([]);
  const [messages, setMessages] = useState<PoolChatMessage[]>([]);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelRef[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [listFilter, setListFilter] = useState<TaskPoolListFilter>('working');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [newSubtaskColumn, setNewSubtaskColumn] = useState<PoolSubtaskStatus>('todo');
  const [newChat, setNewChat] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDel | null>(null);
  const [subtaskDetailId, setSubtaskDetailId] = useState<string | null>(null);
  const [accrualDialog, setAccrualDialog] = useState<null | {
    row: TaskPoolItemRecord;
    kind: 'project' | 'recurring' | 'hourly' | 'milestone';
    milestoneId?: string;
  }>(null);
  const [accrualHours, setAccrualHours] = useState('');

  const withdrawnPreview = useMemo(() => {
    if (form.budgetType === 'fixed' && (form.fixedBudgetMode === 'project' || form.fixedBudgetMode === 'milestone')) {
      if (!editingId) return 0;
      const row = items.find((i) => i.id === editingId);
      return Number(row?.withdrawn_amount ?? 0);
    }
    const accrualForm =
      form.budgetType === 'hourly' || (form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring');
    if (!accrualForm) return 0;
    if (!editingId) return 0;
    const row = items.find((i) => i.id === editingId);
    if (!row) return 0;
    if (!taskUsesAccrualPayments(row)) return 0;
    return Number(row.withdrawn_amount ?? 0);
  }, [form, editingId, items]);

  const hasPendingProjectPayment = (row: TaskPoolItemRecord): boolean => {
    if (row.budget_type !== 'fixed' || taskPoolFixedMode(row) !== 'project') return false;
    const targetNet = calcWithdrawnAmount({
      budgetAmount: Number(row.budget_amount ?? 0),
      upworkConnectionFee: Number(row.upwork_connection_fee ?? 0),
      convertFee: Number(row.convert_fee ?? 0),
      transferFee: Number(row.transfer_fee ?? 0),
      upworkFee: Number(row.upwork_fee ?? 0),
      withdrawFee: Number(row.withdraw_fee ?? 0),
    });
    return Number(row.withdrawn_amount ?? 0) + 0.0001 < targetNet;
  };

  const accrualDueItems = useMemo(
    () => items.filter((t) => taskPoolNeedsAccrualAck(t) || hasPendingProjectPayment(t) || hasPendingMilestonePayment(t)),
    [items],
  );

  const fetchAll = async () => {
    setLoading(true);
    const [itemsRes, shotsRes, filesRes, tasksRes, messagesRes, deps] = await Promise.all([
      supabase.from('task_pool_items').select('*').order('created_at', { ascending: false }),
      supabase.from('task_pool_screenshots').select('*').order('sort_order'),
      supabase.from('task_pool_source_files').select('*').order('sort_order'),
      supabase.from('task_pool_subtasks').select('*').order('created_at', { ascending: false }),
      supabase.from('task_pool_chat_messages').select('*').order('created_at', { ascending: false }),
      loadProjectDependencies(),
    ]);

    if (itemsRes.error) toast({ title: 'Error loading task pool', description: itemsRes.error.message, variant: 'destructive' });

    setItems((itemsRes.data || []) as TaskPoolItemRecord[]);
    setScreenshots((shotsRes.data || []) as TaskPoolScreenshot[]);
    setSourceFiles((filesRes.data || []) as TaskPoolSourceFile[]);
    setSubtasks((tasksRes.data || []) as PoolSubtask[]);
    setMessages((messagesRes.data || []) as PoolChatMessage[]);
    setClients(deps.clients);
    setAccounts(deps.accounts);
    setPersonnel(deps.personnel);
    setLoading(false);
  };

  /** Sync task pool data without full-page loading spinner. */
  const refreshTaskPoolDataQuiet = async () => {
    const [itemsRes, shotsRes, filesRes, tasksRes, messagesRes, deps] = await Promise.all([
      supabase.from('task_pool_items').select('*').order('created_at', { ascending: false }),
      supabase.from('task_pool_screenshots').select('*').order('sort_order'),
      supabase.from('task_pool_source_files').select('*').order('sort_order'),
      supabase.from('task_pool_subtasks').select('*').order('created_at', { ascending: false }),
      supabase.from('task_pool_chat_messages').select('*').order('created_at', { ascending: false }),
      loadProjectDependencies(),
    ]);
    if (itemsRes.error) toast({ title: 'Error refreshing task pool', description: itemsRes.error.message, variant: 'destructive' });
    setItems((itemsRes.data || []) as TaskPoolItemRecord[]);
    setScreenshots((shotsRes.data || []) as TaskPoolScreenshot[]);
    setSourceFiles((filesRes.data || []) as TaskPoolSourceFile[]);
    setSubtasks((tasksRes.data || []) as PoolSubtask[]);
    setMessages((messagesRes.data || []) as PoolChatMessage[]);
    setClients(deps.clients);
    setAccounts(deps.accounts);
    setPersonnel(deps.personnel);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (!items.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [items, selectedId]);

  useEffect(() => {
    setSubtaskDetailId(null);
  }, [selectedId]);

  const searchFilteredItems = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const client = clients.find((c) => c.id === p.client_id);
      const account = accounts.find((a) => a.id === p.account_id);
      const blob = [
        p.name,
        p.description,
        p.task_source,
        p.main_stack,
        p.skillset_csv,
        p.tags_csv,
        p.status,
        p.priority,
        p.client_name_override,
        client ? `${client.first_name} ${client.last_name}` : '',
        account ? `${account.platform} ${account.username}` : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [items, searchInput, clients, accounts]);

  const now = useMemo(() => new Date(), [items.length, searchInput, listFilter]);
  const thisPeriod = useMemo(() => getPeriodBoundsForDate(now), [now]);
  const lastPeriod = useMemo(() => getLastPeriodBounds(now), [now]);
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = useMemo(() => getWeekBounds(now), [now]);
  const yearStart = useMemo(() => new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), [now]);
  const yearEnd = useMemo(() => new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0), [now]);

  const filteredItems = useMemo(() => {
    const base = searchFilteredItems;
    if (listFilter === 'all') return base;
    if (listFilter === 'latest') return base.slice(0, 20);
    if (listFilter === 'working') return base.filter((x) => !['completed', 'cancelled'].includes(x.status));
    if (listFilter === 'this_period') return base.filter((x) => isWithinRange(x.task_received_at || x.created_at, thisPeriod.start, thisPeriod.end));
    if (listFilter === 'last_period') return base.filter((x) => isWithinRange(x.task_received_at || x.created_at, lastPeriod.start, lastPeriod.end));
    if (listFilter === 'this_week') return base.filter((x) => isWithinRange(x.task_received_at || x.created_at, thisWeekStart, thisWeekEnd));
    if (listFilter === 'last_week') return base.filter((x) => isWithinRange(x.task_received_at || x.created_at, lastWeekStart, lastWeekEnd));
    if (listFilter === 'custom' && customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(new Date(customEnd).getFullYear(), new Date(customEnd).getMonth(), new Date(customEnd).getDate() + 1);
      return base.filter((x) => isWithinRange(x.task_received_at || x.created_at, start, end));
    }
    if (listFilter === 'this_year') return base.filter((x) => isWithinRange(x.task_received_at || x.created_at, yearStart, yearEnd));
    return base;
  }, [searchFilteredItems, listFilter, thisPeriod, lastPeriod, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, yearStart, yearEnd, customStart, customEnd]);

  const thisPeriodSummary = useMemo(
    () => summarizeTaskPool(items.filter((x) => isWithinRange(x.task_received_at || x.created_at, thisPeriod.start, thisPeriod.end))),
    [items, thisPeriod],
  );
  const lastPeriodSummary = useMemo(
    () => summarizeTaskPool(items.filter((x) => isWithinRange(x.task_received_at || x.created_at, lastPeriod.start, lastPeriod.end))),
    [items, lastPeriod],
  );
  const thisYearSummary = useMemo(
    () => summarizeTaskPool(items.filter((x) => isWithinRange(x.task_received_at || x.created_at, yearStart, yearEnd))),
    [items, yearStart, yearEnd],
  );
  const thisMonthLabel = useMemo(() => now.toLocaleString('en-US', { month: 'long' }), [now]);
  const lastMonthLabel = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('en-US', { month: 'long' }), [now]);
  const yearLabel = useMemo(() => now.getFullYear().toString(), [now]);

  const selected = selectedId ? items.find((p) => p.id === selectedId) || null : null;
  const selectedScreenshots = selected ? screenshots.filter((s) => s.pool_item_id === selected.id) : [];
  const selectedFiles = selected ? sourceFiles.filter((s) => s.pool_item_id === selected.id) : [];
  const selectedSubtasks = selected ? subtasks.filter((t) => t.pool_item_id === selected.id) : [];
  const detailSubtask =
    selected && subtaskDetailId ? selectedSubtasks.find((t) => t.id === subtaskDetailId) ?? null : null;
  const selectedMessages = selected ? messages.filter((m) => m.pool_item_id === selected.id) : [];

  const promoteIfNeeded = async (poolId: string, status: string) => {
    if (status !== 'completed') return;
    const { projectId, error } = await promoteCompletedPoolItemToProject(poolId);
    if (error) {
      toast({ title: 'Promotion failed', description: error, variant: 'destructive' });
      return;
    }
    if (projectId) {
      toast({
        title: 'Project created',
        description: 'This task was copied into Projects.',
      });
      const row = await supabase.from('task_pool_items').select('*').eq('id', poolId).maybeSingle();
      if (row.data) setItems((prev) => prev.map((x) => (x.id === poolId ? (row.data as TaskPoolItemRecord) : x)));
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      sourceStorageLinks: [{ label: 'Storage', url: '' }],
    });
    setDialogOpen(true);
  };

  const openEdit = (row: TaskPoolItemRecord) => {
    setEditingId(row.id);
    const gh = parseLabeledLinks(row.github_links, row.github_url, 'GitHub');
    const st = parseLabeledLinks(row.source_storage_urls, row.source_storage_url, 'Storage');
    const doc = parseLabeledLinks(row.initial_document_urls, row.initial_document_url, 'Document');
    setForm({
      name: row.name,
      description: row.description || '',
      taskSource: row.task_source || '',
      mainStack: row.main_stack || '',
      skillsetTags: (row.skillset_csv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      tagsTags: (row.tags_csv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      status: row.status,
      priority: row.priority,
      clientId: row.client_id || '',
      clientNameOverride: row.client_name_override || '',
      clientCountry: canonicalCountryNameOrLegacy(row.client_country || ''),
      clientTimezone: canonicalTimezoneOrLegacy(row.client_timezone || ''),
      accountId: row.account_id || '',
      chatHistory: row.chat_history || '',
      metadataJson: row.metadata_json ? JSON.stringify(row.metadata_json, null, 2) : '{}',
      initialDocumentUrl: row.initial_document_url || '',
      sourceStorageType: row.source_storage_type,
      sourceStorageUrl: row.source_storage_url || '',
      githubLinks: gh,
      sourceStorageLinks: st,
      initialDocLinks: doc,
      taskReceivedAt: row.task_received_at ? isoToDatetimeLocalInJst(row.task_received_at) : '',
      deadline: row.deadline ? isoToDatetimeLocalInJst(row.deadline) : '',
      budgetType: row.budget_type,
      fixedBudgetMode: taskPoolFixedMode(row),
      recurringCadence: (row.recurring_cadence || '') as '' | 'weekly' | 'biweekly' | 'monthly',
      nextPaymentDueAt: row.next_payment_due_at || '',
      hourlyRate: row.hourly_rate != null ? String(row.hourly_rate) : '',
      weeklyHoursCap: row.weekly_hours_cap != null ? String(row.weekly_hours_cap) : '40',
      budgetAmount: row.budget_amount?.toString() || '',
      milestones: parseMilestones(row.milestones_json).map((m) => ({
        id: m.id,
        title: m.title,
        amount: String(m.amount),
        confirmedAt: m.confirmed_at,
      })),
      upworkConnectionFee: Number(row.upwork_connection_fee ?? 0).toString(),
      convertFee: Number(row.convert_fee ?? 0).toString(),
      transferFee: Number(row.transfer_fee ?? 0).toString(),
      upworkFee: Number(row.upwork_fee ?? 0).toString(),
      withdrawFee: Number(row.withdraw_fee ?? 0).toString(),
      currency: row.currency || 'USD',
      githubUrl: row.github_url || '',
      screenshotUrls: screenshots.filter((s) => s.pool_item_id === row.id).map((s) => s.image_url),
      sourceFileUrls: sourceFiles.filter((s) => s.pool_item_id === row.id).map((s) => s.file_url),
    });
    setDialogOpen(true);
  };

  const savePoolItem = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const storageLinks = serializeLabeledLinks(form.sourceStorageLinks);
    if (storageLinks.length === 0) {
      toast({ title: 'Source storage URL is required', description: 'Add at least one storage link.', variant: 'destructive' });
      return;
    }
    if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring') {
      if (!form.nextPaymentDueAt.trim()) {
        toast({ title: 'Next payment date required', variant: 'destructive' });
        return;
      }
      if (!form.budgetAmount || Number(form.budgetAmount) <= 0) {
        toast({ title: 'Installment amount required', variant: 'destructive' });
        return;
      }
    }
    if (form.budgetType === 'hourly') {
      if (!form.hourlyRate || Number(form.hourlyRate) <= 0) {
        toast({ title: 'Hourly rate required', variant: 'destructive' });
        return;
      }
    }
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(form.metadataJson || '{}');
    } catch {
      toast({ title: 'Metadata JSON is invalid', variant: 'destructive' });
      return;
    }

    const gh = serializeLabeledLinks(form.githubLinks);
    const docs = serializeLabeledLinks(form.initialDocLinks);
    const existing = editingId ? items.find((i) => i.id === editingId) : null;

    const upworkConnectionFee = form.upworkConnectionFee ? Number(form.upworkConnectionFee) : 0;
    const convertFee = form.convertFee ? Number(form.convertFee) : 0;
    const transferFee = form.transferFee ? Number(form.transferFee) : 0;
    const upworkFee = form.upworkFee ? Number(form.upworkFee) : 0;
    const withdrawFee = form.withdrawFee ? Number(form.withdrawFee) : 0;

    let milestoneRowsForSave: Array<{ id: string; title: string; amount: number; confirmed_at: string | null }> = [];
    if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone') {
      const prev = existing ? parseMilestones(existing.milestones_json) : [];
      milestoneRowsForSave = form.milestones
        .filter((m) => m.title.trim() || Number(m.amount) > 0)
        .map((m) => {
          const p = prev.find((x) => x.id === m.id);
          return {
            id: m.id,
            title: m.title.trim() || 'Milestone',
            amount: Math.max(0, Number(m.amount) || 0),
            confirmed_at: p?.confirmed_at ?? null,
          };
        });
      if (milestoneRowsForSave.length === 0 || sumMilestoneGross(milestoneRowsForSave) <= 0) {
        toast({
          title: 'Invalid milestones',
          description: 'Add at least one milestone with an amount greater than 0.',
          variant: 'destructive',
        });
        return;
      }
    }

    const isAccrualForm =
      form.budgetType === 'hourly' || (form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring');

    let withdrawn_amount = 0;
    if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'project') {
      const wasProjectFixed = existing?.budget_type === 'fixed' && taskPoolFixedMode(existing) === 'project';
      withdrawn_amount = wasProjectFixed ? Number(existing?.withdrawn_amount ?? 0) : 0;
    } else if (form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone') {
      const wasMilestone = existing?.budget_type === 'fixed' && taskPoolFixedMode(existing) === 'milestone';
      if (!existing) withdrawn_amount = 0;
      else if (!wasMilestone) withdrawn_amount = 0;
      else withdrawn_amount = Number(existing.withdrawn_amount ?? 0);
    } else if (isAccrualForm) {
      const wasAccrual = existing ? taskUsesAccrualPayments(existing) : false;
      if (!existing) {
        withdrawn_amount = 0;
      } else if (!wasAccrual) {
        // Switched from one-shot fixed (or any non-accrual) to installment/hourly: do not carry over full-project net.
        withdrawn_amount = 0;
      } else {
        withdrawn_amount = Number(existing.withdrawn_amount ?? 0);
      }
    } else if (existing) {
      withdrawn_amount = Number(existing.withdrawn_amount ?? 0);
    }

    const resolvedBudgetAmount =
      form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone'
        ? sumMilestoneGross(milestoneRowsForSave)
        : form.budgetAmount
          ? Number(form.budgetAmount)
          : null;

    const fixedMode = form.budgetType === 'hourly' ? 'project' : form.fixedBudgetMode;
    const recurringCadence =
      form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring'
        ? form.recurringCadence || 'weekly'
        : null;
    const next_payment_due_at =
      form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring' && form.nextPaymentDueAt.trim()
        ? form.nextPaymentDueAt.trim()
        : null;

    setSaving(true);
    const payload = {
      user_id: user?.id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      task_source: form.taskSource.trim() || null,
      main_stack: form.mainStack || null,
      skillset_csv: toCsv(form.skillsetTags) || null,
      tags_csv: toCsv(form.tagsTags) || null,
      status: form.status,
      priority: form.priority,
      client_id: form.clientId || null,
      client_name_override: form.clientNameOverride.trim() || null,
      client_country: form.clientCountry.trim() || null,
      client_timezone: form.clientTimezone.trim() || null,
      account_id: form.accountId || null,
      chat_history: form.chatHistory.trim() || null,
      metadata_json: metadata,
      initial_document_url: docs[0]?.url ?? null,
      source_storage_type: form.sourceStorageType,
      source_storage_url: storageLinks[0]?.url ?? null,
      github_links: gh,
      source_storage_urls: storageLinks,
      initial_document_urls: docs,
      task_received_at: form.taskReceivedAt ? datetimeLocalJstToIso(form.taskReceivedAt) : null,
      deadline: form.deadline ? datetimeLocalJstToIso(form.deadline) : null,
      budget_type: form.budgetType,
      fixed_budget_mode: fixedMode,
      recurring_cadence: recurringCadence,
      next_payment_due_at,
      hourly_rate: form.budgetType === 'hourly' && form.hourlyRate ? Number(form.hourlyRate) : null,
      weekly_hours_cap: form.budgetType === 'hourly' ? Number(form.weeklyHoursCap || 40) : null,
      budget_amount: resolvedBudgetAmount,
      milestones_json: form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone' ? milestoneRowsForSave : [],
      upwork_connection_fee: upworkConnectionFee,
      convert_fee: convertFee,
      transfer_fee: transferFee,
      upwork_fee: upworkFee,
      withdraw_fee: withdrawFee,
      withdrawn_amount,
      currency: form.currency.trim() || 'USD',
      github_url: gh[0]?.url ?? null,
      updated_at: new Date().toISOString(),
    };

    const saveResult = editingId
      ? await supabase.from('task_pool_items').update(payload).eq('id', editingId).select('id').single()
      : await supabase.from('task_pool_items').insert(payload).select('id').single();

    if (saveResult.error || !saveResult.data) {
      toast({ title: 'Save failed', description: saveResult.error?.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    const poolId = saveResult.data.id as string;

    await supabase.from('task_pool_screenshots').delete().eq('pool_item_id', poolId);
    if (form.screenshotUrls.length > 0) {
      await supabase.from('task_pool_screenshots').insert(
        form.screenshotUrls.map((url, index) => ({
          pool_item_id: poolId,
          image_url: url,
          sort_order: index,
        })),
      );
    }

    await supabase.from('task_pool_source_files').delete().eq('pool_item_id', poolId);
    if (form.sourceFileUrls.length > 0) {
      await supabase.from('task_pool_source_files').insert(
        form.sourceFileUrls.map((url, index) => ({
          pool_item_id: poolId,
          file_url: url,
          sort_order: index,
        })),
      );
    }

    setSaving(false);
    setDialogOpen(false);
    toast({ title: editingId ? 'Task updated' : 'Task created' });
    await refreshTaskPoolDataQuiet();
    await promoteIfNeeded(poolId, form.status);
  };

  const submitAccrualConfirm = async () => {
    if (!accrualDialog || !user?.id) return;
    const row = items.find((i) => i.id === accrualDialog.row.id) ?? accrualDialog.row;
    const fees = {
      upworkConnectionFee: Number(row.upwork_connection_fee ?? 0),
      convertFee: Number(row.convert_fee ?? 0),
      transferFee: Number(row.transfer_fee ?? 0),
      upworkFee: Number(row.upwork_fee ?? 0),
      withdrawFee: Number(row.withdraw_fee ?? 0),
    };
    let net = 0;
    let noteExtra = '';
    let nextDue: string | null = row.next_payment_due_at;
    let hourlyAck: string | null = row.hourly_last_ack_week_monday;
    let milestonesJsonPatch: ReturnType<typeof parseMilestones> | null = null;

    if (accrualDialog.kind === 'project') {
      const full = Number(row.budget_amount ?? 0);
      net = calcWithdrawnAmount({ budgetAmount: full, ...fees });
      const already = Number(row.withdrawn_amount ?? 0);
      net = Math.max(0, net - already);
      noteExtra = 'Fixed project · one-time client payment confirmation (JST)';
    } else if (accrualDialog.kind === 'recurring') {
      const installment = Number(row.budget_amount ?? 0);
      net = calcWithdrawnAmount({ budgetAmount: installment, ...fees });
      if (!row.recurring_cadence || !row.next_payment_due_at) {
        toast({ title: 'Task is missing cadence or due date', variant: 'destructive' });
        return;
      }
      nextDue = advanceRecurringDueJstYmd(row.next_payment_due_at, row.recurring_cadence);
      noteExtra = `Fixed ${row.recurring_cadence} · due ${row.next_payment_due_at} (JST)`;
    } else if (accrualDialog.kind === 'milestone') {
      const mid = accrualDialog.milestoneId;
      if (!mid) {
        toast({ title: 'Missing milestone', variant: 'destructive' });
        return;
      }
      const ms = parseMilestones(row.milestones_json);
      const m = ms.find((x) => x.id === mid);
      if (!m || m.confirmed_at) {
        toast({ title: 'Milestone unavailable', description: 'Already confirmed or removed.', variant: 'destructive' });
        return;
      }
      const slice = Number(m.amount ?? 0);
      if (slice <= 0) {
        toast({ title: 'Milestone amount must be positive', variant: 'destructive' });
        return;
      }
      net = calcWithdrawnAmount({ budgetAmount: slice, ...fees });
      noteExtra = `Fixed milestone · ${m.title}`;
      milestonesJsonPatch = ms.map((x) => (x.id === mid ? { ...x, confirmed_at: new Date().toISOString() } : x));
    } else {
      const cap = Number(row.weekly_hours_cap ?? 40);
      const hours = Math.min(Math.max(Number(accrualHours || 0), 0), cap);
      const gross = hours * Number(row.hourly_rate ?? 0);
      net = calcWithdrawnAmount({ budgetAmount: gross, ...fees });
      hourlyAck = addDaysToJstYmd(getJstMondayYmd(new Date()), -7);
      noteExtra = `Hourly (JST Mon–Sun) · ${hours}h × ${row.hourly_rate} · week ending before ${formatJstYmd(new Date())}`;
    }

    if (net <= 0) {
      toast({ title: 'Net accrual is zero', description: 'Check amounts and fees.', variant: 'destructive' });
      return;
    }

    const newWithdrawn = Number(row.withdrawn_amount ?? 0) + net;

    const payRes = await supabase.from('payment_entries').insert({
      user_id: user.id,
      entry_type: 'incoming',
      category:
        accrualDialog.kind === 'project'
          ? 'Task pool (fixed project)'
          : accrualDialog.kind === 'recurring'
            ? 'Task pool (fixed installment)'
            : accrualDialog.kind === 'milestone'
              ? 'Task pool (fixed milestone)'
              : 'Task pool (hourly)',
      amount: net,
      currency: row.currency || 'USD',
      occurred_at: new Date().toISOString(),
      note: `${row.name} — ${noteExtra}`,
      source_kind: 'task_auto',
      pool_item_id: row.id,
      updated_at: new Date().toISOString(),
    });
    if (payRes.error) {
      toast({ title: 'Payment entry failed', description: payRes.error.message, variant: 'destructive' });
      return;
    }

    const upd = await supabase
      .from('task_pool_items')
      .update({
        withdrawn_amount: newWithdrawn,
        next_payment_due_at: accrualDialog.kind === 'recurring' ? nextDue : row.next_payment_due_at,
        hourly_last_ack_week_monday: accrualDialog.kind === 'hourly' ? hourlyAck : row.hourly_last_ack_week_monday,
        ...(milestonesJsonPatch ? { milestones_json: milestonesJsonPatch } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .single();

    if (upd.error || !upd.data) {
      toast({ title: 'Task update failed', description: upd.error?.message, variant: 'destructive' });
      return;
    }

    setAccrualDialog(null);
    toast({ title: 'Payment confirmed', description: `Recorded ${row.currency} ${net.toFixed(2)} incoming and updated withdrawn.` });
    setItems((prev) => prev.map((x) => (x.id === row.id ? (upd.data as TaskPoolItemRecord) : x)));
  };

  const deletePoolItem = async (id: string) => {
    const res = await supabase.from('task_pool_items').delete().eq('id', id);
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    if (selectedId === id) setSelectedId(null);
    toast({ title: 'Removed from task pool' });
    await refreshTaskPoolDataQuiet();
  };

  const updateDetailStatus = async (newStatus: string) => {
    if (!selected) return;
    const res = await supabase
      .from('task_pool_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', selected.id)
      .select('*')
      .single();
    if (res.error || !res.data) {
      toast({ title: 'Update failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === selected.id ? (res.data as TaskPoolItemRecord) : x)));
    await promoteIfNeeded(selected.id, newStatus);
  };

  const addSubtask = async () => {
    if (!selected || !newSubtaskTitle.trim()) return;
    const res = await supabase
      .from('task_pool_subtasks')
      .insert({
        pool_item_id: selected.id,
        title: newSubtaskTitle.trim(),
        assignee_personnel_id: newSubtaskAssignee || null,
        status: newSubtaskColumn,
        priority: 'medium',
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (res.error || !res.data) {
      toast({ title: 'Failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    setNewSubtaskTitle('');
    setNewSubtaskAssignee('');
    setSubtasks((prev) => [res.data as PoolSubtask, ...prev]);
  };

  const saveSubtaskDetail = async (
    taskId: string,
    data: { title: string; description: string | null },
  ): Promise<boolean> => {
    const res = await supabase
      .from('task_pool_subtasks')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();
    if (res.error || !res.data) {
      toast({ title: 'Save failed', description: res.error?.message, variant: 'destructive' });
      return false;
    }
    setSubtasks((prev) => prev.map((t) => (t.id === taskId ? (res.data as PoolSubtask) : t)));
    toast({ title: 'Card saved', description: 'Title and description were updated.' });
    return true;
  };

  const moveSubtaskToColumn = async (taskId: string, status: PoolSubtaskStatus) => {
    const res = await supabase
      .from('task_pool_subtasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();
    if (res.error || !res.data) {
      toast({ title: 'Move failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    const updated = res.data as PoolSubtask;
    setSubtasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
  };

  const deleteSubtask = async (id: string) => {
    const res = await supabase.from('task_pool_subtasks').delete().eq('id', id);
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    setSubtasks((prev) => prev.filter((x) => x.id !== id));
    setSubtaskDetailId((cur) => (cur === id ? null : cur));
  };

  const addChatMessage = async () => {
    if (!selected || !newChat.trim() || !user?.id) return;
    const res = await supabase
      .from('task_pool_chat_messages')
      .insert({
        pool_item_id: selected.id,
        author_user_id: user.id,
        message: newChat.trim(),
      })
      .select('*')
      .single();
    if (res.error || !res.data) {
      toast({ title: 'Message failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    setMessages((prev) => [res.data as PoolChatMessage, ...prev]);
    setNewChat('');
  };

  const deleteChatMessage = async (id: string) => {
    const res = await supabase.from('task_pool_chat_messages').delete().eq('id', id);
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const executePendingDelete = async () => {
    if (!pendingDelete) return;
    const p = pendingDelete;
    setPendingDelete(null);
    if (p.kind === 'pool') await deletePoolItem(p.id);
    else if (p.kind === 'subtask') await deleteSubtask(p.id);
    else await deleteChatMessage(p.id);
  };

  const poolClientLabel = (row: TaskPoolItemRecord) => {
    if (row.client_id) {
      const c = clients.find((x) => x.id === row.client_id);
      if (c) return `${c.first_name} ${c.last_name}${c.company_name ? ` (${c.company_name})` : ''}`;
    }
    return row.client_name_override || 'N/A';
  };

  const poolAccountLabel = (row: TaskPoolItemRecord) => {
    if (!row.account_id) return 'N/A';
    const a = accounts.find((x) => x.id === row.account_id);
    return a ? `${a.platform} @${a.username}` : 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accrualDueItems.length > 0 ? (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Confirm accrual (JST)</AlertTitle>
          <AlertDescription>
            <p className="text-sm text-muted-foreground mb-2">
              Confirm installments, milestones, one-off fixed payouts, or hourly weeks (Mon–Sun JST). Each confirmation increases <strong className="text-foreground">withdrawn</strong> on the task and adds an <strong className="text-foreground">incoming</strong> row in Payments.
            </p>
            <div className="flex flex-wrap gap-2">
              {accrualDueItems.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  onClick={() => {
                    if (t.budget_type === 'hourly') {
                      setAccrualHours(String(t.weekly_hours_cap ?? 40));
                      setAccrualDialog({ row: t, kind: 'hourly' });
                    } else if (t.budget_type === 'fixed' && taskPoolFixedMode(t) === 'project') {
                      setAccrualDialog({ row: t, kind: 'project' });
                    } else if (t.budget_type === 'fixed' && taskPoolFixedMode(t) === 'milestone') {
                      const m = firstPendingMilestone(t);
                      if (m) setAccrualDialog({ row: t, kind: 'milestone', milestoneId: m.id });
                    } else {
                      setAccrualDialog({ row: t, kind: 'recurring' });
                    }
                  }}
                >
                  {t.name}
                  <Badge variant="outline" className="text-[10px]">
                    {t.budget_type === 'hourly'
                      ? 'hourly'
                      : taskPoolFixedMode(t) === 'project'
                        ? 'project'
                        : taskPoolFixedMode(t) === 'milestone'
                          ? 'milestone'
                          : t.recurring_cadence}
                  </Badge>
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {!selectedId ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Task pool</h2>
              <p className="text-sm text-muted-foreground">
                Click a lead to open details and the full-width <strong>Task board</strong>. Set the lead to <strong>Completed</strong> to promote to Projects.
              </p>
            </div>
            <div className="flex w-full max-w-2xl gap-3">
              <ModuleSearchBar value={searchInput} onChange={setSearchInput} placeholder="Search tasks..." id="admin-task-pool-search" />
              <Select value={listFilter} onValueChange={(v) => setListFilter(v as TaskPoolListFilter)}>
                <SelectTrigger className="w-[210px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tasks</SelectItem>
                  <SelectItem value="latest">Latest tasks</SelectItem>
                  <SelectItem value="this_period">{`This month (${thisMonthLabel})`}</SelectItem>
                  <SelectItem value="last_period">{`Last month (${lastMonthLabel})`}</SelectItem>
                  <SelectItem value="this_week">This week</SelectItem>
                  <SelectItem value="last_week">Last week</SelectItem>
                  <SelectItem value="custom">Custom period</SelectItem>
                  <SelectItem value="this_year">This year</SelectItem>
                  <SelectItem value="working">Current working</SelectItem>
                </SelectContent>
              </Select>
              {listFilter === 'custom' ? (
                <div className="flex items-center gap-2">
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[150px]" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[150px]" />
                </div>
              ) : null}
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'card' | 'list' | 'line' | 'table')}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card mode</SelectItem>
                  <SelectItem value="list">List mode</SelectItem>
                  <SelectItem value="line">Line mode</SelectItem>
                  <SelectItem value="table">Table mode</SelectItem>
                </SelectContent>
              </Select>
              <Button className="gap-2 shrink-0" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <AdminTaskStatCard title={`This Month (${thisMonthLabel})`} summary={thisPeriodSummary} />
            <AdminTaskStatCard title={`Last Month (${lastMonthLabel})`} summary={lastPeriodSummary} />
            <AdminTaskStatCard title={`Year (${yearLabel})`} summary={thisYearSummary} />
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-lg border bg-card py-12 text-center">
              <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching tasks' : 'No tasks yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput.trim() ? 'Try different keywords or clear the search.' : 'Create a task with New.'}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((row) => (
                <Card
                  key={row.id}
                  className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                  onClick={() => setSelectedId(row.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground line-clamp-2">{row.name}</p>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary">{taskPoolItemStatusLabel(row.status)}</Badge>
                        {taskPoolNeedsAccrualAck(row) || hasPendingProjectPayment(row) || hasPendingMilestonePayment(row) ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Accrual due
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {row.promoted_project_id ? (
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        Promoted
                      </Badge>
                    ) : null}
                    {row.task_source ? (
                      <p className="mt-2 text-xs text-muted-foreground capitalize">Source: {row.task_source.replace('_', ' ')}</p>
                    ) : null}
                    {row.main_stack ? (
                      <p className="mt-1 text-xs text-primary/90 capitalize">Stack: {row.main_stack.replace('_', ' ')}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Real: {row.currency} {taskPoolContractGross(row).toFixed(2)}
                    </p>
                    <p className="text-xs text-emerald-600">
                      Withdrawn: {row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Received: {formatIsoInJst(row.task_received_at)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-3 break-words [overflow-wrap:anywhere]">
                      {row.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'No description'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Real</th>
                    <th className="px-3 py-2">Withdrawn</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((row) => (
                    <tr key={row.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => setSelectedId(row.id)}>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2">{taskPoolItemStatusLabel(row.status)}</td>
                      <td className="px-3 py-2 capitalize">{(row.task_source || '-').replace('_', ' ')}</td>
                      <td className="px-3 py-2">{row.currency} {taskPoolContractGross(row).toFixed(2)}</td>
                      <td className="px-3 py-2 text-emerald-600">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'line' ? (
            <div className="rounded-lg border bg-card">
              {filteredItems.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/30"
                  onClick={() => setSelectedId(row.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{(row.task_source || 'n/a').replace('_', ' ')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{taskPoolItemStatusLabel(row.status)}</p>
                    <p className="text-xs text-emerald-600">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((row) => (
                <Card key={row.id} className="cursor-pointer hover:border-primary/40" onClick={() => setSelectedId(row.id)}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {taskPoolItemStatusLabel(row.status)} · {row.currency} {taskPoolContractGross(row).toFixed(2)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-4 w-4" />
              All tasks
            </Button>
          </div>

          <Card className="min-w-0">
            {selected ? (
              <>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                <CardTitle className="text-xl">{selected.name}</CardTitle>
                <div
                  className="prose prose-sm max-w-none text-muted-foreground mt-1 break-words [overflow-wrap:anywhere] [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-primary [&_a]:break-all"
                  dangerouslySetInnerHTML={{ __html: selected.description?.trim() ? selected.description : '<p>No description.</p>' }}
                />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select value={selected.status} onValueChange={(v) => updateDetailStatus(v)}>
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_POOL_ITEM_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {taskPoolItemStatusLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selected.main_stack ? (
                        <Badge className="capitalize">{selected.main_stack.replace('_', ' ')}</Badge>
                      ) : null}
                      {selected.task_source ? (
                        <Badge variant="outline" className="capitalize">
                          Task source(from): {selected.task_source.replace('_', ' ')}
                        </Badge>
                      ) : null}
                      {selected.promoted_project_id ? (
                        <Badge variant="default" className="gap-1">
                          Linked project
                        </Badge>
                      ) : null}
                    </div>
                    {selected.promoted_project_id ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Promoted to Projects.{' '}
                        <Link to="/dashboard/projects" className="font-medium text-primary hover:underline">
                          Open Projects view
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {taskPoolNeedsAccrualAck(selected) || hasPendingProjectPayment(selected) || hasPendingMilestonePayment(selected) ? (
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          if (selected.budget_type === 'hourly') {
                            setAccrualHours(String(selected.weekly_hours_cap ?? 40));
                            setAccrualDialog({ row: selected, kind: 'hourly' });
                          } else if (selected.budget_type === 'fixed' && taskPoolFixedMode(selected) === 'project') {
                            setAccrualDialog({ row: selected, kind: 'project' });
                          } else if (selected.budget_type === 'fixed' && taskPoolFixedMode(selected) === 'milestone') {
                            const m = firstPendingMilestone(selected);
                            if (m) setAccrualDialog({ row: selected, kind: 'milestone', milestoneId: m.id });
                          } else {
                            setAccrualDialog({ row: selected, kind: 'recurring' });
                          }
                        }}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {taskPoolFixedMode(selected) === 'milestone' ? 'Confirm next milestone' : 'Confirm accrual'}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(selected)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive"
                      onClick={() => setPendingDelete({ kind: 'pool', id: selected.id, name: selected.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                    <TabsTrigger value="files">Source files</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="tasks">Task board</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCard icon={FolderKanban} title="Client" value={poolClientLabel(selected)} />
                      <InfoCard icon={Link2} title="Account" value={poolAccountLabel(selected)} />
                      <InfoCard icon={Clock} title="Deadline" value={selected.deadline ? formatIsoInJst(selected.deadline) : 'Not set'} />
                      <InfoCard
                        icon={Calendar}
                        title="Task received"
                        value={selected.task_received_at ? formatIsoInJst(selected.task_received_at) : 'Not set'}
                      />
                      <InfoCard
                        icon={Calendar}
                        title="Budget"
                        value={
                          selected.budget_type === 'hourly'
                            ? `${selected.currency} ${Number(selected.hourly_rate ?? 0).toFixed(2)}/hr · cap ${Number(selected.weekly_hours_cap ?? 40)}h/wk (JST)`
                            : taskPoolFixedMode(selected) === 'milestone'
                              ? `${selected.currency} ${taskPoolContractGross(selected).toFixed(2)} · fixed milestone (${parseMilestones(selected.milestones_json).length} steps)`
                              : `${selected.currency} ${Number(selected.budget_amount ?? 0).toFixed(2)} · fixed ${taskPoolFixedMode(selected)}${
                                  taskPoolFixedMode(selected) === 'recurring' && selected.recurring_cadence
                                    ? ` · ${selected.recurring_cadence}`
                                    : ''
                                }`
                        }
                      />
                      {taskPoolFixedMode(selected) === 'recurring' && selected.next_payment_due_at ? (
                        <InfoCard icon={Calendar} title="Next payment due (JST date)" value={selected.next_payment_due_at} />
                      ) : null}
                      <InfoCard
                        icon={Calendar}
                        title="Withdrawn amount"
                        value={`${selected.currency} ${Number(selected.withdrawn_amount ?? 0).toFixed(2)}`}
                      />
                    </div>
                    {taskPoolFixedMode(selected) === 'milestone' ? (
                      <div className="rounded-lg border p-3 space-y-2 md:col-span-2">
                        <p className="text-sm font-medium">Milestones</p>
                        {parseMilestones(selected.milestones_json).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No milestones defined.</p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {parseMilestones(selected.milestones_json).map((m) => (
                              <li
                                key={m.id}
                                className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border/60 pb-2 last:border-0"
                              >
                                <div className="min-w-0">
                                  <span className="font-medium">{m.title}</span>
                                  <span className="text-muted-foreground">
                                    {' '}
                                    · {selected.currency} {Number(m.amount).toFixed(2)}
                                  </span>
                                  {m.confirmed_at ? (
                                    <Badge variant="secondary" className="ml-2 text-[10px]">
                                      Confirmed
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="ml-2 text-[10px]">
                                      Pending
                                    </Badge>
                                  )}
                                </div>
                                {!m.confirmed_at && Number(m.amount) > 0 ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setAccrualDialog({ row: selected, kind: 'milestone', milestoneId: m.id })}
                                  >
                                    Confirm paid
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoCard icon={Clock} title="Upwork connection fee" value={`${selected.currency} ${Number(selected.upwork_connection_fee ?? 0).toFixed(2)}`} />
                      <InfoCard icon={Clock} title="Convert fee" value={`${selected.currency} ${Number(selected.convert_fee ?? 0).toFixed(2)}`} />
                      <InfoCard icon={Clock} title="Transfer fee" value={`${selected.currency} ${Number(selected.transfer_fee ?? 0).toFixed(2)}`} />
                      <InfoCard icon={Clock} title="Upwork fee" value={`${selected.currency} ${Number(selected.upwork_fee ?? 0).toFixed(2)}`} />
                      <InfoCard icon={Clock} title="Withdraw fee" value={`${selected.currency} ${Number(selected.withdraw_fee ?? 0).toFixed(2)}`} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Skillset</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.skillset_csv || '')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((skill) => (
                            <Badge key={skill} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <MultiLinkField title="Source storage" links={parseLabeledLinks(selected.source_storage_urls, selected.source_storage_url, 'Storage')} />
                      <MultiLinkField title="GitHub" links={parseLabeledLinks(selected.github_links, selected.github_url, 'GitHub')} />
                      <MultiLinkField title="Initial documents" links={parseLabeledLinks(selected.initial_document_urls, selected.initial_document_url, 'Document')} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Metadata</p>
                      <pre className="rounded border bg-muted/40 p-3 text-xs overflow-auto">
                        {JSON.stringify(selected.metadata_json || {}, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="screenshots" className="space-y-4">
                    {selectedScreenshots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No screenshots.</p>
                    ) : (
                      <div className="px-12">
                        <Carousel opts={{ align: 'start' }}>
                          <CarouselContent>
                            {selectedScreenshots.map((s) => (
                              <CarouselItem key={s.id}>
                                <div className="overflow-hidden rounded border bg-muted/20">
                                  <img src={s.image_url} alt="" className="h-[320px] w-full object-cover" />
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          <CarouselPrevious />
                          <CarouselNext />
                        </Carousel>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="files" className="space-y-2">
                    {selectedFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No source file links.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedFiles.map((f) => (
                          <li key={f.id}>
                            <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                              {f.file_url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="chat" className="space-y-3">
                    <div className="flex gap-2">
                      <Textarea placeholder="Internal note..." value={newChat} onChange={(e) => setNewChat(e.target.value)} />
                      <Button className="self-end gap-1" onClick={addChatMessage}>
                        <MessageSquare className="h-4 w-4" />
                        Post
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[320px] overflow-auto">
                      {selectedMessages.map((m) => (
                        <div key={m.id} className="rounded border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm whitespace-pre-line">{m.message}</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive"
                              onClick={() =>
                                setPendingDelete({
                                  kind: 'chat',
                                  id: m.id,
                                  preview: m.message.length > 120 ? `${m.message.slice(0, 120)}…` : m.message,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                      {selectedMessages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
                    </div>
                  </TabsContent>

                  <TabsContent value="tasks" className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      About three columns show at once—scroll sideways to see all. Click a card for title and description. Drag from the grip to move. Add a card to choose its starting column.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_160px_220px_auto]">
                      <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} placeholder="Card title" />
                      <Select value={newSubtaskColumn} onValueChange={(v) => setNewSubtaskColumn(v as PoolSubtaskStatus)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Column" />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_POOL_SUBTASK_BOARD_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {poolSubtaskBoardLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={newSubtaskAssignee || 'none'} onValueChange={(v) => setNewSubtaskAssignee(v === 'none' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Developer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {personnel.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.first_name} {p.last_name} ({p.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={addSubtask}>
                        <ListTodo className="h-4 w-4 mr-1" />
                        Add card
                      </Button>
                    </div>
                    <PoolSubtaskKanban
                      subtasks={selectedSubtasks}
                      personnel={personnel}
                      onMove={moveSubtaskToColumn}
                      onSelect={(t) => setSubtaskDetailId(t.id)}
                      canDelete
                      onDelete={(id, title) => setPendingDelete({ kind: 'subtask', id, title })}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
              </>
            ) : (
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>This task is no longer available.</p>
                <Button type="button" variant="outline" className="mt-4" onClick={() => setSelectedId(null)}>
                  Back to all tasks
                </Button>
              </CardContent>
            )}
          </Card>
        </>
      )}

      <PoolSubtaskDetailDialog
        open={!!detailSubtask}
        onOpenChange={(open) => !open && setSubtaskDetailId(null)}
        task={detailSubtask}
        personnel={personnel}
        onSave={saveSubtaskDetail}
      />

      <AlertDialog open={!!accrualDialog} onOpenChange={(open) => !open && setAccrualDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm you received this payment?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {accrualDialog?.kind === 'milestone' ? (
                    <>
                      Confirm that the client paid this <strong className="text-foreground">milestone</strong> (gross). Net after your fee fields is
                      added to <strong className="text-foreground">withdrawn</strong> and recorded as <strong className="text-foreground">incoming</strong>{' '}
                      in Payments.
                    </>
                  ) : (
                    <>
                      Only confirm if the last <strong className="text-foreground">weekly / bi-weekly / monthly / hourly (Mon–Sun JST)</strong> amount
                      or <strong className="text-foreground">one-off fixed</strong> payment was actually received. This will increase{' '}
                      <strong className="text-foreground">withdrawn</strong> on the task and add a matching <strong className="text-foreground">incoming</strong>{' '}
                      row in Payments.
                    </>
                  )}
                </p>
                {accrualDialog?.kind === 'milestone' && accrualDialog.milestoneId ? (
                  <p className="text-foreground font-medium">
                    {(() => {
                      const m = parseMilestones(accrualDialog.row.milestones_json).find((x) => x.id === accrualDialog.milestoneId);
                      if (!m) return 'Milestone';
                      const net = calcWithdrawnAmount({
                        budgetAmount: Number(m.amount),
                        upworkConnectionFee: Number(accrualDialog.row.upwork_connection_fee ?? 0),
                        convertFee: Number(accrualDialog.row.convert_fee ?? 0),
                        transferFee: Number(accrualDialog.row.transfer_fee ?? 0),
                        upworkFee: Number(accrualDialog.row.upwork_fee ?? 0),
                        withdrawFee: Number(accrualDialog.row.withdraw_fee ?? 0),
                      });
                      return `${m.title}: ${accrualDialog.row.currency} ${Number(m.amount).toFixed(2)} gross → ${net.toFixed(2)} net to withdrawn`;
                    })()}
                  </p>
                ) : null}
                {accrualDialog?.kind === 'hourly' ? (
                  <div className="space-y-2">
                    <Label>Billable hours this week (max {accrualDialog.row.weekly_hours_cap ?? 40})</Label>
                    <Input type="number" value={accrualHours} onChange={(e) => setAccrualHours(e.target.value)} min={0} />
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitAccrualConfirm()}>Yes, payment received</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit task pool item' : 'Create task pool item'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Task name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <RichTextEditor
                value={form.description}
                onChange={(val) => setForm((p) => ({ ...p, description: val }))}
                placeholder="Task details…"
              />
            </div>
            <div className="space-y-2">
              <Label>Task source(from)</Label>
              <Input list="task-src-opt" value={form.taskSource} onChange={(e) => setForm((p) => ({ ...p, taskSource: e.target.value }))} />
              <datalist id="task-src-opt">
                {TASK_SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Main stack</Label>
              <Input list="ms-opt" value={form.mainStack} onChange={(e) => setForm((p) => ({ ...p, mainStack: e.target.value }))} />
              <datalist id="ms-opt">
                {MAIN_STACK_OPTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2 md:col-span-2">
              <TagChipsInput
                label="Skillset"
                values={form.skillsetTags}
                onChange={(next) => setForm((p) => ({ ...p, skillsetTags: next }))}
                placeholder="Type skill, Enter or comma"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <TagChipsInput
                label="Tags"
                values={form.tagsTags}
                onChange={(next) => setForm((p) => ({ ...p, tagsTags: next }))}
                placeholder="Type tag, Enter or comma"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_POOL_ITEM_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {taskPoolItemStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={form.clientId || 'none'}
                onValueChange={(v) => {
                  const c = clients.find((x) => x.id === v);
                  setForm((p) => ({
                    ...p,
                    clientId: v === 'none' ? '' : v,
                    clientCountry:
                      v === 'none'
                        ? p.clientCountry
                        : canonicalCountryNameOrLegacy(c?.country || '') || p.clientCountry,
                    clientTimezone:
                      v === 'none'
                        ? p.clientTimezone
                        : canonicalTimezoneOrLegacy(c?.timezone || '') || p.clientTimezone,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.company_name ? ` (${c.company_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client name (manual)</Label>
              <Input value={form.clientNameOverride} onChange={(e) => setForm((p) => ({ ...p, clientNameOverride: e.target.value }))} />
            </div>
            <CountrySelect
              label="Client country"
              value={form.clientCountry}
              onChange={(clientCountry) => setForm((p) => ({ ...p, clientCountry }))}
            />
            <TimezoneSelect
              label="Client timezone"
              value={form.clientTimezone}
              onChange={(clientTimezone) => setForm((p) => ({ ...p, clientTimezone }))}
            />
            <div className="space-y-2 md:col-span-2">
              <Label>Account</Label>
              <Select value={form.accountId || 'none'} onValueChange={(v) => setForm((p) => ({ ...p, accountId: v === 'none' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.platform} @{a.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task received at (offer date, JST)</Label>
              <Input type="datetime-local" value={form.taskReceivedAt} onChange={(e) => setForm((p) => ({ ...p, taskReceivedAt: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">Interpreted as Asia/Tokyo, not your computer timezone.</p>
            </div>
            <div className="space-y-2">
              <Label>Deadline (JST)</Label>
              <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Budget type</Label>
              <Select
                value={form.budgetType}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    budgetType: v as 'fixed' | 'hourly',
                    fixedBudgetMode: v === 'hourly' ? 'project' : p.fixedBudgetMode,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.budgetType === 'fixed' ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Fixed contract</Label>
                <Select
                  value={form.fixedBudgetMode}
                  onValueChange={(v) =>
                    setForm((p) => {
                      const mode = v as 'project' | 'recurring' | 'milestone';
                      return {
                        ...p,
                        fixedBudgetMode: mode,
                        recurringCadence:
                          mode === 'recurring' && !p.recurringCadence ? 'weekly' : mode === 'recurring' ? p.recurringCadence : '',
                        milestones:
                          mode === 'milestone' && p.milestones.length === 0
                            ? [{ id: crypto.randomUUID(), title: '', amount: '', confirmedAt: null }]
                            : p.milestones,
                      };
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Contract amount (single total)</SelectItem>
                    <SelectItem value="milestone">By milestone (total = sum of milestones)</SelectItem>
                    <SelectItem value="recurring">Installment (weekly / bi-weekly / monthly, JST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {form.budgetType === 'fixed' && form.fixedBudgetMode === 'project' ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Contract amount (total)</Label>
                <Input type="number" value={form.budgetAmount} onChange={(e) => setForm((p) => ({ ...p, budgetAmount: e.target.value }))} />
              </div>
            ) : null}
            {form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone' ? (
              <div className="space-y-3 md:col-span-2">
                <div className="space-y-2">
                  <Label>Contract amount (total)</Label>
                  <Input
                    readOnly
                    className="bg-muted/40"
                    value={`${form.currency || 'USD'} ${sumMilestoneGross(
                      form.milestones
                        .filter((m) => m.title.trim() || Number(m.amount) > 0)
                        .map((m) => ({
                          id: m.id,
                          title: m.title.trim() || 'Milestone',
                          amount: Math.max(0, Number(m.amount) || 0),
                          confirmed_at: m.confirmedAt,
                        })),
                    ).toFixed(2)} (sum of milestones)`}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Milestones</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          milestones: [...p.milestones, { id: crypto.randomUUID(), title: '', amount: '', confirmedAt: null }],
                        }))
                      }
                    >
                      Add milestone
                    </Button>
                  </div>
                  <div className="space-y-2 rounded-md border p-3">
                    {form.milestones.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No milestones yet — add one.</p>
                    ) : (
                      form.milestones.map((m, idx) => (
                        <div key={m.id} className="flex flex-wrap items-end gap-2 border-b border-dashed pb-2 last:border-b-0">
                          <div className="space-y-1 flex-1 min-w-[140px]">
                            <span className="text-[11px] text-muted-foreground">Title</span>
                            <Input
                              value={m.title}
                              disabled={!!m.confirmedAt}
                              onChange={(e) =>
                                setForm((p) => {
                                  const next = [...p.milestones];
                                  next[idx] = { ...next[idx], title: e.target.value };
                                  return { ...p, milestones: next };
                                })
                              }
                              placeholder={`Milestone ${idx + 1}`}
                            />
                          </div>
                          <div className="space-y-1 w-[120px]">
                            <span className="text-[11px] text-muted-foreground">Amount</span>
                            <Input
                              type="number"
                              value={m.amount}
                              disabled={!!m.confirmedAt}
                              onChange={(e) =>
                                setForm((p) => {
                                  const next = [...p.milestones];
                                  next[idx] = { ...next[idx], amount: e.target.value };
                                  return { ...p, milestones: next };
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2 pb-1">
                            {m.confirmedAt ? (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                Paid
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="shrink-0 text-destructive"
                                onClick={() => setForm((p) => ({ ...p, milestones: p.milestones.filter((_, j) => j !== idx) }))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Saved <strong className="text-foreground">budget_amount</strong> matches this total. Confirm each milestone on the task detail page to
                    update withdrawn and add incoming rows in Payments.
                  </p>
                </div>
              </div>
            ) : null}
            {form.budgetType === 'fixed' && form.fixedBudgetMode === 'recurring' ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Installment amount (per period)</Label>
                  <Input type="number" value={form.budgetAmount} onChange={(e) => setForm((p) => ({ ...p, budgetAmount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cadence</Label>
                  <Select
                    value={form.recurringCadence || 'weekly'}
                    onValueChange={(v) => setForm((p) => ({ ...p, recurringCadence: v as 'weekly' | 'biweekly' | 'monthly' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Next payment due (date in JST)</Label>
                  <Input type="date" value={form.nextPaymentDueAt} onChange={(e) => setForm((p) => ({ ...p, nextPaymentDueAt: e.target.value }))} />
                </div>
              </>
            ) : null}
            {form.budgetType === 'hourly' ? (
              <>
                <div className="space-y-2">
                  <Label>Hourly rate</Label>
                  <Input type="number" value={form.hourlyRate} onChange={(e) => setForm((p) => ({ ...p, hourlyRate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Weekly hour cap (Mon–Sun JST, default 40)</Label>
                  <Input type="number" value={form.weeklyHoursCap} onChange={(e) => setForm((p) => ({ ...p, weeklyHoursCap: e.target.value }))} />
                </div>
                <p className="text-xs text-muted-foreground md:col-span-2">
                  Billing weeks follow Monday–Sunday in Asia/Tokyo. Withdrawn increases when you confirm each week from the accrual prompt.
                </p>
              </>
            ) : null}
            <div className="space-y-2">
              <Label>Upwork connection fee</Label>
              <Input type="number" value={form.upworkConnectionFee} onChange={(e) => setForm((p) => ({ ...p, upworkConnectionFee: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Convert fee</Label>
              <Input type="number" value={form.convertFee} onChange={(e) => setForm((p) => ({ ...p, convertFee: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Transfer fee</Label>
              <Input type="number" value={form.transferFee} onChange={(e) => setForm((p) => ({ ...p, transferFee: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Upwork fee</Label>
              <Input type="number" value={form.upworkFee} onChange={(e) => setForm((p) => ({ ...p, upworkFee: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Withdraw fee</Label>
              <Input type="number" value={form.withdrawFee} onChange={(e) => setForm((p) => ({ ...p, withdrawFee: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Withdrawn amount (preview / saved)</Label>
              <Input value={`${form.currency || 'USD'} ${withdrawnPreview.toFixed(2)}`} readOnly />
              <p className="text-xs text-muted-foreground">
                {form.budgetType === 'fixed' && form.fixedBudgetMode === 'project'
                  ? 'Project fixed: withdrawn stays unchanged until you confirm payment receipt.'
                  : form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone'
                    ? 'Milestone fixed: withdrawn increases when you confirm each milestone; fees apply per milestone payment.'
                    : 'Accrual (recurring or hourly): total only goes up when you confirm each period; fees below apply to each accrual slice.'}
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>GitHub &amp; repo links</Label>
              <LabeledLinksEditor
                links={form.githubLinks}
                onChange={(links) => setForm((p) => ({ ...p, githubLinks: links }))}
                newRowLabel="GitHub"
              />
            </div>
            <div className="space-y-2">
              <Label>Storage type</Label>
              <Select value={form.sourceStorageType} onValueChange={(v) => setForm((p) => ({ ...p, sourceStorageType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_STORAGE_PROVIDER_OPTIONS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Source storage URLs *</Label>
              <LabeledLinksEditor
                links={form.sourceStorageLinks}
                onChange={(links) => setForm((p) => ({ ...p, sourceStorageLinks: links }))}
                newRowLabel="Storage"
              />
            </div>
            {(form.sourceStorageType === 'google_drive' || form.sourceStorageType === 'drive') && (
              <div className="space-y-3 md:col-span-2">
                <CloudGoogleDriveUpload
                  title="Upload screenshots to Google Drive"
                  accept="image/*"
                  onUrlAdded={(url) => setForm((p) => ({ ...p, screenshotUrls: [...p.screenshotUrls, url] }))}
                />
                <CloudGoogleDriveUpload
                  title="Upload source files to Google Drive"
                  accept="*/*"
                  onUrlAdded={(url) =>
                    setForm((p) => {
                      const withFile = { ...p, sourceFileUrls: [...p.sourceFileUrls, url] };
                      if (serializeLabeledLinks(p.sourceStorageLinks).length === 0) {
                        return {
                          ...withFile,
                          sourceStorageLinks: [...p.sourceStorageLinks.filter((l) => l.url.trim()), { label: 'Drive', url }],
                        };
                      }
                      return withFile;
                    })
                  }
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>Initial document URLs</Label>
              <LabeledLinksEditor
                links={form.initialDocLinks}
                onChange={(links) => setForm((p) => ({ ...p, initialDocLinks: links }))}
                newRowLabel="Document"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Legacy chat history</Label>
              <Textarea value={form.chatHistory} onChange={(e) => setForm((p) => ({ ...p, chatHistory: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Metadata JSON</Label>
              <Textarea className="font-mono min-h-[100px]" value={form.metadataJson} onChange={(e) => setForm((p) => ({ ...p, metadataJson: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Screenshot URLs (one per line)</Label>
              <Textarea
                className="min-h-[90px]"
                value={form.screenshotUrls.join('\n')}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    screenshotUrls: e.target.value
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Source file URLs (one per line)</Label>
              <Textarea
                className="min-h-[90px]"
                value={form.sourceFileUrls.join('\n')}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sourceFileUrls: e.target.value
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">Links only (e.g. Google Drive).</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePoolItem} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === 'pool' && 'Delete task pool item'}
              {pendingDelete?.kind === 'subtask' && 'Delete dev task'}
              {pendingDelete?.kind === 'chat' && 'Delete message'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'pool' && (
                <>
                  Delete <strong>{pendingDelete.name}</strong>? This cannot be undone.
                </>
              )}
              {pendingDelete?.kind === 'subtask' && (
                <>
                  Remove <strong>{pendingDelete.title}</strong>?
                </>
              )}
              {pendingDelete?.kind === 'chat' && <>Remove this chat message?</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executePendingDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LabeledLinksEditor({
  links,
  onChange,
  newRowLabel,
}: {
  links: LabeledLink[];
  onChange: (v: LabeledLink[]) => void;
  newRowLabel: string;
}) {
  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center">
          <Input
            className="max-w-[140px]"
            placeholder="Label"
            value={link.label}
            onChange={(e) => {
              const n = [...links];
              n[i] = { ...n[i], label: e.target.value };
              onChange(n);
            }}
          />
          <Input
            className="flex-1 min-w-[200px]"
            placeholder="https://…"
            value={link.url}
            onChange={(e) => {
              const n = [...links];
              n[i] = { ...n[i], url: e.target.value };
              onChange(n);
            }}
          />
          <Button type="button" size="icon" variant="outline" onClick={() => onChange(links.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...links, { label: newRowLabel, url: '' }])}>
        Add link
      </Button>
    </div>
  );
}

function MultiLinkField({ title, links }: { title: string; links: LabeledLink[] }) {
  return (
    <div className="rounded border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground mb-2">{title}</p>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">N/A</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l, i) => (
            <li key={`${l.url}-${i}`}>
              <span className="text-xs font-medium text-foreground">{l.label}: </span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                {l.url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: string }) {
  return (
    <div className="rounded border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="text-sm font-medium text-foreground mt-1">{value}</p>
    </div>
  );
}

function AdminTaskStatCard({
  title,
  summary,
}: {
  title: string;
  summary: { count: number; realBudget: number; withdrawnBudget: number };
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{summary.count} tasks</p>
      <p className="mt-1 text-xs text-muted-foreground">Real: {summary.realBudget.toFixed(2)}</p>
      <p className="text-xs text-emerald-600">Withdrawn: {summary.withdrawnBudget.toFixed(2)}</p>
    </div>
  );
}

