import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!api.isAuthenticated()) {
      navigate('/login');
    } else {
      setCurrentUser(api.getCurrentUser());
    }
  }, [navigate]);

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Get initials
  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'OP';

  return (
    <div className="bg-background text-on-surface min-h-screen">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-[15rem] flex-col py-6 bg-on-primary-fixed shadow-sm z-50">
        <div className="px-6 mb-8">
          <h1 className="font-headline-md text-headline-md text-primary-fixed font-bold">Hydronix</h1>
          <p className="text-primary-fixed-dim opacity-70 font-label-sm text-label-sm">Mission Control</p>
        </div>
        
        <nav className="flex-1 px-3 space-y-1 custom-scrollbar overflow-y-auto">
          {currentUser?.role === 'user' ? (
            <>
              <Link 
                to="/user/dashboard" 
                className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/user/dashboard') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined text-primary">dashboard</span>
                <span className="font-title-md text-title-md">Dashboard</span>
              </Link>
              <Link 
                to="/" 
                className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined">map</span>
                <span className="font-title-md text-title-md">Public Map</span>
              </Link>
            </>
          ) : (
            <>
              <Link 
                to="/admin/dashboard" 
                className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/admin/dashboard') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined text-primary">dashboard</span>
                <span className="font-title-md text-title-md">Dashboard</span>
              </Link>
              <Link 
                to="/admin/fleet" 
                className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/admin/fleet') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined">hub</span>
                <span className="font-title-md text-title-md">Node Network</span>
              </Link>
              <Link 
                to="/admin/alerts" 
                className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/admin/alerts') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined">notifications_active</span>
                <span className="font-title-md text-title-md">Alert History</span>
              </Link>
              <Link 
                to="/admin/intelligence" 
                className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/admin/intelligence') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined">water_drop</span>
                <span className="font-title-md text-title-md">AI Intelligence</span>
              </Link>
              <Link 
                to="/admin/reports" 
                className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/admin/reports') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined">waves</span>
                <span className="font-title-md text-title-md">Reports</span>
              </Link>
              {currentUser?.role === 'superadmin' && (
                <Link 
                  to="/superadmin/overview" 
                  className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${isActive('/superadmin/overview') ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'}`}
                >
                  <span className="material-symbols-outlined">settings</span>
                  <span className="font-title-md text-title-md">Super Admin</span>
                </Link>
              )}
            </>
          )}
        </nav>
        
        {currentUser?.role === 'superadmin' && (
          <div className="px-6 mt-auto pt-6 border-t border-primary-fixed-variant/20">
            <Link to="/superadmin/devices/new" className="btn-premium w-full bg-primary py-2.5 px-4 text-on-primary font-bold rounded shadow-sm hover:opacity-100 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add New Node
            </Link>
          </div>
        )}
      </aside>

      {/* Top AppBar */}
      <header className="fixed top-0 right-0 h-16 bg-surface-container-lowest border-b border-border-subtle flex justify-between items-center px-6 w-full md:w-[calc(100%-15rem)] z-40">
        <div className="flex items-center gap-4">
          <button className="md:hidden text-on-surface">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="hidden sm:block relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined text-[20px]">search</span>
            <input 
              className="pl-10 pr-4 py-1.5 bg-surface-container-low rounded-full border-none focus:ring-2 focus:ring-primary text-body-md w-64 transition-all duration-150 outline-none" 
              placeholder="Search Infrastructure..." 
              type="text" 
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-status-nominal/10 text-status-nominal rounded-full">
            <span className="w-2 h-2 rounded-full bg-status-nominal animate-pulse"></span>
            <span className="font-label-sm text-label-sm uppercase">System Status: Nominal</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="nav-link-hover text-on-surface-variant hover:text-primary transition-all scale-95 active:opacity-80">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="nav-link-hover text-on-surface-variant hover:text-primary transition-all scale-95 active:opacity-80">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div 
              className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold border border-border-subtle cursor-pointer hover:border-primary transition-colors"
              title={currentUser?.email || 'Operator'}
            >
              {initials}
            </div>
            <button 
              className="nav-link-hover text-on-surface-variant hover:text-status-critical transition-all scale-95 active:opacity-80"
              onClick={handleLogout}
              title="Log Out"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="pt-24 pb-12 px-6 md:ml-[15rem] min-h-screen">
        <div className="max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-on-primary-fixed h-16 flex items-center justify-around px-4 z-50">
        {currentUser?.role === 'user' ? (
          <>
            <Link to="/user/dashboard" className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/user/dashboard') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className={`material-symbols-outlined ${isActive('/user/dashboard') ? 'text-primary' : ''}`}>dashboard</span>
              <span className="text-[10px] font-bold">Home</span>
            </Link>
            <Link to="/" className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className="material-symbols-outlined">map</span>
              <span className="text-[10px] font-bold">Public Map</span>
            </Link>
          </>
        ) : (
          <>
            <Link to="/admin/dashboard" className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/admin/dashboard') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className={`material-symbols-outlined ${isActive('/admin/dashboard') ? 'text-primary' : ''}`}>dashboard</span>
              <span className="text-[10px] font-bold">Home</span>
            </Link>
            <Link to="/admin/fleet" className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/admin/fleet') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className="material-symbols-outlined">hub</span>
              <span className="text-[10px] font-bold">Nodes</span>
            </Link>
            {currentUser?.role === 'superadmin' ? (
              <>
                <Link to="/superadmin/devices/new" className="btn-premium flex flex-col items-center justify-center -mt-8 bg-primary w-12 h-12 rounded-full shadow-lg text-on-primary">
                  <span className="material-symbols-outlined">add</span>
                </Link>
                <Link to="/superadmin/overview" className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/superadmin/overview') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
                  <span className="material-symbols-outlined">settings</span>
                  <span className="text-[10px] font-bold">Admin</span>
                </Link>
              </>
            ) : (
              <Link to="/admin/alerts" className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/admin/alerts') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
                <span className="material-symbols-outlined">notifications</span>
                <span className="text-[10px] font-bold">Alerts</span>
              </Link>
            )}
          </>
        )}
      </nav>
    </div>
  );
}
