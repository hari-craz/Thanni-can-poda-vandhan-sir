import { useState } from 'react'
import { useRealtimeStore } from '@/store/realtimeStore'
import { METRIC_CONFIG } from '@/utils/constants'
import { QualityGauge } from '@/components/ui/QualityGauge'
import { GlassCard } from '@/components/ui/GlassCard'
import { formatTime } from '@/utils/formatters'
import { Droplet, Activity, ListFilter, Play, CircleAlert } from 'lucide-react'

export function LivePage() {
  const { liveFeed, wsConnected } = useRealtimeStore()
  const [activeTab, setActiveTab] = useState<'all' | 'critical'>('all')

  const latestReading = liveFeed[0]

  const alertsCount = liveFeed.filter((r) => Object.keys(r.anomaly_flags || {}).length > 0).length

  return (
    <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 overflow-hidden h-full">
      {/* Sidebar: System status & Live feed settings */}
      <div className="xl:col-span-1 flex flex-col gap-6">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Control Panel Status
            </span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Command Center
          </h2>
          <p className="text-slate-500 text-xs leading-relaxed font-semibold">
            This display aggregates and reports real-time data streaming from deployed telemetry modules. Keep open for continuous monitoring.
          </p>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-400">WS Connection</span>
              <span className={wsConnected ? 'text-emerald-600' : 'text-rose-600'}>
                {wsConnected ? 'ACTIVE' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-400">Total Packets Received</span>
              <span className="text-sky-600">{liveFeed.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-400">Abnormal Packets</span>
              <span className="text-rose-600">{alertsCount}</span>
            </div>
          </div>
        </GlassCard>

        {/* Big water quality score gauge */}
        <GlassCard className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-linear-to-b from-white/90 to-sky-50/20">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">
            Live Quality Index
          </span>
          <QualityGauge score={latestReading?.quality_score ?? 85} size="lg" />
          <div className="mt-6 text-xs font-bold text-slate-500">
            {latestReading ? (
              <span>Last packet: {formatTime(latestReading.timestamp)}</span>
            ) : (
              <span>Waiting for initial telemetry packet...</span>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Main Board: Large metrics grids & live scrolling table */}
      <div className="xl:col-span-3 flex flex-col gap-6 h-full overflow-hidden">
        {/* Large Parameters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
          {(['ph', 'tds', 'turbidity', 'temperature', 'flow_rate'] as const).map((key) => {
            const config = METRIC_CONFIG[key]
            const val = latestReading ? latestReading[key] : undefined
            return (
              <GlassCard key={key} className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  {config.label}
                </span>
                <span className="text-2xl font-black text-slate-800 tracking-tight mt-2 block">
                  {val !== undefined ? config.format(val) : '--'}
                </span>
                <span className="text-[20px] mt-1.5">{config.icon}</span>
              </GlassCard>
            )
          })}
        </div>

        {/* Live scrolling telemetry packet log */}
        <GlassCard className="flex-1 flex flex-col min-h-0">
          <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <Play className="h-4 w-4 text-emerald-500 fill-current animate-pulse" /> Live Telemetry Log
              </h2>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                Showing newest incoming sensor messages first
              </span>
            </div>

            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border text-[10px] font-bold">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-md transition-all ${
                  activeTab === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                All Packets
              </button>
              <button
                onClick={() => setActiveTab('critical')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${
                  activeTab === 'critical' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                <CircleAlert className="h-3 w-3" /> Anomalies Only
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 pr-1 scrollbar-thin">
            {liveFeed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-semibold">
                <Activity className="h-8 w-8 text-sky-400 animate-pulse mb-2" />
                Listening for device packets...
              </div>
            ) : (
              liveFeed
                .filter((r) => activeTab === 'all' || Object.keys(r.anomaly_flags || {}).length > 0)
                .map((reading, idx) => {
                  const hasAnomalies = Object.keys(reading.anomaly_flags || {}).length > 0
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        hasAnomalies
                          ? 'border-rose-100 bg-rose-500/5 hover:bg-rose-500/10'
                          : 'border-slate-100 bg-white/40 hover:bg-white/80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                        <span className="text-xs font-black text-slate-800">
                          {reading.device_id}
                        </span>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
                          <span>pH: {reading.ph.toFixed(2)}</span>
                          <span>TDS: {Math.round(reading.tds)} ppm</span>
                          <span>NTU: {reading.turbidity.toFixed(2)}</span>
                          <span>Temp: {reading.temperature.toFixed(1)}°C</span>
                          <span>Flow: {reading.flow_rate.toFixed(1)} L/m</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400">
                          {formatTime(reading.timestamp)}
                        </span>
                        <span
                          className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                            hasAnomalies ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {reading.quality_score} pts
                        </span>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
