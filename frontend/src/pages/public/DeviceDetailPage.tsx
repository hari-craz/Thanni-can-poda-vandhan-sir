import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDevice, useCalibrationStatus } from '@/hooks/useDevices'
import { useSensorData } from '@/hooks/useSensorData'
import { GlassCard } from '@/components/ui/GlassCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { WaterQualityChart } from '@/components/ui/Charts'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { formatDateTime } from '@/utils/formatters'
import {
  ArrowLeft,
  Cpu,
  MapPin,
  Clock,
  Wrench,
  Activity,
  History,
  AlertTriangle,
} from 'lucide-react'

export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const { data: device, isLoading: deviceLoading } = useDevice(deviceId || '')
  const { data: sensorDataRes, isLoading: dataLoading } = useSensorData(deviceId || '')
  const { data: calibration } = useCalibrationStatus(deviceId || '')
  const [activeTab, setActiveTab] = useState<'charts' | 'calibration' | 'history'>('charts')
  const [selectedChartMetric, setSelectedChartMetric] = useState<
    'ph' | 'tds' | 'turbidity' | 'temperature' | 'flow_rate' | 'quality_score'
  >('quality_score')

  if (deviceLoading || !deviceId) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm font-semibold">
        Loading device parameters...
      </div>
    )
  }

  if (!device) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm font-semibold">
        Sensor node not found. <br />
        <Link to="/devices" className="text-sky-600 hover:underline mt-2 inline-block">
          Return to directory
        </Link>
      </div>
    )
  }

  const readings = sensorDataRes?.readings || []
  const latestReading = readings[0]

  return (
    <div className="space-y-6">
      {/* Back nav & Header */}
      <div className="flex flex-col gap-4">
        <Link to="/devices">
          <Button variant="ghost" size="sm" className="-ml-3 text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Directory
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-xs">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                  {device.name}
                </h1>
                <StatusBadge status={device.status} />
              </div>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5" /> {device.location} • ID: {device.device_id}
              </span>
            </div>
          </div>

          {latestReading && (
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Last active: {formatDateTime(latestReading.timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Current KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard type="ph" value={latestReading?.ph} />
        <MetricCard type="tds" value={latestReading?.tds} />
        <MetricCard type="turbidity" value={latestReading?.turbidity} />
        <MetricCard type="temperature" value={latestReading?.temperature} />
        <MetricCard type="flow_rate" value={latestReading?.flow_rate} />
      </div>

      {/* Tabs segment */}
      <Tabs defaultValue="charts" className="w-full">
        <TabsList>
          <TabsTrigger value="charts" className="flex items-center gap-1.5">
            <Activity className="h-4 w-4" /> Telemetry Charts
          </TabsTrigger>
          <TabsTrigger value="calibration" className="flex items-center gap-1.5">
            <Wrench className="h-4 w-4" /> Calibration Specs
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-4 w-4" /> Data History Logs
          </TabsTrigger>
        </TabsList>

        {/* Charts tab */}
        <TabsContent value="charts">
          <GlassCard className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  Live Trend Analysis
                </h2>
                <span className="text-[10px] font-semibold text-slate-400">
                  Select parameter to visualize sensor performance history
                </span>
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

            {dataLoading ? (
              <div className="py-20 text-center text-xs text-slate-400 font-semibold">
                Retrieving chart history...
              </div>
            ) : readings.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400 font-semibold">
                No telemetry data reported yet.
              </div>
            ) : (
              <WaterQualityChart data={readings as any[]} metric={selectedChartMetric} height={300} />
            )}
          </GlassCard>
        </TabsContent>

        {/* Calibration tab */}
        <TabsContent value="calibration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard className="space-y-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <Wrench className="h-4 w-4 text-sky-500" /> Sensor Calibration Status
              </h2>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Needs Calibration</span>
                  <span className={calibration?.needs_calibration ? 'text-rose-600' : 'text-emerald-600'}>
                    {calibration?.needs_calibration ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Calibration Overdue</span>
                  <span className={calibration?.calibration_overdue ? 'text-rose-600' : 'text-emerald-600'}>
                    {calibration?.calibration_overdue ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Due In Days</span>
                  <span className="text-slate-800">
                    {calibration?.calibration_due_in_days !== null && calibration?.calibration_due_in_days !== undefined
                      ? `${calibration.calibration_due_in_days} days`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Last Calibrated Date</span>
                  <span className="text-slate-800">
                    {calibration?.last_calibration_at
                      ? formatDateTime(calibration.last_calibration_at)
                      : 'Never'}
                  </span>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="space-y-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-indigo-500" /> Device Specs
              </h2>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Firmware Build</span>
                  <span className="text-slate-800">{device.firmware_version || 'v1.0.2'}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Node Status</span>
                  <span className="text-slate-800 capitalize">{device.status}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-500">Created At</span>
                  <span className="text-slate-800">{formatDateTime(device.created_at)}</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history">
          <GlassCard className="p-0 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Data Transmission Logs
              </h2>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                History of packets received from this sensor station
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Timestamp</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">pH</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">TDS</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Turbidity</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Temp</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Flow Rate</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {readings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">
                        No history records found.
                      </td>
                    </tr>
                  ) : (
                    readings.map((reading) => (
                      <tr key={reading.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="p-4 text-slate-500 font-semibold">
                          {formatDateTime(reading.timestamp)}
                        </td>
                        <td className="p-4 text-slate-800">{reading.ph.toFixed(2)}</td>
                        <td className="p-4 text-slate-800">{Math.round(reading.tds)} ppm</td>
                        <td className="p-4 text-slate-800">{reading.turbidity.toFixed(2)} NTU</td>
                        <td className="p-4 text-slate-800">{reading.temperature.toFixed(1)}°C</td>
                        <td className="p-4 text-slate-800">{reading.flow_rate.toFixed(1)} L/m</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-md ${
                              reading.quality_score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {reading.quality_score}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
