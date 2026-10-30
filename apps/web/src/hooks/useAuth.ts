import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AuthUser {
  id: string;
  role: string;
  institutionId?: string;
  institutionName?: string;
}

export function useAuth() {
  const { data, isLoading, error } = useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    },
    retry: false,
  });

  return {
    user: data ?? null,
    role: data?.role ?? null,
    institutionId: data?.institutionId ?? null,
    isLoading,
    isAuthenticated: !!data && !error,
  };
}
