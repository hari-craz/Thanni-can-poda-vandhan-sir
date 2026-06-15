'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { DeviceCard } from '@/components/common/DeviceCard';
import { Device } from '@/types';

export default function DevicesPage() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(true);
  const [devices, setDevices] = React.useState<Device[]>([]);

  React.useEffect(() => {
    // Simulate loading and fetch devices
    const timer = setTimeout(() => {
      // Mock data
      const mockDevices: Device[] = [
        {
          device_id: 'HYDRO_001',
          name: 'Main Water Tank',
          location: 'Building A, Floor 1',
          status: 'online',
          firmware_version: '2.1.0',
          last_heartbeat_timestamp: new Date().toISOString(),
          signal_strength: -45,
          is_active: true,
        },
        {
          device_id: 'HYDRO_002',
          name: 'Secondary Tank',
          location: 'Building B, Floor 2',
          status: 'online',
          firmware_version: '2.1.0',
          last_heartbeat_timestamp: new Date(Date.now() - 60000).toISOString(),
          signal_strength: -65,
          is_active: true,
        },
        {
          device_id: 'HYDRO_003',
          name: 'Backup Sensor',
          location: 'Building C',
          status: 'offline',
          firmware_version: '2.0.5',
          last_heartbeat_timestamp: new Date(Date.now() - 3600000).toISOString(),
          is_active: false,
        },
      ];
      setDevices(mockDevices);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <MainLayout onLogout={handleLogout}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Devices</h1>
            <p className="text-gray-600 mt-2">
              Monitor and manage your water quality sensors
            </p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
            + Add Device
          </button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Devices</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{devices.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Online</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {devices.filter((d) => d.status === 'online').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Offline</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {devices.filter((d) => d.status === 'offline').length}
            </p>
          </div>
        </div>

        {/* Devices Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : devices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <DeviceCard key={device.device_id} device={device} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Devices Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Connect your first sensor to start monitoring water quality.
            </p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
              Add Your First Device
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
