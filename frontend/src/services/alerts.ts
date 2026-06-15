import api from './api'
import type { AlertsListResponse, AlertAcknowledgeRequest } from '@/types/alert'

export async function fetchAlerts(): Promise<AlertsListResponse> {
  const { data } = await api.get<AlertsListResponse>('/alerts')
  return data
}

export async function acknowledgeAlert(alertId: number, req: AlertAcknowledgeRequest): Promise<unknown> {
  const { data } = await api.post(`/alerts/${alertId}/acknowledge`, req)
  return data
}
