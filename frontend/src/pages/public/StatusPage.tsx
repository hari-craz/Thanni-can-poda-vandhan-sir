import { useSystemStatus, useHealthCheck } from '@/hooks/useSystemStatus'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { Server, ShieldCheck, Database, Send, Radio } from 'lucide-react'

export function StatusPage() {
  const { data: status, isLoading: statusLoading } = useSystemStatus()
  const { data: health, isLoading: healthLoading } = useHealthCheck()

  const formatUptime = (secs: number | undefined) => {
    if (secs === undefined) return '--'
    const days = Math.floor(secs / (3600 * 24))
    const hours = Math.floor((secs % (3600 * 24)) / 3600)
    const minutes = Math.floor((secs % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          System Operational Status
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Monitor system services, network routing, and message broker health metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 flex flex-col items-center justify-center text-center">
          <Server className="h-8 w-8 text-sky-500 mb-3" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            FastAPI Server
          </span>
          <Badge variant={status?.backend_status === 'healthy' || status?.ok ? 'success' : 'danger'} className="mt-3">
            {status?.backend_status || 'Operational'}
          </Badge>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col items-center justify-center text-center">
          <Database className="h-8 w-8 text-indigo-500 mb-3" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Postgres DB
          </span>
          <Badge variant={status?.database_status === 'healthy' || status?.ok ? 'success' : 'danger'} className="mt-3">
            {status?.database_status || 'Operational'}
          </Badge>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col items-center justify-center text-center">
          <Radio className="h-8 w-8 text-teal-500 mb-3" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            MQTT Message Broker
          </span>
          <Badge variant={status?.mqtt_broker_status === 'healthy' || status?.ok ? 'success' : 'danger'} className="mt-3">
            {status?.mqtt_broker_status || 'Operational'}
          </Badge>
        </GlassCard>
      </div>

      <GlassCard className="p-6 space-y-6">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
          <ShieldCheck className="h-5 w-5 text-sky-500" /> Operational Metrics & Uptime
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-500">System Uptime</span>
            <span className="text-slate-800">{formatUptime(status?.uptime_seconds)}</span>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-500">Active Sensor Stations</span>
            <span className="text-slate-800">{status?.active_devices ?? 0}</span>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-500">Total Registered Nodes</span>
            <span className="text-slate-800">{status?.total_devices ?? 0}</span>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-500">FastAPI Status</span>
            <span className="text-slate-800 capitalize">{health?.status || 'Operational'}</span>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
