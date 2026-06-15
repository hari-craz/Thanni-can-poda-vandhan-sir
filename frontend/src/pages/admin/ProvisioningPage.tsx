import { useState } from 'react'
import { provisionDevice } from '@/services/devices'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Cpu, ShieldCheck, Check, Copy, ArrowRight, Key, QrCode } from 'lucide-react'

export function ProvisioningPage() {
  const [deviceId, setDeviceId] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState<any | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessData(null)
    setLoading(true)

    if (!deviceId || !name || !location) {
      setError('Please fill out all fields.')
      setLoading(false)
      return
    }

    try {
      const res = await provisionDevice({
        device_id: deviceId,
        name,
        location,
      })
      setSuccessData(res)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Provisioning request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyKey = () => {
    if (!successData?.api_key) return
    navigator.clipboard.writeText(successData.api_key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Provision ESP32 Sensor
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Register new IoT water quality telemetry devices on the network.
        </p>
      </div>

      {!successData ? (
        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Unique Device ID"
              placeholder="esp32-node-01"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            />

            <Input
              label="Device Name"
              placeholder="Main Water Line Inlet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Deployment Location"
              placeholder="Block A, Ground Floor"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            {error && (
              <div className="p-3 rounded-xl border border-red-200/50 bg-red-500/5 text-red-600 text-xs font-bold">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full justify-center py-3" disabled={loading}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              {loading ? 'Provisioning Device Node...' : 'Authorize Node Provisioning'}
            </Button>
          </form>
        </GlassCard>
      ) : (
        <GlassCard className="space-y-6 border-emerald-200 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">Node Authorized</h3>
              <span className="text-xs text-emerald-600 font-bold">Ready for device flashing</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Unique Device API Token</span>
              <div className="mt-1.5 p-3 rounded-xl bg-slate-900 text-slate-100 flex items-center justify-between gap-4 font-mono text-xs select-all">
                <span className="truncate">{successData.api_key}</span>
                <Button variant="ghost" size="icon" onClick={handleCopyKey} className="text-white hover:bg-white/10 shrink-0">
                  {copiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200/50">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block">Flash Configuration QR</span>
                <div className="p-4 rounded-2xl bg-white border flex flex-col items-center justify-center">
                  {successData.qr_code ? (
                    <img src={successData.qr_code} alt="ESP32 Flash QR Code" className="w-36 h-36" />
                  ) : (
                    <QrCode className="w-24 h-24 text-slate-300" />
                  )}
                  <span className="text-[10px] text-slate-400 font-bold mt-2">Scan with ESP32 setup tool</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block">Setup Instructions URL</span>
                <div className="p-4 rounded-2xl bg-white border flex flex-col justify-between h-44">
                  <p className="text-[11px] font-semibold text-slate-500 leading-normal">
                    This setup URL provides details required by the flashing firmware tool to finalize provisioning of the ESP32 board.
                  </p>
                  <a
                    href={successData.setup_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-black text-sky-600 hover:text-sky-700 flex items-center gap-1 mt-2"
                  >
                    Open Setup Dashboard <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/50 flex justify-end">
            <Button variant="secondary" onClick={() => setSuccessData(null)}>
              Provision Another Device
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
