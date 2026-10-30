import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Upload,
  Flag,
  Bell,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/flags', label: 'Flags', icon: Flag },
  { to: '/notify', label: 'Notifications', icon: Bell },
] as const;

export function InstitutionLayout() {
  const { user } = useAuth();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      queryClient.clear();
      window.location.href = '/login';
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-lg font-bold">Akshanet</h1>
          {user?.institutionName && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{user.institutionName}</p>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
