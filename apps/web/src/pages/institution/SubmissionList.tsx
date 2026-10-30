import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SubmitFinalButton } from './SubmitFinalButton';

interface Submission {
  id: string;
  filename: string;
  uploadedAt: string;
  status: string;
  totalRecords: number;
  verified: number;
  flagged: number;
  pending: number;
  hasDuplicatesOrIntake: boolean;
}

export function SubmissionList() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<Submission[]>({
    queryKey: ['institution', 'submissions'],
    queryFn: async () => {
      const res = await api.get('/institution/submissions');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return <p className="text-muted-foreground text-sm">No submissions yet. Upload a CSV to get started.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>File</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Verified</TableHead>
          <TableHead className="text-right">Flagged</TableHead>
          <TableHead className="text-right">Pending</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((sub) => (
          <TableRow key={sub.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(sub.uploadedAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="max-w-[200px] truncate">{sub.filename}</TableCell>
            <TableCell className="text-right">{sub.totalRecords}</TableCell>
            <TableCell className="text-right">{sub.verified}</TableCell>
            <TableCell className="text-right">{sub.flagged}</TableCell>
            <TableCell className="text-right">{sub.pending}</TableCell>
            <TableCell>
              <Badge variant="status" status={sub.status}>{sub.status.replace(/_/g, ' ')}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/submissions/${sub.id}/records`)}
                >
                  View Records
                </Button>
                <SubmitFinalButton submission={sub} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
