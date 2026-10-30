import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface StudentUser {
  id: string;
  name: string;
  apaarId: string;
  status: 'PENDING' | 'VERIFIED';
  role: string;
}

export function useAuth() {
  const { data, isLoading, error } = useQuery<StudentUser>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    },
    retry: false,
  });

  return {
    user: data ?? null,
    isLoading,
    isAuthenticated: !!data && !error,
  };
}
