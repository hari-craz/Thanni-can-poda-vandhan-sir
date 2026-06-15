import { useState } from 'react'
import { useDevices } from '@/hooks/useDevices'
import { GlassCard } from '@/components/ui/GlassCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Grid, List, Search, MapPin, Cpu, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function DevicesPage() {
  const { data: devicesRes, isLoading } = useDevices()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const devices = devicesRes?.devices || []

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.device_id.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Sensor Network Directory
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Browse active and offline Hydronix ESP32 telemetry nodes across campus.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 self-start">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-xs' : ''}`}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-md ${viewMode === 'list' ? 'bg-white shadow-xs' : ''}`}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <GlassCard className="p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or location..."
            className="pl-10"
          />
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-sm font-semibold">
          Loading devices...
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="py-20 text-center text-slate-400 text-sm font-semibold">
          No matching telemetry nodes found.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredDevices.map((device) => (
            <GlassCard key={device.device_id} className="p-6 flex flex-col justify-between h-48 group">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-400 block tracking-widest uppercase">
                      Node: {device.device_id}
                    </span>
                    <h3 className="text-base font-black text-slate-800 tracking-tight mt-1 truncate">
                      {device.name}
                    </h3>
                  </div>
                  <StatusBadge status={device.status} className="shrink-0" />
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-4">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {device.location}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400">
                  Firmware: {device.firmware_version || 'v1.0.0'}
                </span>
                <Link
                  to={`/devices/${device.device_id}`}
                  className="text-xs font-black text-sky-600 hover:text-sky-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                >
                  Inspect details <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/50 bg-white/40 backdrop-blur-md">
          <div className="divide-y divide-slate-100">
            {filteredDevices.map((device) => (
              <div
                key={device.device_id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/60 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">{device.name}</h3>
                    <span className="text-xs font-semibold text-slate-400">
                      ID: {device.device_id} • Location: {device.location}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end sm:self-auto">
                  <StatusBadge status={device.status} />
                  <Link
                    to={`/devices/${device.device_id}`}
                    className="text-xs font-black text-sky-600 hover:underline flex items-center gap-0.5"
                  >
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
