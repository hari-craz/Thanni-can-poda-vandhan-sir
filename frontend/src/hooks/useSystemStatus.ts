import { useQuery } from '@tanstack/react-query'
import { fetchSystemStatus, fetchHealth } from '@/services/system'
import { POLL_INTERVALS } from '@/utils/constants'

export function useSystemStatus() {
  return useQuery({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: POLL_INTERVALS.status,
  })
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['healthCheck'],
    queryFn: fetchHealth,
    refetchInterval: POLL_INTERVALS.status,
  })
}
