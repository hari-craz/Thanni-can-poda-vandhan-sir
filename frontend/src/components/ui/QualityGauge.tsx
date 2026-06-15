import { QUALITY_COLORS } from '@/utils/constants'
import { cn } from '@/utils/cn'

interface QualityGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function QualityGauge({ score, size = 'md', className }: QualityGaugeProps) {
  // Determine color based on score
  let color: string = QUALITY_COLORS.good
  let label = 'Excellent'
  
  if (score < 20) {
    color = QUALITY_COLORS.emergency
    label = 'Emergency'
  } else if (score < 40) {
    color = QUALITY_COLORS.critical
    label = 'Critical'
  } else if (score < 70) {
    color = QUALITY_COLORS.warning
    label = 'Warning'
  } else if (score < 85) {
    color = QUALITY_COLORS.good
    label = 'Good'
  }

  // Dimensions
  const sizes = {
    sm: { diameter: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-[9px]' },
    md: { diameter: 140, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-xs' },
    lg: { diameter: 200, strokeWidth: 14, fontSize: 'text-5xl', labelSize: 'text-sm' },
  }

  const { diameter, strokeWidth, fontSize, labelSize } = sizes[size]
  const radius = (diameter - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className={cn('flex flex-col items-center justify-center relative', className)}>
      <div className="relative" style={{ width: diameter, height: diameter }}>
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-10 transition-all duration-1000"
          style={{ backgroundColor: color }}
        />

        <svg className="w-full h-full transform -rotate-90">
          {/* Background Track */}
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            className="stroke-slate-100 fill-none"
            strokeWidth={strokeWidth}
          />
          {/* Foreground Meter */}
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            className="fill-none transition-all duration-1000 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke={color}
          />
        </svg>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={cn('font-black text-slate-800 tracking-tighter leading-none', fontSize)}>
            {score}
          </span>
          <span
            className={cn('font-bold mt-1 uppercase tracking-wider', labelSize)}
            style={{ color }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
