import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Droplet, ShieldCheck, Lock, User } from 'lucide-react'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, error: authError, isLoading } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')

  // Redirect path
  const from = (location.state as any)?.from?.pathname || '/admin'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    
    if (!username || !password) {
      setLocalError('Please enter both username and password.')
      return
    }

    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err: any) {
      setLocalError(err.message || 'Login failed. Please check credentials.')
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <GlassCard className="w-full max-w-md p-8 border-sky-100/50 bg-white/70 relative overflow-hidden">
        {/* Floating gradient accent */}
        <div className="absolute top-[-30px] right-[-30px] h-24 w-24 rounded-full bg-linear-to-br from-teal-300/30 to-sky-300/30 blur-xl" />

        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-linear-to-r from-teal-400 to-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/10 mb-4">
            <Droplet className="h-6 w-6 fill-current animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Administrator Access
          </h1>
          <p className="text-slate-400 text-xs font-semibold mt-1">
            Sign in to configure ESP32 sensors and manage water safety parameters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <User className="absolute left-3.5 top-[38px] h-4 w-4 text-slate-400 z-10" />
            <Input
              label="Username or Email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="pl-10"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-[38px] h-4 w-4 text-slate-400 z-10" />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10"
            />
          </div>

          {(localError || authError) && (
            <div className="p-3 rounded-xl border border-red-200/50 bg-red-500/5 text-red-600 text-xs font-bold">
              {localError || authError}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center py-3 mt-2"
            disabled={isLoading}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {isLoading ? 'Verifying credentials...' : 'Secure Authorization'}
          </Button>
        </form>
      </GlassCard>
    </div>
  )
}
