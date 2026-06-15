import React from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, label, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'flex h-11 w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-300 backdrop-blur-xs outline-hidden focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-500/5 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-500/5',
            className
          )}
          {...props}
        />
        {error && (
          <span className="block mt-1 text-[11px] font-medium text-red-500 ml-1">
            {error}
          </span>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
