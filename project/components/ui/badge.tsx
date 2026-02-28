import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary/10 text-primary hover:bg-primary/20',
        secondary:
          'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200',
        destructive:
          'border-transparent bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-200',
        success:
          'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
        warning:
          'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
        info:
          'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        outline: 'text-slate-500 border-slate-200 dark:border-slate-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
