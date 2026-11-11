import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import ModuleSearchBar from '@/components/ModuleSearchBar';
import ScreenshotCarousel from '@/components/ScreenshotCarousel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, ExternalLink, Pin } from 'lucide-react';
import { orderedSkillTagKeys } from '@/lib/projectLinkSkills';
import { fetchProjectLinks, filterProjectLinks, type ProjectLinkRecord } from '@/lib/projectLinks';

export default function ProjectLinks() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProjectLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectLinkRecord | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchProjectLinks();
      if (res.error) toast({ title: 'Error loading project links', description: res.error, variant: 'destructive' });
      else setItems(res.data);
      setLoading(false);
    })();
  }, [toast]);

  const skillKeys = useMemo(() => {
    const present = new Set<string>();
    for (const item of items) for (const t of item.skill_tags) present.add(t);
    return orderedSkillTagKeys(present);
  }, [items]);

  const filtered = useMemo(
    () => filterProjectLinks(items, { search: searchInput, skill: selectedSkill }),
    [items, searchInput, selectedSkill],
  );

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Project Links</h1>
        <p className="text-sm text-muted-foreground">
          Find a demo by skill and copy the link for your client — screenshots included so you do not need to reopen the site.
        </p>
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
            No project links match. Ask an admin to add entries under Manage → Projects → Project Links.
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
                <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copyUrl(item.url)}>
                    <Copy className="h-3 w-3" />
                    Copy link
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                {detail.source_note ? (
                  <p className="text-xs text-muted-foreground">Source note: {detail.source_note}</p>
                ) : null}
                <ScreenshotCarousel
                  slides={detail.screenshots.map((url, i) => ({ id: `${detail.id}-${i}`, image_url: url }))}
                  emptyMessage="No screenshots for this link."
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
