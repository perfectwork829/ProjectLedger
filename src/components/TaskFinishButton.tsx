import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canFinishPoolTask, type TaskPoolItemRecord } from '@/lib/taskPool';
import { cn } from '@/lib/utils';

type Props = {
  task: TaskPoolItemRecord;
  onFinish: (task: TaskPoolItemRecord) => void;
  compact?: boolean;
  className?: string;
};

export default function TaskFinishButton({ task, onFinish, compact = false, className }: Props) {
  if (!canFinishPoolTask(task)) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant={compact ? 'outline' : 'default'}
      className={cn('gap-1', className)}
      aria-label="Finish task"
      title="Finish task"
      onClick={(e) => {
        e.stopPropagation();
        onFinish(task);
      }}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {compact ? <span className="sr-only">Finish task</span> : 'Finish task'}
    </Button>
  );
}
