import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClientRef,
  loadProjectDependencies,
  PersonnelRef,
  PoolChatMessage,
  PoolSubtask,
  promoteCompletedPoolItemToProject,
  TaskPoolItemRecord,
  TaskPoolScreenshot,
  TaskPoolSourceFile,
} from '@/lib/taskPool';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
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
import { Trash2 } from 'lucide-react';

const POOL_STATUS_OPTIONS = ['planning', 'active', 'blocked', 'qa', 'completed', 'cancelled'] as const;
const SUBTASK_STATUS_OPTIONS = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const;

export default function TaskPool() {
  const { user, hasRole } = useAuth();
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
  const [selectedStack, setSelectedStack] = useState<string>('all');
  const [newChat, setNewChat] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [taskDeleteConfirm, setTaskDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

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

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.name, p.description, p.task_source, p.main_stack, p.skillset_csv, p.tags_csv, p.status].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [items, searchInput]);

  const stackTree = useMemo(() => {
    const grouped = filtered.reduce<Record<string, TaskPoolItemRecord[]>>((acc, p) => {
      const key = (p.main_stack || 'uncategorized').toLowerCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const displayItems = useMemo(() => {
    if (selectedStack === 'all') return filtered;
    return filtered.filter((p) => (p.main_stack || 'uncategorized').toLowerCase() === selectedStack);
  }, [filtered, selectedStack]);

  const selected = selectedId ? items.find((p) => p.id === selectedId) || null : null;
  const selectedScreenshots = selected ? screenshots.filter((s) => s.pool_item_id === selected.id) : [];
  const selectedFiles = selected ? sourceFiles.filter((s) => s.pool_item_id === selected.id) : [];
  const selectedSubtasks = selected ? subtasks.filter((t) => t.pool_item_id === selected.id) : [];
  const selectedMessages = selected ? messages.filter((m) => m.pool_item_id === selected.id) : [];

  const canEditStatus =
    selected && !selected.promoted_project_id && user && (hasRole('admin') || selected.user_id === user.id);

  const updatePoolStatus = async (newStatus: string) => {
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
    if (newStatus === 'completed') {
      const { projectId, error } = await promoteCompletedPoolItemToProject(selected.id);
      if (error) toast({ title: 'Could not create project', description: error, variant: 'destructive' });
      else if (projectId) toast({ title: 'Moved to Projects', description: 'This lead is now an active project.' });
      fetchAll();
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

  const addSubtask = async () => {
    if (!selected || !newTitle.trim()) return;
    const res = await supabase
      .from('task_pool_subtasks')
      .insert({
        pool_item_id: selected.id,
        title: newTitle.trim(),
        assignee_personnel_id: newAssignee || null,
        status: 'todo',
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

  const updateSubtaskStatus = async (task: PoolSubtask, status: string) => {
    const r = await supabase.from('task_pool_subtasks').update({ status, updated_at: new Date().toISOString() }).eq('id', task.id);
    if (r.error) {
      toast({ title: 'Update failed', description: r.error.message, variant: 'destructive' });
      return;
    }
    fetchAll();
  };

  const deleteSubtask = async (id: string) => {
    const r = await supabase.from('task_pool_subtasks').delete().eq('id', id);
    if (r.error) {
      toast({ title: 'Delete failed', description: r.error.message, variant: 'destructive' });
      return;
    }
    setSubtasks((prev) => prev.filter((t) => t.id !== id));
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Task pool</h2>
          <p className="text-sm text-muted-foreground">Pre-project leads. Completing a task creates a project automatically.</p>
        </div>
        <ModuleSearchBar value={searchInput} onChange={setSearchInput} placeholder="Search task pool..." id="task-pool-search" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-auto">
            <button
              type="button"
              onClick={() => setSelectedStack('all')}
              className={`mb-2 w-full rounded border px-3 py-2 text-left text-sm transition ${selectedStack === 'all' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}
            >
              All stacks ({filtered.length})
            </button>
            <Accordion type="multiple" className="w-full">
              {stackTree.map(([stack, rows]) => (
                <AccordionItem key={stack} value={stack}>
                  <AccordionTrigger className="py-2 text-sm font-medium no-underline hover:no-underline">
                    <span className="capitalize">{stack.replace('_', ' ')}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({rows.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 pb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStack(stack)}
                      className={`w-full rounded border px-2 py-1.5 text-left text-xs transition ${selectedStack === stack ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}
                    >
                      Show all in {stack.replace('_', ' ')}
                    </button>
                    {rows.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedStack(stack);
                          setSelectedId(item.id);
                        }}
                        className="block w-full truncate rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={item.name}
                      >
                        {item.name}
                      </button>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Tasks ({displayItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
            {displayItems.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full rounded border p-3 text-left transition hover:border-primary/40 ${selectedId === row.id ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground line-clamp-1">{row.name}</p>
                  <Badge variant="secondary" className="capitalize">
                    {row.status}
                  </Badge>
                </div>
                {row.promoted_project_id ? (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    In Projects
                  </Badge>
                ) : null}
                {row.task_source ? (
                  <p className="mt-1 text-xs text-muted-foreground capitalize">Task source(from): {row.task_source.replace('_', ' ')}</p>
                ) : null}
                {row.main_stack ? <p className="mt-1 text-xs text-primary/90 capitalize">Stack: {row.main_stack.replace('_', ' ')}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{row.description || 'No description'}</p>
              </button>
            ))}
            {displayItems.length === 0 && <p className="text-sm text-muted-foreground">No tasks found.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {!selected ? (
            <CardContent className="py-12 text-center text-muted-foreground">Select an item.</CardContent>
          ) : (
            <CardContent className="pt-6">
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold">{selected.name}</h3>
                  {canEditStatus ? (
                    <Select value={selected.status} onValueChange={updatePoolStatus}>
                      <SelectTrigger className="w-[170px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POOL_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className="capitalize">{selected.status}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
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
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Client: {clientLabel(selected)}</span>
                  <span>Account: {accountLabel(selected)}</span>
                  <span>Deadline: {selected.deadline ? new Date(selected.deadline).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                  <TabsTrigger value="files">Source files</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="tasks">Dev tasks</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3">
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
                  <InfoLink label="Source storage" url={selected.source_storage_url} />
                  <InfoLink label="GitHub" url={selected.github_url} />
                  <InfoLink label="Initial document" url={selected.initial_document_url} />
                </TabsContent>

                <TabsContent value="screenshots">
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
                        <p className="text-sm whitespace-pre-line">{m.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    {selectedMessages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Dev task title" />
                    <Select value={newAssignee || 'none'} onValueChange={(v) => setNewAssignee(v === 'none' ? '' : v)}>
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
                    <Button onClick={addSubtask}>Add</Button>
                  </div>
                  <div className="space-y-2">
                    {selectedSubtasks.map((task) => (
                      <div key={task.id} className="rounded border p-3 flex items-center justify-between gap-3">
                        <p className="font-medium text-sm">{task.title}</p>
                        <div className="flex items-center gap-2">
                          <Select value={task.status} onValueChange={(v) => updateSubtaskStatus(task, v)}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SUBTASK_STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replace('_', ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {hasRole('admin') ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setTaskDeleteConfirm({ id: task.id, title: task.title })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {selectedSubtasks.length === 0 && <p className="text-sm text-muted-foreground">No dev tasks yet.</p>}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          )}
        </Card>
      </div>

      <AlertDialog open={!!taskDeleteConfirm} onOpenChange={(open) => !open && setTaskDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dev task</AlertDialogTitle>
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

function InfoLink({ label, url }: { label: string; url: string | null }) {
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
