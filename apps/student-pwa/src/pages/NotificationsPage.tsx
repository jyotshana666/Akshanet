import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { requestNotificationPermission } from '@/lib/notifications';
import { Card, CardContent } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { Bell } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export function NotificationsPage() {
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const { data, isLoading } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', 'mine'],
    queryFn: async () => {
      const res = await api.get('/notifications/mine');
      return res.data;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Notifications</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        data.map((n) => (
          <Card key={n.id} className={n.read ? 'opacity-70' : ''}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-brand'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
