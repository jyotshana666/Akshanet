import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/Dialog';
import { useToast } from '@/hooks/useToast';
import { FileText, Download, Eye } from 'lucide-react';

interface ApprovalRecord {
  id: string;
  institutionName: string;
  academicYear: string;
  action: 'approved' | 'rejected';
  createdAt: string;
  letterUrl: string | null;
}

export function LettersPage() {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ApprovalRecord[]>({
    queryKey: ['aicte', 'letters'],
    queryFn: async () => {
      const res = await api.get('/aicte/letters');
      return res.data;
    },
  });

  const generate = useMutation({
    mutationFn: async (approvalId: string) => {
      const res = await api.post(`/aicte/letter/${approvalId}`);
      return res.data as { url: string };
    },
    onSuccess: (result) => {
      toast({ title: 'Letter generated' });
      setPreviewUrl(result.url);
    },
    onError: () => toast({ title: 'Letter generation failed', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-aicte-navy">Letter Generation</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Institution</TableHead>
              <TableHead>Academic Year</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell className="font-medium">{rec.institutionName}</TableCell>
                <TableCell>{rec.academicYear}</TableCell>
                <TableCell>
                  <Badge variant={rec.action === 'approved' ? 'success' : 'danger'}>
                    {rec.action}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{new Date(rec.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {rec.letterUrl ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setPreviewUrl(rec.letterUrl)}>
                          <Eye className="h-4 w-4 mr-1" /> Preview
                        </Button>
                        <a href={rec.letterUrl} download>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-1" /> Download
                          </Button>
                        </a>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => generate.mutate(rec.id)}
                        disabled={generate.isPending}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        {generate.isPending ? 'Generating...' : 'Generate'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!data?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">No approval/rejection records.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Letter Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="w-full flex-1 rounded border" title="Letter Preview" />
          )}
          <div className="flex justify-end gap-2">
            {previewUrl && (
              <a href={previewUrl} download>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
              </a>
            )}
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
