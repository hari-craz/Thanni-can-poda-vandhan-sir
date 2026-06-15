import api from './api'
import type { AnomaliesListResponse } from '@/types/alert'

export async function fetchAnomalies(): Promise<AnomaliesListResponse> {
  const { data } = await api.get<AnomaliesListResponse>('/anomalies')
  return data
}
