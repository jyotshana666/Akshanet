import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { NOTIFICATION_TEMPLATES } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/hooks/useToast';
import { Send } from 'lucide-react';

interface Submission {
  id: string;
  filename: string;
  totalRecords: number;
  pending: number;
}

const TEMPLATE_PREVIEWS: Record<string, string> = {
  'verify-reminder': 'Dear Student, your admission record is pending verification. Please log in to the Akshanet student portal and verify your details at the earliest.',
  'flag-resolved': 'Dear Student, the flag raised on your record has been reviewed and resolved by your institution. No further action is needed from your side.',
  'general': 'Dear Student, this is a notification from your institution regarding your admission records on the Akshanet platform.',
};

export function NotifyPage() {
  const { toast } = useToast();
  const [submissionId, setSubmissionId] = useState('');
  const [template, setTemplate] = useState('');

  const { data: submissions, isLoading } = useQuery<Submission[]>({
    queryKey: ['institution', 'submissions'],
    queryFn: async () => {
      const res = await api.get('/institution/submissions');
      return res.data;
    },
  });

  const send = useMutation({
    mutationFn: () =>
      api.post(`/institution/submissions/${submissionId}/notify`, { template }),
    onSuccess: (res) => {
      const count = res.data?.sentCount ?? 0;
      toast({ title: 'Notifications sent', description: `${count} student(s) notified.` });
    },
    onError: () => {
      toast({ title: 'Failed to send notifications', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Send Notifications</h1>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-64" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Submission</label>
              <Select value={submissionId} onValueChange={setSubmissionId}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select submission..." />
                </SelectTrigger>
                <SelectContent>
                  {submissions?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.filename} ({s.pending} pending)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {template && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
                <p className="text-sm">{TEMPLATE_PREVIEWS[template]}</p>
              </div>
            )}

            <Button
              onClick={() => send.mutate()}
              disabled={!submissionId || !template || send.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {send.isPending ? 'Sending...' : 'Send to All Pending'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
