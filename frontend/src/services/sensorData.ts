import api from './api'
import type { SensorDataResponse } from '@/types/sensor'

export async function fetchSensorData(deviceId: string, limit = 100): Promise<SensorDataResponse> {
  const { data } = await api.get<SensorDataResponse>(`/data/${deviceId}`, {
    params: { limit },
  })
  return data
}
