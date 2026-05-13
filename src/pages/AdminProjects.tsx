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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { CloudGoogleDriveUpload } from '@/components/CloudGoogleDriveUpload';
import { CloudBoxUpload } from '@/components/CloudBoxUpload';
import { CountrySelect } from '@/components/CountrySelect';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { canonicalCountryNameOrLegacy } from '@/lib/countries';
import { canonicalTimezoneOrLegacy, suggestedTimezoneForCountry } from '@/lib/timezones';
import {
  AccountRef,
  ClientRef,
  loadProjectDependencies,
  PersonnelRef,
  ProjectChatMessage,
  ProjectRecord,
  ProjectScreenshot,
  ProjectTask,
  SOURCE_STORAGE_PROVIDER_OPTIONS,
  toCsv,
} from '@/lib/projects';
import { Calendar, MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2, FolderKanban, Link2, Clock } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { LabeledLinksEditor } from '@/components/LabeledLinksEditor';
import { LabeledLinksListWithCopy, UrlFieldWithCopy } from '@/components/LabeledLinksListWithCopy';
import { CopyDescriptionButton } from '@/components/CopyDescriptionButton';
import { TagChipsInput } from '@/components/TagChipsInput';
import type { LabeledLink } from '@/lib/taskPool';
import { parseLabeledLinks, serializeLabeledLinks } from '@/lib/taskPool';

const STATUS_OPTIONS = ['planning', 'active', 'blocked', 'qa', 'completed', 'cancelled'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;
const TASK_STATUS_OPTIONS = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const;
const MAIN_STACK_OPTIONS = ['angular', 'react', 'react_native', 'vue', 'nextjs', 'nodejs', 'laravel', 'django', 'flutter', 'other'] as const;
const PROJECT_SOURCE_OPTIONS = ['upwork', 'freelancer', 'job_broker', 'linkedin', 'other_job_site', 'friend', 'discord_job_channel', 'telegram_channel', 'teams', 'facebook', 'github'] as const;

type PendingProjectDelete =
  | { kind: 'project'; id: string; name: string }
  | { kind: 'task'; id: string; title: string }
  | { kind: 'chat'; id: string; preview: string };

const emptyForm = {
  name: '',
  description: '',
  projectSource: '',
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
  deadline: '',
  budgetType: 'fixed',
  budgetAmount: '',
  currency: 'USD',
  githubUrl: '',
  publishedLinks: [] as LabeledLink[],
  screenshotUrls: [] as string[],
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

export default function AdminProjects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterClientId = searchParams.get('client');

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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newChat, setNewChat] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingProjectDelete | null>(null);
  const [taskPublishedEdit, setTaskPublishedEdit] = useState<null | { id: string; title: string; links: LabeledLink[] }>(null);
  const [savingTaskLinks, setSavingTaskLinks] = useState(false);

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
    if (screenshotsRes.error) toast({ title: 'Error loading screenshots', description: screenshotsRes.error.message, variant: 'destructive' });
    if (tasksRes.error) toast({ title: 'Error loading tasks', description: tasksRes.error.message, variant: 'destructive' });
    if (messagesRes.error) toast({ title: 'Error loading chat', description: messagesRes.error.message, variant: 'destructive' });
    if (deps.error) toast({ title: 'Error loading references', description: deps.error.message, variant: 'destructive' });

    setProjects((projectsRes.data || []) as ProjectRecord[]);
    setScreenshots((screenshotsRes.data || []) as ProjectScreenshot[]);
    setTasks((tasksRes.data || []) as ProjectTask[]);
    setMessages((messagesRes.data || []) as ProjectChatMessage[]);
    setClients(deps.clients);
    setAccounts(deps.accounts);
    setPersonnel(deps.personnel);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const pid = searchParams.get('project');
    if (!pid || projects.length === 0) return;
    if (projects.some((p) => p.id === pid)) setSelectedProjectId(pid);
  }, [searchParams, projects]);

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (filterClientId) {
      list = list.filter((p) => p.client_id === filterClientId);
    }
    const q = searchInput.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const client = clients.find((c) => c.id === p.client_id);
      const account = accounts.find((a) => a.id === p.account_id);
      const blob = [
        p.name,
        p.description,
        p.project_source,
        p.main_stack,
        p.skillset_csv,
        p.tags_csv,
        p.status,
        p.priority,
        p.client_name_override,
        p.client_country,
        p.client_timezone,
        p.github_url,
        p.source_storage_url,
        ...parseLabeledLinks(p.published_links, null, 'Link').flatMap((l) => [l.label, l.url]),
        client ? `${client.first_name} ${client.last_name} ${client.company_name || ''}` : '',
        account ? `${account.platform} ${account.username}` : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [projects, searchInput, clients, accounts, filterClientId]);

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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (project: ProjectRecord) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      description: project.description || '',
      projectSource: project.project_source || '',
      mainStack: project.main_stack || '',
      skillsetTags: (project.skillset_csv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      tagsTags: (project.tags_csv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      status: project.status,
      priority: project.priority,
      clientId: project.client_id || '',
      clientNameOverride: project.client_name_override || '',
      clientCountry: canonicalCountryNameOrLegacy(project.client_country || ''),
      clientTimezone: canonicalTimezoneOrLegacy(project.client_timezone || ''),
      accountId: project.account_id || '',
      chatHistory: project.chat_history || '',
      metadataJson: project.metadata_json ? JSON.stringify(project.metadata_json, null, 2) : '{}',
      credentialsText: credentialsToText(credentialsFromMetadata(project.metadata_json)),
      initialDocumentUrl: project.initial_document_url || '',
      sourceStorageType: project.source_storage_type,
      sourceStorageUrl: project.source_storage_url || '',
      deadline: project.deadline ? project.deadline.slice(0, 16) : '',
      budgetType: project.budget_type,
      budgetAmount: project.budget_amount?.toString() || '',
      currency: project.currency || 'USD',
      githubUrl: project.github_url || '',
      publishedLinks: parseLabeledLinks(project.published_links, null, 'Link'),
      screenshotUrls: screenshots.filter((s) => s.project_id === project.id).map((s) => s.image_url),
    });
    setDialogOpen(true);
  };

  const saveProject = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Project name is required', variant: 'destructive' });
      return;
    }
    if (!form.sourceStorageUrl.trim()) {
      toast({ title: 'Source storage URL is required', description: 'Please add your Drive folder link.', variant: 'destructive' });
      return;
    }

    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(form.metadataJson || '{}');
    } catch {
      toast({ title: 'Metadata JSON is invalid', variant: 'destructive' });
      return;
    }

    const credentialRows = parseCredentialsFromText(form.credentialsText);
    const normalizedMetadata = { ...metadata } as Record<string, unknown>;
    if (credentialRows.length > 0) normalizedMetadata.credentials = credentialRows;
    else delete normalizedMetadata.credentials;
    const published = serializeLabeledLinks(form.publishedLinks ?? []);
    setSaving(true);
    const payload = {
      user_id: user?.id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      project_source: form.projectSource.trim() || null,
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
      metadata_json: normalizedMetadata,
      initial_document_url: form.initialDocumentUrl.trim() || null,
      source_storage_type: form.sourceStorageType,
      source_storage_url: form.sourceStorageUrl.trim(),
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      budget_type: form.budgetType,
      budget_amount: form.budgetAmount ? Number(form.budgetAmount) : null,
      currency: form.currency.trim() || 'USD',
      github_url: form.githubUrl.trim() || null,
      published_links: published,
      updated_at: new Date().toISOString(),
    };

    const saveResult = editingId
      ? await supabase.from('projects').update(payload).eq('id', editingId).select('id').single()
      : await supabase.from('projects').insert(payload).select('id').single();

    if (saveResult.error) {
      toast({ title: 'Save failed', description: saveResult.error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    const projectId = saveResult.data.id as string;

    await supabase.from('project_screenshots').delete().eq('project_id', projectId);
    if (form.screenshotUrls.length > 0) {
      const insertRows = form.screenshotUrls.map((url, index) => ({
        project_id: projectId,
        image_url: url,
        sort_order: index,
      }));
      const screenshotsInsert = await supabase.from('project_screenshots').insert(insertRows);
      if (screenshotsInsert.error) {
        toast({ title: 'Screenshots save warning', description: screenshotsInsert.error.message, variant: 'destructive' });
      }
    }

    setSaving(false);
    setDialogOpen(false);
    toast({ title: editingId ? 'Project updated' : 'Project created' });
    fetchAll();
  };

  const deleteProject = async (id: string) => {
    const res = await supabase.from('projects').delete().eq('id', id);
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    if (selectedProjectId === id) setSelectedProjectId(null);
    toast({ title: 'Project deleted' });
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
      toast({ title: 'Task create failed', description: res.error?.message || 'Unknown error', variant: 'destructive' });
      return;
    }
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setTasks((prev) => [res.data as ProjectTask, ...prev]);
  };

  const saveTaskPublishedLinks = async () => {
    if (!taskPublishedEdit) return;
    setSavingTaskLinks(true);
    const serialized = serializeLabeledLinks(taskPublishedEdit.links);
    const res = await supabase
      .from('project_tasks')
      .update({ published_links: serialized, updated_at: new Date().toISOString() })
      .eq('id', taskPublishedEdit.id)
      .select('*')
      .maybeSingle();
    setSavingTaskLinks(false);
    if (res.error || !res.data) {
      toast({ title: 'Save failed', description: res.error?.message || 'Unknown error', variant: 'destructive' });
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === taskPublishedEdit.id ? (res.data as ProjectTask) : t)));
    setTaskPublishedEdit(null);
    toast({ title: 'Published links saved' });
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

  const addChatMessage = async () => {
    if (!selectedProject || !newChat.trim() || !user?.id) return;
    const res = await supabase.from('project_chat_messages').insert({
      project_id: selectedProject.id,
      author_user_id: user.id,
      message: newChat.trim(),
    }).select('*').single();
    if (res.error || !res.data) {
      toast({ title: 'Message failed', description: res.error?.message || 'Unknown error', variant: 'destructive' });
      return;
    }
    setMessages((prev) => [res.data as ProjectChatMessage, ...prev]);
    setNewChat('');
  };

  const deleteChatMessage = async (id: string) => {
    const res = await supabase.from('project_chat_messages').delete().eq('id', id);
    if (res.error) {
      toast({ title: 'Delete message failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const executePendingDelete = async () => {
    if (!pendingDelete) return;
    const p = pendingDelete;
    setPendingDelete(null);
    if (p.kind === 'project') await deleteProject(p.id);
    else if (p.kind === 'task') await deleteTask(p.id);
    else await deleteChatMessage(p.id);
  };

  const projectClientLabel = (project: ProjectRecord) => {
    if (project.client_id) {
      const c = clients.find((x) => x.id === project.client_id);
      if (c) return `${c.first_name} ${c.last_name}${c.company_name ? ` (${c.company_name})` : ''}`;
    }
    return project.client_name_override || 'N/A';
  };

  const projectAccountLabel = (project: ProjectRecord) => {
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Manage Projects</h2>
          <p className="text-sm text-muted-foreground">Project pool with client/account linkage, screenshots, chat, and developer tasks.</p>
        </div>
        <div className="flex w-full max-w-2xl gap-3">
          <ModuleSearchBar value={searchInput} onChange={setSearchInput} placeholder="Search projects, clients, tags, statuses..." id="admin-project-search" />
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
          <Button className="gap-2 shrink-0" onClick={openCreate}><Plus className="h-4 w-4" />New</Button>
        </div>
      </div>

      {filterClientId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Showing projects linked to this client only
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
                <div
                  key={project.id}
                  className={`w-full overflow-hidden rounded border transition hover:border-primary/40 ${selectedProjectId === project.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground line-clamp-1">{project.name}</p>
                      <Badge variant="secondary" className="capitalize">{project.status}</Badge>
                    </div>
                    {project.project_source ? <p className="mt-1 text-xs text-muted-foreground capitalize">Project source(from): {project.project_source.replace('_', ' ')}</p> : null}
                    {project.main_stack ? <p className="mt-1 text-xs text-primary/90 capitalize">Stack: {project.main_stack.replace('_', ' ')}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{project.description || 'No description'}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(project.tags_csv || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{projectClientLabel(project)}</span>
                      <span>{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}</span>
                    </div>
                  </button>
                  {project.client_id ? (
                    <div className="border-t border-border bg-muted/25 px-3 py-1.5">
                      <Link
                        to={`/admin/clients?client=${project.client_id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open linked client in Clients
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
              {displayProjects.length === 0 && <p className="text-sm text-muted-foreground">No projects found.</p>}
            </CardContent>
          </Card>
        ) : null}

        <Card className={showCategoriesPanel && showProjectsPanel ? 'lg:col-span-2' : showCategoriesPanel || showProjectsPanel ? 'lg:col-span-2' : 'lg:col-span-1'}>
          {!selectedProject ? (
            <CardContent className="py-12 text-center text-muted-foreground">Select a project to view details.</CardContent>
          ) : (
            <>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{selectedProject.name}</CardTitle>
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <p className="text-sm text-muted-foreground flex-1 min-w-0">{selectedProject.description || 'No description added.'}</p>
                      <CopyDescriptionButton description={selectedProject.description} />
                    </div>
                    {selectedProject.main_stack ? <Badge className="mt-2 capitalize">{selectedProject.main_stack.replace('_', ' ')}</Badge> : null}
                    {selectedProject.project_source ? <Badge variant="outline" className="mt-2 ml-2 capitalize">Project source(from): {selectedProject.project_source.replace('_', ' ')}</Badge> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(selectedProject)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive"
                      onClick={() => setPendingDelete({ kind: 'project', id: selectedProject.id, name: selectedProject.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCard
                        icon={FolderKanban}
                        title="Client"
                        value={projectClientLabel(selectedProject)}
                        action={
                          selectedProject.client_id ? (
                            <Link
                              to={`/admin/clients?client=${selectedProject.client_id}`}
                              className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
                            >
                              Open in Clients
                            </Link>
                          ) : undefined
                        }
                      />
                      <InfoCard icon={Link2} title="Account" value={projectAccountLabel(selectedProject)} />
                      <InfoCard icon={Clock} title="Deadline" value={selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleString() : 'Not set'} />
                      <InfoCard icon={Calendar} title="Budget" value={selectedProject.budget_amount ? `${selectedProject.currency} ${selectedProject.budget_amount} (${selectedProject.budget_type})` : 'Not set'} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Skillset</p>
                      <div className="flex flex-wrap gap-1.5">{(selectedProject.skillset_csv || '').split(',').map((s) => s.trim()).filter(Boolean).map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <UrlFieldWithCopy label="Source Storage" url={selectedProject.source_storage_url} />
                      <UrlFieldWithCopy label="GitHub" url={selectedProject.github_url} />
                      <UrlFieldWithCopy label="Initial Document" url={selectedProject.initial_document_url} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Published / live site / app store</p>
                      <LabeledLinksListWithCopy
                        title=""
                        links={parseLabeledLinks(selectedProject.published_links, null, 'Link')}
                        emptyHint="No published links yet. Click Edit on this project and use the highlighted “Published / live site / app store links” section (under GitHub)."
                      />
                    </div>
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
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Credentials</p>
                      {credentialsFromMetadata(selectedProject.metadata_json).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No credentials saved.</p>
                      ) : (
                        <ul className="space-y-2">
                          {credentialsFromMetadata(selectedProject.metadata_json).map((c, i) => (
                            <li key={`${c.label}-${i}`} className="rounded border bg-muted/20 p-2">
                              <p className="text-xs text-muted-foreground">{c.label}</p>
                              <p className="text-sm break-all">{c.value}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Metadata</p>
                      <pre className="rounded border bg-muted/40 p-3 text-xs overflow-auto">{JSON.stringify(selectedProject.metadata_json || {}, null, 2)}</pre>
                    </div>
                    {selectedProject.chat_history && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Legacy Chat History</p>
                        <p className="text-sm whitespace-pre-line text-muted-foreground">{selectedProject.chat_history}</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="screenshots" className="space-y-4">
                    {selectedScreenshots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No screenshots uploaded yet.</p>
                    ) : (
                      <div className="px-12">
                        <Carousel opts={{ align: 'start' }}>
                          <CarouselContent>
                            {selectedScreenshots.map((s) => (
                              <CarouselItem key={s.id}>
                                <div className="overflow-hidden rounded border bg-muted/20">
                                  <img src={s.image_url} alt={s.caption || 'Screenshot'} className="h-[320px] w-full object-cover" />
                                  {s.caption && <p className="p-2 text-sm text-muted-foreground">{s.caption}</p>}
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
                      <Textarea placeholder="Write an internal project message..." value={newChat} onChange={(e) => setNewChat(e.target.value)} />
                      <Button className="self-end gap-1" onClick={addChatMessage}><MessageSquare className="h-4 w-4" />Post</Button>
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
                              title="Delete message"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                      {selectedMessages.length === 0 && <p className="text-sm text-muted-foreground">No chat messages yet.</p>}
                    </div>
                  </TabsContent>

                  <TabsContent value="tasks" className="space-y-3">
                    {selectedProject ? (
                      <div className="rounded-lg border bg-muted/25 p-3 space-y-2">
                        <p className="text-sm font-semibold">Project-wide published links</p>
                        <p className="text-xs text-muted-foreground">
                          Same links as on the Overview tab. Use per-task links below for URLs that belong to a single task.
                        </p>
                        <LabeledLinksListWithCopy
                          embedded
                          title=""
                          links={parseLabeledLinks(selectedProject.published_links, null, 'Link')}
                          emptyHint="No project-wide links yet. Add them via Edit on this project (highlighted block under GitHub)."
                        />
                      </div>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
                      <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title" />
                      <Select value={newTaskAssignee || 'none'} onValueChange={(v) => setNewTaskAssignee(v === 'none' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Assign developer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {personnel.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={addTask}>Add Task</Button>
                    </div>
                    <div className="space-y-2">
                      {selectedTasks.map((task) => {
                        const assignee = personnel.find((p) => p.id === task.assignee_personnel_id);
                        return (
                          <div key={task.id} className="rounded border p-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">{task.title}</p>
                              <p className="text-xs text-muted-foreground">{assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Unassigned'}</p>
                          <LabeledLinksListWithCopy
                            embedded
                            title="Published links (this task)"
                            links={parseLabeledLinks(task.published_links, null, 'Link')}
                            emptyHint="No links for this task — click the chain icon to add."
                          />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 shrink-0"
                                title="Edit published links"
                                onClick={() =>
                                  setTaskPublishedEdit({
                                    id: task.id,
                                    title: task.title,
                                    links: parseLabeledLinks(task.published_links, null, 'Link'),
                                  })
                                }
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
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
                                onClick={() => setPendingDelete({ kind: 'task', id: task.id, title: task.title })}
                                title="Remove task"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {selectedTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit project' : 'Create project'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Project name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Description</Label>
                <CopyDescriptionButton description={form.description} />
              </div>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Project source(from)</Label>
              <Input
                list="project-source-options"
                value={form.projectSource}
                onChange={(e) => setForm((p) => ({ ...p, projectSource: e.target.value }))}
                placeholder="e.g. upwork, linkedin, friend, discord_job_channel"
              />
              <datalist id="project-source-options">
                {PROJECT_SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Main stack category</Label>
              <Input
                list="main-stack-options"
                value={form.mainStack}
                onChange={(e) => setForm((p) => ({ ...p, mainStack: e.target.value }))}
                placeholder="e.g. angular, react_native, svelte, asp.net"
              />
              <datalist id="main-stack-options">
                {MAIN_STACK_OPTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">Choose a suggestion or type your own new stack name.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <TagChipsInput label="Skillset" values={form.skillsetTags} onChange={(next) => setForm((p) => ({ ...p, skillsetTags: next }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <TagChipsInput label="Tags" values={form.tagsTags} onChange={(next) => setForm((p) => ({ ...p, tagsTags: next }))} />
            </div>

            <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>

            <div className="space-y-2"><Label>Client (linked)</Label><Select value={form.clientId} onValueChange={(v) => {
              const selected = clients.find((c) => c.id === v);
              setForm((p) => {
                if (v === 'none') {
                  return { ...p, clientId: '', clientCountry: p.clientCountry, clientTimezone: p.clientTimezone };
                }
                const newCountry = canonicalCountryNameOrLegacy(selected?.country || '') || p.clientCountry;
                const fromClientTz = canonicalTimezoneOrLegacy(selected?.timezone || '');
                const fromCountry = suggestedTimezoneForCountry(newCountry);
                return {
                  ...p,
                  clientId: v,
                  clientCountry: newCountry,
                  clientTimezone: fromClientTz || fromCountry || '',
                };
              });
            }}><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.company_name ? ` (${c.company_name})` : ''}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Client name (manual)</Label><Input value={form.clientNameOverride} onChange={(e) => setForm((p) => ({ ...p, clientNameOverride: e.target.value }))} placeholder="Use when not in client module" /></div>
            <CountrySelect label="Client country" value={form.clientCountry} onChange={(clientCountry) => setForm((p) => {
              const suggested = suggestedTimezoneForCountry(clientCountry);
              return { ...p, clientCountry, ...(suggested ? { clientTimezone: suggested } : {}) };
            })} />
            <TimezoneSelect label="Client timezone" value={form.clientTimezone} onChange={(clientTimezone) => setForm((p) => ({ ...p, clientTimezone }))} />

            <div className="space-y-2"><Label>Account linkage</Label><Select value={form.accountId} onValueChange={(v) => setForm((p) => ({ ...p, accountId: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.platform} @{a.username}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Deadline</Label><Input type="datetime-local" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} /></div>

            <div className="space-y-2"><Label>Budget type</Label><Select value={form.budgetType} onValueChange={(v) => setForm((p) => ({ ...p, budgetType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">fixed</SelectItem><SelectItem value="hourly">hourly</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Budget amount</Label><Input type="number" value={form.budgetAmount} onChange={(e) => setForm((p) => ({ ...p, budgetAmount: e.target.value }))} /></div>

            <div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} /></div>
            <div className="space-y-2"><Label>GitHub link</Label><Input value={form.githubUrl} onChange={(e) => setForm((p) => ({ ...p, githubUrl: e.target.value }))} placeholder="https://github.com/..." /></div>
            <div className="space-y-2 md:col-span-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <Label>Published / live site / app store links</Label>
              <p className="text-xs text-muted-foreground mt-1">Website, Google Play, App Store, etc. (optional)</p>
              <div className="mt-2">
                <LabeledLinksEditor
                  links={form.publishedLinks}
                  onChange={(links) => setForm((p) => ({ ...p, publishedLinks: links }))}
                  newRowLabel="Link"
                />
              </div>
            </div>

            <div className="space-y-2"><Label>Source storage type</Label><Select value={form.sourceStorageType} onValueChange={(v) => setForm((p) => ({ ...p, sourceStorageType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCE_STORAGE_PROVIDER_OPTIONS.map((provider) => <SelectItem key={provider} value={provider}>{provider}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Source storage URL *</Label><Input value={form.sourceStorageUrl} onChange={(e) => setForm((p) => ({ ...p, sourceStorageUrl: e.target.value }))} placeholder="Drive folder link" /></div>
            {(form.sourceStorageType === 'google_drive' || form.sourceStorageType === 'drive') && (
              <div className="space-y-3 md:col-span-2">
                <CloudGoogleDriveUpload
                  title="Upload screenshots to Google Drive"
                  accept="image/*"
                  onUrlAdded={(url) => setForm((p) => ({ ...p, screenshotUrls: [...p.screenshotUrls, url] }))}
                />
                <CloudGoogleDriveUpload
                  title="Upload source file to Google Drive"
                  accept="*/*"
                  onUrlAdded={(url) =>
                    setForm((p) => {
                      if (!p.sourceStorageUrl.trim()) return { ...p, sourceStorageUrl: url };
                      toast({
                        title: 'Drive file uploaded',
                        description: `Primary URL is already set. Use this link if needed: ${url}`,
                        duration: 12_000,
                      });
                      return p;
                    })
                  }
                />
              </div>
            )}
            {form.sourceStorageType === 'box' && (
              <div className="space-y-3 md:col-span-2">
                <CloudBoxUpload
                  title="Upload screenshots to Box"
                  accept="image/*"
                  onUrlAdded={(url) => setForm((p) => ({ ...p, screenshotUrls: [...p.screenshotUrls, url] }))}
                />
                <CloudBoxUpload
                  title="Upload source file to Box"
                  accept="*/*"
                  onUrlAdded={(url) =>
                    setForm((p) => {
                      if (!p.sourceStorageUrl.trim()) return { ...p, sourceStorageUrl: url };
                      toast({
                        title: 'Box file uploaded',
                        description: `Primary URL is already set. Use this link if needed: ${url}`,
                        duration: 12_000,
                      });
                      return p;
                    })
                  }
                />
              </div>
            )}

            <div className="space-y-2"><Label>Initial document URL (PDF/DOCX)</Label><Input value={form.initialDocumentUrl} onChange={(e) => setForm((p) => ({ ...p, initialDocumentUrl: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Legacy chat history</Label><Textarea value={form.chatHistory} onChange={(e) => setForm((p) => ({ ...p, chatHistory: e.target.value }))} /></div>

            <div className="space-y-2 md:col-span-2">
              <Label>Credentials (one per line)</Label>
              <Textarea
                className="min-h-[110px]"
                value={form.credentialsText}
                onChange={(e) => setForm((p) => ({ ...p, credentialsText: e.target.value }))}
                placeholder="Hostinger | https://hpanel.hostinger.com&#10;cPanel user | john_doe&#10;SSH private key | -----BEGIN OPENSSH PRIVATE KEY-----..."
              />
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Related metadata (JSON)</Label><Textarea className="font-mono min-h-[120px]" value={form.metadataJson} onChange={(e) => setForm((p) => ({ ...p, metadataJson: e.target.value }))} /></div>

            <div className="space-y-2 md:col-span-2">
              <Label>Screenshots (slider source)</Label>
              <Textarea
                className="min-h-[110px]"
                value={form.screenshotUrls.join('\n')}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    screenshotUrls: e.target.value
                      .split('\n')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="Paste screenshot links (one URL per line, e.g. Google Drive public image links)"
              />
              <p className="text-xs text-muted-foreground">
                Link-only mode: files stay in Google Drive (or your cloud storage). We save only URLs in database.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveProject} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!taskPublishedEdit} onOpenChange={(open) => !open && setTaskPublishedEdit(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Published links — {taskPublishedEdit?.title}</DialogTitle>
          </DialogHeader>
          {taskPublishedEdit ? (
            <>
              <p className="text-xs text-muted-foreground">Website, app store listings, or other public URLs.</p>
              <LabeledLinksEditor
                links={taskPublishedEdit.links}
                onChange={(links) => setTaskPublishedEdit((prev) => (prev ? { ...prev, links } : prev))}
                newRowLabel="Link"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setTaskPublishedEdit(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveTaskPublishedLinks} disabled={savingTaskLinks}>
                  {savingTaskLinks ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === 'project' && 'Delete project'}
              {pendingDelete?.kind === 'task' && 'Delete task'}
              {pendingDelete?.kind === 'chat' && 'Delete chat message'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'project' && (
                <>
                  Are you sure you want to delete <strong>{pendingDelete.name}</strong>? Related screenshots, chat, and tasks will be removed. This cannot be undone.
                </>
              )}
              {pendingDelete?.kind === 'task' && (
                <>
                  Remove task <strong>{pendingDelete.title}</strong>? This cannot be undone.
                </>
              )}
              {pendingDelete?.kind === 'chat' && (
                <>
                  Permanently delete this message? <span className="block mt-2 text-foreground/80">&ldquo;{pendingDelete.preview}&rdquo;</span>
                </>
              )}
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
      <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{title}</p>
      <p className="text-sm font-medium text-foreground mt-1">{value}</p>
      {action}
    </div>
  );
}
