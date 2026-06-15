import { cn } from '@/utils/cn'

interface StatusBadgeProps {
  status: 'online' | 'offline' | string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const isOnline = status === 'online'
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-all duration-300',
        isOnline
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-500 border-slate-200',
        className
      )}
    >
      {isOnline && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
      )}
      {isOnline ? 'Online' : 'Offline'}
    </span>
  )
}
