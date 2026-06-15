import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Settings, ShieldCheck, Mail, BellRing } from 'lucide-react'

export function SettingsPage() {
  const [smtpServer, setSmtpServer] = useState('smtp.mailgun.org')
  const [smtpPort, setSmtpPort] = useState('587')
  const [senderEmail, setSenderEmail] = useState('alerts@hydronix.com')
  
  const handleSave = () => {
    alert('Global settings updated successfully')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          System Preferences
        </h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">
          Superadmin configuration panel for alert triggers, email gateways, and global defaults.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="md:col-span-2 space-y-6">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
            <Mail className="h-5 w-5 text-sky-500" /> SMTP Notification Gateway
          </h2>

          <div className="space-y-4">
            <Input
              label="SMTP Server Address"
              value={smtpServer}
              onChange={(e) => setSmtpServer(e.target.value)}
            />
            
            <Input
              label="Port"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
            />
            
            <Input
              label="Authorized Sender Address"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />

            <Button variant="primary" className="w-full justify-center py-3" onClick={handleSave}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Save Global Configuration
            </Button>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6">
          <GlassCard className="p-6 space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <BellRing className="h-4 w-4 text-emerald-500" /> Threshold Alerts
            </h2>
            <p className="text-slate-500 text-[11px] leading-relaxed font-semibold">
              Warning triggers are mapped to standard limits. If an electrode reports out-of-range metrics for over 3 sequential packets, email notifications are dispatched.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
