import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CopyDescriptionButton } from '@/components/CopyDescriptionButton';
import {
  coercePoolSubtaskStatus,
  poolSubtaskBoardLabel,
  type PersonnelRef,
  type PoolSubtask,
} from '@/lib/taskPool';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: PoolSubtask | null;
  personnel: PersonnelRef[];
  onSave: (taskId: string, data: { title: string; description: string | null }) => Promise<boolean>;
};

export default function PoolSubtaskDetailDialog({ open, onOpenChange, task, personnel, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [open, task?.id, task?.updated_at]);

  const assignee = task ? personnel.find((p) => p.id === task.assignee_personnel_id) : undefined;
  const columnLabel = task ? poolSubtaskBoardLabel(coercePoolSubtaskStatus(task.status)) : '';

  const handleSave = async () => {
    if (!task || !title.trim()) return;
    setSaving(true);
    const ok = await onSave(task.id, {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Board card</DialogTitle>
          <DialogDescription>
            {task ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{columnLabel}</Badge>
                {assignee ? (
                  <span className="text-muted-foreground">
                    {assignee.first_name} {assignee.last_name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {task ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="pool-subtask-detail-title">Title</Label>
              <Input
                id="pool-subtask-detail-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Card title"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pool-subtask-detail-desc">Description</Label>
                <CopyDescriptionButton description={description} />
              </div>
              <Textarea
                id="pool-subtask-detail-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a detailed description…"
                className="min-h-[200px] resize-y"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
