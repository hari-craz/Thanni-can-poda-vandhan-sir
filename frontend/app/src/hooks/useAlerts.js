import { useState, useCallback } from 'react';
import { api } from '../services/api';

export default function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAlerts = useCallback(async (status = null, severity = null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAlerts(status, severity);
      setAlerts(data.alerts || []);
      return data.alerts;
    } catch (err) {
      setError(err.message || 'Failed to fetch alerts');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnomalies = useCallback(async (deviceId = null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAnomalies(deviceId);
      setAnomalies(data.anomalies || []);
      return data.anomalies;
    } catch (err) {
      setError(err.message || 'Failed to fetch anomalies');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertId, userId, message) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.acknowledgeAlert(alertId, userId, message);
      // Update local state if alert is in list
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged_at: new Date().toISOString(), acknowledged_by: userId } 
          : alert
      ));
      return result;
    } catch (err) {
      setError(err.message || `Failed to acknowledge alert ${alertId}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    alerts,
    anomalies,
    loading,
    error,
    fetchAlerts,
    fetchAnomalies,
    acknowledgeAlert,
    setAlerts,
    setAnomalies
  };
}
