import { THRESHOLDS, METRIC_CONFIG, QUALITY_COLORS } from '@/utils/constants'
import { GlassCard } from './GlassCard'
import { cn } from '@/utils/cn'

interface MetricCardProps {
  type: 'ph' | 'tds' | 'turbidity' | 'temperature' | 'flow_rate'
  value: number | undefined
  className?: string
}

export function MetricCard({ type, value, className }: MetricCardProps) {
  const config = METRIC_CONFIG[type]
  const thresholds = THRESHOLDS[type]

  // Determine status & color based on thresholds
  let status: 'good' | 'warning' | 'critical' = 'good'
  let statusText = 'Normal'
  
  if (value !== undefined) {
    if ('min' in thresholds && 'max' in thresholds) {
      const min = thresholds.min as number
      const max = thresholds.max as number
      const critical_min = (thresholds as any).critical_min as number | undefined
      const critical_max = (thresholds as any).critical_max as number | undefined

      if (critical_min !== undefined && value < critical_min) {
        status = 'critical'
        statusText = 'Critical Low'
      } else if (critical_max !== undefined && value > critical_max) {
        status = 'critical'
        statusText = 'Critical High'
      } else if (value < min) {
        status = 'warning'
        statusText = 'Low'
      } else if (value > max) {
        status = 'warning'
        statusText = 'High'
      }
    } else if ('max' in thresholds) {
      const max = thresholds.max as number
      const critical_max = (thresholds as any).critical_max as number | undefined

      if (critical_max !== undefined && value > critical_max) {
        status = 'critical'
        statusText = 'Critical High'
      } else if (value > max) {
        status = 'warning'
        statusText = 'High'
      }
    }
  }

  const statusColor =
    status === 'critical'
      ? QUALITY_COLORS.emergency
      : status === 'warning'
      ? QUALITY_COLORS.warning
      : QUALITY_COLORS.good

  const displayValue = value !== undefined ? config.format(value) : '--'

  // Progress percentage calculation for visual bar
  let percentage = 0
  if (value !== undefined) {
    if (type === 'ph') {
      percentage = ((value - 0) / 14) * 100
    } else if (type === 'tds') {
      percentage = Math.min((value / 1000) * 100, 100)
    } else if (type === 'turbidity') {
      percentage = Math.min((value / 15) * 100, 100)
    } else if (type === 'temperature') {
      percentage = ((value - 0) / 50) * 100
    } else if (type === 'flow_rate') {
      percentage = Math.min((value / 1000) * 100, 100)
    }
  }

  return (
    <GlassCard className={cn('relative overflow-hidden group', className)}>
      {/* Decorative accent top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-300"
        style={{ backgroundColor: statusColor }}
      />
      
      <div className="flex items-start justify-between">
        <div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
            {config.label}
          </span>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1.5 font-sans group-hover:scale-105 transition-transform duration-300 origin-left">
            {displayValue}
          </h3>
        </div>
        <div
          className="text-2xl p-2.5 rounded-xl bg-slate-50 border border-slate-100 shadow-xs group-hover:scale-110 transition-transform duration-300"
        >
          {config.icon}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs font-bold">
        <span
          className="px-2 py-0.5 rounded-md border text-[10px]"
          style={{
            borderColor: `${statusColor}30`,
            backgroundColor: `${statusColor}10`,
            color: statusColor,
          }}
        >
          {statusText}
        </span>
        <span className="text-slate-400">
          {type === 'ph'
            ? 'Range: 6.5 - 8.5'
            : type === 'tds'
            ? 'Max: 500 ppm'
            : type === 'turbidity'
            ? 'Max: 5 NTU'
            : type === 'temperature'
            ? 'Range: 10 - 35°C'
            : 'Range: 0 - 1000 L/m'}
        </span>
      </div>

      {/* Mini-progress visual bar */}
      {value !== undefined && (
        <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${percentage}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      )}
    </GlassCard>
  )
}
