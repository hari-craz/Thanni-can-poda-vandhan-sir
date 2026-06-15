import React from 'react'
import { cn } from '@/utils/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'secondary'
}

export function Badge({ className, variant = 'info', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors',
        {
          'bg-emerald-50 text-emerald-700 border-emerald-200': variant === 'success',
          'bg-amber-50 text-amber-700 border-amber-200': variant === 'warning',
          'bg-rose-50 text-rose-700 border-rose-200': variant === 'danger',
          'bg-sky-50 text-sky-700 border-sky-200': variant === 'info',
          'bg-slate-100 text-slate-700 border-slate-200': variant === 'secondary',
        },
        className
      )}
      {...props}
    />
  )
}
