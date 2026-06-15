'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

interface DeviceDetailPageProps {
  params: {
    id: string;
  };
}

export default function DeviceDetailPage({ params }: DeviceDetailPageProps) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <MainLayout onLogout={handleLogout}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading device data...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout onLogout={handleLogout}>
      <div className="p-8">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Device {params.id}</h1>
          <p className="text-gray-600 mt-2">View device metrics and sensor data</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">Online</p>
              </div>
              <div className="text-3xl">🟢</div>
            </div>
          </div>

          {/* Last Updated */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Last Updated</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">Just now</p>
          </div>

          {/* Quality Score */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Quality Score</p>
            <p className="text-2xl font-bold text-green-600 mt-1">85/100</p>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Active Alerts</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
          </div>
        </div>

        {/* Sensor Readings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[
            { label: 'pH Level', value: '7.2', unit: '', color: 'blue' },
            { label: 'Turbidity', value: '2.5', unit: 'NTU', color: 'green' },
            { label: 'TDS', value: '245', unit: 'ppm', color: 'blue' },
            { label: 'Temperature', value: '22.5', unit: '°C', color: 'orange' },
            { label: 'Flow Rate', value: '5.3', unit: 'L/min', color: 'green' },
            { label: 'Signal Strength', value: '-45', unit: 'dBm', color: 'blue' },
          ].map((reading) => (
            <div key={reading.label} className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">{reading.label}</p>
              <div className="flex items-baseline justify-between mt-2">
                <p className={`text-3xl font-bold text-${reading.color}-600`}>
                  {reading.value}
                </p>
                <p className="text-gray-500 ml-2">{reading.unit}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Placeholder */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sensor Data Chart</h2>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Chart placeholder - Recharts integration coming</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
