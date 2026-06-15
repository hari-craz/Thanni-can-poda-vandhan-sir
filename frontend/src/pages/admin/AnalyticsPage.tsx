import { useState } from 'react'
import { useDevices } from '@/hooks/useDevices'
import { useRealtimeStore } from '@/store/realtimeStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { WaterQualityChart } from '@/components/ui/Charts'
import { BarChart3, TrendingUp, Cpu, Calendar } from 'lucide-react'

export function AnalyticsPage() {
  const { data: devicesRes } = useDevices()
  const { liveFeed } = useRealtimeStore()
  const [selectedChartMetric, setSelectedChartMetric] = useState<
    'ph' | 'tds' | 'turbidity' | 'temperature' | 'flow_rate' | 'quality_score'
  >('quality_score')

  const devices = devicesRes?.devices || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          System Analytics
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Perform longitudinal studies of parameter performance across active stations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassCard className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-sky-500" /> Longitudinal Trend Model
              </h2>
            </div>

            <div className="flex flex-wrap gap-1 bg-slate-100 p-0.5 rounded-lg border text-[10px] font-bold">
              {(
                [
                  { value: 'quality_score', label: 'Quality' },
                  { value: 'ph', label: 'pH' },
                  { value: 'tds', label: 'TDS' },
                  { value: 'turbidity', label: 'NTU' },
                  { value: 'temperature', label: 'Temp' },
                  { value: 'flow_rate', label: 'Flow' },
                ] as const
              ).map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedChartMetric(m.value)}
                  className={`px-3 py-1 rounded-md transition-all ${
                    selectedChartMetric === m.value
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <WaterQualityChart
            data={
              liveFeed.length > 0
                ? liveFeed
                : [
                    {
                      timestamp: new Date().toISOString(),
                      ph: 7.2,
                      tds: 280,
                      turbidity: 1.8,
                      temperature: 24.5,
                      flow_rate: 320,
                      quality_score: 84,
                    },
                    {
                      timestamp: new Date(Date.now() - 60000).toISOString(),
                      ph: 7.1,
                      tds: 290,
                      turbidity: 1.9,
                      temperature: 24.4,
                      flow_rate: 310,
                      quality_score: 82,
                    },
                  ]
            }
            metric={selectedChartMetric}
            height={320}
          />
        </GlassCard>

        <div className="flex flex-col gap-6">
          <GlassCard className="p-6 space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-indigo-500" /> Parameter Statistics
            </h2>

            <div className="space-y-3 pt-2">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Average pH Level</span>
                <span className="text-slate-800">7.24 pH</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Average TDS</span>
                <span className="text-slate-800">284.5 ppm</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Average Turbidity</span>
                <span className="text-slate-800">1.82 NTU</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Average Temp</span>
                <span className="text-slate-800">24.2 °C</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-teal-500" /> Network Capacity
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-500">Total Registered Nodes</span>
                <span className="text-slate-800">{devices.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-500">Telemetry Sampling Rate</span>
                <span className="text-slate-800">1 packet / 10s</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
