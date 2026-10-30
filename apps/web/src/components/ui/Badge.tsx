import * as React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'status';
  status?: string;
}

function Badge({ className, variant = 'default', status, children, ...props }: BadgeProps) {
  const statusClass = status ? STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700' : '';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'status' ? statusClass : 'bg-primary/10 text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
