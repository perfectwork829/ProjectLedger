import { Link } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import type { TaskPoolItemRecord } from '@/lib/taskPool';
import type { TaskPoolAccrualPeriodRow } from '@/lib/taskPoolAccrualPeriods';
import { isPeriodPending } from '@/lib/taskPoolAccrualPeriods';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskPoolItemRecord | null;
  pendingPeriods: TaskPoolAccrualPeriodRow[];
  onConfirmFinish: () => void;
};

export default function TaskFinishPaymentDialog({
  open,
  onOpenChange,
  task,
  pendingPeriods,
  onConfirmFinish,
}: Props) {
  const due = pendingPeriods.filter((p) => isPeriodPending(p));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark task completed?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{task?.name}</strong> will be marked completed and
                timestamped. You can still confirm any due payments on the Payments page.
              </p>
              {due.length > 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="font-medium text-foreground mb-2">
                    {due.length} payment{due.length === 1 ? '' : 's'} still due for confirmation:
                  </p>
                  <ul className="space-y-1">
                    {due.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {p.period_kind.replace('_', ' ')}
                        </Badge>
                        <span>{p.label}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={task ? `/admin/payments?task=${task.id}` : '/admin/payments'}
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    Open Payments to confirm
                  </Link>
                </div>
              ) : (
                <p>No accrual periods are currently due. Outstanding periods may appear later on Payments.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmFinish}>Mark completed</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
