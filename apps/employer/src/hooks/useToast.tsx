import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  variant: 'default' | 'success' | 'error';
}

interface ToastCtx {
  toasts: Toast[];
  toast: (message: string, variant?: Toast['variant']) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: Toast['variant'] = 'default') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`rounded-md px-4 py-3 text-sm shadow-lg ${
              t.variant === 'error'
                ? 'bg-red-600 text-white'
                : t.variant === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-white'
            }`}
          >
            {t.message}
            <button onClick={() => dismiss(t.id)} className="ml-3 font-bold opacity-70 hover:opacity-100">
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
