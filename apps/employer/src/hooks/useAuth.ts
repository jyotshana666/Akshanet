import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  employerId: string;
  companyName: string;
}

export function useAuth() {
  const { data, isLoading } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    retry: false,
    staleTime: 5 * 60_000,
  });

  return {
    user: data ?? null,
    role: data?.role ?? null,
    employerId: data?.employerId ?? null,
    isLoading,
    isAuthenticated: !!data,
  };
}
