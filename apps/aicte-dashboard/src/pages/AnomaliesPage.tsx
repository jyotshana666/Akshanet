import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ANOMALY_TYPES, INDIAN_STATES } from '@/lib/constants';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/hooks/useToast';

interface AnomalyAlert {
  id: string;
  institutionName: string;
  maskedApaarId: string;
  anomalyType: string;
  confidence: number;
  detectedAt: string;
  state: string;
}

export function AnomaliesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<AnomalyAlert[]>({
    queryKey: ['aicte', 'anomalies', stateFilter, typeFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (stateFilter) params.state = stateFilter;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/aicte/dashboard/anomalies', { params });
      return res.data;
    },
  });

  const escalate = useMutation({
    mutationFn: (ids: string[]) => api.post('/aicte/dashboard/anomalies/escalate', { ids }),
    onSuccess: () => {
      toast({ title: 'Escalated', description: `${selected.size} alert(s) escalated to fraud review.` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['aicte', 'anomalies'] });
    },
    onError: () => toast({ title: 'Escalation failed', variant: 'destructive' }),
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((a) => a.id)));
  }

  function confidenceBadge(score: number) {
    if (score >= 0.8) return <Badge variant="danger">{(score * 100).toFixed(0)}%</Badge>;
    if (score >= 0.5) return <Badge variant="warning">{(score * 100).toFixed(0)}%</Badge>;
    return <Badge variant="outline">{(score * 100).toFixed(0)}%</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-aicte-navy">Anomaly Alerts</h1>
        {selected.size > 0 && (
          <Button
            className="bg-aicte-red hover:bg-aicte-red/90"
            onClick={() => escalate.mutate([...selected])}
            disabled={escalate.isPending}
          >
            Escalate {selected.size} Selected
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All states</SelectItem>
            {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {ANOMALY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={!!data?.length && selected.size === data.length}
                  onChange={toggleAll}
                  className="rounded"
                />
              </TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>APAAR ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Detected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(alert.id)}
                    onChange={() => toggleSelect(alert.id)}
                    className="rounded"
                  />
                </TableCell>
                <TableCell className="font-medium">{alert.institutionName}</TableCell>
                <TableCell className="font-mono text-sm">{alert.maskedApaarId}</TableCell>
                <TableCell>{alert.anomalyType.replace(/_/g, ' ')}</TableCell>
                <TableCell>{confidenceBadge(alert.confidence)}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(alert.detectedAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {!data?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No anomaly alerts.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
