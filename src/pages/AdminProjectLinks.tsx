import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ProjectsSectionNav } from '@/components/ProjectsSectionNav';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import ImageGalleryUpload from '@/components/ImageGalleryUpload';
import ScreenshotCarousel from '@/components/ScreenshotCarousel';
import { TagChipsInput } from '@/components/TagChipsInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, ExternalLink, Pencil, Plus, Trash2, Pin } from 'lucide-react';
import {
  DEFAULT_PROJECT_LINK_SKILLS,
  mergeSkillTags,
  orderedSkillTagKeys,
  parseSkillTagsCsv,
  skillTagFromMainStack,
} from '@/lib/projectLinkSkills';
import {
  fetchProjectLinks,
  filterProjectLinks,
  normalizeProjectLinkRow,
  plainOverviewFromHtml,
  type ProjectLinkRecord,
  type ProjectLinkSourceType,
} from '@/lib/projectLinks';
import { normalizeExternalUrl } from '@/lib/externalUrl';
import { parseLabeledLinks } from '@/lib/taskPool';

type ProjectOption = {
  id: string;
  name: string;
  description: string | null;
  main_stack: string | null;
  skillset_csv: string | null;
  tags_csv: string | null;
  published_links: unknown;
};

const emptyForm = {
  title: '',
  url: '',
  overview: '',
  skillTags: [] as string[],
  sourceType: 'own_project' as ProjectLinkSourceType,
  sourceProjectId: '' as string,
  sourceNote: '',
  screenshots: [] as string[],
  isPinned: false,
};

export default function AdminProjectLinks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ProjectLinkRecord[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectLinkRecord | null>(null);
  const [detail, setDetail] = useState<ProjectLinkRecord | null>(null);

  const refresh = async () => {
    const [linksRes, projectsRes] = await Promise.all([
      fetchProjectLinks(),
      supabase
        .from('projects')
        .select('id, name, description, main_stack, skillset_csv, tags_csv, published_links')
        .order('name'),
    ]);
    if (linksRes.error) toast({ title: 'Error loading project links', description: linksRes.error, variant: 'destructive' });
    else setItems(linksRes.data);
    if (!projectsRes.error) setProjects((projectsRes.data || []) as ProjectOption[]);
    setLoading(false);
  };

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const applySourceProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      setForm((f) => ({ ...f, sourceProjectId: projectId }));
      return;
    }
    const published = parseLabeledLinks(project.published_links, null, 'Link').find((l) => l.url.trim());
    const skills = mergeSkillTags(
      skillTagFromMainStack(project.main_stack) ? [skillTagFromMainStack(project.main_stack)!] : [],
      parseSkillTagsCsv(project.skillset_csv),
      parseSkillTagsCsv(project.tags_csv),
    );
    setForm((f) => ({
      ...f,
      sourceType: 'own_project',
      sourceProjectId: projectId,
      // Prefill only empty fields so edits are not wiped.
      title: f.title.trim() || project.name,
      url: f.url.trim() || (published ? normalizeExternalUrl(published.url) || published.url : ''),
      overview: f.overview.trim() || plainOverviewFromHtml(project.description),
      skillTags: f.skillTags.length > 0 ? f.skillTags : skills,
      sourceNote: f.sourceNote.trim() || `From project: ${project.name}`,
    }));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const skillKeys = useMemo(() => {
    const present = new Set<string>();
    for (const item of items) for (const t of item.skill_tags) present.add(t);
    return orderedSkillTagKeys(present);
  }, [items]);

  const filtered = useMemo(
    () => filterProjectLinks(items, { search: searchInput, skill: selectedSkill }),
    [items, searchInput, selectedSkill],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: ProjectLinkRecord) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      url: item.url,
      overview: item.overview || '',
      skillTags: [...item.skill_tags],
      sourceType: item.source_type,
      sourceProjectId: item.source_project_id || '',
      sourceNote: item.source_note || '',
      screenshots: [...item.screenshots],
      isPinned: item.is_pinned,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user?.id) return;
    const title = form.title.trim();
    const url = normalizeExternalUrl(form.url.trim()) || form.url.trim();
    if (!title || !url) {
      toast({ title: 'Title and URL are required', variant: 'destructive' });
      return;
    }
    if (form.sourceType === 'own_project' && !form.sourceProjectId) {
      toast({
        title: 'Select a project',
        description: 'Pick which project from your Projects list this link comes from.',
        variant: 'destructive',
      });
      return;
    }
    if (form.sourceType === 'external' && !form.sourceNote.trim()) {
      toast({ title: 'Source note required', description: 'Say where you got this external link.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const existing = editingId ? items.find((x) => x.id === editingId) : null;
    const linkedName = form.sourceProjectId ? projectNameById.get(form.sourceProjectId) : null;
    const payload = {
      user_id: user.id,
      title,
      url,
      overview: form.overview.trim() || null,
      skill_tags: form.skillTags,
      source_type: form.sourceType,
      source_project_id: form.sourceType === 'own_project' ? form.sourceProjectId : null,
      // Keep pool import link on edit; clear if switched to external.
      source_pool_item_id:
        form.sourceType === 'own_project' ? existing?.source_pool_item_id ?? null : null,
      source_note:
        form.sourceType === 'external'
          ? form.sourceNote.trim()
          : form.sourceNote.trim() || (linkedName ? `From project: ${linkedName}` : null),
      screenshots: form.screenshots,
      is_pinned: form.isPinned,
      updated_at: new Date().toISOString(),
    };

    const res = editingId
      ? await supabase.from('project_links').update(payload).eq('id', editingId).select('*').single()
      : await supabase.from('project_links').insert(payload).select('*').single();

    setSaving(false);
    if (res.error || !res.data) {
      toast({ title: 'Save failed', description: res.error?.message, variant: 'destructive' });
      return;
    }
    const row = normalizeProjectLinkRow(res.data as Record<string, unknown>);
    setItems((prev) => {
      if (editingId) return prev.map((x) => (x.id === editingId ? row : x));
      return [row, ...prev];
    });
    setDialogOpen(false);
    toast({ title: editingId ? 'Project link updated' : 'Project link created' });
  };

  const remove = async () => {
    if (!deleteConfirm) return;
    const res = await supabase.from('project_links').delete().eq('id', deleteConfirm.id);
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== deleteConfirm.id));
    if (detail?.id === deleteConfirm.id) setDetail(null);
    setDeleteConfirm(null);
    toast({ title: 'Project link removed' });
  };

  const copyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: url });
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <ProjectsSectionNav base="admin" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Project Links</h1>
            <p className="text-sm text-muted-foreground">
              Manage client-shareable demos and live/store URLs, tagged by skill, with screenshots.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Add link
        </Button>
      </div>

      <ModuleSearchBar
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search title, URL, overview, tags…"
      />

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={selectedSkill == null ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => setSelectedSkill(null)}
        >
          All skills
        </Button>
        {skillKeys.map((skill) => (
          <Button
            key={skill}
            type="button"
            size="sm"
            variant={selectedSkill?.toLowerCase() === skill.toLowerCase() ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setSelectedSkill(skill)}
          >
            {skill}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No project links yet. Add one manually, or import when you complete a task with published links.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => setDetail(item)}
            >
              <CardHeader className="space-y-2 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                  {item.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.skill_tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.screenshots[0] ? (
                  <img
                    src={item.screenshots[0]}
                    alt=""
                    className="aspect-[16/10] w-full rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground">
                    No screenshot
                  </div>
                )}
                <p className="line-clamp-2 text-sm text-muted-foreground">{item.overview || 'No overview'}</p>
                {item.source_type === 'own_project' && item.source_project_id ? (
                  <p className="text-xs text-muted-foreground">
                    Project: {projectNameById.get(item.source_project_id) || 'Linked project'}
                  </p>
                ) : item.source_type === 'external' ? (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    External: {item.source_note || '—'}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copyUrl(item.url)}>
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openEdit(item)}>
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs text-destructive"
                    onClick={() => setDeleteConfirm(item)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit project link' : 'Add project link'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pl-title">Title</Label>
              <Input id="pl-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-url">URL</Label>
              <Input
                id="pl-url"
                placeholder="https://…"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-overview">Short overview</Label>
              <Textarea
                id="pl-overview"
                rows={3}
                placeholder="What was built, what it connects to…"
                value={form.overview}
                onChange={(e) => setForm((f) => ({ ...f, overview: e.target.value }))}
              />
            </div>
            <TagChipsInput
              label="Skills / categories"
              values={form.skillTags}
              onChange={(skillTags) => setForm((f) => ({ ...f, skillTags }))}
              suggestions={DEFAULT_PROJECT_LINK_SKILLS}
              placeholder="Type a skill or pick a default"
            />
            <div className="space-y-2">
              <Label>Where is this link from?</Label>
              <Select
                value={form.sourceType}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    sourceType: v as ProjectLinkSourceType,
                    sourceProjectId: v === 'external' ? '' : f.sourceProjectId,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own_project">One of my Projects</SelectItem>
                  <SelectItem value="external">External / not mine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.sourceType === 'own_project' ? (
              <div className="space-y-2">
                <Label>Project *</Label>
                <Select
                  value={form.sourceProjectId || undefined}
                  onValueChange={(v) => applySourceProject(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={projects.length ? 'Select a project you already added…' : 'No projects yet'} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        Add a project under Manage → Projects first
                      </SelectItem>
                    ) : (
                      projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the project from your Projects list. Empty title / URL / skills can autofill from that project.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="pl-note-own">Extra source note (optional)</Label>
                  <Input
                    id="pl-note-own"
                    value={form.sourceNote}
                    onChange={(e) => setForm((f) => ({ ...f, sourceNote: e.target.value }))}
                    placeholder="e.g. Client delivery Q1 2026"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pl-note-ext">Where did you get this link? *</Label>
                <Textarea
                  id="pl-note-ext"
                  rows={2}
                  value={form.sourceNote}
                  onChange={(e) => setForm((f) => ({ ...f, sourceNote: e.target.value }))}
                  placeholder="e.g. Colleague referral / public demo gallery"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Screenshots</Label>
              <ImageGalleryUpload
                urls={form.screenshots}
                onChange={(screenshots) => setForm((f) => ({ ...f, screenshots }))}
                folder="project-links"
                accept="image/*"
                addLabel="Add screenshot"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="pl-pin">Pin to top</Label>
              <Switch
                id="pl-pin"
                checked={form.isPinned}
                onCheckedChange={(isPinned) => setForm((f) => ({ ...f, isPinned }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{detail.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {detail.skill_tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{detail.overview || 'No overview'}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <a href={detail.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                    {detail.url}
                  </a>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={() => copyUrl(detail.url)}>
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Source:{' '}
                  {detail.source_type === 'own_project' ? (
                    <>
                      Project{' '}
                      <strong className="text-foreground">
                        {detail.source_project_id
                          ? projectNameById.get(detail.source_project_id) || 'Linked project'
                          : '(not selected)'}
                      </strong>
                      {detail.source_project_id ? (
                        <>
                          {' · '}
                          <Link to={`/admin/projects?id=${detail.source_project_id}`} className="text-primary hover:underline">
                            Open in Projects
                          </Link>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>External{detail.source_note ? ` — ${detail.source_note}` : ''}</>
                  )}
                  {detail.source_type === 'own_project' && detail.source_note ? (
                    <span className="block mt-1">Note: {detail.source_note}</span>
                  ) : null}
                </p>
                <ScreenshotCarousel
                  slides={detail.screenshots.map((url, i) => ({ id: `${detail.id}-${i}`, image_url: url }))}
                  emptyMessage="No screenshots yet — edit this link to add some."
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => { setDetail(null); openEdit(detail); }}>
                    Edit
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => setDeleteConfirm(detail)}>
                    Delete
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project link?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteConfirm?.title}</strong>? This does not delete the live site — only this share entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
