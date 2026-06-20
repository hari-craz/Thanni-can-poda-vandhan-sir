import React from 'react';
import { Link } from 'react-router-dom';

export default function Sidebar({ currentUser, isActive }) {
  return (
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
      
      {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && (
        <div className="px-6 mt-auto pt-6 border-t border-primary-fixed-variant/20">
          <Link to="/superadmin/devices/new" className="btn-premium w-full bg-primary py-2.5 px-4 text-on-primary font-bold rounded shadow-sm hover:opacity-100 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add New Node
          </Link>
        </div>
      )}
    </aside>
  );
}
