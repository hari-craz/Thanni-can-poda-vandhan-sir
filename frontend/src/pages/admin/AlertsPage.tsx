import { useState } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { acknowledgeAlert } from '@/services/alerts'
import { useAuthStore } from '@/store/authStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/Dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { formatDateTime } from '@/utils/formatters'
import { AlertTriangle, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react'

export function AlertsPage() {
  const { data: alertsRes, refetch } = useAlerts()
  const { user } = useAuthStore()
  
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null)
  const [ackMessage, setAckMessage] = useState('')
  const [isAckModalOpen, setIsAckModalOpen] = useState(false)

  const alerts = alertsRes?.alerts || []

  // Filter alerts
  const activeAlerts = alerts.filter((a) => !a.acknowledged_at)
  const acknowledgedAlerts = alerts.filter((a) => a.acknowledged_at)

  const handleAcknowledge = async () => {
    if (!selectedAlertId || !user) return
    try {
      await acknowledgeAlert(selectedAlertId, {
        user_id: user.email,
        acknowledgement_message: ackMessage,
      })
      alert('Alert successfully marked as acknowledged')
      setIsAckModalOpen(false)
      setAckMessage('')
      refetch()
    } catch (err) {
      alert('Failed to acknowledge alert')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Alert Resolution Center
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Acknowledge parameter exceedances and safety warning reports across the network.
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-500" /> Active ({activeAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resolved ({acknowledgedAlerts.length})
          </TabsTrigger>
        </TabsList>

        {/* Active tab content */}
        <TabsContent value="active">
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Severity</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Sensor Node</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Warning Details</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Trigger Time</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">
                        No active alerts requiring attention.
                      </td>
                    </tr>
                  ) : (
                    activeAlerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="p-4">
                          <Badge variant={alert.severity === 'emergency' ? 'danger' : 'warning'}>
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-800">{alert.device_id}</td>
                        <td className="p-4 text-slate-800 leading-normal max-w-sm">{alert.message}</td>
                        <td className="p-4 text-slate-400 font-semibold">
                          {formatDateTime(alert.triggered_at)}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="glass"
                            size="sm"
                            onClick={() => {
                              setSelectedAlertId(alert.id)
                              setIsAckModalOpen(true)
                            }}
                          >
                            Resolve Alert
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </TabsContent>

        {/* Resolved tab content */}
        <TabsContent value="acknowledged">
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Severity</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Sensor Node</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Message</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Resolved By</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Notes</th>
                    <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Resolved Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {acknowledgedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                        No resolved alert history.
                      </td>
                    </tr>
                  ) : (
                    acknowledgedAlerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="p-4">
                          <Badge variant="secondary">{alert.severity}</Badge>
                        </td>
                        <td className="p-4 text-slate-800">{alert.device_id}</td>
                        <td className="p-4 text-slate-500 leading-normal max-w-xs">{alert.message}</td>
                        <td className="p-4 text-slate-800 font-black truncate max-w-[120px]">
                          {alert.acknowledged_by || 'Staff'}
                        </td>
                        <td className="p-4 text-slate-500 font-semibold italic truncate max-w-[160px]">
                          {alert.acknowledgement_message || 'N/A'}
                        </td>
                        <td className="p-4 text-slate-400 font-semibold">
                          {alert.acknowledged_at ? formatDateTime(alert.acknowledged_at) : 'N/A'}
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

      {/* Acknowledge Alert Dialog */}
      {isAckModalOpen && selectedAlertId && (
        <Dialog open={isAckModalOpen} onOpenChange={setIsAckModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Warning Indicator</DialogTitle>
              <DialogDescription>
                Submit resolutions notes detailing steps taken to restore baseline parameters.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Input
                label="Resolution Notes"
                placeholder="Flushed main valves / reset sensor values..."
                value={ackMessage}
                onChange={(e) => setAckMessage(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAckModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAcknowledge}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Mark as Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
