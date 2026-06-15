import { create } from 'zustand';
import { Device, SensorReading, DeviceMetrics } from '@/types';

interface DeviceStoreState {
  devices: Device[];
  selectedDeviceId: string | null;
  readings: SensorReading[];
  deviceMetrics: Record<string, DeviceMetrics>;
  isLoading: boolean;
  error: string | null;

  // Actions
  setDevices: (devices: Device[]) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setReadings: (readings: SensorReading[]) => void;
  setDeviceMetrics: (deviceId: string, metrics: DeviceMetrics) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  addReading: (reading: SensorReading) => void;
  updateDeviceStatus: (deviceId: string, status: 'online' | 'offline') => void;
  clearReadings: () => void;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  devices: [],
  selectedDeviceId: null,
  readings: [],
  deviceMetrics: {},
  isLoading: false,
  error: null,

  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  setReadings: (readings) => set({ readings }),
  setDeviceMetrics: (deviceId, metrics) =>
    set((state) => ({
      deviceMetrics: {
        ...state.deviceMetrics,
        [deviceId]: metrics,
      },
    })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  addReading: (reading) =>
    set((state) => ({
      readings: [reading, ...state.readings].slice(0, 1000), // Keep last 1000 readings
    })),

  updateDeviceStatus: (deviceId, status) =>
    set((state) => ({
      devices: state.devices.map((d) =>
        d.device_id === deviceId ? { ...d, status } : d
      ),
    })),

  clearReadings: () => set({ readings: [] }),
  clearError: () => set({ error: null }),
}));
