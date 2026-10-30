import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AicteUser {
  id: string;
  role: string;
  region: string | null;
  name: string;
}

export function useAuth() {
  const { data, isLoading, error } = useQuery<AicteUser>({
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
    region: data?.region ?? null,
    isLoading,
    isAuthenticated: !!data && !error,
  };
}
