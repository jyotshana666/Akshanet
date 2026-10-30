import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';

interface AuditEntry {
  id: string;
  action: string;
  targetApaarId: string;
  details: string;
  performedBy: string;
  createdAt: string;
}

export function AuditLogPage() {
  const { data, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log'],
    queryFn: () => api.get('/employer/audit-log').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-emp-navy">Audit Log</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Immutable Activity Record</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">No audit entries</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>APAAR ID</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Performed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium capitalize">
                      {entry.action.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.targetApaarId}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{entry.details}</TableCell>
                    <TableCell className="text-sm">{entry.performedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
