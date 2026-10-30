import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ADMISSION_STATES } from '@/lib/constants';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface AdmissionRecord {
  id: string;
  studentName: string;
  maskedApaarId: string;
  programme: string;
  seatType: string;
  verificationStatus: string;
  riskScore: number | null;
}

interface RecordsResponse {
  records: AdmissionRecord[];
  total: number;
  page: number;
  totalPages: number;
  programmes: string[];
}

export function RecordsPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<RecordsResponse>({
    queryKey: ['institution', 'records', id, page, statusFilter, programmeFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilter) params.set('status', statusFilter);
      if (programmeFilter) params.set('programme', programmeFilter);
      if (search) params.set('search', search);
      const res = await api.get(`/institution/submissions/${id}/records?${params}`);
      return res.data;
    },
  });

  const stateValues = Object.values(ADMISSION_STATES);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Records</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name..."
          className="w-64"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {stateValues.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={programmeFilter} onValueChange={(v) => { setProgrammeFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All programmes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All programmes</SelectItem>
            {(data?.programmes ?? []).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>APAAR ID</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Seat Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Risk Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.studentName}</TableCell>
                  <TableCell className="font-mono text-sm">{r.maskedApaarId}</TableCell>
                  <TableCell>{r.programme}</TableCell>
                  <TableCell>{r.seatType}</TableCell>
                  <TableCell>
                    <Badge variant="status" status={r.verificationStatus}>
                      {r.verificationStatus.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.riskScore != null ? r.riskScore.toFixed(2) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.records.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages} ({data.total} records)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
