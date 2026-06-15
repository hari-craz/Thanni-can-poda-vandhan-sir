import { useAnomalies } from '@/hooks/useAnomalies'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/utils/formatters'
import { Cpu, Activity, AlertTriangle } from 'lucide-react'

export function AnomaliesPage() {
  const { data: anomaliesRes, isLoading } = useAnomalies()

  const anomalies = anomaliesRes?.anomalies || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Anomaly Audits
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Review outliers flagged automatically by backend statistical models.
        </p>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-indigo-500" /> Flagged Outliers
          </h2>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm font-semibold">
            Loading anomalies...
          </div>
        ) : anomalies.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm font-semibold">
            No anomalous values recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Device ID</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Parameter</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Observed Value</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Severity</th>
                  <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Audit Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anomalies.map((a) => {
                  const flaggedParams = Object.keys(a.anomaly_flags || {})
                  const parameterName = flaggedParams.join(', ').toUpperCase() || 'UNKNOWN'
                  const observedValue = flaggedParams.map(p => `${p.toUpperCase()}: ${a.values[p]?.toFixed(2)}`).join(', ') || 'N/A'
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/20 transition-colors">
                      <td className="p-4 text-slate-800 flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-slate-400" />
                        {a.device_id}
                      </td>
                      <td className="p-4 text-slate-800 uppercase">{parameterName}</td>
                      <td className="p-4 text-slate-800">{observedValue}</td>
                      <td className="p-4">
                        <Badge variant="warning">FLAGGED</Badge>
                      </td>
                      <td className="p-4 text-slate-400 font-semibold">
                        {formatDateTime(a.timestamp)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
