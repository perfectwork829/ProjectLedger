import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { LabeledLinksEditor } from '@/components/LabeledLinksEditor';
import { LabeledLinksListWithCopy } from '@/components/LabeledLinksListWithCopy';
import { CountrySelect } from '@/components/CountrySelect';
import { canonicalCountryNameOrLegacy } from '@/lib/countries';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { canonicalTimezoneOrLegacy, suggestedTimezoneForCountry } from '@/lib/timezones';
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
  taskUsesAccrualPayments,
  parseMilestones,
  sumMilestoneGross,
  taskPoolContractGross,
  compareTaskPoolItemsWithinPriority,
  computeTaskPoolDragPatches,
  TASK_POOL_ITEM_STATUS_OPTIONS,
  TASK_POOL_SUBTASK_BOARD_STATUSES,
  poolSubtaskBoardLabel,
  taskPoolItemStatusLabel,
  taskPoolFixedMode,
  canEditLastHourlyAccrual,
  type PoolSubtaskStatus,
  TaskPoolItemRecord,
  type TaskPoolItemStatus,
  TaskPoolScreenshot,
  TaskPoolSourceFile,
  toCsv,
} from '@/lib/taskPool';
import {
  calcWithdrawnAmount,
  computeTaskPoolWithdrawnOnSave,
  computeTaskPoolWithdrawnPreview,
  getLastPeriodBounds,
  getPeriodBoundsForDate,
  getWeekBounds,
  isWithinRange,
  parseHourlyHoursFromAccrualNote,
  summarizeTaskPool,
  taskPoolFeesFromNumbers,
  type TaskAutoPaymentSlice,
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
import { ReadmePanel, README_EDITOR_PLACEHOLDER } from '@/components/ReadmePanel';
import { TagChipsInput } from '@/components/TagChipsInput';
import { CopyDescriptionButton } from '@/components/CopyDescriptionButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PoolSubtaskKanban from '@/components/PoolSubtaskKanban';
import PoolSubtaskDetailDialog from '@/components/PoolSubtaskDetailDialog';
import { AlertTriangle, ArrowLeft, ArrowUpDown, Calendar, MessageSquare, Pencil, Plus, Trash2, FolderKanban, Link2, Clock, ListTodo } from 'lucide-react';
import { PRIORITY_BADGE_CLASS, PRIORITY_OPTIONS, PRIORITY_RANK, taskDescriptionPreview } from '@/lib/taskPriority';
import ResolvedScreenshotCarousel from '@/components/ResolvedScreenshotCarousel';
import { ScreenshotsDriveFolderField } from '@/components/ScreenshotsDriveFolderField';
import {
  SCREENSHOTS_DRIVE_FOLDER_META_KEY,
  screenshotsFolderFromMetadata,
  screenshotsToFormFields,
  validateScreenshotsFolderUrl,
} from '@/lib/screenshotDriveFolder';
import {
  countPendingByPool,
  filterAccrualPeriodsForPaymentTracking,
  type TaskPoolAccrualPeriodRow,
} from '@/lib/taskPoolAccrualPeriods';
import {
  fetchAllAccrualPeriods,
  syncAccrualPeriodsForTasks,
} from '@/lib/taskPoolAccrualService';
import { buildPoolStatusTransitionFields } from '@/lib/taskPoolStatusTransitions';
import TaskPaymentDueBadge from '@/components/TaskPaymentDueBadge';
import TaskFinishPaymentDialog from '@/components/TaskFinishPaymentDialog';
import TaskFinishButton from '@/components/TaskFinishButton';
import TaskPromoteConfirmDialog from '@/components/TaskPromoteConfirmDialog';

const MAIN_STACK_OPTIONS = ['angular', 'react', 'react_native', 'vue', 'nextjs', 'nodejs', 'laravel', 'django', 'flutter', 'other'] as const;
const TASK_SOURCE_OPTIONS = ['upwork', 'freelancer', 'job_broker', 'linkedin', 'other_job_site', 'friend', 'discord_job_channel', 'telegram_channel', 'teams', 'facebook', 'github'] as const;

type PendingDel =
  | { kind: 'pool'; id: string; name: string }
  | { kind: 'subtask'; id: string; title: string }
  | { kind: 'chat'; id: string; preview: string };

const emptyForm = {
  name: '',
  description: '',
  readme: '',
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
  credentialsText: '',
  initialDocumentUrl: '',
  sourceStorageType: 'drive',
  sourceStorageUrl: '',
  githubLinks: [] as LabeledLink[],
  sourceStorageLinks: [] as LabeledLink[],
  initialDocLinks: [] as LabeledLink[],
  publishedLinks: [] as LabeledLink[],
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
  screenshotsDriveFolderUrl: '',
  sourceFileUrls: [] as string[],
};

type CredentialRow = { label: string; value: string };
function parseCredentialsFromText(raw: string): CredentialRow[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes('|') ? '|' : ':';
      const idx = line.indexOf(sep);
      if (idx < 0) return { label: 'Credential', value: line };
      return { label: line.slice(0, idx).trim() || 'Credential', value: line.slice(idx + 1).trim() };
    })
    .filter((x) => x.value);
}
function credentialsToText(rows: CredentialRow[]): string {
  return rows.map((r) => `${r.label} | ${r.value}`).join('\n');
}
function credentialsFromMetadata(metadata: Record<string, unknown> | null | undefined): CredentialRow[] {
  const raw = (metadata as { credentials?: unknown } | null)?.credentials;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const row = x as { label?: unknown; value?: unknown };
      return { label: String(row.label || 'Credential'), value: String(row.value || '') };
    })
    .filter((x) => x.value.trim());
}

export default function AdminTaskPool() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterClientId = searchParams.get('client');

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TaskPoolItemRecord[]>([]);
  const [screenshots, setScreenshots] = useState<TaskPoolScreenshot[]>([]);
  const [sourceFiles, setSourceFiles] = useState<TaskPoolSourceFile[]>([]);
  const [subtasks, setSubtasks] = useState<PoolSubtask[]>([]);
  const [messages, setMessages] = useState<PoolChatMessage[]>([]);
  const [linkedPayments, setLinkedPayments] = useState<
    Array<{
      id: string;
      entry_type: 'incoming' | 'outgoing';
      category: string;
      amount: number;
      currency: string;
      occurred_at: string;
      note: string | null;
      source_kind: string;
    }>
  >([]);
  const [linkedPaymentsCount, setLinkedPaymentsCount] = useState<number>(0);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelRef[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [listFilter, setListFilter] = useState<TaskPoolListFilter>('working');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');
  const [prioritySortOrder, setPrioritySortOrder] = useState<'high_first' | 'low_first'>('high_first');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [newSubtaskColumn, setNewSubtaskColumn] = useState<PoolSubtaskStatus>('todo');
  const [newChat, setNewChat] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatText, setEditingChatText] = useState('');
  const [chatSaving, setChatSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDel | null>(null);
  const [subtaskDetailId, setSubtaskDetailId] = useState<string | null>(null);
  const [accrualDialog, setAccrualDialog] = useState<null | {
    row: TaskPoolItemRecord;
    kind: 'hourly-edit';
    hourlyPaymentEntryId?: string;
  }>(null);
  const [accrualHours, setAccrualHours] = useState('');
  const [editTaskAutoPayments, setEditTaskAutoPayments] = useState<TaskAutoPaymentSlice[]>([]);
  const [accrualPeriods, setAccrualPeriods] = useState<TaskPoolAccrualPeriodRow[]>([]);
  const [finishDialog, setFinishDialog] = useState<{ task: TaskPoolItemRecord; newStatus: string } | null>(null);
  const [promoteConfirm, setPromoteConfirm] = useState<{ poolId: string; taskName: string } | null>(null);

  const formFees = useMemo(
    () =>
      taskPoolFeesFromNumbers({
        upwork_connection_fee: form.upworkConnectionFee ? Number(form.upworkConnectionFee) : 0,
        convert_fee: form.convertFee ? Number(form.convertFee) : 0,
        transfer_fee: form.transferFee ? Number(form.transferFee) : 0,
        upwork_fee: form.upworkFee ? Number(form.upworkFee) : 0,
        withdraw_fee: form.withdrawFee ? Number(form.withdrawFee) : 0,
      }),
    [form.upworkConnectionFee, form.convertFee, form.transferFee, form.upworkFee, form.withdrawFee],
  );

  const withdrawnPreview = useMemo(() => {
    const existing = editingId ? items.find((i) => i.id === editingId) : undefined;
    return computeTaskPoolWithdrawnPreview(
      {
        budgetType: form.budgetType,
        fixedBudgetMode: form.fixedBudgetMode,
        budgetAmount: form.budgetAmount,
        milestones: form.milestones,
        hourlyRate: form.hourlyRate,
      },
      formFees,
      existing,
      editTaskAutoPayments,
    );
  }, [form, editingId, items, formFees, editTaskAutoPayments]);

  const paymentTrackingPeriods = useMemo(
    () => filterAccrualPeriodsForPaymentTracking(accrualPeriods, items),
    [accrualPeriods, items],
  );
  const pendingCountByPool = useMemo(() => countPendingByPool(paymentTrackingPeriods), [paymentTrackingPeriods]);

  const refreshAccrualPeriods = async (taskList: TaskPoolItemRecord[], accountList: typeof accounts) => {
    try {
      await syncAccrualPeriodsForTasks(
        taskList,
        accountList.map((a) => ({ id: a.id, badge_status: a.badge_status ?? null })),
      );
      const periods = await fetchAllAccrualPeriods();
      setAccrualPeriods(periods);
    } catch (e) {
      console.error('Accrual period sync failed', e);
    }
  };

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

    const loadedItems = (itemsRes.data || []) as TaskPoolItemRecord[];
    setItems(loadedItems);
    setScreenshots((shotsRes.data || []) as TaskPoolScreenshot[]);
    setSourceFiles((filesRes.data || []) as TaskPoolSourceFile[]);
    setSubtasks((tasksRes.data || []) as PoolSubtask[]);
    setMessages((messagesRes.data || []) as PoolChatMessage[]);
    setClients(deps.clients);
    setAccounts(deps.accounts);
    setPersonnel(deps.personnel);
    setLoading(false);
    void refreshAccrualPeriods(loadedItems, deps.accounts);
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
    const loadedItems = (itemsRes.data || []) as TaskPoolItemRecord[];
    setItems(loadedItems);
    setScreenshots((shotsRes.data || []) as TaskPoolScreenshot[]);
    setSourceFiles((filesRes.data || []) as TaskPoolSourceFile[]);
    setSubtasks((tasksRes.data || []) as PoolSubtask[]);
    setMessages((messagesRes.data || []) as PoolChatMessage[]);
    setClients(deps.clients);
    setAccounts(deps.accounts);
    setPersonnel(deps.personnel);
    void refreshAccrualPeriods(loadedItems, deps.accounts);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (!items.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [items, selectedId]);

  useEffect(() => {
    const tid = searchParams.get('task');
    if (!tid || items.length === 0) return;
    if (items.some((p) => p.id === tid)) setSelectedId(tid);
  }, [searchParams, items]);

  useEffect(() => {
    setSubtaskDetailId(null);
  }, [selectedId]);

  useEffect(() => {
    setEditingChatId(null);
    setEditingChatText('');
    setChatSaving(false);
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedId) {
        setLinkedPayments([]);
        setLinkedPaymentsCount(0);
        return;
      }
      const [countRes, rowsRes] = await Promise.all([
        supabase
          .from('payment_entries')
          .select('id', { count: 'exact', head: true })
          .eq('pool_item_id', selectedId),
        supabase
          .from('payment_entries')
          .select('id,entry_type,category,amount,currency,occurred_at,note,source_kind')
          .eq('pool_item_id', selectedId)
          .order('occurred_at', { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setLinkedPaymentsCount(countRes.count || 0);
      setLinkedPayments((rowsRes.data || []) as typeof linkedPayments);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const itemsForClientFilter = useMemo(() => {
    if (!filterClientId) return items;
    return items.filter((p) => p.client_id === filterClientId);
  }, [items, filterClientId]);

  const searchFilteredItems = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return itemsForClientFilter;
    return itemsForClientFilter.filter((p) => {
      const client = clients.find((c) => c.id === p.client_id);
      const account = accounts.find((a) => a.id === p.account_id);
      const blob = [
        p.name,
        p.description,
        p.readme,
        p.task_source,
        p.main_stack,
        p.skillset_csv,
        p.tags_csv,
        p.status,
        p.priority,
        p.client_name_override,
        client ? `${client.first_name} ${client.last_name}` : '',
        account ? `${account.platform} ${account.username}` : '',
        ...parseLabeledLinks(p.published_links, null, 'Link').flatMap((l) => [l.label, l.url]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [itemsForClientFilter, searchInput, clients, accounts]);

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
  const sortedItems = useMemo(
    () =>
      [...filteredItems].sort((a, b) => {
        const pa = PRIORITY_RANK[a.priority] ?? 999;
        const pb = PRIORITY_RANK[b.priority] ?? 999;
        if (pa !== pb) return prioritySortOrder === 'high_first' ? pa - pb : pb - pa;
        return compareTaskPoolItemsWithinPriority(a, b);
      }),
    [filteredItems, prioritySortOrder],
  );

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

  const updatePoolItemQuick = async (id: string, patch: Partial<Pick<TaskPoolItemRecord, 'priority' | 'status' | 'priority_order'>>) => {
    const row = items.find((x) => x.id === id);
    if (patch.status === 'completed' && row && row.status !== 'completed') {
      setFinishDialog({ task: row, newStatus: 'completed' });
      return;
    }
    let priority_order = patch.priority_order;
    if (patch.priority !== undefined && priority_order === undefined && row && patch.priority !== row.priority) {
      const maxO = items
        .filter((x) => x.id !== id && x.priority === patch.priority)
        .reduce((m, x) => Math.max(m, Number(x.priority_order ?? 0)), -1);
      priority_order = maxO + 1;
    }
    const statusFields =
      patch.status !== undefined && row
        ? buildPoolStatusTransitionFields(row, patch.status as TaskPoolItemStatus)
        : { status: patch.status };
    const res = await supabase
      .from('task_pool_items')
      .update({
        ...(patch.status !== undefined ? statusFields : patch),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(priority_order !== undefined ? { priority_order } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (res.error || !res.data) {
      toast({ title: 'Update failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    const updated = res.data as TaskPoolItemRecord;
    setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
    if (patch.status !== undefined) {
      void refreshAccrualPeriods(
        items.map((x) => (x.id === id ? updated : x)),
        accounts,
      );
    }
  };

  const applyDraggedPriority = async (target: TaskPoolItemRecord) => {
    if (!draggingTaskId || draggingTaskId === target.id) return;
    const patches = computeTaskPoolDragPatches(items, draggingTaskId, target.id);
    if (!patches?.length) return;
    const ts = new Date().toISOString();
    const results = await Promise.all(
      patches.map((p) =>
        supabase
          .from('task_pool_items')
          .update({ priority: p.priority, priority_order: p.priority_order, updated_at: ts })
          .eq('id', p.id)
          .select('*')
          .maybeSingle(),
      ),
    );
    const bad = results.find((r) => r.error);
    if (bad?.error) {
      toast({ title: 'Reorder failed', description: bad.error.message, variant: 'destructive' });
      setDraggingTaskId(null);
      return;
    }
    const byId = new Map<string, TaskPoolItemRecord>();
    for (const r of results) {
      if (r.data) byId.set(r.data.id, r.data as TaskPoolItemRecord);
    }
    setItems((prev) => prev.map((x) => byId.get(x.id) ?? x));
    setDraggingTaskId(null);
  };

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const t of sortedItems) counts[t.priority] = (counts[t.priority] || 0) + 1;
    return counts;
  }, [sortedItems]);

  const openCreate = () => {
    setEditingId(null);
    setEditTaskAutoPayments([]);
    setForm({
      ...emptyForm,
      sourceStorageLinks: [{ label: 'Storage', url: '' }],
    });
    setDialogOpen(true);
  };

  const loadTaskAutoPaymentsForEdit = async (poolId: string) => {
    const { data } = await supabase
      .from('payment_entries')
      .select('id, amount, note, category')
      .eq('pool_item_id', poolId)
      .eq('entry_type', 'incoming')
      .eq('source_kind', 'task_auto')
      .order('occurred_at', { ascending: true });
    setEditTaskAutoPayments(
      (data || []).map((p) => ({
        id: p.id,
        amount: Number(p.amount ?? 0),
        note: p.note,
        category: String(p.category || ''),
      })),
    );
  };

  const openEdit = (row: TaskPoolItemRecord) => {
    setEditingId(row.id);
    void loadTaskAutoPaymentsForEdit(row.id);
    const gh = parseLabeledLinks(row.github_links, row.github_url, 'GitHub');
    const st = parseLabeledLinks(row.source_storage_urls, row.source_storage_url, 'Storage');
    const doc = parseLabeledLinks(row.initial_document_urls, row.initial_document_url, 'Document');
    const published = parseLabeledLinks(row.published_links, null, 'Link');
    setForm({
      name: row.name,
      description: row.description || '',
      readme: row.readme || '',
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
      credentialsText: credentialsToText(credentialsFromMetadata(row.metadata_json)),
      initialDocumentUrl: row.initial_document_url || '',
      sourceStorageType: row.source_storage_type,
      sourceStorageUrl: row.source_storage_url || '',
      githubLinks: gh,
      sourceStorageLinks: st,
      initialDocLinks: doc,
      publishedLinks: published,
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
      ...screenshotsToFormFields(
        screenshots.filter((s) => s.pool_item_id === row.id),
        row.metadata_json,
      ),
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
    const published = serializeLabeledLinks(form.publishedLinks ?? []);
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

    let hourlyPaymentSlices: { id: string; amount: number; note: string | null }[] | undefined;
    if (form.budgetType === 'hourly' && editingId) {
      const { data: payRows } = await supabase
        .from('payment_entries')
        .select('id, amount, note, category')
        .eq('pool_item_id', editingId)
        .eq('entry_type', 'incoming')
        .eq('source_kind', 'task_auto');
      hourlyPaymentSlices = (payRows || [])
        .filter((p) => String(p.category || '').includes('hourly'))
        .map((p) => ({ id: p.id, amount: Number(p.amount ?? 0), note: p.note }));
    }

    let withdrawn_amount = computeTaskPoolWithdrawnOnSave(
      {
        budgetType: form.budgetType,
        fixedBudgetMode: form.fixedBudgetMode,
        budgetAmount: form.budgetAmount,
        milestones: form.milestones,
        hourlyRate: form.hourlyRate,
      },
      {
        upworkConnectionFee,
        convertFee,
        transferFee,
        upworkFee,
        withdrawFee,
      },
      existing ?? null,
      milestoneRowsForSave,
      hourlyPaymentSlices,
    );

    if (!existing && withdrawn_amount === 0) {
      /* new row — keep 0 */
    } else if (
      isAccrualForm &&
      existing &&
      !taskUsesAccrualPayments(existing) &&
      (form.budgetType === 'hourly' || form.fixedBudgetMode === 'recurring')
    ) {
      withdrawn_amount = 0;
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

    const credentialRows = parseCredentialsFromText(form.credentialsText);
    const normalizedMetadata = { ...metadata } as Record<string, unknown>;
    if (credentialRows.length > 0) normalizedMetadata.credentials = credentialRows;
    else delete normalizedMetadata.credentials;

    try {
      const folderUrl = validateScreenshotsFolderUrl(form.screenshotsDriveFolderUrl);
      if (folderUrl) normalizedMetadata[SCREENSHOTS_DRIVE_FOLDER_META_KEY] = folderUrl;
      else delete normalizedMetadata[SCREENSHOTS_DRIVE_FOLDER_META_KEY];
    } catch (e) {
      toast({
        title: 'Screenshots folder invalid',
        description: e instanceof Error ? e.message : 'Invalid folder link',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const existing = editingId ? items.find((i) => i.id === editingId) ?? null : null;
    let statusFields: Pick<TaskPoolItemRecord, 'status' | 'paused_at' | 'metadata_json'>;
    if (existing && form.status !== existing.status) {
      statusFields = buildPoolStatusTransitionFields(
        { ...existing, metadata_json: normalizedMetadata },
        form.status as TaskPoolItemStatus,
      );
    } else if (!existing && form.status === 'paused') {
      statusFields = {
        status: 'paused',
        paused_at: new Date().toISOString(),
        metadata_json: normalizedMetadata,
      };
    } else {
      statusFields = {
        status: form.status as TaskPoolItemStatus,
        paused_at: existing?.paused_at ?? null,
        metadata_json: normalizedMetadata,
      };
    }

    const payload = {
      user_id: user?.id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      readme: form.readme.trim() || null,
      task_source: form.taskSource.trim() || null,
      main_stack: form.mainStack || null,
      skillset_csv: toCsv(form.skillsetTags) || null,
      tags_csv: toCsv(form.tagsTags) || null,
      ...statusFields,
      priority: form.priority,
      client_id: form.clientId || null,
      client_name_override: form.clientNameOverride.trim() || null,
      client_country: form.clientCountry.trim() || null,
      client_timezone: form.clientTimezone.trim() || null,
      account_id: form.accountId || null,
      chat_history: form.chatHistory.trim() || null,
      metadata_json: statusFields.metadata_json,
      initial_document_url: docs[0]?.url ?? null,
      source_storage_type: form.sourceStorageType,
      source_storage_url: storageLinks[0]?.url ?? null,
      github_links: gh,
      source_storage_urls: storageLinks,
      initial_document_urls: docs,
      published_links: published,
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

    if (form.budgetType === 'hourly' && editingId && hourlyPaymentSlices && hourlyPaymentSlices.length > 0) {
      const rate = form.hourlyRate ? Number(form.hourlyRate) : Number(existing?.hourly_rate ?? 0);
      for (const slice of hourlyPaymentSlices) {
        const hours = parseHourlyHoursFromAccrualNote(slice.note);
        if (hours == null || hours <= 0) continue;
        const gross = hours * rate;
        const net = calcWithdrawnAmount({
          budgetAmount: gross,
          upworkConnectionFee,
          convertFee,
          transferFee,
          upworkFee,
          withdrawFee,
        });
        if (Math.abs(net - slice.amount) > 0.0001) {
          await supabase
            .from('payment_entries')
            .update({ amount: net, updated_at: new Date().toISOString() })
            .eq('id', slice.id);
        }
      }
    }

    setSaving(false);
    setDialogOpen(false);
    toast({ title: editingId ? 'Task updated' : 'Task created' });
    await refreshTaskPoolDataQuiet();
    const newlyCompleted =
      form.status === 'completed' && (existing?.status !== 'completed' || !editingId);
    if (newlyCompleted && !existing?.promoted_project_id) {
      setPromoteConfirm({ poolId, taskName: form.name.trim() });
    }
  };

  const openEditLastHourlyAccrual = async (row: TaskPoolItemRecord) => {
    const hoursDefault =
      row.hourly_last_billable_hours != null
        ? String(row.hourly_last_billable_hours)
        : String(row.weekly_hours_cap ?? 40);
    const { data: payRow } = await supabase
      .from('payment_entries')
      .select('id, note')
      .eq('pool_item_id', row.id)
      .eq('entry_type', 'incoming')
      .eq('source_kind', 'task_auto')
      .ilike('category', '%hourly%')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const parsed = payRow?.note ? parseHourlyHoursFromAccrualNote(payRow.note) : null;
    setAccrualHours(parsed != null ? String(parsed) : hoursDefault);
    setAccrualDialog({
      row,
      kind: 'hourly-edit',
      hourlyPaymentEntryId: payRow?.id,
    });
  };

  const submitAccrualConfirm = async () => {
    if (!accrualDialog || accrualDialog.kind !== 'hourly-edit' || !user?.id) return;
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

    if (accrualDialog.kind === 'hourly-edit') {
      const entryId = accrualDialog.hourlyPaymentEntryId;
      if (!entryId) {
        toast({ title: 'No hourly payment to edit', description: 'Could not find the linked payment entry.', variant: 'destructive' });
        return;
      }
      const cap = Number(row.weekly_hours_cap ?? 40);
      const hours = Math.min(Math.max(Number(accrualHours || 0), 0), cap);
      const gross = hours * Number(row.hourly_rate ?? 0);
      net = calcWithdrawnAmount({ budgetAmount: gross, ...fees });
      const weekMon = row.hourly_last_ack_week_monday;
      const weekLabel = weekMon ? addDaysToJstYmd(weekMon, 6) : formatJstYmd(new Date());
      noteExtra = `Hourly (JST Mon–Sun) · ${hours}h × ${row.hourly_rate} · week ending ${weekLabel}`;

      if (net <= 0) {
        toast({ title: 'Net accrual is zero', description: 'Check hours and fees.', variant: 'destructive' });
        return;
      }

      const { data: payRow, error: payFetchErr } = await supabase.from('payment_entries').select('amount').eq('id', entryId).single();
      if (payFetchErr) {
        toast({ title: 'Could not load payment', description: payFetchErr.message, variant: 'destructive' });
        return;
      }
      const oldNet = Number(payRow?.amount ?? 0);
      const newWithdrawn = Number(row.withdrawn_amount ?? 0) - oldNet + net;

      const payUpd = await supabase
        .from('payment_entries')
        .update({
          amount: net,
          note: `${row.name} — ${noteExtra}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId);
      if (payUpd.error) {
        toast({ title: 'Payment update failed', description: payUpd.error.message, variant: 'destructive' });
        return;
      }

      const upd = await supabase
        .from('task_pool_items')
        .update({
          withdrawn_amount: newWithdrawn,
          hourly_last_billable_hours: hours,
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
      toast({ title: 'Hourly payment updated', description: `Withdrawn is now ${row.currency} ${newWithdrawn.toFixed(2)}.` });
      setItems((prev) => prev.map((x) => (x.id === row.id ? (upd.data as TaskPoolItemRecord) : x)));
    }
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
    if (newStatus === 'completed' && selected.status !== 'completed') {
      setFinishDialog({ task: selected, newStatus });
      return;
    }
    await applyDetailStatus(selected.id, newStatus);
  };

  const requestFinishTask = (task: TaskPoolItemRecord) => {
    if (task.status === 'completed') return;
    setFinishDialog({ task, newStatus: 'completed' });
  };

  const applyDetailStatus = async (taskId: string, newStatus: string, finishedAt?: string) => {
    const row = items.find((x) => x.id === taskId);
    if (!row) return;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (finishedAt) {
      patch.status = newStatus;
      patch.finished_at = finishedAt;
    } else {
      Object.assign(patch, buildPoolStatusTransitionFields(row, newStatus as TaskPoolItemStatus));
    }
    const res = await supabase.from('task_pool_items').update(patch).eq('id', taskId).select('*').single();
    if (res.error || !res.data) {
      toast({ title: 'Update failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    const updated = res.data as TaskPoolItemRecord;
    setItems((prev) => prev.map((x) => (x.id === taskId ? updated : x)));
    void refreshAccrualPeriods(
      items.map((x) => (x.id === taskId ? updated : x)),
      accounts,
    );
  };

  const confirmFinishTask = async (moveToProject: boolean) => {
    if (!finishDialog) return;
    const { task } = finishDialog;
    const finishedAt = new Date().toISOString();
    await applyDetailStatus(task.id, finishDialog.newStatus, finishedAt);
    setFinishDialog(null);
    if (moveToProject && !task.promoted_project_id) {
      await promoteIfNeeded(task.id, 'completed');
    }
    toast({ title: 'Task completed', description: 'Confirm any due payments on the Payments page.' });
  };

  const confirmPromoteToProject = async () => {
    if (!promoteConfirm) return;
    const { poolId } = promoteConfirm;
    setPromoteConfirm(null);
    await promoteIfNeeded(poolId, 'completed');
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

  const beginChatEdit = (msg: PoolChatMessage) => {
    setEditingChatId(msg.id);
    setEditingChatText(msg.message);
  };

  const cancelChatEdit = () => {
    setEditingChatId(null);
    setEditingChatText('');
    setChatSaving(false);
  };

  const saveChatEdit = async () => {
    if (!editingChatId) return;
    const message = editingChatText.trim();
    if (!message) {
      toast({ title: 'Message is required', variant: 'destructive' });
      return;
    }
    setChatSaving(true);
    const res = await supabase.from('task_pool_chat_messages').update({ message }).eq('id', editingChatId).select('*').maybeSingle();
    setChatSaving(false);
    if (res.error) {
      toast({ title: 'Edit failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    if (res.data) {
      const updated = res.data as PoolChatMessage;
      setMessages((prev) => prev.map((m) => (m.id === editingChatId ? updated : m)));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === editingChatId ? { ...m, message } : m)));
    }
    setEditingChatId(null);
    setEditingChatText('');
    toast({ title: 'Message updated' });
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
      {filterClientId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Showing task pool leads linked to this client only
            {(() => {
              const c = clients.find((x) => x.id === filterClientId);
              return c ? (
                <span className="font-medium text-foreground">
                  {' '}
                  · {c.first_name} {c.last_name}
                  {c.company_name ? ` (${c.company_name})` : ''}
                </span>
              ) : null;
            })()}
            .
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
            Clear filters
          </Button>
        </div>
      ) : null}
      {!selectedId ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Task pool</h2>
              <p className="text-sm text-muted-foreground">
                Click a lead to open details and the full-width <strong>Task board</strong>. When you mark a lead{' '}
                <strong>Completed</strong>, you can choose whether to move it to Projects.
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {sortedItems.length} tasks, sorted by priority ({prioritySortOrder === 'high_first' ? 'high to low' : 'low to high'}). Within the
              same priority, drag a task onto another to place it <span className="font-medium text-foreground/80">before</span> that task.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => setPrioritySortOrder((v) => (v === 'high_first' ? 'low_first' : 'high_first'))}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Toggle
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
              <Badge key={p} variant="outline" className={`capitalize ${PRIORITY_BADGE_CLASS[p] || ''}`}>
                {p}: {priorityCounts[p] || 0}
              </Badge>
            ))}
          </div>

          {sortedItems.length === 0 ? (
            <div className="rounded-lg border bg-card py-12 text-center">
              <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching tasks' : 'No tasks yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput.trim() ? 'Try different keywords or clear the search.' : 'Create a task with New.'}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedItems.map((row, idx) => (
                <Card
                  key={row.id}
                  className="overflow-hidden transition-all hover:border-primary/40 hover:shadow-md"
                  style={{ borderLeft: `4px solid ${row.priority === 'critical' ? '#dc2626' : row.priority === 'high' ? '#ea580c' : row.priority === 'medium' ? '#2563eb' : '#64748b'}` }}
                  draggable
                  onDragStart={(e) => {
                    setDraggingTaskId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!draggingTaskId || draggingTaskId === row.id) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void applyDraggedPriority(row);
                    setDraggingTaskId(null);
                  }}
                  onDragEnd={() => setDraggingTaskId(null)}
                >
                  <CardContent className="cursor-pointer p-4" onClick={() => setSelectedId(row.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground line-clamp-2">#{idx + 1} {row.name}</p>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary">{taskPoolItemStatusLabel(row.status)}</Badge>
                        <TaskPaymentDueBadge count={pendingCountByPool[row.id] ?? 0} />
                      </div>
                    </div>
                    <Badge variant="outline" className={`mt-2 text-[10px] capitalize ${PRIORITY_BADGE_CLASS[row.priority] || ''}`}>
                      {row.priority}
                    </Badge>
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
                      {taskDescriptionPreview(row.description, 20)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                      <TaskFinishButton task={row} onFinish={requestFinishTask} />
                    </div>
                  </CardContent>
                  {row.client_id ? (
                    <div className="border-t border-border bg-muted/25 px-4 py-1.5">
                      <Link
                        to={`/admin/clients?client=${row.client_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open linked client in Clients
                      </Link>
                    </div>
                  ) : null}
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
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => setPrioritySortOrder((v) => (v === 'high_first' ? 'low_first' : 'high_first'))}
                        title={`Priority sort: ${prioritySortOrder === 'high_first' ? 'high to low' : 'low to high'}`}
                      >
                        Priority
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Real</th>
                    <th className="px-3 py-2">Withdrawn</th>
                    <th className="px-3 py-2 w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t hover:bg-muted/30"
                      onClick={() => setSelectedId(row.id)}
                      draggable
                      onDragStart={(e) => {
                        setDraggingTaskId(row.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        if (!draggingTaskId || draggingTaskId === row.id) return;
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        void applyDraggedPriority(row);
                        setDraggingTaskId(null);
                      }}
                      onDragEnd={() => setDraggingTaskId(null)}
                    >
                      <td className="px-3 py-2 font-medium">#{idx + 1} {row.name}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.status}
                          onValueChange={(v) => void updatePoolItemQuick(row.id, { status: v as TaskPoolItemRecord['status'] })}
                        >
                          <SelectTrigger className="h-8 w-[150px]" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent onClick={(e) => e.stopPropagation()}>
                            {TASK_POOL_ITEM_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {taskPoolItemStatusLabel(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.priority}
                          onValueChange={(v) => void updatePoolItemQuick(row.id, { priority: v as TaskPoolItemRecord['priority'] })}
                        >
                          <SelectTrigger className="h-8 w-[130px]" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent onClick={(e) => e.stopPropagation()}>
                            {PRIORITY_OPTIONS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 capitalize">{(row.task_source || '-').replace('_', ' ')}</td>
                      <td className="px-3 py-2">{row.currency} {taskPoolContractGross(row).toFixed(2)}</td>
                      <td className="px-3 py-2 text-emerald-600">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <TaskFinishButton task={row} onFinish={requestFinishTask} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'line' ? (
            <div className="rounded-lg border bg-card">
              {sortedItems.map((row, idx) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/30"
                  onClick={() => setSelectedId(row.id)}
                  draggable
                  onDragStart={(e) => {
                    setDraggingTaskId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!draggingTaskId || draggingTaskId === row.id) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void applyDraggedPriority(row);
                    setDraggingTaskId(null);
                  }}
                  onDragEnd={() => setDraggingTaskId(null)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">#{idx + 1} {row.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xs text-muted-foreground capitalize">{(row.task_source || 'n/a').replace('_', ' ')}</p>
                      <Badge variant="outline" className={`text-[10px] capitalize ${PRIORITY_BADGE_CLASS[row.priority] || ''}`}>{row.priority}</Badge>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={row.status}
                        onValueChange={(v) => void updatePoolItemQuick(row.id, { status: v as TaskPoolItemRecord['status'] })}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
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
                      <Select
                        value={row.priority}
                        onValueChange={(v) => void updatePoolItemQuick(row.id, { priority: v as TaskPoolItemRecord['priority'] })}
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TaskFinishButton task={row} onFinish={requestFinishTask} compact />
                    </div>
                    <p className="text-xs text-emerald-600">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedItems.map((row, idx) => (
                <Card
                  key={row.id}
                  className="cursor-pointer hover:border-primary/40"
                  onClick={() => setSelectedId(row.id)}
                  draggable
                  onDragStart={(e) => {
                    setDraggingTaskId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!draggingTaskId || draggingTaskId === row.id) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void applyDraggedPriority(row);
                    setDraggingTaskId(null);
                  }}
                  onDragEnd={() => setDraggingTaskId(null)}
                >
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">#{idx + 1} {row.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] capitalize ${PRIORITY_BADGE_CLASS[row.priority] || ''}`}>{row.priority}</Badge>
                        <p className="text-xs text-muted-foreground">
                        {taskPoolItemStatusLabel(row.status)} · {row.currency} {taskPoolContractGross(row).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <TaskFinishButton task={row} onFinish={requestFinishTask} compact />
                      <Badge variant="outline">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</Badge>
                    </div>
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
                    <TaskFinishButton task={selected} onFinish={requestFinishTask} />
                    {(pendingCountByPool[selected.id] ?? 0) > 0 ? (
                      <Button size="sm" variant="secondary" className="gap-1" asChild>
                        <Link to={`/admin/payments?task=${selected.id}`}>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Confirm payments ({pendingCountByPool[selected.id]})
                        </Link>
                      </Button>
                    ) : null}
                    {canEditLastHourlyAccrual(selected) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => void openEditLastHourlyAccrual(selected)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit last week payment
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
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="readme">README</TabsTrigger>
                    <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                    <TabsTrigger value="files">Source files</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="tasks">Task board</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCard
                        icon={FolderKanban}
                        title="Client"
                        value={poolClientLabel(selected)}
                        action={
                          selected.client_id ? (
                            <Link
                              to={`/admin/clients?client=${selected.client_id}`}
                              className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
                            >
                              Open in Clients
                            </Link>
                          ) : undefined
                        }
                      />
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
                    {Number(selected.withdrawn_amount ?? 0) > 0 && linkedPaymentsCount === 0 ? (
                      <Alert className="border-amber-500/40 bg-amber-500/5">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle>Data check</AlertTitle>
                        <AlertDescription>
                          This task has withdrawn &gt; 0, but there are no linked payment entries yet. If you confirmed accruals before, re-open “Confirm
                          accrual” to create the incoming rows.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">Linked payments</p>
                        <Link to={`/admin/payments?task=${selected.id}`} className="text-sm text-primary hover:underline">
                          Open Payments
                        </Link>
                      </div>
                      {linkedPayments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No linked payment entries.</p>
                      ) : (
                        <ul className="space-y-2">
                          {linkedPayments.map((p) => (
                            <li key={p.id} className="rounded border bg-muted/20 p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{p.category}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(p.occurred_at).toLocaleString()}
                                    {p.note ? ` · ${p.note}` : ''}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <Badge variant={p.entry_type === 'incoming' ? 'secondary' : 'outline'} className="capitalize">
                                    {p.entry_type}
                                  </Badge>
                                  <p className="text-sm font-medium">
                                    {p.currency} {Number(p.amount ?? 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {linkedPaymentsCount > linkedPayments.length ? (
                        <p className="text-xs text-muted-foreground">
                          Showing latest {linkedPayments.length} of {linkedPaymentsCount}.
                        </p>
                      ) : null}
                    </div>
                    {taskPoolFixedMode(selected) === 'milestone' ? (
                      <div className="rounded-lg border p-3 space-y-2 md:col-span-2">
                        <p className="text-sm font-medium">Milestones</p>
                        {parseMilestones(selected.milestones_json).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No milestones defined.</p>
                        ) : (
                          <>
                            {(() => {
                              const ms = parseMilestones(selected.milestones_json);
                              const paid = ms.filter((m) => !!m.confirmed_at);
                              const pending = ms.filter((m) => !m.confirmed_at);
                              const paidGross = paid.reduce((s, m) => s + Number(m.amount || 0), 0);
                              const pendingGross = pending.reduce((s, m) => s + Number(m.amount || 0), 0);
                              const paidNet = paid.reduce(
                                (s, m) =>
                                  s +
                                  calcWithdrawnAmount({
                                    budgetAmount: Number(m.amount || 0),
                                    upworkConnectionFee: Number(selected.upwork_connection_fee ?? 0),
                                    convertFee: Number(selected.convert_fee ?? 0),
                                    transferFee: Number(selected.transfer_fee ?? 0),
                                    upworkFee: Number(selected.upwork_fee ?? 0),
                                    withdrawFee: Number(selected.withdraw_fee ?? 0),
                                  }),
                                0,
                              );
                              const contractNetMax = ms.reduce(
                                (s, m) =>
                                  s +
                                  calcWithdrawnAmount({
                                    budgetAmount: Number(m.amount || 0),
                                    upworkConnectionFee: Number(selected.upwork_connection_fee ?? 0),
                                    convertFee: Number(selected.convert_fee ?? 0),
                                    transferFee: Number(selected.transfer_fee ?? 0),
                                    upworkFee: Number(selected.upwork_fee ?? 0),
                                    withdrawFee: Number(selected.withdraw_fee ?? 0),
                                  }),
                                0,
                              );
                              return (
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div className="rounded border bg-muted/20 p-2">
                                    <p className="text-[11px] text-muted-foreground">Paid</p>
                                    <p className="text-sm font-medium">
                                      {selected.currency} {paidGross.toFixed(2)} gross
                                    </p>
                                    <p className="text-[11px] text-emerald-700">
                                      {paidNet.toFixed(2)} net → withdrawn (by milestones)
                                    </p>
                                  </div>
                                  <div className="rounded border bg-muted/20 p-2">
                                    <p className="text-[11px] text-muted-foreground">Pending</p>
                                    <p className="text-sm font-medium">
                                      {selected.currency} {pendingGross.toFixed(2)} gross
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">Awaiting confirmation</p>
                                  </div>
                                  <div className="rounded border bg-muted/20 p-2">
                                    <p className="text-[11px] text-muted-foreground">Safety cap</p>
                                    <p className="text-sm font-medium">
                                      Max net: {selected.currency} {contractNetMax.toFixed(2)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Current withdrawn: {selected.currency} {Number(selected.withdrawn_amount ?? 0).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
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
                                  {m.confirmed_at ? (
                                    <span className="ml-2 text-[11px] text-muted-foreground">
                                      {new Date(m.confirmed_at).toLocaleString()}
                                    </span>
                                  ) : null}
                                </div>
                                {!m.confirmed_at && Number(m.amount) > 0 ? (
                                  <Button type="button" size="sm" variant="outline" asChild>
                                    <Link to={`/admin/payments?task=${selected.id}`}>Confirm on Payments</Link>
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          </>
                        )}
                        {(() => {
                          const confirmed = parseMilestones(selected.milestones_json).filter((m) => !!m.confirmed_at);
                          if (confirmed.length === 0) return null;
                          return (
                            <div className="pt-1">
                              <p className="text-xs font-medium text-foreground">Milestone history</p>
                              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                                {confirmed
                                  .slice()
                                  .sort((a, b) => new Date(String(b.confirmed_at)).getTime() - new Date(String(a.confirmed_at)).getTime())
                                  .map((m) => (
                                    <li key={`hist-${m.id}`} className="flex flex-wrap gap-2">
                                      <span className="text-foreground">{m.title}</span>
                                      <span>
                                        {selected.currency} {Number(m.amount).toFixed(2)}
                                      </span>
                                      <span>·</span>
                                      <span>{m.confirmed_at ? new Date(m.confirmed_at).toLocaleString() : ''}</span>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          );
                        })()}
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
                      <LabeledLinksListWithCopy title="Source storage" links={parseLabeledLinks(selected.source_storage_urls, selected.source_storage_url, 'Storage')} />
                      <LabeledLinksListWithCopy title="GitHub" links={parseLabeledLinks(selected.github_links, selected.github_url, 'GitHub')} />
                      <LabeledLinksListWithCopy title="Initial documents" links={parseLabeledLinks(selected.initial_document_urls, selected.initial_document_url, 'Document')} />
                      <LabeledLinksListWithCopy title="Published / store links" links={parseLabeledLinks(selected.published_links, null, 'Link')} emptyHint="No published links yet — edit this pool item and use the highlighted block under GitHub." />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Credentials</p>
                      {credentialsFromMetadata(selected.metadata_json).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No credentials saved.</p>
                      ) : (
                        <ul className="space-y-2">
                          {credentialsFromMetadata(selected.metadata_json).map((c, i) => (
                            <li key={`${c.label}-${i}`} className="rounded border bg-muted/20 p-2">
                              <p className="text-xs text-muted-foreground">{c.label}</p>
                              <p className="text-sm break-all whitespace-pre-wrap">{c.value}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Metadata</p>
                      <pre className="rounded border bg-muted/40 p-3 text-xs overflow-auto">
                        {JSON.stringify(selected.metadata_json || {}, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="readme">
                    <ReadmePanel readme={selected.readme} className="border-0 p-0" />
                  </TabsContent>

                  <TabsContent value="screenshots" className="space-y-4">
                    <ResolvedScreenshotCarousel
                      rows={selectedScreenshots}
                      folderUrl={screenshotsFolderFromMetadata(selected.metadata_json)}
                      emptyMessage="No screenshots. Edit this task and add a Google Drive screenshots folder link."
                    />
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
                            {editingChatId === m.id ? (
                              <div className="w-full space-y-2">
                                <Textarea value={editingChatText} onChange={(e) => setEditingChatText(e.target.value)} rows={4} className="text-sm" />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={saveChatEdit} disabled={chatSaving}>
                                    {chatSaving ? 'Saving…' : 'Save'}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelChatEdit} disabled={chatSaving}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm whitespace-pre-line flex-1">{m.message}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => beginChatEdit(m)}
                                    title="Edit message"
                                    aria-label="Edit message"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() =>
                                      setPendingDelete({
                                        kind: 'chat',
                                        id: m.id,
                                        preview: m.message.length > 120 ? `${m.message.slice(0, 120)}…` : m.message,
                                      })
                                    }
                                    title="Delete message"
                                    aria-label="Delete message"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
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
                <div className="mt-4 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Description</p>
                    <CopyDescriptionButton description={selected.description} />
                  </div>
                  <div
                    className="prose prose-sm mt-2 max-w-none text-muted-foreground break-words [overflow-wrap:anywhere] [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-primary [&_a]:break-all"
                    dangerouslySetInnerHTML={{ __html: selected.description?.trim() ? selected.description : '<p>No description.</p>' }}
                  />
                </div>
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
            <AlertDialogTitle>Edit last week hourly payment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Updates withdrawn and the linked incoming payment using current fee fields on this task.</p>
                <div className="space-y-2">
                  <Label>Billable hours (last confirmed week, max {accrualDialog?.row.weekly_hours_cap ?? 40})</Label>
                  <Input type="number" value={accrualHours} onChange={(e) => setAccrualHours(e.target.value)} min={0} />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitAccrualConfirm()}>Save changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskFinishPaymentDialog
        open={!!finishDialog}
        onOpenChange={(open) => !open && setFinishDialog(null)}
        task={finishDialog?.task ?? null}
        pendingPeriods={
          finishDialog
            ? paymentTrackingPeriods.filter((p) => p.pool_item_id === finishDialog.task.id)
            : []
        }
        canPromoteToProject={!!finishDialog && !finishDialog.task.promoted_project_id}
        onConfirmFinish={(moveToProject) => void confirmFinishTask(moveToProject)}
      />

      <TaskPromoteConfirmDialog
        open={!!promoteConfirm}
        onOpenChange={(open) => !open && setPromoteConfirm(null)}
        taskName={promoteConfirm?.taskName ?? null}
        onConfirmPromote={() => void confirmPromoteToProject()}
      />


      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditTaskAutoPayments([]);
        }}
      >
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
              <div className="flex items-center justify-between gap-2">
                <Label>Description</Label>
                <CopyDescriptionButton description={form.description} />
              </div>
              <RichTextEditor
                value={form.description}
                onChange={(val) => setForm((p) => ({ ...p, description: val }))}
                placeholder="Task details…"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>README</Label>
                <CopyDescriptionButton description={form.readme} />
              </div>
              <p className="text-xs text-muted-foreground">
                Project handbook: overview, installation, known issues, version history.
              </p>
              <RichTextEditor
                value={form.readme}
                onChange={(val) => setForm((p) => ({ ...p, readme: val }))}
                placeholder={README_EDITOR_PLACEHOLDER}
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
                  setForm((p) => {
                    if (v === 'none') {
                      return { ...p, clientId: '', clientCountry: p.clientCountry, clientTimezone: p.clientTimezone };
                    }
                    const newCountry = canonicalCountryNameOrLegacy(c?.country || '') || p.clientCountry;
                    const fromClientTz = canonicalTimezoneOrLegacy(c?.timezone || '');
                    const fromCountry = suggestedTimezoneForCountry(newCountry);
                    return {
                      ...p,
                      clientId: v,
                      clientCountry: newCountry,
                      clientTimezone: fromClientTz || fromCountry || '',
                    };
                  });
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
              onChange={(clientCountry) =>
                setForm((p) => {
                  const suggested = suggestedTimezoneForCountry(clientCountry);
                  return {
                    ...p,
                    clientCountry,
                    ...(suggested ? { clientTimezone: suggested } : {}),
                  };
                })
              }
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
                  Billing weeks follow Monday–Sunday in Asia/Tokyo. Confirm due payments on the Payments page; withdrawn updates when each period is confirmed.
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
                  ? 'Project fixed: preview is net after fees for the full contract; saved on confirm.'
                  : form.budgetType === 'fixed' && form.fixedBudgetMode === 'milestone'
                    ? 'Milestone: preview sums confirmed milestones after fees.'
                    : form.budgetType === 'hourly'
                      ? 'Hourly: preview recalculates all confirmed weekly payments using the fees and rate above (updates as you type).'
                      : 'Recurring: preview sums each confirmed installment after fees.'}
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
            <div className="space-y-2 md:col-span-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <Label>Published / live site / app store links</Label>
              <p className="text-xs text-muted-foreground mt-1">Website, Google Play, App Store, or other public links (optional).</p>
              <div className="mt-2">
                <LabeledLinksEditor
                  links={form.publishedLinks}
                  onChange={(links) => setForm((p) => ({ ...p, publishedLinks: links }))}
                  newRowLabel="Link"
                />
              </div>
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
              <Label>Credentials (one per line)</Label>
              <Textarea
                className="min-h-[110px]"
                value={form.credentialsText}
                onChange={(e) => setForm((p) => ({ ...p, credentialsText: e.target.value }))}
                placeholder="Hostinger login | https://hpanel.hostinger.com / user@example.com&#10;cPanel | username + password&#10;SSH private key | -----BEGIN OPENSSH PRIVATE KEY-----..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Metadata JSON</Label>
              <Textarea className="font-mono min-h-[100px]" value={form.metadataJson} onChange={(e) => setForm((p) => ({ ...p, metadataJson: e.target.value }))} />
            </div>
            <ScreenshotsDriveFolderField
              folderUrl={form.screenshotsDriveFolderUrl}
              onFolderUrlChange={(url) => setForm((p) => ({ ...p, screenshotsDriveFolderUrl: url }))}
            />
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

function InfoCard({
  icon: Icon,
  title,
  value,
  action,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="text-sm font-medium text-foreground mt-1">{value}</p>
      {action}
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

