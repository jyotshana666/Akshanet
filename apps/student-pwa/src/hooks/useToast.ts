import { useCallback, useContext } from 'react';
import { ToastContext } from '@/components/Toast';

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');

  const toast = useCallback(
    (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
      ctx.addToast(opts);
    },
    [ctx],
  );

  return { toast };
}
