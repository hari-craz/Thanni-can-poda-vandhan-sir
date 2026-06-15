import { useEffect, useRef } from 'react'
import { useRealtimeStore } from '@/store/realtimeStore'
import { WS_URL } from '@/utils/constants'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const { addReading, updateDevice, setWsConnected } = useRealtimeStore()

  useEffect(() => {
    function connect() {
      if (wsRef.current) return

      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          setWsConnected(true)
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'reading') {
              // Convert to SensorReading format
              const reading = {
                id: data.id || Date.now(),
                device_id: data.device_id,
                ph: data.values.ph,
                turbidity: data.values.turbidity,
                tds: data.values.tds,
                temperature: data.values.temperature,
                flow_rate: data.values.flow_rate,
                timestamp: data.timestamp,
                received_at: new Date().toISOString(),
                quality_score: data.quality_score,
                anomaly_flags: data.anomaly_flags || {},
              }
              addReading(reading)
              
              // Also update device status/last_seen
              updateDevice(data.device_id, {
                status: 'online',
                last_seen: data.timestamp,
              })
            } else if (data.type === 'key_rotation') {
              updateDevice(data.device_id, {
                last_seen: new Date().toISOString(),
              })
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err)
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          wsRef.current = null
          // Auto reconnect after 5 seconds
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect()
          }, 5000)
        }

        ws.onerror = (err) => {
          console.error('WebSocket error:', err)
          ws.close()
        }
      } catch (err) {
        console.error('Failed to create WebSocket:', err)
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [addReading, updateDevice, setWsConnected])

  return wsRef.current
}
