import { useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TagChipsInput } from '@/components/TagChipsInput';
import { DEFAULT_PROJECT_LINK_SKILLS } from '@/lib/projectLinkSkills';
import type { ProjectLinkImportCandidate } from '@/lib/projectLinks';
import type { TaskPoolItemRecord } from '@/lib/taskPool';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskPoolItemRecord | null;
  initialCandidates: ProjectLinkImportCandidate[];
  initialSkillTags: string[];
  onConfirm: (candidates: ProjectLinkImportCandidate[], skillTags: string[]) => void;
};

export default function ProjectLinksImportDialog({
  open,
  onOpenChange,
  task,
  initialCandidates,
  initialSkillTags,
  onConfirm,
}: Props) {
  const [candidates, setCandidates] = useState<ProjectLinkImportCandidate[]>([]);
  const [skillTags, setSkillTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setCandidates(initialCandidates.map((c) => ({ ...c })));
    setSkillTags([...initialSkillTags]);
  }, [open, initialCandidates, initialSkillTags]);

  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Add published links to Project Links?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{task?.name}</strong> is completed and has published /
                live / store links. Add them to Project Links so you can share them with clients by skill?
              </p>
              <ul className="space-y-2 rounded-md border bg-muted/30 p-3">
                {candidates.map((c, i) => (
                  <li key={`${c.url}-${i}`} className="flex items-start gap-2">
                    <Checkbox
                      id={`pl-import-${i}`}
                      checked={c.selected}
                      onCheckedChange={(v) => {
                        setCandidates((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, selected: v === true } : row)),
                        );
                      }}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`pl-import-${i}`} className="cursor-pointer space-y-0.5 font-normal">
                      <span className="block text-foreground">{c.label}</span>
                      <span className="block break-all text-xs text-muted-foreground">{c.url}</span>
                    </Label>
                  </li>
                ))}
              </ul>
              <TagChipsInput
                label="Skill tags"
                values={skillTags}
                onChange={setSkillTags}
                suggestions={DEFAULT_PROJECT_LINK_SKILLS}
                placeholder="e.g. Node, React"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Skip</AlertDialogCancel>
          <AlertDialogAction
            disabled={selectedCount === 0}
            onClick={() => onConfirm(candidates, skillTags)}
          >
            Add {selectedCount || ''} to Project Links
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
