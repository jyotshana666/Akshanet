import { cn } from '@/lib/utils';

interface StatusPillProps {
  status: string;
  className?: string;
}

const PILL_STYLES: Record<string, string> = {
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DENIED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        PILL_STYLES[status] ?? 'bg-gray-100 text-gray-600',
        className,
      )}
    >
      {status}
    </span>
  );
}
