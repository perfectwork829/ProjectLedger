import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  coercePoolSubtaskStatus,
  TASK_POOL_SUBTASK_BOARD_STATUSES,
  poolSubtaskBoardLabel,
  type PersonnelRef,
  type PoolSubtask,
  type PoolSubtaskStatus,
} from '@/lib/taskPool';
import { FileText, GripVertical, Trash2 } from 'lucide-react';

const DND_TYPE = 'application/x-benchhub-pool-subtask';

type Props = {
  subtasks: PoolSubtask[];
  personnel: PersonnelRef[];
  onMove: (taskId: string, status: PoolSubtaskStatus) => void;
  onSelect?: (task: PoolSubtask) => void;
  onDelete?: (taskId: string, title: string) => void;
  canDelete?: boolean;
};

export default function PoolSubtaskKanban({ subtasks, personnel, onMove, onSelect, onDelete, canDelete }: Props) {
  const grouped = useMemo(() => {
    const g = {} as Record<PoolSubtaskStatus, PoolSubtask[]>;
    for (const col of TASK_POOL_SUBTASK_BOARD_STATUSES) g[col] = [];
    for (const t of subtasks) {
      g[coercePoolSubtaskStatus(t.status)].push(t);
    }
    for (const col of TASK_POOL_SUBTASK_BOARD_STATUSES) {
      g[col].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return g;
  }, [subtasks]);

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData(DND_TYPE, taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropCol = (e: React.DragEvent, col: PoolSubtaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DND_TYPE);
    if (!id) return;
    const task = subtasks.find((t) => t.id === id);
    if (!task || coercePoolSubtaskStatus(task.status) === col) return;
    onMove(id, col);
  };

  /** ~3 columns visible at once; scroll horizontally for the other statuses */
  const columnClass =
    'flex min-h-0 w-[min(24rem,calc(33.333vw-0.75rem))] min-w-[15.5rem] shrink-0 flex-col rounded-lg border border-border bg-muted/30';

  return (
    <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-2 [-webkit-overflow-scrolling:touch]">
      <div className="flex w-max min-w-full gap-3 pr-1">
        {TASK_POOL_SUBTASK_BOARD_STATUSES.map((col) => (
          <div
            key={col}
            className={columnClass}
            onDragOver={onDragOver}
            onDrop={(e) => onDropCol(e, col)}
          >
            <div className="border-b border-border bg-muted/50 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">{poolSubtaskBoardLabel(col)}</p>
              <p className="text-[11px] text-muted-foreground">{grouped[col].length} cards</p>
            </div>
            <div className="flex max-h-[min(420px,50vh)] flex-col gap-2 overflow-y-auto p-2.5">
              {grouped[col].map((task) => {
                const assignee = personnel.find((p) => p.id === task.assignee_personnel_id);
                const descTrim = task.description?.trim() ?? '';
                const hasDesc = descTrim.length > 0;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'rounded-md border bg-card p-2.5 shadow-sm',
                      'border-border hover:border-primary/40',
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <div
                        draggable
                        onDragStart={(e) => onDragStart(e, task.id)}
                        className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 active:cursor-grabbing hover:bg-muted/80"
                        title="Drag to move"
                      >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      </div>
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onSelect?.(task)}
                      >
                        <p className="text-[15px] font-medium leading-snug text-foreground">{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {hasDesc ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Has description">
                              <FileText className="h-3 w-3 shrink-0" aria-hidden />
                              <span className="line-clamp-1">
                                {descTrim.slice(0, 80)}
                                {descTrim.length > 80 ? '…' : ''}
                              </span>
                            </span>
                          ) : null}
                          {assignee ? (
                            <p className="text-[10px] text-muted-foreground">
                              {assignee.first_name} {assignee.last_name}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      {canDelete && onDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive"
                          onClick={() => onDelete(task.id, task.title)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {grouped[col].length === 0 && (
                <p className="py-4 text-center text-[11px] text-muted-foreground">Drop cards here</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
