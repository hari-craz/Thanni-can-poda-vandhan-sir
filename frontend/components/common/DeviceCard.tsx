'use client';

import React from 'react';
import { Device } from '@/types';
import Link from 'next/link';

interface DeviceCardProps {
  device: Device;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device }) => {
  const statusColor = device.status === 'online' ? 'text-green-600' : 'text-red-600';
  const statusBg = device.status === 'online' ? 'bg-green-100' : 'bg-red-100';

  return (
    <Link href={`/devices/${device.device_id}`}>
      <div className="liquid-card cursor-pointer h-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{device.device_id}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBg} ${statusColor}`}>
              {device.status === 'online' ? '🟢' : '🔴'} {device.status}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm text-gray-600 mb-4">
            <p>📍 {device.location}</p>
            {device.firmware_version && (
              <p>📦 Firmware {device.firmware_version}</p>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Last update: {device.last_heartbeat_timestamp ? new Date(device.last_heartbeat_timestamp).toLocaleTimeString() : 'Never'}
            </span>
            <span className="text-blue-600 hover:text-blue-700 font-medium">→</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
