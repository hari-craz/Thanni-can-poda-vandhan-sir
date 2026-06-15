import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatTime } from '@/utils/formatters'
import { METRIC_CONFIG } from '@/utils/constants'

interface ChartDataPoint {
  timestamp: string
  ph: number
  tds: number
  turbidity: number
  temperature: number
  flow_rate: number
  quality_score: number
}

interface WaterQualityChartProps {
  data: ChartDataPoint[]
  metric: 'ph' | 'tds' | 'turbidity' | 'temperature' | 'flow_rate' | 'quality_score'
  height?: number
}

export function WaterQualityChart({ data, metric, height = 300 }: WaterQualityChartProps) {
  const config = METRIC_CONFIG[metric] || { label: 'Metric', color: '#0070F3' }
  
  // Format data for chart
  const chartData = data.map((d) => ({
    ...d,
    formattedTime: formatTime(d.timestamp),
    value: d[metric],
  })).reverse() // reverse to show chronological order if backend returns newest first

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={config.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={config.color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="formattedTime"
            tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
            }}
            labelStyle={{ fontWeight: 700, color: '#1E293B', fontSize: '11px' }}
            itemStyle={{ fontWeight: 600, color: config.color, fontSize: '12px' }}
            formatter={(value: any) => [
              metric === 'quality_score' ? value : (config as any).format ? (config as any).format(value) : value,
              config.label,
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={config.color}
            strokeWidth={3}
            fillOpacity={1}
            fill={`url(#gradient-${metric})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
