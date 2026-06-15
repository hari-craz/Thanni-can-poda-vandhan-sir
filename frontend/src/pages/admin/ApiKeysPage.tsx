import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { KeyRound, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function ApiKeysPage() {
  const keys = [
    { name: 'Grafana Read Dashboard', prefix: 'hyd_live_...', created: 'Jun 12, 2026', scope: 'Read-Only' },
    { name: 'SCADA Webhook Pipe', prefix: 'hyd_write_...', created: 'Jun 10, 2026', scope: 'Read/Write' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            System API Keys
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Superadmin credentials configuration for external services integration.
          </p>
        </div>
        <Button variant="primary" className="flex items-center gap-1.5 self-start">
          <Plus className="h-4 w-4" /> Generate API Key
        </Button>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Key Label Name</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Token Prefix</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Integration Scope</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Created Date</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {keys.map((k) => (
              <tr key={k.name} className="hover:bg-slate-50/20 transition-colors">
                <td className="p-4 text-slate-800 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  {k.name}
                </td>
                <td className="p-4 text-slate-500 font-mono">{k.prefix}</td>
                <td className="p-4">
                  <Badge variant={k.scope === 'Read-Only' ? 'secondary' : 'info'}>{k.scope}</Badge>
                </td>
                <td className="p-4 text-slate-400 font-semibold">{k.created}</td>
                <td className="p-4 text-right">
                  <button className="text-rose-600 hover:underline cursor-pointer">Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}
