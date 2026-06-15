import React from 'react'
import { cn } from '@/utils/cn'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean
}

export function GlassCard({ className, hoverEffect = true, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-panel p-6 border border-white/60 bg-white/70 backdrop-blur-md rounded-2xl transition-all duration-500',
        hoverEffect && 'hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/5 hover:bg-white/80',
        className
      )}
      {...props}
    />
  )
}
