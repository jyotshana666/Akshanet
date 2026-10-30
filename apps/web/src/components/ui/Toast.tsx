import React, { createContext, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastContextValue {
  addToast: (opts: Omit<ToastItem, 'id'>) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((opts: Omit<ToastItem, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...opts, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-full',
              t.variant === 'destructive'
                ? 'border-destructive bg-destructive text-destructive-foreground'
                : 'bg-background text-foreground',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="text-sm opacity-90 mt-1">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
