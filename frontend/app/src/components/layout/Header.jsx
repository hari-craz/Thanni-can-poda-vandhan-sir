import React from 'react';

export default function Header({ currentUser, initials, onLogout }) {
  return (
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
            onClick={onLogout}
            title="Log Out"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
