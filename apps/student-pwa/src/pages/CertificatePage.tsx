import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { useToast } from '@/hooks/useToast';
import { Download, ShieldCheck } from 'lucide-react';

export function CertificatePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const download = useMutation({
    mutationFn: async () => {
      const res = await api.get('/student/letter', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'akshanet-verification-certificate.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: 'Certificate downloaded' }),
    onError: () => toast({ title: 'Download failed', variant: 'destructive' }),
  });

  const isVerified = user?.status === 'VERIFIED';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Verification Certificate</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-brand" />
            <div>
              <CardTitle className="text-base">APAAR Verification</CardTitle>
              <StatusPill status={isVerified ? 'VERIFIED' : 'PENDING'} className="mt-1" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isVerified ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Your records have been verified. Download your official verification letter below.
              </p>
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => download.mutate()}
                disabled={download.isPending}
              >
                <Download className="h-5 w-5" />
                {download.isPending ? 'Downloading...' : 'Download Certificate'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Your records are pending verification. The certificate will be available once your institution and AICTE complete the approval process.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
