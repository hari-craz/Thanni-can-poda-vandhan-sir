'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function AlertsPage() {
  const router = useRouter();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <MainLayout onLogout={handleLogout}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600 mt-2">
            View and manage system alerts
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Alerts
          </h2>
          <p className="text-gray-600">
            All systems are operating normally.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
