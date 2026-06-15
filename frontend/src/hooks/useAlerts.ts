import { useQuery } from '@tanstack/react-query'
import { fetchAlerts } from '@/services/alerts'
import { POLL_INTERVALS } from '@/utils/constants'

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: POLL_INTERVALS.alerts,
    staleTime: 10_000,
  })
}
