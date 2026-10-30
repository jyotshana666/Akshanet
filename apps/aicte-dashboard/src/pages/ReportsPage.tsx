import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { REPORT_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { Download, Loader2, FileBarChart } from 'lucide-react';

interface ReportResult {
  reportId: string;
  downloadUrl: string;
  status: 'completed' | 'generating';
}

export function ReportsPage() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState('');
  const [format, setFormat] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [polling, setPolling] = useState(false);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post('/aicte/reports/generate', {
        type: reportType,
        format,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      return res.data as ReportResult;
    },
    onSuccess: async (data) => {
      if (data.status === 'completed') {
        setResult(data);
        toast({ title: 'Report ready' });
      } else {
        setPolling(true);
        await pollStatus(data.reportId);
      }
    },
    onError: () => toast({ title: 'Report generation failed', variant: 'destructive' }),
  });

  async function pollStatus(reportId: string) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await api.get(`/aicte/reports/${reportId}/status`);
        if (res.data.status === 'completed') {
          setResult(res.data);
          setPolling(false);
          toast({ title: 'Report ready' });
          return;
        }
      } catch {
        break;
      }
    }
    setPolling(false);
    toast({ title: 'Report timed out — check back later', variant: 'destructive' });
  }

  const canSubmit = reportType && format && !generate.isPending && !polling;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-aicte-navy">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            Generate Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date (optional)</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date (optional)</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <Button
            className="bg-aicte-navy hover:bg-aicte-navy/90"
            disabled={!canSubmit}
            onClick={() => { setResult(null); generate.mutate(); }}
          >
            {generate.isPending || polling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {polling ? 'Generating...' : 'Submitting...'}
              </>
            ) : (
              'Generate Report'
            )}
          </Button>

          {result && (
            <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
              <Badge variant="success">Ready</Badge>
              <span className="text-sm flex-1">Report generated successfully.</span>
              <a href={result.downloadUrl} download>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
