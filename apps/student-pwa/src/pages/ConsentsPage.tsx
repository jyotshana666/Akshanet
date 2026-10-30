import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/hooks/useToast';

export interface ConsentRequest {
  id: string;
  employerName: string;
  purpose: string;
  expiresAt: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
}

export function ConsentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ConsentRequest[]>({
    queryKey: ['student', 'consents'],
    queryFn: async () => {
      const res = await api.get('/student/consent-requests');
      return res.data;
    },
  });

  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'deny' }) =>
      api.patch(`/student/consent/${id}`, { action }),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['student', 'consents'] });
      toast({
        title: action === 'approve' ? 'Consent approved' : 'Consent denied',
        description: action === 'approve' ? 'The employer can now view limited records.' : 'Access request has been denied.',
      });
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Consent Requests</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            No consent requests at the moment.
          </CardContent>
        </Card>
      ) : (
        data.map((req) => (
          <Card key={req.id} data-testid={`consent-${req.id}`}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{req.employerName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{req.purpose}</p>
                </div>
                <StatusPill status={req.status} />
              </div>

              <p className="text-xs text-gray-400">
                Expires: {new Date(req.expiresAt).toLocaleDateString()}
              </p>

              {req.status === 'PENDING' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="success"
                    className="flex-1"
                    onClick={() => respond.mutate({ id: req.id, action: 'approve' })}
                    disabled={respond.isPending}
                    data-testid={`approve-${req.id}`}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => respond.mutate({ id: req.id, action: 'deny' })}
                    disabled={respond.isPending}
                    data-testid={`deny-${req.id}`}
                  >
                    Deny
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
