import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/hooks/useToast';

interface FlagItem {
  id: string;
  studentName: string;
  field: string;
  reason: string;
  createdAt: string;
  status: 'OPEN' | 'RESOLVED';
}

export function FlagsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<FlagItem[]>({
    queryKey: ['institution', 'flags'],
    queryFn: async () => {
      const res = await api.get('/institution/flags');
      return res.data;
    },
  });

  const resolve = useMutation({
    mutationFn: (flagId: string) => api.patch(`/institution/flags/${flagId}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institution', 'flags'] });
      toast({ title: 'Flag resolved' });
    },
    onError: () => {
      toast({ title: 'Failed to resolve flag', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Flags Inbox</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data?.length ? (
        <p className="text-muted-foreground text-sm">No flags raised.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((flag) => (
              <TableRow key={flag.id}>
                <TableCell className="font-medium">{flag.studentName}</TableCell>
                <TableCell>{flag.field}</TableCell>
                <TableCell className="max-w-xs truncate">{flag.reason}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(flag.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    className={flag.status === 'OPEN' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}
                  >
                    {flag.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {flag.status === 'OPEN' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolve.mutate(flag.id)}
                      disabled={resolve.isPending}
                    >
                      Mark Resolved
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
