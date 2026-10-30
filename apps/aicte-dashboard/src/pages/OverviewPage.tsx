import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CHART_COLORS } from '@/lib/constants';
import { KpiTile } from '@/components/KpiTile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Users, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface DashboardStats {
  totalStudents: number;
  verifiedPercent: number;
  anomalyCount: number;
  pendingApprovals: number;
}

interface TrendPoint {
  month: string;
  count: number;
}

interface StatewiseEntry {
  state: string;
  total: number;
  verified: number;
}

export function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['aicte', 'dashboard', 'stats'],
    queryFn: async () => {
      const res = await api.get('/aicte/dashboard/stats');
      return res.data;
    },
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<TrendPoint[]>({
    queryKey: ['aicte', 'dashboard', 'trends'],
    queryFn: async () => {
      const res = await api.get('/aicte/dashboard/trends', { params: { metric: 'verifications', period: '12m' } });
      return res.data;
    },
  });

  const { data: statewise, isLoading: stateLoading } = useQuery<StatewiseEntry[]>({
    queryKey: ['aicte', 'dashboard', 'statewise'],
    queryFn: async () => {
      const res = await api.get('/aicte/dashboard/statewise');
      return res.data;
    },
  });

  const kpis = [
    { label: 'Total Students', value: stats?.totalStudents?.toLocaleString() ?? '0', icon: Users, color: 'text-aicte-navy' },
    { label: 'Verified', value: `${stats?.verifiedPercent ?? 0}%`, icon: CheckCircle2, color: 'text-aicte-green' },
    { label: 'Anomalies', value: stats?.anomalyCount ?? 0, icon: AlertTriangle, color: 'text-aicte-red' },
    { label: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: ClipboardCheck, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-aicte-navy">National Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} loading={statsLoading} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verifications — Last 12 Months</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLORS.navy}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.navy, r: 3 }}
                    name="Verifications"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">State-Wise Student Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stateLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statewise?.slice(0, 15)} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip />
                  <Bar dataKey="total" fill={CHART_COLORS.navy} name="Total" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="verified" fill={CHART_COLORS.green} name="Verified" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
