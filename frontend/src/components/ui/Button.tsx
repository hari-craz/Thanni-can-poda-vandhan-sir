import React from 'react'
import { cn } from '@/utils/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          // Variants
          {
            'bg-linear-to-r from-teal-500 to-sky-500 text-white shadow-md shadow-sky-500/10 hover:shadow-lg hover:shadow-sky-500/20 hover:brightness-105':
              variant === 'primary',
            'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/50':
              variant === 'secondary',
            'bg-white/40 backdrop-blur-md border border-white/50 text-sky-900 shadow-xs hover:bg-white/60':
              variant === 'glass',
            'bg-red-500 text-white hover:bg-red-600 shadow-xs':
              variant === 'danger',
            'text-slate-600 hover:bg-slate-100/50 hover:text-slate-900':
              variant === 'ghost',
          },
          // Sizes
          {
            'px-3 py-1.5 text-xs rounded-lg': size === 'sm',
            'px-5 py-2.5 text-sm': size === 'md',
            'px-6 py-3.5 text-base': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
