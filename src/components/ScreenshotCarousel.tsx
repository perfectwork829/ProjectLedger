import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, ExternalLink } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ScreenshotImage from '@/components/ScreenshotImage';
import { cn } from '@/lib/utils';

export type ScreenshotSlide = {
  id: string;
  image_url: string;
  caption?: string | null;
};

type Props = {
  slides: ScreenshotSlide[];
  emptyMessage?: string;
};

const PREVIEW_FRAME = 'h-[min(440px,52vh)] w-full';
const THUMB_MAX_COUNT = 40;

function ScreenshotThumbStrip({
  slides,
  activeIndex,
  onSelect,
}: {
  slides: ScreenshotSlide[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const useNumbered = slides.length > THUMB_MAX_COUNT;

  useEffect(() => {
    thumbRefs.current[activeIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeIndex]);

  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-1 pt-2 scroll-smooth [scrollbar-width:thin]"
      role="tablist"
      aria-label="Jump to screenshot"
    >
      {slides.map((s, i) => (
        <button
          key={s.id}
          type="button"
          ref={(el) => {
            thumbRefs.current[i] = el;
          }}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={s.caption?.trim() || `Screenshot ${i + 1}`}
          title={s.caption?.trim() || `Screenshot ${i + 1}`}
          onClick={() => onSelect(i)}
          className={cn(
            'shrink-0 overflow-hidden rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            i === activeIndex
              ? 'border-primary shadow-sm'
              : 'border-transparent opacity-80 hover:border-muted-foreground/30 hover:opacity-100',
          )}
        >
          {useNumbered ? (
            <span
              className={cn(
                'flex h-10 min-w-10 items-center justify-center px-2 text-xs font-medium tabular-nums',
                i === activeIndex ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
          ) : (
            <ScreenshotImage url={s.image_url} alt="" frameClassName="h-16 w-[4.5rem] sm:h-[4.5rem] sm:w-20" />
          )}
        </button>
      ))}
    </div>
  );
}

export default function ScreenshotCarousel({ slides, emptyMessage = 'No screenshots.' }: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const [enlargeOpen, setEnlargeOpen] = useState(false);
  const [enlargeIndex, setEnlargeIndex] = useState(0);

  const syncIndexFromApi = useCallback(() => {
    if (!api) return;
    setIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    syncIndexFromApi();
    api.on('select', syncIndexFromApi);
    api.on('reInit', syncIndexFromApi);
    return () => {
      api.off('select', syncIndexFromApi);
      api.off('reInit', syncIndexFromApi);
    };
  }, [api, syncIndexFromApi]);

  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      const wrapped = ((next % slides.length) + slides.length) % slides.length;
      setEnlargeIndex(wrapped);
      setIndex(wrapped);
      api?.scrollTo(wrapped);
    },
    [api, slides.length],
  );

  const openEnlarge = () => {
    setEnlargeIndex(index);
    setEnlargeOpen(true);
  };

  if (slides.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const current = slides[index] ?? slides[0];
  const enlarged = slides[enlargeIndex] ?? slides[0];

  return (
    <>
      <div className="space-y-3">
        <div className="px-8 sm:px-12">
          <Carousel opts={{ align: 'start' }} setApi={setApi}>
            <CarouselContent>
              {slides.map((s) => (
                <CarouselItem key={s.id}>
                  <button
                    type="button"
                    className="w-full overflow-hidden rounded-lg border bg-muted/20 text-left transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={openEnlarge}
                    title="Click to view larger"
                  >
                    <ScreenshotImage url={s.image_url} alt={s.caption || 'Screenshot'} frameClassName={PREVIEW_FRAME} />
                  </button>
                  {s.caption ? <p className="mt-2 px-1 text-sm text-muted-foreground">{s.caption}</p> : null}
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>

          {slides.length > 1 ? (
            <ScreenshotThumbStrip slides={slides} activeIndex={index} onSelect={goTo} />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 px-4">
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={openEnlarge}>
            <Expand className="h-4 w-4" />
            View larger
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={current.image_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open / share link
            </a>
          </Button>
          {slides.length > 1 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {index + 1} / {slides.length}
            </span>
          ) : null}
        </div>
        <p className="text-center text-[11px] text-muted-foreground px-4">
          Click the image or &quot;View larger&quot; for a bigger view — use &quot;Open / share link&quot; to send the URL to clients.
        </p>
      </div>

      <Dialog open={enlargeOpen} onOpenChange={setEnlargeOpen}>
        <DialogContent className="flex max-h-[96vh] w-[min(1280px,96vw)] max-w-[96vw] flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0 space-y-1">
            <DialogTitle className="text-base font-semibold pr-8">
              Screenshot
              {slides.length > 1 ? ` (${enlargeIndex + 1} of ${slides.length})` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            <ScreenshotImage
              url={enlarged.image_url}
              alt={enlarged.caption || 'Screenshot'}
              frameClassName="min-h-[55vh] max-h-[78vh] w-full"
            />
            {enlarged.caption ? <p className="mt-2 text-sm text-muted-foreground">{enlarged.caption}</p> : null}
          </div>

          {slides.length > 1 ? (
            <ScreenshotThumbStrip slides={slides} activeIndex={enlargeIndex} onSelect={goTo} />
          ) : null}

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-3">
            {slides.length > 1 ? (
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goTo(enlargeIndex - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[4rem] text-center text-xs text-muted-foreground tabular-nums">
                  {enlargeIndex + 1} / {slides.length}
                </span>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goTo(enlargeIndex + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <span />
            )}
            <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={enlarged.image_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
