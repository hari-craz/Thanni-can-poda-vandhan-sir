import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { Activity, ShieldCheck, History } from 'lucide-react'

export function AuditPage() {
  const auditLogs = [
    { action: 'rotate_key', actor: 'superadmin@hydronix.com', target: 'esp32-node-01', date: 'Jun 15, 2026 14:32' },
    { action: 'provision_node', actor: 'superadmin@hydronix.com', target: 'esp32-node-03', date: 'Jun 12, 2026 10:15' },
    { action: 'calibrate_sensor', actor: 'admin@hydronix.com', target: 'esp32-node-01', date: 'Jun 10, 2026 11:22' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Administrative Audit Logs
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Superadmin ledger recording all state modifications, provision operations, and safety adjustments.
        </p>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-1.5">
          <History className="h-5 w-5 text-sky-500" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            Audit Trail Ledger
          </h2>
        </div>

        <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Action Type</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Actor Account</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Target Resource</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Action Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLogs.map((log, index) => (
              <tr key={index} className="hover:bg-slate-50/20 transition-colors">
                <td className="p-4 text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <span className="font-extrabold uppercase text-[10px] tracking-wider bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                    {log.action}
                  </span>
                </td>
                <td className="p-4 text-slate-500 font-semibold">{log.actor}</td>
                <td className="p-4 text-slate-800">{log.target}</td>
                <td className="p-4 text-slate-400 font-semibold">{log.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}
