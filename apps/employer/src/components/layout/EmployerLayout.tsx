import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, FileText, History, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/search', label: 'Student Search', icon: Search },
  { to: '/request-consent', label: 'Request Consent', icon: FileText },
  { to: '/consent-history', label: 'Consent History', icon: History },
  { to: '/audit-log', label: 'Audit Log', icon: Shield },
] as const;

export function EmployerLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.post('/auth/logout');
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 flex-col border-r bg-white">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-bold text-emp-navy">Akshanet</h1>
          <p className="text-xs text-muted-foreground">Employer Portal</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-emp-navy text-white' : 'text-gray-700 hover:bg-gray-100',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">{user?.companyName ?? 'Employer'}</p>
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
