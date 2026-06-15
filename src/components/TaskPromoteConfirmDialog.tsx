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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string | null;
  onConfirmPromote: () => void;
};

export default function TaskPromoteConfirmDialog({ open, onOpenChange, taskName, onConfirmPromote }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to Projects?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{taskName}</strong> was saved as completed. Do you want to move it to
            Projects now? You can also leave it in the task pool as a completed task.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, keep in task pool</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmPromote}>Yes, move to Projects</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
