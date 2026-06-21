import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'OP';

  return (
    <div className="bg-background text-on-surface min-h-screen">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentUser={currentUser} 
        isActive={isActive} 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Top AppBar */}
      <Header 
        currentUser={currentUser} 
        initials={initials} 
        onLogout={handleLogout} 
        onMenuClick={() => setSidebarOpen(true)}
      />

      {/* Main Content Canvas */}
      <main className="pt-24 pb-24 md:pb-12 px-6 md:ml-[15rem] min-h-screen">
        <div className="max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-on-primary-fixed h-16 flex items-center justify-around px-4 z-50">
        {currentUser?.role === 'user' ? (
          <>
            <button onClick={() => navigate('/user/dashboard')} className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/user/dashboard') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className={`material-symbols-outlined ${isActive('/user/dashboard') ? 'text-primary' : ''}`}>dashboard</span>
              <span className="text-[10px] font-bold">Home</span>
            </button>
            <button onClick={() => navigate('/')} className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className="material-symbols-outlined">map</span>
              <span className="text-[10px] font-bold">Public Map</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/admin/dashboard')} className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/admin/dashboard') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className={`material-symbols-outlined ${isActive('/admin/dashboard') ? 'text-primary' : ''}`}>dashboard</span>
              <span className="text-[10px] font-bold">Home</span>
            </button>
            <button onClick={() => navigate('/admin/fleet')} className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/admin/fleet') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
              <span className="material-symbols-outlined">hub</span>
              <span className="text-[10px] font-bold">Nodes</span>
            </button>
            {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && (
              <button onClick={() => navigate('/superadmin/devices/new')} className="btn-premium flex flex-col items-center justify-center -mt-8 bg-primary w-12 h-12 rounded-full shadow-lg text-on-primary">
                <span className="material-symbols-outlined">add</span>
              </button>
            )}
            {currentUser?.role === 'superadmin' ? (
              <button onClick={() => navigate('/superadmin/overview')} className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/superadmin/overview') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
                <span className="material-symbols-outlined">settings</span>
                <span className="text-[10px] font-bold">Admin</span>
              </button>
            ) : (
              <button onClick={() => navigate('/admin/alerts')} className={`flex flex-col items-center justify-center gap-0.5 ${isActive('/admin/alerts') ? 'text-primary-fixed' : 'text-on-primary-fixed-variant opacity-60'}`}>
                <span className="material-symbols-outlined">notifications</span>
                <span className="text-[10px] font-bold">Alerts</span>
              </button>
            )}
          </>
        )}
      </nav>
    </div>
  );
}
