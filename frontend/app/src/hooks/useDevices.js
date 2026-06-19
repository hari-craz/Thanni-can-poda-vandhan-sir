import { useState, useCallback } from 'react';
import { api } from '../services/api';

export default function useDevices() {
  const [devices, setDevices] = useState([]);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDevices();
      setDevices(data.devices || []);
      return data.devices;
    } catch (err) {
      setError(err.message || 'Failed to fetch devices');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDevice = useCallback(async (deviceId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDevice(deviceId);
      setCurrentDevice(data);
      return data;
    } catch (err) {
      setError(err.message || `Failed to fetch device ${deviceId}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const provisionDevice = useCallback(async (deviceId, name, location, latitude, longitude) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.provisionDevice(deviceId, name, location, latitude, longitude);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to provision device');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDeviceConfig = useCallback(async (deviceId, configUpdates) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.updateDeviceConfig(deviceId, configUpdates);
      if (currentDevice && currentDevice.device_id === deviceId) {
        setCurrentDevice(prev => ({ ...prev, remote_config: updated }));
      }
      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update remote config');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentDevice]);

  return {
    devices,
    currentDevice,
    loading,
    error,
    fetchDevices,
    fetchDevice,
    provisionDevice,
    updateDeviceConfig,
    setCurrentDevice
  };
}
