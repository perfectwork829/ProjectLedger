import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { plainTextFromDescription } from '@/lib/plainTextFromDescription';
import { Copy } from 'lucide-react';

export function CopyDescriptionButton({
  description,
  title = 'Copy description',
  className,
}: {
  description: string | null | undefined;
  title?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const plain = plainTextFromDescription(description);
  if (!plain) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className={className ?? 'h-8 w-8 shrink-0'}
      title={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(plain);
          toast({ title: 'Copied', description: 'Description copied to clipboard.' });
        } catch {
          toast({ title: 'Copy failed', variant: 'destructive' });
        }
      }}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}
