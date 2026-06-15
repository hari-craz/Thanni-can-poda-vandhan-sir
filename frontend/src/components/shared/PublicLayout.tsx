import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Menu, X, Droplet, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import { Button } from '../ui/Button'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useRealtimeStore } from '@/store/realtimeStore'

export function PublicLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()
  const { wsConnected } = useRealtimeStore()

  // Initialize live WebSocket feed
  useWebSocket()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans overflow-x-hidden">
      {/* Dynamic drifting background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-linear-to-r from-teal-200/40 to-sky-200/40 blur-3xl animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-linear-to-r from-sky-200/30 to-blue-200/30 blur-3xl animate-blob animation-delay-2000" />
      <div className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full bg-linear-to-r from-indigo-100/30 to-teal-100/30 blur-3xl animate-blob animation-delay-4000" />

      {/* Glass Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/40 bg-white/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-xl bg-linear-to-r from-teal-400 to-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/10 group-hover:scale-105 transition-transform duration-300">
              <Droplet className="h-5 w-5 fill-current animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-800 block">
                HYDRONIX
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block -mt-1">
                Water Command
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <Link to="/" className="hover:text-sky-600 transition-colors">
              Monitoring
            </Link>
            <Link to="/live" className="hover:text-sky-600 transition-colors flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Live Feed
            </Link>
            <Link to="/devices" className="hover:text-sky-600 transition-colors">
              Devices
            </Link>
            <Link to="/status" className="hover:text-sky-600 transition-colors">
              System Health
            </Link>
            <Link to="/about" className="hover:text-sky-600 transition-colors">
              About
            </Link>
          </nav>

          {/* Desktop Right Panel (Auth options) */}
          <div className="hidden md:flex items-center gap-4">
            {/* WS Live status dot */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 border border-slate-200/50 text-[10px] font-bold text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {wsConnected ? 'Live Feed Active' : 'Disconnected'}
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/admin">
                  <Button variant="glass" size="sm" className="flex items-center gap-1.5">
                    <LayoutDashboard className="h-4 w-4" />
                    Admin Portal
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Log Out" className="h-9 w-9">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="primary" size="sm" className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4" />
                  Admin Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Navigation Trigger */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-xl bg-white/80 border border-slate-200/30 text-slate-600 cursor-pointer"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-md md:hidden" onClick={() => setSidebarOpen(false)}>
          <div
            className="fixed top-16 right-0 w-64 h-[calc(100vh-4rem)] bg-white/90 backdrop-blur-xl border-l border-slate-100 p-6 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-6 text-base font-bold text-slate-700">
              <Link to="/" onClick={() => setSidebarOpen(false)} className="hover:text-sky-600 py-1.5">
                Monitoring Portal
              </Link>
              <Link to="/live" onClick={() => setSidebarOpen(false)} className="hover:text-sky-600 py-1.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Live Control Center
              </Link>
              <Link to="/devices" onClick={() => setSidebarOpen(false)} className="hover:text-sky-600 py-1.5">
                Public Devices
              </Link>
              <Link to="/status" onClick={() => setSidebarOpen(false)} className="hover:text-sky-600 py-1.5">
                System Health
              </Link>
              <Link to="/about" onClick={() => setSidebarOpen(false)} className="hover:text-sky-600 py-1.5">
                About Platform
              </Link>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 py-2 text-xs font-bold text-slate-400">
                <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {wsConnected ? 'Websocket Connection Live' : 'Websocket Disconnected'}
              </div>
              {user ? (
                <>
                  <Link to="/admin" onClick={() => setSidebarOpen(false)} className="w-full">
                    <Button variant="glass" size="md" className="w-full justify-center">
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Portal
                    </Button>
                  </Link>
                  <Button variant="danger" size="md" onClick={handleLogout} className="w-full justify-center">
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </Button>
                </>
              ) : (
                <Link to="/login" onClick={() => setSidebarOpen(false)} className="w-full">
                  <Button variant="primary" size="md" className="w-full justify-center">
                    <Shield className="mr-2 h-4 w-4" /> Admin Access
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 relative z-10">
        <Outlet />
      </main>

      {/* Responsive Footer */}
      <footer className="border-t border-slate-200/50 bg-white/40 backdrop-blur-md py-8 mt-auto text-center text-xs font-semibold text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-linear-to-r from-teal-400 to-sky-500 flex items-center justify-center text-white text-[10px]">
              💧
            </div>
            <span>© {new Date().getFullYear()} Hydronix. Public Water Quality Infrastructure.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/about" className="hover:text-slate-600 transition-colors">Documentation</Link>
            <Link to="/status" className="hover:text-slate-600 transition-colors">API Endpoint Status</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-slate-600 transition-colors">Source Code</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
