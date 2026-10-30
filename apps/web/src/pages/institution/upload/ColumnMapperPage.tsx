import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AKSHANET_FIELDS } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { CheckCircle2, XCircle } from 'lucide-react';

interface UploadDetail {
  headers: string[];
  status: string;
}

interface ValidationResult {
  valid: boolean;
  unmappedRequired?: string[];
}

interface ConfirmResult {
  created: number;
  skipped: number;
  failed: number;
}

export function ColumnMapperPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmResult | null>(null);

  const { data: upload, isLoading } = useQuery<UploadDetail>({
    queryKey: ['upload', id],
    queryFn: async () => {
      const res = await api.get(`/institution/upload/${id}`);
      return res.data;
    },
  });

  useEffect(() => {
    if (upload?.headers) {
      const auto: Record<string, string> = {};
      for (const h of upload.headers) {
        const match = AKSHANET_FIELDS.find(
          (f) => f.key.toLowerCase() === h.toLowerCase() || f.key === h.replace(/_/g, ''),
        );
        if (match) auto[h] = match.key;
      }
      setMapping(auto);
    }
  }, [upload]);

  const validate = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/institution/upload/${id}/map-columns`, { mapping });
      return res.data as ValidationResult;
    },
    onSuccess: (data) => {
      setValidation(data);
      if (data.valid) {
        toast({ title: 'Mapping valid' });
      } else {
        toast({
          title: 'Mapping incomplete',
          description: `Missing: ${data.unmappedRequired?.join(', ')}`,
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({ title: 'Validation failed', variant: 'destructive' });
    },
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/institution/upload/${id}/confirm`);
      return res.data as ConfirmResult;
    },
    onSuccess: (data) => {
      setConfirmed(data);
      queryClient.invalidateQueries({ queryKey: ['institution'] });
      toast({ title: 'Upload confirmed', description: `Created: ${data.created}, Skipped: ${data.skipped}, Failed: ${data.failed}` });
    },
    onError: () => {
      toast({ title: 'Confirm failed', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>;
  }

  if (confirmed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload Complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{confirmed.created}</div>
              <div className="text-sm text-muted-foreground">Created</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{confirmed.skipped}</div>
              <div className="text-sm text-muted-foreground">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{confirmed.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
          <Button className="w-full" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Map Columns</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {upload?.headers.map((header) => (
            <div key={header} className="flex items-center gap-4">
              <div className="w-48 text-sm font-medium truncate">{header}</div>
              <div className="text-muted-foreground text-sm">&rarr;</div>
              <Select
                value={mapping[header] ?? ''}
                onValueChange={(val) => {
                  setMapping((prev) => {
                    const next = { ...prev };
                    if (val === '__none__') {
                      delete next[header];
                    } else {
                      next[header] = val;
                    }
                    return next;
                  });
                  setValidation(null);
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Skip —</SelectItem>
                  {AKSHANET_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label} {f.required && '*'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {AKSHANET_FIELDS.find((f) => f.key === mapping[header])?.required && (
                <Badge>Required</Badge>
              )}
            </div>
          ))}

          {validation && (
            <div className="p-4 rounded-lg border space-y-2">
              {validation.valid ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">All required fields mapped</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Missing required mappings</span>
                  </div>
                  {validation.unmappedRequired?.map((field) => (
                    <p key={field} className="text-sm text-red-600 pl-7">{field}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => validate.mutate()} disabled={validate.isPending}>
              {validate.isPending ? 'Validating...' : 'Validate Mapping'}
            </Button>
            {validation?.valid && (
              <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
                {confirm.isPending ? 'Confirming...' : 'Confirm Upload'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
