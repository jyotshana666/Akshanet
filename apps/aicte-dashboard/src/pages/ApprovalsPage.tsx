import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { REJECTION_REASON_CODES } from '@/lib/constants';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/Dialog';
import { useToast } from '@/hooks/useToast';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

interface AphChecklist {
  apaarCoverage100: boolean;
  noDuplicates: boolean;
  noIntakeViolations: boolean;
  noFraudEscalation: boolean;
  allStudentsVerified: boolean;
}

interface InstitutionApproval {
  id: string;
  name: string;
  aicteId: string;
  region: string;
  state: string;
  totalRecords: number;
  verified: number;
  flagged: number;
  submittedAt: string;
  checklist: AphChecklist;
}

interface ApprovalResponse {
  institutions: InstitutionApproval[];
  total: number;
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<InstitutionApproval | null>(null);
  const [rejectReasons, setRejectReasons] = useState<string[]>([]);

  const { data, isLoading } = useQuery<ApprovalResponse>({
    queryKey: ['aicte', 'approvals'],
    queryFn: async () => {
      const res = await api.get('/aicte/approval/queue', { params: { page: 1, limit: 50 } });
      return res.data;
    },
  });

  const approve = useMutation({
    mutationFn: (institutionId: string) =>
      api.post('/aicte/approval/bulk', { institutionIds: [institutionId], action: 'approve' }),
    onSuccess: () => {
      toast({ title: 'Approved' });
      queryClient.invalidateQueries({ queryKey: ['aicte'] });
    },
    onError: () => toast({ title: 'Approval failed', variant: 'destructive' }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reasons }: { id: string; reasons: string[] }) =>
      api.post('/aicte/approval/bulk', { institutionIds: [id], action: 'reject', reasonCodes: reasons }),
    onSuccess: () => {
      toast({ title: 'Rejected' });
      setRejectTarget(null);
      setRejectReasons([]);
      queryClient.invalidateQueries({ queryKey: ['aicte'] });
    },
    onError: () => toast({ title: 'Rejection failed', variant: 'destructive' }),
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleReason(code: string) {
    setRejectReasons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  const checkItems: { key: keyof AphChecklist; label: string }[] = [
    { key: 'apaarCoverage100', label: '100% APAAR Coverage' },
    { key: 'noDuplicates', label: 'No Unresolved Duplicates' },
    { key: 'noIntakeViolations', label: 'No Intake Violations' },
    { key: 'noFraudEscalation', label: 'No Fraud Escalations' },
    { key: 'allStudentsVerified', label: 'All Students Verified' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-aicte-navy">Approval Queue</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Institution</TableHead>
              <TableHead>AICTE ID</TableHead>
              <TableHead>Region</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead className="text-right">Verified</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.institutions.map((inst) => (
              <React.Fragment key={inst.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => toggleExpand(inst.id)}
                  data-testid={`approval-row-${inst.id}`}
                >
                  <TableCell>
                    {expanded.has(inst.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell className="font-mono text-sm">{inst.aicteId}</TableCell>
                  <TableCell>{inst.region}</TableCell>
                  <TableCell className="text-right">{inst.totalRecords}</TableCell>
                  <TableCell className="text-right">{inst.verified}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(inst.submittedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="bg-aicte-green hover:bg-aicte-green/90"
                        onClick={() => approve.mutate(inst.id)}
                        disabled={approve.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setRejectTarget(inst); setRejectReasons([]); }}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expanded.has(inst.id) && (
                  <TableRow data-testid={`approval-detail-${inst.id}`}>
                    <TableCell colSpan={8}>
                      <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                        <h4 className="text-sm font-semibold">APH Compliance Checklist</h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {checkItems.map(({ key, label }) => (
                            <div key={key} className="flex items-center gap-2 text-sm">
                              {inst.checklist[key] ? (
                                <CheckCircle2 className="h-4 w-4 text-aicte-green" />
                              ) : (
                                <XCircle className="h-4 w-4 text-aicte-red" />
                              )}
                              <span className={inst.checklist[key] ? '' : 'text-aicte-red font-medium'}>{label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                          <span>State: {inst.state}</span>
                          <span>Flagged: {inst.flagged}</span>
                          <span>Total: {inst.totalRecords}</span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
            {!data?.institutions.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">No pending approvals.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject — {rejectTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select rejection reason(s):</p>
            {REJECTION_REASON_CODES.map(({ code, label }) => (
              <label key={code} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={rejectReasons.includes(code)}
                  onChange={() => toggleReason(code)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={rejectReasons.length === 0 || reject.isPending}
              onClick={() => {
                if (rejectTarget) reject.mutate({ id: rejectTarget.id, reasons: rejectReasons });
              }}
            >
              {reject.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
