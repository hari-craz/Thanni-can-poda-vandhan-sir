import { GlassCard } from '@/components/ui/GlassCard'
import { Droplet, Info, ShieldAlert, Cpu } from 'lucide-react'

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          About Hydronix
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Learn about the architecture, security roles, and water safety standards behind the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard className="p-6 space-y-4">
          <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
            <Droplet className="h-5 w-5 fill-current" />
          </div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">
            Our Purpose
          </h2>
          <p className="text-slate-500 text-xs font-semibold leading-relaxed">
            Hydronix provides absolute visibility into water safety metrics. Using a distributed network of remote IoT sensors, we aggregate real-time pH, TDS (Total Dissolved Solids), turbidity, and line pressure data, ensuring public water infrastructures stay safe and compliant.
          </p>
        </GlassCard>

        <GlassCard className="p-6 space-y-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">
            Role-Based Security
          </h2>
          <p className="text-slate-500 text-xs font-semibold leading-relaxed">
            While telemetry parameters are public, configuration parameters are secured. Admins configure ESP32 channels and trigger sensor calibrations, while Superadmins provision keys, register staff, audit transactions, and manage system security.
          </p>
        </GlassCard>
      </div>

      <GlassCard className="p-6 space-y-6">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
          <Info className="h-5 w-5 text-sky-500" /> Technology Highlights
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <span className="text-slate-800 text-xs font-black block">Vite + React 19</span>
            <span className="text-slate-400 text-[10px] font-semibold mt-1 block leading-normal">
              Rebuilt from the ground up for instantaneous UI rendering, robust caching, and rich liquid CSS animations.
            </span>
          </div>

          <div>
            <span className="text-slate-800 text-xs font-black block">ESP32 IoT Modules</span>
            <span className="text-slate-400 text-[10px] font-semibold mt-1 block leading-normal">
              Direct telemetry using hardware boards configured with JWT authentication reporting parameters over secure channels.
            </span>
          </div>

          <div>
            <span className="text-slate-800 text-xs font-black block">FastAPI & MQTT</span>
            <span className="text-slate-400 text-[10px] font-semibold mt-1 block leading-normal">
              Backend message ingestion, Postgres caching, and instant WebSocket dispatching to web clients.
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
