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
import {
  ClientRef,
  loadProjectDependencies,
  PersonnelRef,
  PoolChatMessage,
  PoolSubtask,
  promoteCompletedPoolItemToProject,
  TASK_POOL_ITEM_STATUS_OPTIONS,
  TASK_POOL_SUBTASK_BOARD_STATUSES,
  poolSubtaskBoardLabel,
  taskPoolItemStatusLabel,
  type PoolSubtaskStatus,
  TaskPoolItemRecord,
  TaskPoolScreenshot,
  TaskPoolSourceFile,
  toCsv,
} from '@/lib/taskPool';
import PoolSubtaskKanban from '@/components/PoolSubtaskKanban';
import PoolSubtaskDetailDialog from '@/components/PoolSubtaskDetailDialog';
import { ArrowLeft, Calendar, MessageSquare, Pencil, Plus, Trash2, FolderKanban, Link2, Clock, ListTodo } from 'lucide-react';
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
  skillsetCsv: '',
  tagsCsv: '',
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
  deadline: '',
  budgetType: 'fixed',
  budgetAmount: '',
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

  const filteredItems = useMemo(() => {
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
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: TaskPoolItemRecord) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description || '',
      taskSource: row.task_source || '',
      mainStack: row.main_stack || '',
      skillsetCsv: row.skillset_csv || '',
      tagsCsv: row.tags_csv || '',
      status: row.status,
      priority: row.priority,
      clientId: row.client_id || '',
      clientNameOverride: row.client_name_override || '',
      clientCountry: row.client_country || '',
      clientTimezone: row.client_timezone || '',
      accountId: row.account_id || '',
      chatHistory: row.chat_history || '',
      metadataJson: row.metadata_json ? JSON.stringify(row.metadata_json, null, 2) : '{}',
      initialDocumentUrl: row.initial_document_url || '',
      sourceStorageType: row.source_storage_type,
      sourceStorageUrl: row.source_storage_url || '',
      deadline: row.deadline ? row.deadline.slice(0, 16) : '',
      budgetType: row.budget_type,
      budgetAmount: row.budget_amount?.toString() || '',
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
    if (!form.sourceStorageUrl.trim()) {
      toast({ title: 'Source storage URL is required', description: 'Add your Drive folder link.', variant: 'destructive' });
      return;
    }
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(form.metadataJson || '{}');
    } catch {
      toast({ title: 'Metadata JSON is invalid', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user?.id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      task_source: form.taskSource.trim() || null,
      main_stack: form.mainStack || null,
      skillset_csv: toCsv(form.skillsetCsv.split(',')) || null,
      tags_csv: toCsv(form.tagsCsv.split(',')) || null,
      status: form.status,
      priority: form.priority,
      client_id: form.clientId || null,
      client_name_override: form.clientNameOverride.trim() || null,
      client_country: form.clientCountry.trim() || null,
      client_timezone: form.clientTimezone.trim() || null,
      account_id: form.accountId || null,
      chat_history: form.chatHistory.trim() || null,
      metadata_json: metadata,
      initial_document_url: form.initialDocumentUrl.trim() || null,
      source_storage_type: form.sourceStorageType,
      source_storage_url: form.sourceStorageUrl.trim(),
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      budget_type: form.budgetType,
      budget_amount: form.budgetAmount ? Number(form.budgetAmount) : null,
      currency: form.currency.trim() || 'USD',
      github_url: form.githubUrl.trim() || null,
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
              <Button className="gap-2 shrink-0" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-lg border bg-card py-12 text-center">
              <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching tasks' : 'No tasks yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput.trim() ? 'Try different keywords or clear the search.' : 'Create a task with New.'}
              </p>
            </div>
          ) : (
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
                      <Badge variant="secondary" className="shrink-0">
                        {taskPoolItemStatusLabel(row.status)}
                      </Badge>
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
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{row.description || 'No description'}</p>
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
                    <p className="text-sm text-muted-foreground mt-1">{selected.description || 'No description.'}</p>
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
                  <div className="flex gap-2 shrink-0">
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
                      <InfoCard icon={Clock} title="Deadline" value={selected.deadline ? new Date(selected.deadline).toLocaleString() : 'Not set'} />
                      <InfoCard
                        icon={Calendar}
                        title="Budget"
                        value={
                          selected.budget_amount ? `${selected.currency} ${selected.budget_amount} (${selected.budget_type})` : 'Not set'
                        }
                      />
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      <LinkField label="Source storage" url={selected.source_storage_url} />
                      <LinkField label="GitHub" url={selected.github_url} />
                      <LinkField label="Initial document" url={selected.initial_document_url} />
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
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
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
            <div className="space-y-2">
              <Label>Skillset (comma)</Label>
              <Input value={form.skillsetCsv} onChange={(e) => setForm((p) => ({ ...p, skillsetCsv: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma)</Label>
              <Input value={form.tagsCsv} onChange={(e) => setForm((p) => ({ ...p, tagsCsv: e.target.value }))} />
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
                    clientCountry: c?.country || p.clientCountry,
                    clientTimezone: c?.timezone || p.clientTimezone,
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
            <div className="space-y-2">
              <Label>Client country</Label>
              <Input value={form.clientCountry} onChange={(e) => setForm((p) => ({ ...p, clientCountry: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Client timezone</Label>
              <Input value={form.clientTimezone} onChange={(e) => setForm((p) => ({ ...p, clientTimezone: e.target.value }))} />
            </div>
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
              <Label>Deadline</Label>
              <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Budget type</Label>
              <Select value={form.budgetType} onValueChange={(v) => setForm((p) => ({ ...p, budgetType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">fixed</SelectItem>
                  <SelectItem value="hourly">hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Budget amount</Label>
              <Input type="number" value={form.budgetAmount} onChange={(e) => setForm((p) => ({ ...p, budgetAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>GitHub</Label>
              <Input value={form.githubUrl} onChange={(e) => setForm((p) => ({ ...p, githubUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Storage type</Label>
              <Select value={form.sourceStorageType} onValueChange={(v) => setForm((p) => ({ ...p, sourceStorageType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drive">drive</SelectItem>
                  <SelectItem value="dropbox">dropbox</SelectItem>
                  <SelectItem value="onedrive">onedrive</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Source storage URL *</Label>
              <Input value={form.sourceStorageUrl} onChange={(e) => setForm((p) => ({ ...p, sourceStorageUrl: e.target.value }))} placeholder="Drive folder" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Initial document URL</Label>
              <Input value={form.initialDocumentUrl} onChange={(e) => setForm((p) => ({ ...p, initialDocumentUrl: e.target.value }))} />
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

function LinkField({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="rounded border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
          {url}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">N/A</p>
      )}
    </div>
  );
}
