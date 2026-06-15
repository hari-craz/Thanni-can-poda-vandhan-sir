import { Link, Outlet } from 'react-router-dom'
import { ArrowLeft, Droplet } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

export function FullscreenLayout() {
  // Initialize live WebSocket feed
  useWebSocket()

  return (
    <div className="relative min-h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden flex flex-col">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-linear-to-r from-teal-200/30 to-sky-200/30 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-linear-to-r from-sky-200/20 to-blue-200/20 blur-3xl" />

      {/* Floating Header */}
      <header className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        <Link
          to="/"
          className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/60 bg-white/70 backdrop-blur-md text-slate-600 hover:text-slate-800 hover:bg-white transition-all shadow-md shadow-slate-200/50 font-bold text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          Exit Fullscreen Dashboard
        </Link>

        <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-xl border border-white/60 bg-white/70 backdrop-blur-md shadow-md shadow-slate-200/50">
          <div className="h-6 w-6 rounded-md bg-linear-to-r from-teal-400 to-sky-500 flex items-center justify-center text-white">
            <Droplet className="h-3.5 w-3.5 fill-current" />
          </div>
          <span className="text-xs font-black tracking-tight text-slate-800">
            HYDRONIX COMMAND
          </span>
        </div>
      </header>

      {/* Main Content (Full Screen) */}
      <main className="flex-1 w-full h-full p-6 pt-20 relative z-10 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
