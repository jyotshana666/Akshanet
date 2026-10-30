import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { CONSENT_STATUS_COLORS, type ConsentStatus } from '@/lib/constants';

interface Stats {
  total: number;
  approved: number;
  denied: number;
  pending: number;
}

interface Activity {
  id: string;
  apaarId: string;
  purpose: string;
  status: ConsentStatus;
  updatedAt: string;
}

const KPI_CARDS = [
  { key: 'total' as const, label: 'Total Requests', icon: FileText, color: 'text-emp-navy' },
  { key: 'approved' as const, label: 'Approved', icon: CheckCircle, color: 'text-green-600' },
  { key: 'denied' as const, label: 'Denied', icon: XCircle, color: 'text-red-600' },
  { key: 'pending' as const, label: 'Pending', icon: Clock, color: 'text-yellow-600' },
];

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['consent', 'stats'],
    queryFn: () => api.get('/employer/consent/stats').then((r) => r.data),
  });

  const { data: activity, isLoading: activityLoading } = useQuery<Activity[]>({
    queryKey: ['consent', 'activity'],
    queryFn: () => api.get('/employer/consent/activity').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-emp-navy">Dashboard</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-4 p-6">
              <Icon className={`h-8 w-8 ${color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                {statsLoading ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.[key] ?? 0}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !activity?.length ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">APAAR: {a.apaarId}</p>
                    <p className="text-xs text-muted-foreground">{a.purpose}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={CONSENT_STATUS_COLORS[a.status]}>{a.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
