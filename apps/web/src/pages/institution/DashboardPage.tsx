import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { SubmissionList } from './SubmissionList';
import { Users, CheckCircle2, Clock, Percent } from 'lucide-react';

interface DashboardStats {
  totalStudents: number;
  verified: number;
  pending: number;
  apaarCoverage: number;
}

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['institution', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/institution/dashboard');
      return res.data;
    },
  });

  const kpis = [
    { label: 'Total Students', value: stats?.totalStudents ?? 0, icon: Users, color: 'text-blue-600' },
    { label: 'Verified', value: stats?.verified ?? 0, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-yellow-600' },
    { label: 'APAAR Coverage', value: `${stats?.apaarCoverage ?? 0}%`, icon: Percent, color: 'text-cyan-600' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Submissions</h2>
        <SubmissionList />
      </div>
    </div>
  );
}
