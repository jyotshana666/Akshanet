import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { Skeleton } from '@/components/Skeleton';
import { FileText, ShieldCheck, Bell, Download } from 'lucide-react';

export function HomePage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const quickActions = [
    { label: 'My Record', icon: FileText, to: '/record' },
    { label: 'Consents', icon: ShieldCheck, to: '/consents' },
    { label: 'Notifications', icon: Bell, to: '/notifications' },
    ...(user?.status === 'VERIFIED'
      ? [{ label: 'Certificate', icon: Download, to: '/certificate' }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <Card className="bg-brand text-white border-0">
        <CardContent className="pt-5">
          <p className="text-sm opacity-80">Welcome back</p>
          <h1 className="text-xl font-bold mt-1">{user?.name ?? 'Student'}</h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-sm opacity-80 font-mono">{user?.apaarId}</span>
            <StatusPill
              status={user?.status ?? 'PENDING'}
              className={user?.status === 'VERIFIED' ? 'bg-white/20 text-white' : 'bg-white/20 text-white'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {quickActions.map(({ label, icon: Icon, to }) => (
          <Button
            key={to}
            variant="outline"
            className="h-auto flex-col gap-2 py-5 rounded-2xl"
            onClick={() => navigate(to)}
          >
            <Icon className="h-6 w-6 text-brand" />
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
