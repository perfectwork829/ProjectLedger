import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

type Props = {
  count: number;
  className?: string;
};

/** Shows how many accrual periods are due for confirmation on this task. */
export default function TaskPaymentDueBadge({ count, className }: Props) {
  if (count <= 0) return null;
  return (
    <Badge variant="destructive" className={`gap-1 text-[10px] ${className ?? ''}`}>
      <Clock className="h-3 w-3" />
      {count === 1 ? 'Payment due' : `${count} payments due`}
    </Badge>
  );
}
