import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useToast } from '@/hooks/useToast';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface UploadResponse {
  uploadId: string;
  headers: string[];
  preview: string[][];
}

export function UploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [result, setResult] = useState<UploadResponse | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/institution/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data as UploadResponse;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: 'File uploaded', description: `${data.preview.length} preview rows loaded.` });
    },
    onError: () => {
      toast({ title: 'Upload failed', description: 'Check file format and try again.', variant: 'destructive' });
    },
  });

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Maximum file size is 10 MB.', variant: 'destructive' });
        return;
      }
      upload.mutate(file);
    },
    [upload, toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: upload.isPending,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Upload Student Data</h1>

      {!result ? (
        <Card>
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              {upload.isPending ? (
                <p className="text-muted-foreground">Uploading...</p>
              ) : isDragActive ? (
                <p className="text-primary font-medium">Drop CSV file here</p>
              ) : (
                <div>
                  <p className="font-medium">Drag and drop a CSV file here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse (max 10 MB)</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5" />
              Preview (first {result.preview.length} rows)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.headers.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.preview.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="whitespace-nowrap">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => navigate(`/upload/${result.uploadId}/map`)}>
                Next: Map Columns
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
