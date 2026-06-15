import api from './api'
import type { SystemStatus, HealthCheck } from '@/types/api'

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const { data } = await api.get<SystemStatus>('/status')
  return data
}

export async function fetchHealth(): Promise<HealthCheck> {
  const { data } = await api.get<HealthCheck>('/health')
  return data
}
