import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, FileText, ShieldCheck, Bell } from 'lucide-react';

const TABS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/record', label: 'Record', icon: FileText },
  { to: '/consents', label: 'Consents', icon: ShieldCheck },
  { to: '/notifications', label: 'Alerts', icon: Bell },
] as const;

export function MobileLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 overflow-y-auto pb-20 px-4 pt-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-pb z-50">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors py-1 px-3',
                  isActive ? 'text-brand' : 'text-gray-400',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
