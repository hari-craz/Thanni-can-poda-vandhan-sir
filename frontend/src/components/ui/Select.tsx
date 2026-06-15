import React from 'react'
import { cn } from '@/utils/cn'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  label?: string
  options: { value: string; label: string }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'flex h-11 w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2 text-sm text-slate-800 transition-all duration-300 backdrop-blur-xs outline-hidden focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-500/5 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer',
              error && 'border-red-400 focus:border-red-400 focus:ring-red-500/5',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {error && (
          <span className="block mt-1 text-[11px] font-medium text-red-500 ml-1">
            {error}
          </span>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'
