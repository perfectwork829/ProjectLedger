import { useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Copy, ExternalLink, Pin, Link as LinkIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { filterUsefulLinks } from '@/lib/clientSearch';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  orderedUsefulLinkCategoryKeys,
  usefulLinkCategoryLabel,
  USEFUL_LINK_CATEGORIES,
} from '@/lib/usefulLinksCategories';

interface LinkItem {
  label: string;
  url: string;
}

interface UsefulLink {
  id: string;
  user_id: string;
  title: string;
  category: string;
  purpose: string | null;
  description: string | null;
  how_to_use: string | null;
  links: LinkItem[];
  tags: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

function CopyButton({ value }: { value: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); toast({ title: 'Copied!', description: value }); }}
      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent transition-colors"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

const emptyForm = {
  title: '',
  category: 'general',
  purpose: '',
  description: '' as string,
  how_to_use: '' as string,
  links: [{ label: '', url: '' }] as LinkItem[],
  tags: '',
  is_pinned: false,
};

function parseTagsString(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTagsList(tags: string[]): string {
  return tags.join(', ');
}

export default function AdminUsefulLinks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<UsefulLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [listViewMode, setListViewMode] = useState<'card' | 'list' | 'line' | 'table'>('table');
  /** Current text in the tag input (committed on Enter or comma). */
  const [tagDraft, setTagDraft] = useState('');

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('useful_links')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Error loading help entries', description: error.message, variant: 'destructive' });
    else setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    if (!dialogOpen) setTagDraft('');
  }, [dialogOpen]);

  const set = (key: string, value: string | boolean | LinkItem[]) => setForm(prev => ({ ...prev, [key]: value }));

  const mergeTagsIntoForm = (incoming: string[]) => {
    const existing = parseTagsString(form.tags);
    const seen = new Set(existing.map((t) => t.toLowerCase()));
    for (const raw of incoming) {
      const t = raw.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      existing.push(t);
    }
    set('tags', joinTagsList(existing));
  };

  const removeTagAt = (index: number) => {
    const arr = parseTagsString(form.tags);
    arr.splice(index, 1);
    set('tags', joinTagsList(arr));
  };

  const removeLastTag = () => {
    const arr = parseTagsString(form.tags);
    if (arr.length === 0) return;
    arr.pop();
    set('tags', joinTagsList(arr));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setTagDraft('');
    setDialogOpen(true);
  };

  const openEdit = (item: UsefulLink) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      category: item.category,
      purpose: item.purpose || '',
      description: item.description || '',
      how_to_use: item.how_to_use || '',
      links: item.links.length > 0 ? item.links : [{ label: '', url: '' }],
      tags: item.tags || '',
      is_pinned: item.is_pinned,
    });
    setTagDraft('');
    setDialogOpen(true);
  };

  /** Merge pending tag draft into a comma string (sync, for save payload). */
  const tagsStringForSave = (): string | null => {
    const existing = parseTagsString(form.tags);
    const seen = new Set(existing.map((t) => t.toLowerCase()));
    const pending = tagDraft.trim();
    if (pending) {
      const k = pending.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        existing.push(pending);
      }
    }
    const s = joinTagsList(existing);
    return s || null;
  };

  const handleSave = async () => {
    if (!form.title) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    const tagsPayload = tagsStringForSave();
    setTagDraft('');
    setSaving(true);
    const validLinks = form.links.filter(l => l.url.trim());
    const payload = {
      title: form.title,
      category: form.category,
      purpose: form.purpose || null,
      description: form.description || null,
      how_to_use: form.how_to_use || null,
      links: validLinks,
      tags: tagsPayload,
      is_pinned: form.is_pinned,
      user_id: user!.id,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('useful_links').update(payload).eq('id', editingId);
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Entry updated' });
    } else {
      const { error } = await supabase.from('useful_links').insert(payload);
      if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Entry created' });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchItems();
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('useful_links').delete().eq('id', deleteConfirm.id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Entry deleted' }); fetchItems(); }
    setDeleteConfirm(null);
  };

  const addLink = () => set('links', [...form.links, { label: '', url: '' }]);
  const removeLink = (idx: number) => set('links', form.links.filter((_, i) => i !== idx));
  const updateLink = (idx: number, field: 'label' | 'url', val: string) => {
    const updated = [...form.links];
    updated[idx] = { ...updated[idx], [field]: val };
    set('links', updated);
  };

  const searchFiltered = useMemo(() => filterUsefulLinks(items, searchInput), [items, searchInput]);
  const grouped = useMemo(
    () =>
      searchFiltered.reduce<Record<string, UsefulLink[]>>((acc, item) => {
        const cat = item.category || 'general';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {}),
    [searchFiltered],
  );

  const filteredItems = useMemo(
    () => (selectedCategory ? searchFiltered.filter((i) => i.category === selectedCategory) : searchFiltered),
    [searchFiltered, selectedCategory],
  );

  const categoryKeysOrdered = useMemo(() => orderedUsefulLinkCategoryKeys(grouped), [grouped]);

  const categorySelectOptions = useMemo(() => {
    const known = new Map(USEFUL_LINK_CATEGORIES.map((c) => [c.value, c.label] as const));
    if (form.category && !known.has(form.category)) {
      known.set(form.category, `${form.category} (saved topic)`);
    }
    return [...known.entries()].map(([value, label]) => ({ value, label }));
  }, [form.category]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-1 lg:justify-start lg:gap-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Manage Help</h2>
            <p className="text-sm text-muted-foreground">Commands, troubleshooting steps, and related URLs</p>
          </div>
          <ModuleSearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search title, steps, tags, URLs, topic…"
            id="admin-useful-links-search"
          />
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0"><Plus className="h-4 w-4" />Add entry</Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedCategory === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
          >All ({searchFiltered.length})</Badge>
          {categoryKeysOrdered.map((catKey) => (
            <Badge
              key={catKey}
              variant={selectedCategory === catKey ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(catKey)}
            >
              {usefulLinkCategoryLabel(catKey)} ({grouped[catKey].length})
            </Badge>
          ))}
        </div>
        <Select value={listViewMode} onValueChange={(v) => setListViewMode(v as 'card' | 'list' | 'line' | 'table')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="table">Table mode</SelectItem>
            <SelectItem value="card">Card mode</SelectItem>
            <SelectItem value="list">List mode</SelectItem>
            <SelectItem value="line">Line mode</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-foreground">No help entries yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add steps, commands, or bookmarks you use often</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" />Add entry</Button>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching entries' : 'No entries in this topic'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{searchInput.trim() ? 'Try different keywords or clear the search.' : 'Pick another category or clear filters.'}</p>
          </CardContent>
        </Card>
      ) : listViewMode === 'table' ? (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">URLs</th>
                <th className="px-3 py-2">Pinned</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{item.title}</td>
                  <td className="px-3 py-2">{usefulLinkCategoryLabel(item.category)}</td>
                  <td className="px-3 py-2">{item.links.length}</td>
                  <td className="px-3 py-2">{item.is_pinned ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteConfirm({ id: item.id, title: item.title })} className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                        <Trash2 className="h-3.5 w-3.5" />Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : listViewMode === 'line' ? (
        <div className="rounded-lg border bg-card">
          {filteredItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/30">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.links.length} URL{item.links.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteConfirm({ id: item.id, title: item.title })} className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : listViewMode === 'list' ? (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.purpose || 'No purpose'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteConfirm({ id: item.id, title: item.title })} className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="group relative transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      {item.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      <span className="truncate">{item.title}</span>
                    </CardTitle>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {usefulLinkCategoryLabel(item.category)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.purpose && <p className="text-sm text-muted-foreground line-clamp-2">{item.purpose}</p>}

                {/* Links list */}
                <div className="space-y-1.5">
                  {item.links.slice(0, 3).map((link, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-sm">
                      <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-foreground/80">{link.label || link.url}</span>
                      <CopyButton value={link.url} />
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent transition-colors">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    </div>
                  ))}
                  {item.links.length > 3 && <p className="text-xs text-muted-foreground">+{item.links.length - 3} more URLs</p>}
                </div>

                {item.tags && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.split(',').map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t.trim()}</Badge>)}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteConfirm({ id: item.id, title: item.title })} className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editingId ? 'Edit help entry' : 'Add help entry'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] px-6 pb-6">
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. MySQL won’t start in XAMPP" />
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Select value={form.category} onValueChange={(v) => set('category', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categorySelectOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Summary</Label>
                <Input value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="One-line context (optional)" />
              </div>

              <div className="space-y-2">
                <Label>Steps &amp; commands</Label>
                <p className="text-xs text-muted-foreground">Numbered lists, paths, and shell commands. Use code formatting in the editor for copy-paste blocks.</p>
                <RichTextEditor
                  value={form.how_to_use}
                  onChange={(v) => set('how_to_use', v)}
                  placeholder="Numbered steps and commands (e.g. mysql_install_db --datadir=…)"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <RichTextEditor value={form.description} onChange={(v) => set('description', v)} placeholder="Extra context, warnings, or links to docs (optional)" />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label>Related URLs</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Optional. Leave blank for command-only entries.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addLink} className="gap-1.5 shrink-0">
                    <Plus className="h-3.5 w-3.5" />Add URL
                  </Button>
                </div>
                {form.links.map((link, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        value={link.label}
                        onChange={(e) => updateLink(idx, 'label', e.target.value)}
                        placeholder="Label (e.g. Laravel docs)"
                      />
                      <Input
                        value={link.url}
                        onChange={(e) => updateLink(idx, 'url', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    {form.links.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeLink(idx)} className="shrink-0 h-10 w-10 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <p className="text-xs text-muted-foreground">Type a tag and press Enter or comma — it is added automatically. Backspace removes the last tag when the field is empty.</p>
                  <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
                    {parseTagsString(form.tags).map((tag, idx) => (
                      <Badge key={`${tag}-${idx}`} variant="secondary" className="gap-0.5 pr-0.5 font-normal">
                        <span>{tag}</span>
                        <button
                          type="button"
                          className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
                          aria-label={`Remove tag ${tag}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => removeTagAt(idx)}
                        >
                          <X className="h-3 w-3 opacity-70" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      className="min-w-[140px] flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-1"
                      value={tagDraft}
                      placeholder={parseTagsString(form.tags).length === 0 ? 'e.g. xampp' : 'Add another…'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.includes(',')) {
                          const parts = v.split(',');
                          const tail = parts.length > 0 ? parts[parts.length - 1] ?? '' : '';
                          const complete = parts.slice(0, -1).map((p) => p.trim()).filter(Boolean);
                          if (complete.length) mergeTagsIntoForm(complete);
                          setTagDraft(tail);
                          return;
                        }
                        setTagDraft(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const t = tagDraft.trim();
                          if (t) {
                            mergeTagsIntoForm([t]);
                            setTagDraft('');
                          }
                        }
                        if (e.key === 'Backspace' && tagDraft === '' && parseTagsString(form.tags).length > 0) {
                          e.preventDefault();
                          removeLastTag();
                        }
                      }}
                      onBlur={() => {
                        const t = tagDraft.trim();
                        if (t) {
                          mergeTagsIntoForm([t]);
                          setTagDraft('');
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Pin to top</Label>
                  <Switch checked={form.is_pinned} onCheckedChange={(v) => set('is_pinned', v)} />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create entry'}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete help entry</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <strong>{deleteConfirm?.title}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
