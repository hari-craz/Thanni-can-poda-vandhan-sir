import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import {
  Menu,
  X,
  Droplet,
  LogOut,
  LayoutDashboard,
  Cpu,
  AlertTriangle,
  Activity,
  BarChart3,
  FileText,
  KeyRound,
  Users,
  Settings,
  ShieldCheck,
  History,
  ExternalLink,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '@/utils/cn'

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // Define sidebar links based on user role
  const isSuper = user?.role === 'superadmin'

  const links = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'superadmin'] },
    { to: '/admin/devices', label: 'Devices', icon: Cpu, roles: ['admin', 'superadmin'] },
    { to: '/admin/alerts', label: 'Alert Center', icon: AlertTriangle, roles: ['admin', 'superadmin'] },
    { to: '/admin/anomalies', label: 'Anomalies', icon: Activity, roles: ['admin', 'superadmin'] },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'superadmin'] },
    { to: '/admin/reports', label: 'Reports & Export', icon: FileText, roles: ['admin', 'superadmin'] },
    // Superadmin-only operations
    { to: '/admin/provisioning', label: 'Device Provisioning', icon: ShieldCheck, roles: ['superadmin'] },
    { to: '/admin/users', label: 'User Management', icon: Users, roles: ['superadmin'] },
    { to: '/admin/api-keys', label: 'System API Keys', icon: KeyRound, roles: ['superadmin'] },
    { to: '/admin/audit', label: 'Audit Log', icon: History, roles: ['superadmin'] },
    { to: '/admin/settings', label: 'System Settings', icon: Settings, roles: ['superadmin'] },
  ]

  const activeLink = links.find((link) => link.to === location.pathname)

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex font-sans overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-linear-to-r from-sky-200/20 to-teal-200/20 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-linear-to-r from-indigo-100/20 to-sky-100/20 blur-3xl" />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200/60 bg-white/60 backdrop-blur-xl shrink-0 p-6 z-20">
        <Link to="/" className="flex items-center gap-2.5 mb-8 group">
          <div className="h-9 w-9 rounded-lg bg-linear-to-r from-teal-400 to-sky-500 flex items-center justify-center text-white shadow-xs">
            <Droplet className="h-4 w-4 fill-current" />
          </div>
          <div>
            <span className="text-base font-black tracking-tight text-slate-800 block">
              HYDRONIX
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block -mt-1">
              Admin Portal
            </span>
          </div>
        </Link>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
          {links
            .filter((link) => link.roles.includes(user?.role || ''))
            .map((link) => {
              const Icon = link.icon
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 border border-transparent',
                    isActive
                      ? 'bg-linear-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/15'
                      : 'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900 hover:border-slate-200/30'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              )
            })}
        </nav>

        {/* Footer info & logout */}
        <div className="mt-auto pt-6 border-t border-slate-200/50 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-slate-100/60 p-3 rounded-xl border border-slate-200/30">
            <div className="h-8 w-8 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center uppercase shadow-xs">
              {user?.email[0] || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black text-slate-800 truncate leading-none">
                {user?.name || 'Admin'}
              </span>
              <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-sky-600">
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Admin View Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200/50 bg-white/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-xl bg-white border border-slate-200/40 text-slate-600 cursor-pointer"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-base font-black text-slate-800 tracking-tight">
              {activeLink?.label || 'Overview'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
              View Public Site <ExternalLink className="h-3 w-3" />
            </Link>
            <div className="h-4 w-[1px] bg-slate-200" />
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
              {isSuper ? 'SUPE-ADMIN MODE' : 'ADMIN MODE'}
            </span>
          </div>
        </header>

        {/* Dynamic Mobile Sidebar Drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-md lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-slate-100 p-6 flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-linear-to-r from-teal-400 to-sky-500 flex items-center justify-center text-white font-bold text-sm">
                      💧
                    </div>
                    <span className="text-sm font-black tracking-tight text-slate-800">
                      HYDRONIX
                    </span>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg bg-slate-100/60 text-slate-500 cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="flex flex-col gap-1.5 overflow-y-auto">
                  {links
                    .filter((link) => link.roles.includes(user?.role || ''))
                    .map((link) => {
                      const Icon = link.icon
                      const isActive = location.pathname === link.to
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent',
                            isActive
                              ? 'bg-sky-500 text-white'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </Link>
                      )
                    })}
                </nav>
              </div>

              <div className="flex flex-col gap-3 pt-6 border-t border-slate-200/50">
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border">
                  <div className="h-8 w-8 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center uppercase">
                    {user?.email[0] || 'A'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-800 truncate leading-none">
                      {user?.name || 'Admin'}
                    </span>
                    <span className="inline-block mt-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                      {user?.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
