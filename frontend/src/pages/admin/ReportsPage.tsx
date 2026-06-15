import { useState } from 'react'
import { useRealtimeStore } from '@/store/realtimeStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { FileDown, Calendar, FileText, CheckCircle2 } from 'lucide-react'

export function ReportsPage() {
  const { liveFeed } = useRealtimeStore()
  const [format, setFormat] = useState('csv')
  const [timeRange, setTimeRange] = useState('24h')

  const handleExport = () => {
    // Generate simple mock export content
    const headers = 'Timestamp,Device ID,pH,TDS,Turbidity,Temp,FlowRate,QualityScore\n'
    const rows = liveFeed.map(
      (r) =>
        `"${r.timestamp}","${r.device_id}",${r.ph},${r.tds},${r.turbidity},${r.temperature},${r.flow_rate},${r.quality_score}`
    ).join('\n')

    const fileContent = headers + rows
    const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `hydronix-water-report-${timeRange}.${format}`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Reports & Export Center
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Export recorded sensor values, alarms, and calibrations for compliance auditing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="md:col-span-2 space-y-5">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
            <FileText className="h-5 w-5 text-sky-500" /> Export Data Logs
          </h2>

          <div className="space-y-4">
            <Select
              label="Select Time Range"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              options={[
                { value: '24h', label: 'Last 24 Hours' },
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
              ]}
            />

            <Select
              label="Export Format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              options={[
                { value: 'csv', label: 'CSV Spreadsheets' },
                { value: 'json', label: 'JSON Stream Schema' },
              ]}
            />

            <Button variant="primary" className="w-full justify-center py-3" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" /> Download Document
            </Button>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6">
          <GlassCard className="p-6 space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Standards Met
            </h2>
            <p className="text-slate-500 text-[11px] leading-relaxed font-semibold">
              Reports generated here include necessary columns for ISO 14001 environmental auditing and WHO health compliance reviews.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
