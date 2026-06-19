import { useState, useCallback } from 'react';
import { api } from '../services/api';

export default function useTelemetry() {
  const [telemetryData, setTelemetryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTelemetry = useCallback(async (deviceId, limit = 100) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDeviceData(deviceId, limit);
      const readings = data.readings || [];
      setTelemetryData(readings);
      return readings;
    } catch (err) {
      setError(err.message || `Failed to fetch telemetry for device ${deviceId}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    telemetryData,
    loading,
    error,
    fetchTelemetry,
    setTelemetryData
  };
}
