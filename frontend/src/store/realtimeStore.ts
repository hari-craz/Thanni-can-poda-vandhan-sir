import { create } from 'zustand'
import type { SensorReading } from '@/types/sensor'
import type { Alert } from '@/types/alert'
import type { Device } from '@/types/device'

interface RealtimeState {
  liveFeed: SensorReading[]
  liveAlerts: Alert[]
  deviceUpdates: Record<string, Partial<Device>>
  wsConnected: boolean
  lastUpdate: string | null
  addReading: (reading: SensorReading) => void
  addAlert: (alert: Alert) => void
  updateDevice: (deviceId: string, update: Partial<Device>) => void
  setWsConnected: (connected: boolean) => void
  clearFeed: () => void
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  liveFeed: [],
  liveAlerts: [],
  deviceUpdates: {},
  wsConnected: false,
  lastUpdate: null,

  addReading: (reading) =>
    set((state) => ({
      liveFeed: [reading, ...state.liveFeed].slice(0, 50),
      lastUpdate: new Date().toISOString(),
    })),

  addAlert: (alert) =>
    set((state) => ({
      liveAlerts: [alert, ...state.liveAlerts].slice(0, 20),
      lastUpdate: new Date().toISOString(),
    })),

  updateDevice: (deviceId, update) =>
    set((state) => ({
      deviceUpdates: { ...state.deviceUpdates, [deviceId]: { ...state.deviceUpdates[deviceId], ...update } },
      lastUpdate: new Date().toISOString(),
    })),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  clearFeed: () => set({ liveFeed: [], liveAlerts: [], deviceUpdates: {} }),
}))
