import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type AccountRef,
  type ClientRef,
  loadProjectDependencies,
  type PersonnelRef,
  type PoolChatMessage,
  type PoolSubtask,
  promoteCompletedPoolItemToProject,
  TASK_POOL_ITEM_STATUS_OPTIONS,
  TASK_POOL_SUBTASK_BOARD_STATUSES,
  poolSubtaskBoardLabel,
  taskPoolItemStatusLabel,
  type PoolSubtaskStatus,
  parseLabeledLinks,
  type TaskPoolItemRecord,
  type TaskPoolItemStatus,
  type TaskPoolScreenshot,
  type TaskPoolSourceFile,
  taskPoolContractGross,
  compareTaskPoolItemsWithinPriority,
  computeTaskPoolDragPatches,
} from '@/lib/taskPool';
import {
  getLastPeriodBounds,
  getPeriodBoundsForDate,
  getWeekBounds,
  isWithinRange,
  summarizeTaskPool,
  type TaskPoolListFilter,
} from '@/lib/taskPoolFinance';
import { formatJstYmdFromIso } from '@/lib/jst';
import { ImportantNoteCard } from '@/components/ImportantNoteCard';
import PoolSubtaskKanban from '@/components/PoolSubtaskKanban';
import PoolSubtaskDetailDialog from '@/components/PoolSubtaskDetailDialog';
import { LabeledLinksListWithCopy } from '@/components/LabeledLinksListWithCopy';
import { CopyDescriptionButton } from '@/components/CopyDescriptionButton';
import { ReadmePanel } from '@/components/ReadmePanel';
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
import { ArrowLeft, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { PRIORITY_BADGE_CLASS, PRIORITY_OPTIONS, PRIORITY_RANK, taskDescriptionPreview } from '@/lib/taskPriority';
import ResolvedScreenshotCarousel from '@/components/ResolvedScreenshotCarousel';
import { screenshotsFolderFromMetadata } from '@/lib/screenshotDriveFolder';
import { countPendingByPool, filterAccrualPeriodsForPaymentTracking, findAccrualPeriodForMilestone, type TaskPoolAccrualPeriodRow } from '@/lib/taskPoolAccrualPeriods';
import { buildPoolStatusTransitionFields } from '@/lib/taskPoolStatusTransitions';
import { fetchAllAccrualPeriods, syncAccrualPeriodsForTask } from '@/lib/taskPoolAccrualService';
import AccrualPeriodHandleDialog from '@/components/AccrualPeriodHandleDialog';
import TaskMilestonePaymentsPanel from '@/components/TaskMilestonePaymentsPanel';
import TaskPaymentDueBadge from '@/components/TaskPaymentDueBadge';
import TaskFinishPaymentDialog from '@/components/TaskFinishPaymentDialog';
import TaskFinishButton from '@/components/TaskFinishButton';
import TaskPoolTableBandHeader from '@/components/TaskPoolTableBandHeader';
import { cn } from '@/lib/utils';
import {
  countTasksByTableBand,
  sortTasksForTableView,
  taskPoolTableBand,
  TASK_POOL_TABLE_BAND_ROW_CLASS,
} from '@/lib/taskPoolTableBands';

export default function TaskPool() {
  const { user, hasRole } = useAuth();
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
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');
  const [prioritySortOrder, setPrioritySortOrder] = useState<'high_first' | 'low_first'>('high_first');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [newChat, setNewChat] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatText, setEditingChatText] = useState('');
  const [chatSaving, setChatSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newSubtaskColumn, setNewSubtaskColumn] = useState<PoolSubtaskStatus>('todo');
  const [taskDeleteConfirm, setTaskDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [finishDialog, setFinishDialog] = useState<{ task: TaskPoolItemRecord } | null>(null);
  const [subtaskDetailId, setSubtaskDetailId] = useState<string | null>(null);
  const [accrualPeriods, setAccrualPeriods] = useState<TaskPoolAccrualPeriodRow[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TaskPoolAccrualPeriodRow | null>(null);
  const [milestoneConfirmLoadingId, setMilestoneConfirmLoadingId] = useState<string | null>(null);

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
    try {
      setAccrualPeriods(await fetchAllAccrualPeriods());
    } catch {
      setAccrualPeriods([]);
    }
    setLoading(false);
  };

  const paymentTrackingPeriods = useMemo(
    () => filterAccrualPeriodsForPaymentTracking(accrualPeriods, items),
    [accrualPeriods, items],
  );
  const pendingCountByPool = useMemo(() => countPendingByPool(paymentTrackingPeriods), [paymentTrackingPeriods]);

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

  useEffect(() => {
    const tid = searchParams.get('task');
    if (!tid || items.length === 0) return;
    if (items.some((p) => p.id === tid)) setSelectedId(tid);
  }, [searchParams, items]);

  const itemsForClientFilter = useMemo(() => {
    if (!filterClientId) return items;
    return items.filter((p) => p.client_id === filterClientId);
  }, [items, filterClientId]);

  const searchFiltered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return itemsForClientFilter;
    return itemsForClientFilter.filter((p) =>
      [p.name, p.important_note, p.description, p.readme, p.task_source, p.main_stack, p.skillset_csv, p.tags_csv, p.status].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [itemsForClientFilter, searchInput]);

  const now = useMemo(() => new Date(), [items.length, searchInput, listFilter]);
  const thisPeriod = useMemo(() => getPeriodBoundsForDate(now), [now]);
  const lastPeriod = useMemo(() => getLastPeriodBounds(now), [now]);
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = useMemo(() => getWeekBounds(now), [now]);
  const yearStart = useMemo(() => new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), [now]);
  const yearEnd = useMemo(() => new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0), [now]);
  const filtered = useMemo(() => {
    const base = searchFiltered;
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
  }, [searchFiltered, listFilter, thisPeriod, lastPeriod, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, yearStart, yearEnd, customStart, customEnd]);
  const sortedTasks = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const pa = PRIORITY_RANK[a.priority] ?? 999;
        const pb = PRIORITY_RANK[b.priority] ?? 999;
        if (pa !== pb) return prioritySortOrder === 'high_first' ? pa - pb : pb - pa;
        return compareTaskPoolItemsWithinPriority(a, b);
      }),
    [filtered, prioritySortOrder],
  );
  const tableSortedTasks = useMemo(
    () => sortTasksForTableView(filtered, prioritySortOrder),
    [filtered, prioritySortOrder],
  );
  const tableBandCounts = useMemo(() => countTasksByTableBand(tableSortedTasks), [tableSortedTasks]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const t of sortedTasks) counts[t.priority] = (counts[t.priority] || 0) + 1;
    return counts;
  }, [sortedTasks]);

  const canEditTask = (task: TaskPoolItemRecord) =>
    !task.promoted_project_id && user && (hasRole('admin') || task.user_id === user.id);

  const updateTaskQuick = async (id: string, patch: Partial<Pick<TaskPoolItemRecord, 'priority' | 'status' | 'priority_order'>>) => {
    const row = items.find((x) => x.id === id);
    if (!row || !canEditTask(row)) return;
    if (patch.status === 'completed' && row && row.status !== 'completed') {
      setFinishDialog({ task: row });
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
    setItems((prev) => prev.map((x) => (x.id === id ? (res.data as TaskPoolItemRecord) : x)));
  };

  const applyDraggedPriority = async (target: TaskPoolItemRecord) => {
    if (!canEditTask(target) || !draggingTaskId || draggingTaskId === target.id) return;
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

  const canEditStatus =
    selected && !selected.promoted_project_id && user && (hasRole('admin') || selected.user_id === user.id);

  const requestFinishTask = (task: TaskPoolItemRecord) => {
    if (!canEditTask(task) || task.status === 'completed') return;
    setFinishDialog({ task });
  };

  const updatePoolStatus = async (newStatus: string) => {
    if (!selected) return;
    if (newStatus === 'completed' && selected.status !== 'completed') {
      setFinishDialog({ task: selected });
      return;
    }
    await applyPoolStatus(selected.id, newStatus);
  };

  const promoteIfNeeded = async (poolId: string) => {
    const { projectId, error } = await promoteCompletedPoolItemToProject(poolId);
    if (error) {
      toast({ title: 'Could not create project', description: error, variant: 'destructive' });
      return;
    }
    if (projectId) {
      toast({ title: 'Moved to Projects', description: 'This lead is now an active project.' });
      const row = await supabase.from('task_pool_items').select('*').eq('id', poolId).maybeSingle();
      if (row.data) setItems((prev) => prev.map((x) => (x.id === poolId ? (row.data as TaskPoolItemRecord) : x)));
    }
  };

  const applyPoolStatus = async (taskId: string, newStatus: string, finishedAt?: string) => {
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
    setItems((prev) => prev.map((x) => (x.id === taskId ? (res.data as TaskPoolItemRecord) : x)));
  };

  const confirmFinishTask = async (moveToProject: boolean) => {
    if (!finishDialog) return;
    const { task } = finishDialog;
    const finishedAt = new Date().toISOString();
    await applyPoolStatus(task.id, 'completed', finishedAt);
    setFinishDialog(null);
    if (moveToProject && !task.promoted_project_id) {
      await promoteIfNeeded(task.id);
    }
    toast({ title: 'Task completed' });
  };

  const openMilestoneConfirm = async (milestoneId: string) => {
    if (!selected || !hasRole('admin')) return;
    setMilestoneConfirmLoadingId(milestoneId);
    try {
      let period = findAccrualPeriodForMilestone(accrualPeriods, selected.id, milestoneId);
      if (!period) {
        const account = accounts.find((a) => a.id === selected.account_id);
        await syncAccrualPeriodsForTask(selected, account);
        const periods = await fetchAllAccrualPeriods();
        setAccrualPeriods(periods);
        period = findAccrualPeriodForMilestone(periods, selected.id, milestoneId);
      }
      if (!period) {
        toast({
          title: 'Milestone payment not found',
          description: 'Ensure milestones are saved on this task, then try again.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedPeriod(period);
    } catch (e) {
      toast({
        title: 'Could not open milestone payment',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setMilestoneConfirmLoadingId(null);
    }
  };

  const refreshAfterAccrualConfirm = async () => {
    try {
      setAccrualPeriods(await fetchAllAccrualPeriods());
      const res = await supabase.from('task_pool_items').select('*').order('created_at', { ascending: false });
      if (res.data) setItems(res.data as TaskPoolItemRecord[]);
    } catch (e) {
      console.error('Failed to refresh after accrual confirm', e);
    }
  };

  const addChat = async () => {
    if (!selected || !newChat.trim() || !user?.id) return;
    const res = await supabase
      .from('task_pool_chat_messages')
      .insert({ pool_item_id: selected.id, author_user_id: user.id, message: newChat.trim() })
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

  const addSubtask = async () => {
    if (!selected || !newTitle.trim()) return;
    const res = await supabase
      .from('task_pool_subtasks')
      .insert({
        pool_item_id: selected.id,
        title: newTitle.trim(),
        assignee_personnel_id: newAssignee || null,
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
    setNewTitle('');
    setNewAssignee('');
    setSubtasks((prev) => [res.data as PoolSubtask, ...prev]);
  };

  const saveSubtaskDetail = async (
    taskId: string,
    data: { title: string; description: string | null },
  ): Promise<boolean> => {
    const r = await supabase
      .from('task_pool_subtasks')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();
    if (r.error || !r.data) {
      toast({ title: 'Save failed', description: r.error?.message, variant: 'destructive' });
      return false;
    }
    setSubtasks((prev) => prev.map((t) => (t.id === taskId ? (r.data as PoolSubtask) : t)));
    toast({ title: 'Card saved', description: 'Title and description were updated.' });
    return true;
  };

  const moveSubtaskToColumn = async (taskId: string, status: PoolSubtaskStatus) => {
    const r = await supabase
      .from('task_pool_subtasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();
    if (r.error || !r.data) {
      toast({ title: 'Move failed', description: r.error?.message, variant: 'destructive' });
      return;
    }
    const updated = r.data as PoolSubtask;
    setSubtasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
  };

  const deleteSubtask = async (id: string) => {
    const r = await supabase.from('task_pool_subtasks').delete().eq('id', id);
    if (r.error) {
      toast({ title: 'Delete failed', description: r.error.message, variant: 'destructive' });
      return;
    }
    setSubtasks((prev) => prev.filter((t) => t.id !== id));
    setSubtaskDetailId((cur) => (cur === id ? null : cur));
  };

  const execDel = async () => {
    if (!taskDeleteConfirm) return;
    const { id } = taskDeleteConfirm;
    setTaskDeleteConfirm(null);
    await deleteSubtask(id);
  };

  const clientLabel = (row: TaskPoolItemRecord) => {
    if (row.client_id) {
      const c = clients.find((x) => x.id === row.client_id);
      if (c) return `${c.first_name} ${c.last_name}${c.company_name ? ` (${c.company_name})` : ''}`;
    }
    return row.client_name_override || 'N/A';
  };

  const accountLabel = (row: TaskPoolItemRecord) => {
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Task pool</h2>
              <p className="text-sm text-muted-foreground">
                Open a lead to view details and the full-width <strong>Task board</strong>. Set a lead to <strong>Completed</strong> to promote it to Projects.
              </p>
            </div>
            <div className="flex w-full max-w-3xl gap-3">
              <ModuleSearchBar value={searchInput} onChange={setSearchInput} placeholder="Search task pool..." id="task-pool-search" />
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
                  <SelectItem value="this_year">{`Year (${yearLabel})`}</SelectItem>
                  <SelectItem value="working">Current working</SelectItem>
                </SelectContent>
              </Select>
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
              {listFilter === 'custom' ? (
                <div className="flex items-center gap-2">
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[150px]" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[150px]" />
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard title={`This Month (${thisMonthLabel})`} summary={thisPeriodSummary} />
            <StatCard title={`Last Month (${lastMonthLabel})`} summary={lastPeriodSummary} />
            <StatCard title={`Year (${yearLabel})`} summary={thisYearSummary} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {sortedTasks.length} tasks
              {viewMode === 'table'
                ? ', grouped by status (active → paused → free → completed → cancelled), then priority'
                : `, sorted by priority (${prioritySortOrder === 'high_first' ? 'high to low' : 'low to high'})`}{' '}
              {viewMode !== 'table' ? (
                <>
                  . Within the same priority, drag a task onto another to place it{' '}
                  <span className="font-medium text-foreground/80">before</span> that task.
                </>
              ) : null}
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

          {sortedTasks.length === 0 ? (
            <div className="rounded-lg border bg-card py-12 text-center">
              <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching tasks' : 'No tasks yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput.trim() ? 'Try different keywords or clear the search.' : 'Tasks appear here when admins add them.'}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTasks.map((row, idx) => (
                <Card
                  key={row.id}
                  className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                  style={{ borderLeft: `4px solid ${row.priority === 'critical' ? '#dc2626' : row.priority === 'high' ? '#ea580c' : row.priority === 'medium' ? '#2563eb' : '#64748b'}` }}
                  onClick={() => setSelectedId(row.id)}
                  draggable={hasRole('admin')}
                  onDragStart={(e) => {
                    if (!hasRole('admin')) return;
                    setDraggingTaskId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!hasRole('admin') || !draggingTaskId || draggingTaskId === row.id) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void applyDraggedPriority(row);
                    setDraggingTaskId(null);
                  }}
                  onDragEnd={() => setDraggingTaskId(null)}
                >
                  <CardContent className="p-4">
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
                        In Projects
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
                      Received: {formatJstYmdFromIso(row.task_received_at)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-3 break-words [overflow-wrap:anywhere]">
                      {taskDescriptionPreview(row.description, 20)}
                    </p>
                    {canEditTask(row) ? (
                      <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        <TaskFinishButton task={row} onFinish={requestFinishTask} />
                      </div>
                    ) : null}
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
                  {tableSortedTasks.map((row, idx) => {
                    const band = taskPoolTableBand(row.status);
                    const prevBand = idx > 0 ? taskPoolTableBand(tableSortedTasks[idx - 1].status) : null;
                    return (
                      <Fragment key={row.id}>
                        {band !== prevBand ? (
                          <TaskPoolTableBandHeader band={band} count={tableBandCounts[band]} colSpan={7} />
                        ) : null}
                        <tr
                          className={cn(
                            'cursor-pointer border-t hover:bg-muted/30',
                            TASK_POOL_TABLE_BAND_ROW_CLASS[band],
                          )}
                          onClick={() => setSelectedId(row.id)}
                          draggable={canEditTask(row)}
                          onDragStart={(e) => {
                            if (!canEditTask(row)) return;
                            setDraggingTaskId(row.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            if (!canEditTask(row) || !draggingTaskId || draggingTaskId === row.id) return;
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
                        {canEditTask(row) ? (
                          <Select
                            value={row.status}
                            onValueChange={(v) => void updateTaskQuick(row.id, { status: v as TaskPoolItemRecord['status'] })}
                          >
                            <SelectTrigger className="h-8 min-w-[9rem] w-[9rem]" onClick={(e) => e.stopPropagation()}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {TASK_POOL_ITEM_STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {taskPoolItemStatusLabel(s, { inMenu: true })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          taskPoolItemStatusLabel(row.status)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEditTask(row) ? (
                          <Select
                            value={row.priority}
                            onValueChange={(v) => void updateTaskQuick(row.id, { priority: v as TaskPoolItemRecord['priority'] })}
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
                        ) : (
                          <Badge variant="outline" className={`capitalize ${PRIORITY_BADGE_CLASS[row.priority] || ''}`}>
                            {row.priority}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 capitalize">{(row.task_source || '-').replace('_', ' ')}</td>
                      <td className="px-3 py-2">{row.currency} {taskPoolContractGross(row).toFixed(2)}</td>
                      <td className="px-3 py-2 text-emerald-600">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {canEditTask(row) ? <TaskFinishButton task={row} onFinish={requestFinishTask} compact /> : null}
                      </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'line' ? (
            <div className="rounded-lg border bg-card">
              {sortedTasks.map((row, idx) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/30"
                  onClick={() => setSelectedId(row.id)}
                  draggable={hasRole('admin')}
                  onDragStart={(e) => {
                    if (!hasRole('admin')) return;
                    setDraggingTaskId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!hasRole('admin') || !draggingTaskId || draggingTaskId === row.id) return;
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
                    {hasRole('admin') ? (
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Select value={row.status} onValueChange={(v) => void updateTaskQuick(row.id, { status: v as TaskPoolItemRecord['status'] })}>
                          <SelectTrigger className="h-8 min-w-[9rem] w-[9rem] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_POOL_ITEM_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {taskPoolItemStatusLabel(s, { inMenu: true })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={row.priority} onValueChange={(v) => void updateTaskQuick(row.id, { priority: v as TaskPoolItemRecord['priority'] })}>
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
                        {canEditTask(row) ? <TaskFinishButton task={row} onFinish={requestFinishTask} compact /> : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{taskPoolItemStatusLabel(row.status)}</p>
                    )}
                    <p className="text-xs text-emerald-600">{row.currency} {Number(row.withdrawn_amount ?? 0).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map((row, idx) => (
                <Card
                  key={row.id}
                  className="cursor-pointer hover:border-primary/40"
                  onClick={() => setSelectedId(row.id)}
                  draggable={hasRole('admin')}
                  onDragStart={(e) => {
                    if (!hasRole('admin')) return;
                    setDraggingTaskId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!hasRole('admin') || !draggingTaskId || draggingTaskId === row.id) return;
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
                      {canEditTask(row) ? <TaskFinishButton task={row} onFinish={requestFinishTask} compact /> : null}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" size="sm" className="w-fit gap-2 text-muted-foreground" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-4 w-4" />
              All tasks
            </Button>
          </div>

          <Card className="min-w-0">
            {selected ? (
            <CardContent className="pt-6">
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold">{selected.name}</h3>
                  {canEditStatus ? (
                    <Select value={selected.status} onValueChange={updatePoolStatus}>
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_POOL_ITEM_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {taskPoolItemStatusLabel(s, { inMenu: true })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge>{taskPoolItemStatusLabel(selected.status)}</Badge>
                  )}
                  {canEditStatus ? <TaskFinishButton task={selected} onFinish={requestFinishTask} /> : null}
                </div>
                {selected.main_stack ? <Badge className="mt-2 capitalize">{selected.main_stack.replace('_', ' ')}</Badge> : null}
                {selected.task_source ? (
                  <Badge variant="outline" className="mt-2 ml-2 capitalize">
                    Task source(from): {selected.task_source.replace('_', ' ')}
                  </Badge>
                ) : null}
                {selected.promoted_project_id ? (
                  <p className="mt-2 text-sm">
                    <Link to="/dashboard/projects" className="font-medium text-primary hover:underline">
                      View in Projects →
                    </Link>
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>Client: {clientLabel(selected)}</span>
                    {selected.client_id ? (
                      <Link to={`/dashboard/clients?client=${selected.client_id}`} className="font-medium text-primary hover:underline">
                        View in Clients
                      </Link>
                    ) : null}
                  </span>
                  <span>Account: {accountLabel(selected)}</span>
                  <span>Deadline: {selected.deadline ? new Date(selected.deadline).toLocaleDateString() : 'N/A'}</span>
                  <span>Received: {formatJstYmdFromIso(selected.task_received_at)}</span>
                  <span>Real budget: {selected.currency} {taskPoolContractGross(selected).toFixed(2)}</span>
                  <span>Withdrawn: {selected.currency} {Number(selected.withdrawn_amount ?? 0).toFixed(2)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Upwork connection fee: {selected.currency} {Number(selected.upwork_connection_fee ?? 0).toFixed(2)}</span>
                  <span>Convert fee: {selected.currency} {Number(selected.convert_fee ?? 0).toFixed(2)}</span>
                  <span>Transfer fee: {selected.currency} {Number(selected.transfer_fee ?? 0).toFixed(2)}</span>
                  <span>Upwork fee: {selected.currency} {Number(selected.upwork_fee ?? 0).toFixed(2)}</span>
                  <span>Withdraw fee: {selected.currency} {Number(selected.withdraw_fee ?? 0).toFixed(2)}</span>
                </div>
              </div>

              <ImportantNoteCard note={selected.important_note} className="mb-4" />

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="readme">README</TabsTrigger>
                  <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                  <TabsTrigger value="files">Source files</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="tasks">Task board</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3">
                  {Number(selected.withdrawn_amount ?? 0) > 0 && linkedPaymentsCount === 0 ? (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Data check</p>
                      <p>
                        This task has withdrawn &gt; 0, but there are no linked payment entries yet. Confirm accruals in Admin to auto-create incoming rows.
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Linked payments</p>
                      <Link to="/dashboard/payments" className="text-sm text-primary hover:underline">
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
                  <TaskMilestonePaymentsPanel
                    task={selected}
                    onConfirmMilestone={hasRole('admin') ? (id) => void openMilestoneConfirm(id) : undefined}
                    confirmBusyId={milestoneConfirmLoadingId}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(selected.skillset_csv || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((skill) => (
                        <Badge key={skill}>{skill}</Badge>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selected.tags_csv || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                  <LabeledLinksListWithCopy title="Source storage" links={parseLabeledLinks(selected.source_storage_urls, selected.source_storage_url, 'Storage')} />
                  <LabeledLinksListWithCopy title="GitHub" links={parseLabeledLinks(selected.github_links, selected.github_url, 'GitHub')} />
                  <LabeledLinksListWithCopy title="Initial documents" links={parseLabeledLinks(selected.initial_document_urls, selected.initial_document_url, 'Document')} />
                  <LabeledLinksListWithCopy title="Published / store links" links={parseLabeledLinks(selected.published_links, null, 'Link')} emptyHint="No published links yet — edit this pool item and use the highlighted block under GitHub." />
                  <TaskPoolCredentials metadata={selected.metadata_json} />
                </TabsContent>

                <TabsContent value="readme">
                  <ReadmePanel
                    readme={selected.readme}
                    emptyHtml="<p>No README yet. Ask your admin to add overview, installation, known issues, and versions.</p>"
                    className="border-0 p-0"
                  />
                </TabsContent>

                <TabsContent value="screenshots">
                  <ResolvedScreenshotCarousel
                    rows={selectedScreenshots}
                    folderUrl={screenshotsFolderFromMetadata(selected.metadata_json)}
                    emptyMessage="No screenshots yet."
                  />
                </TabsContent>

                <TabsContent value="files">
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
                    <Textarea placeholder="Internal message..." value={newChat} onChange={(e) => setNewChat(e.target.value)} />
                    <Button className="self-end" onClick={addChat}>
                      Post
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[320px] overflow-auto">
                    {selectedMessages.map((m) => (
                      <div key={m.id} className="rounded border p-3">
                        {editingChatId === m.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingChatText}
                              onChange={(e) => setEditingChatText(e.target.value)}
                              rows={4}
                              className="text-sm"
                            />
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
                          <p className="text-sm whitespace-pre-line">{m.message}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                        {editingChatId !== m.id ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="mt-1 h-7 w-7"
                            onClick={() => beginChatEdit(m)}
                            title="Edit message"
                            aria-label="Edit message"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {selectedMessages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    About three columns show at once—scroll horizontally at the bottom to see the rest. Click a card for details. Drag from the grip to move between columns (To do, Doing, Done, Bug list, Cancelled).
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_160px_220px_auto]">
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Card title" />
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
                    <Select value={newAssignee || 'none'} onValueChange={(v) => setNewAssignee(v === 'none' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assignee" />
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
                    <Button onClick={addSubtask}>Add card</Button>
                  </div>
                  <PoolSubtaskKanban
                    subtasks={selectedSubtasks}
                    personnel={personnel}
                    onMove={moveSubtaskToColumn}
                    onSelect={(t) => setSubtaskDetailId(t.id)}
                    canDelete={hasRole('admin')}
                    onDelete={(id, title) => setTaskDeleteConfirm({ id, title })}
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
                  dangerouslySetInnerHTML={{
                    __html: selected.description?.trim() ? selected.description : '<p>No description.</p>',
                  }}
                />
              </div>
            </CardContent>
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

      <AccrualPeriodHandleDialog
        open={!!selectedPeriod}
        onOpenChange={(open) => !open && setSelectedPeriod(null)}
        period={selectedPeriod}
        task={selectedPeriod && selected ? selected : null}
        taskHref={selected ? `/dashboard/tasks?task=${selected.id}` : null}
        onConfirmed={() => void refreshAfterAccrualConfirm()}
      />

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

      <AlertDialog open={!!taskDeleteConfirm} onOpenChange={(open) => !open && setTaskDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete board card</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{taskDeleteConfirm?.title}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={execDel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskPoolCredentials({ metadata }: { metadata: Record<string, unknown> | null }) {
  const credentials = parseCredentialRows(metadata);
  return (
    <div className="rounded border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground mb-2">Credentials</p>
      {credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">N/A</p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((c, idx) => (
            <li key={`${c.label}-${idx}`}>
              <p className="text-xs font-medium">{c.label}</p>
              <p className="text-sm break-all whitespace-pre-wrap">{c.value}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function parseCredentialRows(metadata: Record<string, unknown> | null): Array<{ label: string; value: string }> {
  const raw = (metadata as { credentials?: unknown } | null)?.credentials;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as { label?: unknown; value?: unknown };
      return {
        label: String(row.label || 'Credential'),
        value: String(row.value || ''),
      };
    })
    .filter((x) => x.value.trim());
}

function StatCard({
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
      <p className="mt-1 text-xs text-muted-foreground">Real budget: {summary.realBudget.toFixed(2)}</p>
      <p className="text-xs text-emerald-600">Withdrawn: {summary.withdrawnBudget.toFixed(2)}</p>
    </div>
  );
}
