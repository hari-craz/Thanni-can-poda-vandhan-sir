import { useState } from 'react'
import { useDevices } from '@/hooks/useDevices'
import { rotateApiKey, calibrateDevice } from '@/services/devices'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Cpu, MapPin, KeyRound, Check, Copy, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { formatDateTime } from '@/utils/formatters'

export function AdminDevicesPage() {
  const { data: devicesRes, refetch } = useDevices()
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  
  // Modals state
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [isRotatingKey, setIsRotatingKey] = useState(false)
  
  // Calibration Inputs
  const [phFactor, setPhFactor] = useState('1.0')
  const [phOffset, setPhOffset] = useState('0.0')
  const [tdsFactor, setTdsFactor] = useState('1.0')
  
  // Key rotation display state
  const [rotatedKey, setRotatedKey] = useState('')
  const [copied, setCopied] = useState(false)

  const devices = devicesRes?.devices || []

  const handleRotateKey = async () => {
    if (!selectedDevice) return
    try {
      const res = await rotateApiKey(selectedDevice)
      setRotatedKey(res.new_key)
      setIsRotatingKey(true)
      refetch()
    } catch (err) {
      alert('Key rotation failed')
    }
  }

  const handleCalibrate = async () => {
    if (!selectedDevice) return
    try {
      await calibrateDevice(selectedDevice, {
        ph_factor: parseFloat(phFactor),
        ph_offset: parseFloat(phOffset),
        tds_factor: parseFloat(tdsFactor),
      })
      alert('Calibration offsets applied successfully')
      setIsCalibrating(false)
      refetch()
    } catch (err) {
      alert('Calibration submission failed')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(rotatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            ESP32 Node Management
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Rotate authentication keys, submit calibration offsets, and audit remote ESP32 configurations.
          </p>
        </div>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Device ID</th>
                <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Name</th>
                <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Location</th>
                <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Status</th>
                <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Registered</th>
                <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                    No nodes registered.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.device_id} className="hover:bg-slate-50/20 transition-colors">
                    <td className="p-4 text-slate-800 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-slate-400" />
                      {device.device_id}
                    </td>
                    <td className="p-4 text-slate-800">{device.name}</td>
                    <td className="p-4 text-slate-500 font-semibold">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {device.location}
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={device.status} />
                    </td>
                    <td className="p-4 text-slate-400 font-semibold">
                      {formatDateTime(device.created_at)}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => {
                          setSelectedDevice(device.device_id)
                          setIsCalibrating(true)
                        }}
                      >
                        Calibrate
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-amber-700 border-amber-200/50 hover:bg-amber-50"
                        onClick={() => {
                          setSelectedDevice(device.device_id)
                          handleRotateKey()
                        }}
                      >
                        Rotate Key
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Calibration Dialog */}
      {isCalibrating && selectedDevice && (
        <Dialog open={isCalibrating} onOpenChange={setIsCalibrating}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Calibrate Node: {selectedDevice}</DialogTitle>
              <DialogDescription>
                Submit calibration multipliers and offsets to correct sensor readings directly at the API parsing layer.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="pH Multiplier (Factor)"
                  type="number"
                  step="0.0001"
                  value={phFactor}
                  onChange={(e) => setPhFactor(e.target.value)}
                />
                <Input
                  label="pH Offset"
                  type="number"
                  step="0.0001"
                  value={phOffset}
                  onChange={(e) => setPhOffset(e.target.value)}
                />
              </div>

              <Input
                label="TDS Calibration Multiplier"
                type="number"
                step="0.0001"
                value={tdsFactor}
                onChange={(e) => setTdsFactor(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCalibrating(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCalibrate}>
                Apply Calibration Parameters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Key Rotated Dialog */}
      {isRotatingKey && (
        <Dialog open={isRotatingKey} onOpenChange={setIsRotatingKey}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-amber-600 flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> API Token Rotated Successfully
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs font-semibold leading-relaxed">
                Copy this key immediately. It is encrypted in the database and cannot be retrieved again.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 flex items-center justify-between gap-4 font-mono text-xs select-all">
              <span className="truncate">{rotatedKey}</span>
              <Button variant="ghost" size="icon" onClick={handleCopy} className="text-white hover:bg-white/10 shrink-0">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex gap-2 p-3 rounded-xl border border-amber-200/50 bg-amber-500/5 text-amber-800 text-[11px] font-semibold leading-normal">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Update the ESP32 configuration payload with this rotated API Key to prevent heartbeat disconnects.</span>
            </div>

            <DialogFooter>
              <Button variant="primary" className="w-full justify-center" onClick={() => setIsRotatingKey(false)}>
                I have securely saved this token
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
