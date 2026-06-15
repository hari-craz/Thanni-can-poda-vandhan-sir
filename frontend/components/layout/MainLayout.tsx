'use client';

import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

interface MainLayoutProps {
  children: ReactNode;
  onLogout?: () => Promise<void>;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, onLogout }) => {
  const router = useRouter();
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    }
  };

  const navItems = [
    { icon: '📊', label: 'Devices', href: '/devices' },
    { icon: '🚨', label: 'Alerts', href: '/alerts' },
    { icon: '⚙️', label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className={sidebarOpen ? 'block' : 'hidden'}>
              <h1 className="text-2xl font-bold">💧 Hydronix</h1>
              <p className="text-xs text-gray-400">Water Monitor</p>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg"
            >
              {sidebarOpen ? '‹' : '›'}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition mb-2"
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </a>
          ))}
        </nav>

        {/* User Menu */}
        <div className="border-t border-gray-800 p-4">
          <div
            className={`flex items-center justify-between ${
              sidebarOpen ? '' : 'flex-col'
            }`}
          >
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-400">{user?.role}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-800 rounded-lg"
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
            </div>
            <div className="flex items-center space-x-6">
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                🔔
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="text-sm text-gray-600">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};
