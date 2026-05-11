import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, Pin, Link as LinkIcon, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import { filterUsefulLinks } from '@/lib/clientSearch';
import { orderedUsefulLinkCategoryKeys, usefulLinkCategoryLabel } from '@/lib/usefulLinksCategories';

interface LinkItem { label: string; url: string; }

interface UsefulLink {
  id: string;
  title: string;
  category: string;
  purpose: string | null;
  description: string | null;
  how_to_use: string | null;
  links: LinkItem[];
  tags: string | null;
  is_pinned: boolean;
}

const richHelpProse =
  'prose prose-sm max-w-none text-foreground/80 pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_pre]:rounded-md [&_pre]:bg-muted/70 [&_pre]:px-3 [&_pre]:py-2 [&_pre]:text-sm [&_code]:rounded [&_code]:bg-muted/70 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_a]:text-primary [&_a]:underline';

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

type View = 'categories' | 'list' | 'detail';

export default function UsefulLinks() {
  const { toast } = useToast();
  const [items, setItems] = useState<UsefulLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<UsefulLink | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [listViewMode, setListViewMode] = useState<'table' | 'link' | 'line' | 'card'>('line');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('useful_links')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else setItems(data || []);
      setLoading(false);
    })();
  }, []);

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

  const categoryKeysOrdered = useMemo(() => orderedUsefulLinkCategoryKeys(grouped), [grouped]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  // Detail view
  if (view === 'detail' && selectedItem) {
    const item = selectedItem;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setView('list')} className="gap-2 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />Back to list
        </Button>

        <div>
          <div className="flex items-center gap-3 mb-1">
            {item.is_pinned && <Pin className="h-4 w-4 text-amber-500" />}
            <h2 className="text-2xl font-semibold text-foreground">{item.title}</h2>
          </div>
          <Badge variant="secondary">
            {usefulLinkCategoryLabel(item.category)}
          </Badge>
        </div>

        {item.purpose && (
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-foreground/80">{item.purpose}</p>
          </div>
        )}

        {item.how_to_use && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Steps &amp; commands</h3>
              <div className={richHelpProse} dangerouslySetInnerHTML={{ __html: item.how_to_use }} />
            </div>
          </>
        )}

        {item.description && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
              <div className={richHelpProse} dangerouslySetInnerHTML={{ __html: item.description }} />
            </div>
          </>
        )}

        {item.links.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                Related URLs
              </h3>
              <div className="space-y-2 pl-6">
                {item.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors">
                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{link.label || link.url}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px] hidden sm:inline">{link.url}</span>
                    <CopyButton value={link.url} />
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent transition-colors">
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {item.tags && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1.5">
              {item.tags.split(',').map((t, i) => <Badge key={i} variant="outline">{t.trim()}</Badge>)}
            </div>
          </>
        )}
      </div>
    );
  }

  // List view
  if (view === 'list' && selectedCategory) {
    const catItems = grouped[selectedCategory] || [];
    const catLabel = usefulLinkCategoryLabel(selectedCategory);
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => { setView('categories'); setSelectedCategory(null); }} className="gap-2 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />All Categories
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-semibold text-foreground">{catLabel}</h2>
          <div className="flex w-full max-w-2xl gap-2">
            <ModuleSearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder={`Search in ${catLabel}…`}
              id="useful-links-search-list"
            />
            <Select value={listViewMode} onValueChange={(v) => setListViewMode(v as typeof listViewMode)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table mode</SelectItem>
                <SelectItem value="link">Link mode</SelectItem>
                <SelectItem value="list">List mode</SelectItem>
                <SelectItem value="card">Card mode</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {catItems.length === 0 ? (
          <div className="rounded-lg border bg-card py-12 text-center">
            <p className="text-lg font-medium text-foreground">{searchInput.trim() ? 'No matching entries' : 'No entries in this topic'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{searchInput.trim() ? 'Try different keywords or clear the search.' : ''}</p>
          </div>
        ) : listViewMode === 'table' ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Purpose</th>
                  <th className="px-3 py-2">URLs</th>
                </tr>
              </thead>
              <tbody>
                {catItems.map((item) => (
                  <tr key={item.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => { setSelectedItem(item); setView('detail'); }}>
                    <td className="px-3 py-2 font-medium">{item.title}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.purpose || '-'}</td>
                    <td className="px-3 py-2">{item.links.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : listViewMode === 'link' ? (
          <div className="rounded-lg border bg-card divide-y">
            {catItems.map((item) => (
              <button key={item.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/30" onClick={() => { setSelectedItem(item); setView('detail'); }}>
                <span className="text-sm text-primary hover:underline">{item.title}</span>
              </button>
            ))}
          </div>
        ) : listViewMode === 'line' ? (
          <div className="rounded-lg border bg-card">
            {catItems.map((item) => (
              <button key={item.id} type="button" className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/30" onClick={() => { setSelectedItem(item); setView('detail'); }}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.links.length} URL{item.links.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {item.is_pinned ? <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catItems.map(item => (
              <Card key={item.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => { setSelectedItem(item); setView('detail'); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {item.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {item.purpose && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.purpose}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LinkIcon className="h-3 w-3" />
                    {item.links.length} URL{item.links.length !== 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Categories view
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Help</h2>
          <p className="text-sm text-muted-foreground">Commands, troubleshooting, and bookmarks by topic</p>
        </div>
        <ModuleSearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search title, steps, tags, URLs, topic…"
          id="useful-links-search"
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-foreground">No help entries yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add entries under Admin → Manage Help</p>
          </CardContent>
        </Card>
      ) : searchFiltered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-foreground">No matching entries</p>
            <p className="mt-1 text-sm text-muted-foreground">Try different keywords or clear the search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryKeysOrdered.map((catKey) => (
            <Card key={catKey} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => { setSelectedCategory(catKey); setView('list'); }}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{usefulLinkCategoryLabel(catKey)}</span>
                  <Badge variant="secondary">{grouped[catKey].length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {grouped[catKey].slice(0, 3).map(item => (
                    <p key={item.id} className="text-sm text-muted-foreground truncate">• {item.title}</p>
                  ))}
                  {grouped[catKey].length > 3 && <p className="text-xs text-muted-foreground">+{grouped[catKey].length - 3} more</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
