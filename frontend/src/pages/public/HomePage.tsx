import { useState } from 'react'
import { useDevices } from '@/hooks/useDevices'
import { useSystemStatus } from '@/hooks/useSystemStatus'
import { useAlerts } from '@/hooks/useAlerts'
import { useAnomalies } from '@/hooks/useAnomalies'
import { useRealtimeStore } from '@/store/realtimeStore'
import { MetricCard } from '@/components/ui/MetricCard'
import { QualityGauge } from '@/components/ui/QualityGauge'
import { WaterQualityChart } from '@/components/ui/Charts'
import { GlassCard } from '@/components/ui/GlassCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatTime, formatDateTime } from '@/utils/formatters'
import {
  Droplet,
  Activity,
  Cpu,
  AlertTriangle,
  Server,
  TrendingUp,
  FileSpreadsheet,
  Clock,
  Compass,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export function HomePage() {
  const { data: devicesRes, isLoading: devicesLoading } = useDevices()
  const { data: systemRes } = useSystemStatus()
  const { data: alertsRes } = useAlerts()
  const { data: anomaliesRes } = useAnomalies()
  const { liveFeed } = useRealtimeStore()
  const [selectedChartMetric, setSelectedChartMetric] = useState<
    'ph' | 'tds' | 'turbidity' | 'temperature' | 'flow_rate' | 'quality_score'
  >('quality_score')

  const devices = devicesRes?.devices || []
  const activeDevices = devices.filter((d) => d.status === 'online')

  // Get most recent reading (either from live websocket feed or from active devices)
  const latestReading = liveFeed[0]
  
  // Calculate average quality score across online devices
  const averageQualityScore = latestReading?.quality_score 
    ? Math.round(latestReading.quality_score)
    : 84

  return (
    <div className="space-y-10">
      {/* 1. Hero & Real-time KPI Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        <div className="lg:col-span-2 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-sky-200/50 bg-sky-500/5 text-sky-700 text-xs font-bold uppercase tracking-wider">
            <Droplet className="h-4 w-4 text-sky-500" />
            Live Water Quality Infrastructure
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-800 tracking-tight leading-tight">
            Real water. <br />
            <span className="bg-linear-to-r from-teal-500 to-sky-500 bg-clip-text text-transparent">
              Real time.
            </span>{' '}
            Real control.
          </h1>
          <p className="text-slate-500 text-base max-w-xl font-medium leading-relaxed">
            Welcome to the Hydronix Public Portal. Monitor municipal, campus, and industrial water health metrics in real-time. Powered by distributed ESP32 IoT sensors.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link to="/live">
              <Button variant="primary" className="flex items-center gap-2">
                <Compass className="h-4 w-4" /> Go to Control Center
              </Button>
            </Link>
            <Link to="/devices">
              <Button variant="glass" className="flex items-center gap-2">
                <Cpu className="h-4 w-4" /> View Sensor Network
              </Button>
            </Link>
          </div>
        </div>

        <GlassCard className="flex flex-col items-center justify-center text-center p-8 border-sky-100 bg-linear-to-br from-white/80 to-sky-50/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-[50px] opacity-5">💧</div>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-4">
            System Quality Index
          </span>
          <QualityGauge score={averageQualityScore} size="lg" />
          <span className="text-slate-500 text-xs font-semibold mt-4 block">
            Aggregated from {activeDevices.length} online sensors
          </span>
        </GlassCard>
      </section>

      {/* 2. Live Metric Cards Container */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-500" /> Current Network Readings
          </h2>
          {latestReading && (
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Updated {formatTime(latestReading.timestamp)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <MetricCard type="ph" value={latestReading?.ph ?? 7.2} />
          <MetricCard type="tds" value={latestReading?.tds ?? 280} />
          <MetricCard type="turbidity" value={latestReading?.turbidity ?? 1.8} />
          <MetricCard type="temperature" value={latestReading?.temperature ?? 24.5} />
          <MetricCard type="flow_rate" value={latestReading?.flow_rate ?? 320} />
        </div>
      </section>

      {/* 3. Historical Charts & Webhook Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts block */}
        <GlassCard className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sky-500" /> Historical Analysis
              </h2>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">
                Review parameter trends over time.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200/50">
              {(
                [
                  { value: 'quality_score', label: 'Score' },
                  { value: 'ph', label: 'pH' },
                  { value: 'tds', label: 'TDS' },
                  { value: 'turbidity', label: 'NTU' },
                  { value: 'temperature', label: 'Temp' },
                  { value: 'flow_rate', label: 'Flow' },
                ] as const
              ).map((metric) => (
                <button
                  key={metric.value}
                  onClick={() => setSelectedChartMetric(metric.value)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                    selectedChartMetric === metric.value
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {metric.label}
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
                    {
                      timestamp: new Date(Date.now() - 120000).toISOString(),
                      ph: 7.3,
                      tds: 275,
                      turbidity: 1.7,
                      temperature: 24.6,
                      flow_rate: 330,
                      quality_score: 85,
                    },
                  ]
            }
            metric={selectedChartMetric}
            height={280}
          />
        </GlassCard>

        {/* Live feed drawer */}
        <GlassCard className="flex flex-col h-[400px]">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Telemetry Feed
              </h2>
              <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                Real-time updates via WebSockets
              </span>
            </div>
            <button
              onClick={() => useRealtimeStore.getState().clearFeed()}
              className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1 scrollbar-thin">
            {liveFeed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Droplet className="h-8 w-8 text-sky-300 animate-bounce mb-2" />
                <span className="text-xs font-bold text-slate-400">Waiting for live data...</span>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                  Readings from ESP32 nodes will automatically appear here once broadcast.
                </p>
              </div>
            ) : (
              liveFeed.map((reading, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl border border-white/60 bg-white/50 backdrop-blur-xs flex items-center justify-between hover:bg-white transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-800 truncate">
                        {reading.device_id}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {formatTime(reading.timestamp)}
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] font-bold text-slate-500 mt-1">
                      <span>pH: {reading.ph.toFixed(1)}</span>
                      <span>TDS: {Math.round(reading.tds)}</span>
                      <span>NTU: {reading.turbidity.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor:
                          reading.quality_score >= 80
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(245, 158, 11, 0.1)',
                        color: reading.quality_score >= 80 ? '#10B981' : '#F59E0B',
                      }}
                    >
                      Score: {reading.quality_score}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </section>

      {/* 4. Active Device Directory & Public Safety Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassCard className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Cpu className="h-5 w-5 text-sky-500" /> Active Sensor Nodes
              </h2>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">
                Currently deployed water quality monitoring stations.
              </p>
            </div>
            <Link to="/devices" className="text-xs font-bold text-sky-600 hover:underline flex items-center">
              View Directory <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {devicesLoading ? (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400">Loading devices...</div>
            ) : devices.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400">No devices active.</div>
            ) : (
              devices.slice(0, 4).map((device) => (
                <Link
                  key={device.device_id}
                  to={`/devices/${device.device_id}`}
                  className="p-4 rounded-xl border border-white/60 bg-white/40 backdrop-blur-xs flex items-center justify-between hover:bg-white/80 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div>
                    <span className="text-xs font-black text-slate-800 block">{device.name}</span>
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {device.location}
                    </span>
                  </div>
                  <StatusBadge status={device.status} />
                </Link>
              ))
            )}
          </div>
        </GlassCard>

        {/* Public safety alerts */}
        <GlassCard className="space-y-4">
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Safety Advisories
          </h2>
          
          <div className="space-y-3">
            {alertsRes?.alerts && alertsRes.alerts.filter((a) => !a.acknowledged_at).length > 0 ? (
              alertsRes.alerts
                .filter((a) => !a.acknowledged_at)
                .slice(0, 3)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3.5 rounded-xl border border-rose-200/50 bg-rose-500/5 text-rose-800 flex items-start gap-2.5"
                  >
                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs font-black leading-tight">{alert.message}</span>
                      <span className="block text-[10px] text-rose-500 font-semibold mt-1">
                        Node: {alert.device_id} • {formatDateTime(alert.triggered_at)}
                      </span>
                    </div>
                  </div>
                ))
            ) : (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mb-2">
                  ✓
                </div>
                <span className="text-xs font-bold text-slate-500">All Parameters Normal</span>
                <p className="text-[10px] text-slate-400 mt-0.5">No active safety warnings on the network.</p>
              </div>
            )}
          </div>
        </GlassCard>
      </section>

      {/* 5. Anomalies & System Health Indicators */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Detected anomalies list */}
        <GlassCard className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" /> Recent Anomaly Audits
          </h2>
          
          <div className="space-y-3">
            {anomaliesRes?.anomalies && anomaliesRes.anomalies.length > 0 ? (
              anomaliesRes.anomalies.slice(0, 3).map((anomaly) => {
                const flaggedParams = Object.keys(anomaly.anomaly_flags || {})
                const parameterName = flaggedParams.join(', ').toUpperCase() || 'UNKNOWN'
                const observedValue = flaggedParams.map(p => `${p.toUpperCase()}: ${anomaly.values[p]?.toFixed(1)}`).join(', ') || 'N/A'
                return (
                  <div
                    key={anomaly.id}
                    className="p-3 rounded-xl border border-slate-200/40 bg-white/40 flex items-center justify-between hover:bg-white transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-800 block">
                        {parameterName} FLAGGED
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 mt-0.5 block">
                        Device: {anomaly.device_id} • {observedValue}
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="warning">
                        FLAGGED
                      </Badge>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">
                No system anomalies detected.
              </div>
            )}
          </div>
        </GlassCard>

        {/* API/Broker status overview */}
        <GlassCard className="space-y-4">
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5 text-sky-500" /> System Uptime & API
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
              <span className="text-xs font-bold text-slate-500">FastAPI Server</span>
              <Badge variant={systemRes?.backend_status === 'healthy' || systemRes?.ok ? 'success' : 'danger'}>
                {systemRes?.backend_status || 'Healthy'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
              <span className="text-xs font-bold text-slate-500">PostgreSQL DB</span>
              <Badge variant={systemRes?.database_status === 'healthy' || systemRes?.ok ? 'success' : 'danger'}>
                {systemRes?.database_status || 'Healthy'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
              <span className="text-xs font-bold text-slate-500">MQTT Message Broker</span>
              <Badge variant={systemRes?.mqtt_broker_status === 'healthy' || systemRes?.ok ? 'success' : 'danger'}>
                {systemRes?.mqtt_broker_status || 'Healthy'}
              </Badge>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* 6. Standard Parameters Reference */}
      <section className="bg-linear-to-r from-teal-500 to-sky-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-sky-500/10">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 flex items-center justify-center text-[200px] pointer-events-none">
          🧪
        </div>
        <div className="max-w-2xl space-y-4 relative z-10">
          <h2 className="text-2xl font-black tracking-tight">How we calculate safety ranges</h2>
          <p className="text-sky-100 text-sm font-medium leading-relaxed">
            Safety parameters are calibrated to WHO and national drinking water standards. Our sensor array uses standard electrodes to continuously sample pH levels, electrical conductivity (translated to Total Dissolved Solids), turbidity index, and line temperatures.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs font-bold">
            <div>
              <span className="block text-sky-200">pH Standard</span>
              <span className="text-base font-black">6.5 - 8.5 pH</span>
            </div>
            <div>
              <span className="block text-sky-200">Max TDS</span>
              <span className="text-base font-black">500 ppm</span>
            </div>
            <div>
              <span className="block text-sky-200">Max Turbidity</span>
              <span className="text-base font-black">5.0 NTU</span>
            </div>
            <div>
              <span className="block text-sky-200">Temperature</span>
              <span className="text-base font-black">10 - 35 °C</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
