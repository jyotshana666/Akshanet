import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';

interface StudentResult {
  apaarId: string;
  name: string;
  programme: string;
  institutionName: string;
  verificationStatus: string;
}

export function StudentSearchPage() {
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  const search = useMutation({
    mutationFn: (q: string) =>
      api.get<StudentResult[]>('/employer/students/search', { params: { q } }).then((r) => r.data),
    onError: () => toast('Search failed', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) search.mutate(query.trim());
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-emp-navy">Student Search</h2>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by APAAR ID or student name"
              className="flex-1"
            />
            <Button type="submit" disabled={search.isPending}>
              <Search className="mr-2 h-4 w-4" />
              {search.isPending ? 'Searching…' : 'Search'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {search.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Results ({search.data.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {search.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students found</p>
            ) : (
              <div className="space-y-3">
                {search.data.map((s) => (
                  <div key={s.apaarId} className="rounded-md border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-muted-foreground">APAAR: {s.apaarId}</p>
                        <p className="text-sm text-muted-foreground">{s.programme}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{s.institutionName}</p>
                        <p className="text-xs capitalize text-muted-foreground">{s.verificationStatus}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
