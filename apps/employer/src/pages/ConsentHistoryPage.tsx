import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { CONSENT_STATUS_COLORS, CONSENT_STATUSES, type ConsentStatus } from '@/lib/constants';
import { useToast } from '@/hooks/useToast';

interface ConsentRecord {
  id: string;
  apaarId: string;
  studentName: string;
  purpose: string;
  status: ConsentStatus;
  expiryDate: string;
  createdAt: string;
}

export function ConsentHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ConsentRecord[]>({
    queryKey: ['consent', 'history', statusFilter],
    queryFn: () =>
      api
        .get('/employer/consent/history', {
          params: statusFilter !== 'all' ? { status: statusFilter } : undefined,
        })
        .then((r) => r.data),
  });

  const exportCsv = () => {
    if (!data?.length) return;
    const headers = ['APAAR ID', 'Student Name', 'Purpose', 'Status', 'Expiry Date', 'Requested'];
    const rows = data.map((r) => [
      r.apaarId,
      r.studentName,
      r.purpose,
      r.status,
      r.expiryDate,
      new Date(r.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consent-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-emp-navy">Consent History</h2>
        <Button variant="outline" onClick={exportCsv} disabled={!data?.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">All Requests</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.values(CONSENT_STATUSES).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">No consent requests found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>APAAR ID</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.apaarId}</TableCell>
                    <TableCell>{r.studentName}</TableCell>
                    <TableCell className="capitalize">{r.purpose.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge className={CONSENT_STATUS_COLORS[r.status]}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(r.expiryDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
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
