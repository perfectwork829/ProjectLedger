import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { calcWithdrawnAmount } from '@/lib/taskPoolFinance';
import {
  isTaskDeadlinePassed,
  parseMilestones,
  taskPoolFixedMode,
  type TaskMilestone,
  type TaskPoolItemRecord,
} from '@/lib/taskPool';

type Props = {
  task: TaskPoolItemRecord;
  onConfirmMilestone?: (milestoneId: string) => void;
  confirmBusyId?: string | null;
};

export default function TaskMilestonePaymentsPanel({ task, onConfirmMilestone, confirmBusyId }: Props) {
  if (taskPoolFixedMode(task) !== 'milestone') return null;

  const milestones = parseMilestones(task.milestones_json);
  const deadlinePassed = isTaskDeadlinePassed(task);
  const confirmOnDetail = !deadlinePassed;

  if (milestones.length === 0) {
    return (
      <div className="rounded-lg border p-3 space-y-2 md:col-span-2">
        <p className="text-sm font-medium">Milestones</p>
        <p className="text-xs text-muted-foreground">No milestones defined — edit the task to add them.</p>
      </div>
    );
  }

  const paid = milestones.filter((m) => !!m.confirmed_at);
  const pending = milestones.filter((m) => !m.confirmed_at);
  const paidGross = paid.reduce((s, m) => s + Number(m.amount || 0), 0);
  const pendingGross = pending.reduce((s, m) => s + Number(m.amount || 0), 0);
  const fees = {
    upworkConnectionFee: Number(task.upwork_connection_fee ?? 0),
    convertFee: Number(task.convert_fee ?? 0),
    transferFee: Number(task.transfer_fee ?? 0),
    upworkFee: Number(task.upwork_fee ?? 0),
    withdrawFee: Number(task.withdraw_fee ?? 0),
  };
  const netFor = (m: TaskMilestone) =>
    calcWithdrawnAmount({ budgetAmount: Number(m.amount || 0), ...fees });
  const paidNet = paid.reduce((s, m) => s + netFor(m), 0);
  const contractNetMax = milestones.reduce((s, m) => s + netFor(m), 0);

  return (
    <div className="rounded-lg border p-3 space-y-3 md:col-span-2">
      <div>
        <p className="text-sm font-medium">Milestone payments</p>
        <p className="text-xs text-muted-foreground">
          {confirmOnDetail ? (
            <>
              While the task deadline has not passed, confirm each milestone here when payment is received. Overdue
              milestones also appear on <strong className="text-foreground">Payments</strong> after their due date (JST).
            </>
          ) : (
            <>
              The task deadline has passed — confirm overdue milestones on{' '}
              <strong className="text-foreground">Payments</strong>.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded border bg-muted/20 p-2">
          <p className="text-[11px] text-muted-foreground">Paid</p>
          <p className="text-sm font-medium">
            {task.currency} {paidGross.toFixed(2)} gross
          </p>
          <p className="text-[11px] text-emerald-700">{paidNet.toFixed(2)} net withdrawn</p>
        </div>
        <div className="rounded border bg-muted/20 p-2">
          <p className="text-[11px] text-muted-foreground">Pending</p>
          <p className="text-sm font-medium">
            {task.currency} {pendingGross.toFixed(2)} gross
          </p>
          <p className="text-[11px] text-muted-foreground">{pending.length} awaiting confirm</p>
        </div>
        <div className="rounded border bg-muted/20 p-2">
          <p className="text-[11px] text-muted-foreground">Contract max (net)</p>
          <p className="text-sm font-medium">
            {task.currency} {contractNetMax.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Withdrawn: {task.currency} {Number(task.withdrawn_amount ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      <ul className="space-y-2 text-sm">
        {milestones.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border/60 pb-2 last:border-0"
          >
            <div className="min-w-0">
              <span className="font-medium">{m.title}</span>
              <span className="text-muted-foreground">
                {' '}
                · {task.currency} {Number(m.amount).toFixed(2)} gross
              </span>
              <span className="text-muted-foreground text-xs"> · ~{netFor(m).toFixed(2)} net</span>
              {m.due_at ? (
                <span className="ml-2 text-[11px] text-muted-foreground">Due {m.due_at} JST</span>
              ) : null}
              {m.confirmed_at ? (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  Confirmed
                </Badge>
              ) : (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Pending
                </Badge>
              )}
              {m.confirmed_at ? (
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {new Date(m.confirmed_at).toLocaleString()}
                </span>
              ) : null}
            </div>
            {!m.confirmed_at && Number(m.amount) > 0 && onConfirmMilestone && confirmOnDetail ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={confirmBusyId === m.id}
                onClick={() => onConfirmMilestone(m.id)}
              >
                {confirmBusyId === m.id ? 'Loading…' : 'Confirm payment'}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {paid.length > 0 ? (
        <div className="pt-1">
          <p className="text-xs font-medium text-foreground">Confirmed history</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {paid
              .slice()
              .sort(
                (a, b) =>
                  new Date(String(b.confirmed_at)).getTime() - new Date(String(a.confirmed_at)).getTime(),
              )
              .map((m) => (
                <li key={`hist-${m.id}`} className="flex flex-wrap gap-2">
                  <span className="text-foreground">{m.title}</span>
                  <span>
                    {task.currency} {Number(m.amount).toFixed(2)}
                  </span>
                  <span>·</span>
                  <span>{m.confirmed_at ? new Date(m.confirmed_at).toLocaleString() : ''}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
