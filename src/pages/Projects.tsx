import { useEffect, useMemo, useState } from 'react';
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
import { AccountRef, ClientRef, loadProjectDependencies, PersonnelRef, ProjectChatMessage, ProjectRecord, ProjectScreenshot, ProjectTask } from '@/lib/projects';
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
import { PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react';

const TASK_STATUS_OPTIONS = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const;

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [screenshots, setScreenshots] = useState<ProjectScreenshot[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelRef[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedStack, setSelectedStack] = useState<string>('all');
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(true);
  const [showProjectsPanel, setShowProjectsPanel] = useState(true);
  const [newChat, setNewChat] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [taskDeleteConfirm, setTaskDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [projectsRes, screenshotsRes, tasksRes, messagesRes, deps] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('project_screenshots').select('*').order('sort_order'),
      supabase.from('project_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('project_chat_messages').select('*').order('created_at', { ascending: false }),
      loadProjectDependencies(),
    ]);
    if (projectsRes.error) toast({ title: 'Error loading projects', description: projectsRes.error.message, variant: 'destructive' });

    setProjects((projectsRes.data || []) as ProjectRecord[]);
    setScreenshots((screenshotsRes.data || []) as ProjectScreenshot[]);
    setTasks((tasksRes.data || []) as ProjectTask[]);
    setMessages((messagesRes.data || []) as ProjectChatMessage[]);
    setClients(deps.clients);
    setAccounts(deps.accounts);
    setPersonnel(deps.personnel);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredProjects = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => [p.name, p.description, p.project_source, p.main_stack, p.skillset_csv, p.tags_csv, p.status, p.priority].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [projects, searchInput]);

  const stackTree = useMemo(() => {
    const grouped = filteredProjects.reduce<Record<string, ProjectRecord[]>>((acc, p) => {
      const key = (p.main_stack || 'uncategorized').toLowerCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProjects]);

  const displayProjects = useMemo(() => {
    if (selectedStack === 'all') return filteredProjects;
    return filteredProjects.filter((p) => (p.main_stack || 'uncategorized').toLowerCase() === selectedStack);
  }, [filteredProjects, selectedStack]);

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) || null : null;
  const selectedScreenshots = selectedProject ? screenshots.filter((s) => s.project_id === selectedProject.id) : [];
  const selectedTasks = selectedProject ? tasks.filter((t) => t.project_id === selectedProject.id) : [];
  const selectedMessages = selectedProject ? messages.filter((m) => m.project_id === selectedProject.id) : [];

  const addChat = async () => {
    if (!selectedProject || !newChat.trim() || !user?.id) return;
    const res = await supabase.from('project_chat_messages').insert({ project_id: selectedProject.id, author_user_id: user.id, message: newChat.trim() });
    if (res.error) {
      toast({ title: 'Message failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    setNewChat('');
    fetchAll();
  };

  const addTask = async () => {
    if (!selectedProject || !newTaskTitle.trim()) return;
    const res = await supabase
      .from('project_tasks')
      .insert({
        project_id: selectedProject.id,
        title: newTaskTitle.trim(),
        assignee_personnel_id: newTaskAssignee || null,
        status: 'todo',
        priority: 'medium',
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (res.error || !res.data) {
      toast({ title: 'Task failed', description: res.error?.message || 'Unknown error', variant: 'destructive' });
      return;
    }
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setTasks((prev) => [res.data as ProjectTask, ...prev]);
  };

  const updateTaskStatus = async (task: ProjectTask, status: string) => {
    const res = await supabase.from('project_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', task.id);
    if (res.error) {
      toast({ title: 'Task update failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    fetchAll();
  };

  const deleteTask = async (id: string) => {
    const res = await supabase.from('project_tasks').delete().eq('id', id);
    if (res.error) {
      toast({ title: 'Task delete failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const executeTaskDelete = async () => {
    if (!taskDeleteConfirm) return;
    const { id } = taskDeleteConfirm;
    setTaskDeleteConfirm(null);
    await deleteTask(id);
  };

  const clientLabel = (project: ProjectRecord) => {
    if (project.client_id) {
      const c = clients.find((x) => x.id === project.client_id);
      if (c) return `${c.first_name} ${c.last_name}${c.company_name ? ` (${c.company_name})` : ''}`;
    }
    return project.client_name_override || 'N/A';
  };

  const accountLabel = (project: ProjectRecord) => {
    if (!project.account_id) return 'N/A';
    const a = accounts.find((x) => x.id === project.account_id);
    return a ? `${a.platform} @${a.username}` : 'N/A';
  };

  const projectSourceFiles = (project: ProjectRecord): string[] => {
    const raw = (project.metadata_json as { source_file_urls?: unknown } | null)?.source_file_urls;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => String(x || '').trim()).filter(Boolean);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground">Project pool with files, screenshots, chat, and task manager.</p>
        </div>
        <div className="flex w-full max-w-2xl gap-2">
          <ModuleSearchBar value={searchInput} onChange={setSearchInput} placeholder="Search projects..." id="projects-search" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowProjectsPanel((v) => !v)}
            title={showProjectsPanel ? 'Hide projects panel' : 'Show projects panel'}
            aria-label={showProjectsPanel ? 'Hide projects panel' : 'Show projects panel'}
            className="shrink-0"
          >
            {showProjectsPanel ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowCategoriesPanel((v) => !v)}
            title={showCategoriesPanel ? 'Hide categories panel' : 'Show categories panel'}
            aria-label={showCategoriesPanel ? 'Hide categories panel' : 'Show categories panel'}
            className="shrink-0"
          >
            {showCategoriesPanel ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          showCategoriesPanel && showProjectsPanel ? 'lg:grid-cols-4' : showCategoriesPanel || showProjectsPanel ? 'lg:grid-cols-3' : 'lg:grid-cols-1'
        }`}
      >
        {showCategoriesPanel ? (
          <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Categories</CardTitle></CardHeader>
          <CardContent className="max-h-[70vh] overflow-auto">
            <button
              type="button"
              onClick={() => setSelectedStack('all')}
              className={`mb-2 w-full rounded border px-3 py-2 text-left text-sm transition ${selectedStack === 'all' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}
            >
              All stacks ({filteredProjects.length})
            </button>
            <Accordion type="multiple" className="w-full">
              {stackTree.map(([stack, items]) => (
                <AccordionItem key={stack} value={stack}>
                  <AccordionTrigger className="py-2 text-sm font-medium no-underline hover:no-underline">
                    <span className="capitalize">{stack.replace('_', ' ')}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({items.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 pb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStack(stack)}
                      className={`w-full rounded border px-2 py-1.5 text-left text-xs transition ${selectedStack === stack ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}
                    >
                      Show all in {stack.replace('_', ' ')}
                    </button>
                    {items.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedStack(stack);
                          setSelectedProjectId(item.id);
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
        ) : null}

        {showProjectsPanel ? (
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Projects ({displayProjects.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
              {displayProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded border p-3 text-left transition hover:border-primary/40 ${selectedProjectId === project.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground line-clamp-1">{project.name}</p>
                    <Badge variant="secondary" className="capitalize">{project.status}</Badge>
                  </div>
                  {project.project_source ? <p className="mt-1 text-xs text-muted-foreground capitalize">Project source(from): {project.project_source.replace('_', ' ')}</p> : null}
                  {project.main_stack ? <p className="mt-1 text-xs text-primary/90 capitalize">Stack: {project.main_stack.replace('_', ' ')}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{project.description || 'No description'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{clientLabel(project)}</p>
                </button>
              ))}
              {displayProjects.length === 0 && <p className="text-sm text-muted-foreground">No projects found.</p>}
            </CardContent>
          </Card>
        ) : null}

        <Card className={showCategoriesPanel && showProjectsPanel ? 'lg:col-span-2' : showCategoriesPanel || showProjectsPanel ? 'lg:col-span-2' : 'lg:col-span-1'}>
          {!selectedProject ? (
            <CardContent className="py-12 text-center text-muted-foreground">Select a project to view details.</CardContent>
          ) : (
            <CardContent className="pt-6">
              <div className="mb-4">
                <h3 className="text-xl font-semibold">{selectedProject.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedProject.description}</p>
                {selectedProject.main_stack ? <Badge className="mt-2 capitalize">{selectedProject.main_stack.replace('_', ' ')}</Badge> : null}
                {selectedProject.project_source ? <Badge variant="outline" className="mt-2 ml-2 capitalize">Project source(from): {selectedProject.project_source.replace('_', ' ')}</Badge> : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Client: {clientLabel(selectedProject)}</span>
                  <span>Account: {accountLabel(selectedProject)}</span>
                  <span>Deadline: {selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3">
                  <div className="flex flex-wrap gap-2">{(selectedProject.skillset_csv || '').split(',').map((s) => s.trim()).filter(Boolean).map((skill) => <Badge key={skill}>{skill}</Badge>)}</div>
                  <div className="flex flex-wrap gap-2">{(selectedProject.tags_csv || '').split(',').map((s) => s.trim()).filter(Boolean).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
                  <InfoLink label="Source code storage" url={selectedProject.source_storage_url} />
                  <InfoLink label="GitHub link" url={selectedProject.github_url} />
                  <InfoLink label="Initial document" url={selectedProject.initial_document_url} />
                  <ProjectCredentials metadata={selectedProject.metadata_json} />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Source files (from Task promotion)</p>
                    {projectSourceFiles(selectedProject).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No source files linked.</p>
                    ) : (
                      <ul className="space-y-1">
                        {projectSourceFiles(selectedProject).map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="screenshots">
                  {selectedScreenshots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No screenshots uploaded yet.</p>
                  ) : (
                    <div className="px-12">
                      <Carousel opts={{ align: 'start' }}>
                        <CarouselContent>
                          {selectedScreenshots.map((s) => (
                            <CarouselItem key={s.id}>
                              <div className="overflow-hidden rounded border bg-muted/20">
                                <img src={s.image_url} alt="Screenshot" className="h-[320px] w-full object-cover" />
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

                <TabsContent value="chat" className="space-y-3">
                  <div className="flex gap-2">
                    <Textarea placeholder="Write an internal message..." value={newChat} onChange={(e) => setNewChat(e.target.value)} />
                    <Button className="self-end" onClick={addChat}>Post</Button>
                  </div>
                  <div className="space-y-2 max-h-[320px] overflow-auto">
                    {selectedMessages.map((m) => (
                      <div key={m.id} className="rounded border p-3">
                        <p className="text-sm whitespace-pre-line">{m.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    {selectedMessages.length === 0 && <p className="text-sm text-muted-foreground">No chat messages yet.</p>}
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
                    <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title" />
                    <Select value={newTaskAssignee || 'none'} onValueChange={(v) => setNewTaskAssignee(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Assign developer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {personnel.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={addTask}>Add Task</Button>
                  </div>
                  <div className="space-y-2">
                    {selectedTasks.map((task) => (
                      <div key={task.id} className="rounded border p-3 flex items-center justify-between gap-3">
                        <p className="font-medium text-sm">{task.title}</p>
                        <div className="flex items-center gap-2">
                          <Select value={task.status} onValueChange={(v) => updateTaskStatus(task, v)}>
                            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TASK_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setTaskDeleteConfirm({ id: task.id, title: task.title })}
                            title="Remove task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {selectedTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
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
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              Remove task <strong>{taskDeleteConfirm?.title}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeTaskDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{url}</a> : <p className="text-sm text-muted-foreground">N/A</p>}
    </div>
  );
}

function ProjectCredentials({ metadata }: { metadata: Record<string, unknown> | null }) {
  const credentials = parseCredentialRows(metadata);
  return (
    <div className="rounded border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground">Credentials</p>
      {credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">N/A</p>
      ) : (
        <ul className="mt-2 space-y-2">
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
      return { label: String(row.label || 'Credential'), value: String(row.value || '') };
    })
    .filter((x) => x.value.trim());
}

