import React from 'react';
import { Link } from 'react-router-dom';

function SidebarLink({ to, isActive, onClose, children }) {
  return (
    <Link 
      to={to} 
      onClick={onClose}
      className={`flex items-center gap-3 px-3 py-2 transition-colors duration-150 ease-in-out ${
        isActive 
          ? 'bg-primary/20 text-primary-fixed font-bold border-l-4 border-primary' 
          : 'sidebar-link text-on-primary-fixed-variant opacity-80 hover:bg-primary/10 hover:text-primary-fixed hover:opacity-100'
      }`}
    >
      {children}
    </Link>
  );
}

export default function Sidebar({ currentUser, isActive, isOpen, onClose }) {
  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-45 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 h-full w-[15rem] flex-col py-6 bg-on-primary-fixed shadow-sm z-50 transition-transform duration-300 ease-in-out md:translate-x-0 md:flex ${
        isOpen ? 'translate-x-0 flex' : '-translate-x-full hidden md:flex'
      }`}>
        <div className="px-6 mb-8 flex justify-between items-center">
          <div>
            <h1 className="font-headline-md text-headline-md text-primary-fixed font-bold">Hydronix</h1>
            <p className="text-primary-fixed-dim opacity-70 font-label-sm text-label-sm">Mission Control</p>
          </div>
          <button className="md:hidden text-primary-fixed hover:text-white p-1 rounded-full transition-colors flex items-center justify-center" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <nav className="flex-1 px-3 space-y-1 custom-scrollbar overflow-y-auto">
          {currentUser?.role === 'user' ? (
            <>
              <SidebarLink to="/user/dashboard" isActive={isActive('/user/dashboard')} onClose={onClose}>
                <span className="material-symbols-outlined text-primary">dashboard</span>
                <span className="font-title-md text-title-md">Dashboard</span>
              </SidebarLink>
              <SidebarLink to="/" isActive={isActive('/')} onClose={onClose}>
                <span className="material-symbols-outlined">map</span>
                <span className="font-title-md text-title-md">Public Map</span>
              </SidebarLink>
            </>
          ) : (
            <>
              <SidebarLink to="/admin/dashboard" isActive={isActive('/admin/dashboard')} onClose={onClose}>
                <span className="material-symbols-outlined text-primary">dashboard</span>
                <span className="font-title-md text-title-md">Dashboard</span>
              </SidebarLink>
              <SidebarLink to="/admin/fleet" isActive={isActive('/admin/fleet')} onClose={onClose}>
                <span className="material-symbols-outlined">hub</span>
                <span className="font-title-md text-title-md">Node Network</span>
              </SidebarLink>
              <SidebarLink to="/admin/alerts" isActive={isActive('/admin/alerts')} onClose={onClose}>
                <span className="material-symbols-outlined">notifications_active</span>
                <span className="font-title-md text-title-md">Alert History</span>
              </SidebarLink>
              <SidebarLink to="/admin/intelligence" isActive={isActive('/admin/intelligence')} onClose={onClose}>
                <span className="material-symbols-outlined">water_drop</span>
                <span className="font-title-md text-title-md">AI Intelligence</span>
              </SidebarLink>
              <SidebarLink to="/admin/reports" isActive={isActive('/admin/reports')} onClose={onClose}>
                <span className="material-symbols-outlined">waves</span>
                <span className="font-title-md text-title-md">Reports</span>
              </SidebarLink>
              
              {/* Administration Section */}
              <div className="pt-4 pb-2 px-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary-fixed-dim opacity-50">Administration</p>
              </div>

              <SidebarLink to="/superadmin/devices/new" isActive={isActive('/superadmin/devices/new')} onClose={onClose}>
                <span className="material-symbols-outlined">add_box</span>
                <span className="font-title-md text-title-md">Provision Node</span>
              </SidebarLink>

              <SidebarLink to="/superadmin/nodes" isActive={isActive('/superadmin/nodes')} onClose={onClose}>
                <span className="material-symbols-outlined">developer_board</span>
                <span className="font-title-md text-title-md">Manage Nodes</span>
              </SidebarLink>

              <SidebarLink to="/superadmin/firmware" isActive={isActive('/superadmin/firmware')} onClose={onClose}>
                <span className="material-symbols-outlined">system_update</span>
                <span className="font-title-md text-title-md">Firmware OTA</span>
              </SidebarLink>

              {currentUser?.role === 'superadmin' ? (
                <SidebarLink to="/superadmin/users" isActive={isActive('/superadmin/users')} onClose={onClose}>
                  <span className="material-symbols-outlined">group</span>
                  <span className="font-title-md text-title-md flex-1">User Accounts</span>
                </SidebarLink>
              ) : (
                <div 
                  className="flex items-center gap-3 px-3 py-2 text-on-primary-fixed-variant opacity-40 cursor-not-allowed select-none"
                  title="Super Admin role required"
                >
                  <span className="material-symbols-outlined">group</span>
                  <span className="font-title-md text-title-md flex-1">User Accounts</span>
                  <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">lock</span>
                </div>
              )}

              {currentUser?.role === 'superadmin' ? (
                <SidebarLink to="/superadmin/audit" isActive={isActive('/superadmin/audit')} onClose={onClose}>
                  <span className="material-symbols-outlined">shield</span>
                  <span className="font-title-md text-title-md flex-1">Security Audit</span>
                </SidebarLink>
              ) : (
                <div 
                  className="flex items-center gap-3 px-3 py-2 text-on-primary-fixed-variant opacity-40 cursor-not-allowed select-none"
                  title="Super Admin role required"
                >
                  <span className="material-symbols-outlined">shield</span>
                  <span className="font-title-md text-title-md flex-1">Security Audit</span>
                  <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">lock</span>
                </div>
              )}

              {currentUser?.role === 'superadmin' ? (
                <SidebarLink to="/superadmin/ml-settings" isActive={isActive('/superadmin/ml-settings')} onClose={onClose}>
                  <span className="material-symbols-outlined">settings_suggest</span>
                  <span className="font-title-md text-title-md flex-1">AI Model Settings</span>
                </SidebarLink>
              ) : (
                <div 
                  className="flex items-center gap-3 px-3 py-2 text-on-primary-fixed-variant opacity-40 cursor-not-allowed select-none"
                  title="Super Admin role required"
                >
                  <span className="material-symbols-outlined">settings_suggest</span>
                  <span className="font-title-md text-title-md flex-1">AI Model Settings</span>
                  <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">lock</span>
                </div>
              )}

              {currentUser?.role === 'superadmin' ? (
                <SidebarLink to="/superadmin/overview" isActive={isActive('/superadmin/overview')} onClose={onClose}>
                  <span className="material-symbols-outlined">dns</span>
                  <span className="font-title-md text-title-md flex-1">Infrastructure</span>
                </SidebarLink>
              ) : (
                <div 
                  className="flex items-center gap-3 px-3 py-2 text-on-primary-fixed-variant opacity-40 cursor-not-allowed select-none"
                  title="Super Admin role required"
                >
                  <span className="material-symbols-outlined">dns</span>
                  <span className="font-title-md text-title-md flex-1">Infrastructure</span>
                  <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">lock</span>
                </div>
              )}
            </>
          )}
        </nav>
        
        {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && (
          <div className="px-6 mt-auto pt-6 border-t border-primary-fixed-variant/20">
            <Link 
              to="/superadmin/devices/new" 
              onClick={onClose}
              className="btn-premium w-full bg-primary py-2.5 px-4 text-on-primary font-bold rounded shadow-sm hover:opacity-100 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add New Node
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
