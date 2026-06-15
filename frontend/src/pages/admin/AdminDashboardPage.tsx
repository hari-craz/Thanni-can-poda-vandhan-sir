import { useDevices } from '@/hooks/useDevices'
import { useAlerts } from '@/hooks/useAlerts'
import { useAnomalies } from '@/hooks/useAnomalies'
import { useSystemStatus } from '@/hooks/useSystemStatus'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Cpu, AlertTriangle, Activity, Settings, Plus, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@/utils/formatters'

export function AdminDashboardPage() {
  const { data: devicesRes } = useDevices()
  const { data: alertsRes } = useAlerts()
  const { data: anomaliesRes } = useAnomalies()
  const { data: systemRes } = useSystemStatus()

  const devices = devicesRes?.devices || []
  const onlineDevices = devices.filter((d) => d.status === 'online').length
  const activeAlerts = alertsRes?.alerts ? alertsRes.alerts.filter((a) => !a.acknowledged_at).length : 0
  const anomaliesCount = anomaliesRes?.anomalies ? anomaliesRes.anomalies.length : 0

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Total Sensors
            </span>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1.5">
              {devices.length}
            </h3>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">
              Registered Esp32 nodes
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
            <Cpu className="h-6 w-6" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Online Nodes
            </span>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1.5 text-emerald-600">
              {onlineDevices}
            </h3>
            <span className="text-[10px] text-emerald-500 font-bold block mt-1">
              Actively broadcasting
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Activity className="h-6 w-6" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Active Alerts
            </span>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1.5 text-rose-600">
              {activeAlerts}
            </h3>
            <span className="text-[10px] text-rose-500 font-bold block mt-1">
              Requires attention
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Anomalies Tracked
            </span>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1.5 text-indigo-600">
              {anomaliesCount}
            </h3>
            <span className="text-[10px] text-indigo-500 font-bold block mt-1">
              Flagged by ML model
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Activity className="h-6 w-6" />
          </div>
        </GlassCard>
      </div>

      {/* Main dashboard body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Device table summary */}
        <GlassCard className="lg:col-span-2 space-y-4 p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Sensor Network Overview
              </h2>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                Quick status review of deployed sensors
              </span>
            </div>
            <Link to="/admin/devices">
              <Button variant="glass" size="sm">Manage Nodes</Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Device ID</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Name</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Location</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Last Broadcast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">
                      No nodes registered.
                    </td>
                  </tr>
                ) : (
                  devices.slice(0, 5).map((d) => (
                    <tr key={d.device_id} className="hover:bg-slate-50/20 transition-colors">
                      <td className="p-4 text-slate-800">{d.device_id}</td>
                      <td className="p-4 text-slate-800">{d.name}</td>
                      <td className="p-4 text-slate-500 font-semibold flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {d.location}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="p-4 text-slate-400 font-semibold">
                        {d.last_seen ? formatDateTime(d.last_seen) : 'Never'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Quick action list & system health status */}
        <div className="flex flex-col gap-6">
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Administrative Actions
            </h2>
            <div className="flex flex-col gap-3">
              <Link to="/admin/provisioning">
                <Button variant="primary" className="w-full justify-start text-xs py-3.5">
                  <Plus className="mr-2 h-4 w-4" /> Provision New Sensor
                </Button>
              </Link>
              <Link to="/admin/devices">
                <Button variant="glass" className="w-full justify-start text-xs py-3.5">
                  <Settings className="mr-2 h-4 w-4" /> Device Settings
                </Button>
              </Link>
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              API Integration Status
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-500">API Health</span>
                <Badge variant={systemRes?.ok ? 'success' : 'danger'}>
                  {systemRes?.ok ? 'Connected' : 'Offline'}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-500">Active Pipelines</span>
                <span className="text-slate-800">{onlineDevices}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
