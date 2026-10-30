import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/Dialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip';
import { useToast } from '@/hooks/useToast';

interface Props {
  submission: {
    id: string;
    status: string;
    hasDuplicatesOrIntake: boolean;
  };
}

export function SubmitFinalButton({ submission }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isSubmittable = !submission.hasDuplicatesOrIntake && submission.status !== 'submitted_to_aicte';
  const disabledReason = submission.hasDuplicatesOrIntake
    ? 'Resolve all DUPLICATE_FLAGGED and INTAKE_EXCEEDED records before submitting'
    : submission.status === 'submitted_to_aicte'
      ? 'Already submitted to AICTE'
      : '';

  const submit = useMutation({
    mutationFn: () => api.post(`/institution/submissions/${submission.id}/submit-final`),
    onSuccess: () => {
      toast({ title: 'Submitted to AICTE', description: 'Records have been submitted for approval.' });
      queryClient.invalidateQueries({ queryKey: ['institution'] });
      setOpen(false);
    },
    onError: () => {
      toast({ title: 'Submission failed', variant: 'destructive' });
    },
  });

  if (!isSubmittable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button size="sm" disabled>Submit to AICTE</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-xs">{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>Submit to AICTE</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Submission</DialogTitle>
          <DialogDescription>
            This will submit all eligible records to AICTE for approval. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? 'Submitting...' : 'Confirm Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
