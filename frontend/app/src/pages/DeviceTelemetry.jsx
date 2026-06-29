import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function DeviceTelemetry() {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [readings, setReadings] = useState([]);
  const [calibration, setCalibration] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTelemetryData = async () => {
    try {
      // Fetch device info
      const dev = await api.getDevice(id);
      setDevice(dev);

      // Fetch telemetry history
      const telemetry = await api.getDeviceData(id, 24);
      setReadings(telemetry.readings || []);

      // Fetch calibration status
      const cal = await api.getCalibrationStatus(id);
      setCalibration(cal);
    } catch (e) {
      console.error('Error fetching telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetryData();
    const interval = setInterval(fetchTelemetryData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [id]);

  if (loading && !device) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center p-12 bg-surface-container-lowest border border-border-subtle rounded-lg">
        <span className="material-symbols-outlined text-[48px] text-status-critical mb-2">error</span>
        <p className="font-bold">Device Not Found</p>
        <p className="text-sm text-outline mb-4">The device ID {id} was not recognized in the system database.</p>
        <Link to="/admin/dashboard" className="px-6 py-2 bg-primary text-on-primary font-bold rounded">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const latestReading = readings.length > 0 ? readings[0] : null;

  const metrics = [
    { label: 'Water Quality Score', value: latestReading ? latestReading.quality_score : '—', unit: '', icon: 'opacity', color: latestReading?.quality_score >= 80 ? 'status-nominal' : 'status-warning' },
    { label: 'pH Level', value: latestReading ? latestReading.ph.toFixed(2) : '—', unit: 'pH', icon: 'science', color: 'primary' },
    { label: 'Turbidity', value: latestReading ? latestReading.turbidity.toFixed(2) : '—', unit: 'NTU', icon: 'blur_on', color: 'primary' },
    { label: 'TDS (Solids)', value: latestReading ? latestReading.tds.toFixed(0) : '—', unit: 'ppm', icon: 'bolt', color: 'primary' },
    { label: 'Temperature', value: latestReading ? latestReading.temperature.toFixed(1) : '—', unit: '°C', icon: 'thermostat', color: 'primary' },
    { label: 'Flow Rate', value: latestReading ? latestReading.flow_rate.toFixed(1) : '—', unit: 'L/m', icon: 'speed', color: 'primary' },
  ];

  // Convert readings reverse for chronological time series representation
  const graphReadings = [...readings].reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 text-[10px] font-bold rounded uppercase border ${
              device.status === 'online' ? 'bg-status-nominal/10 text-status-nominal border-status-nominal/20' : 'bg-outline-variant/20 text-outline border-outline-variant'
            }`}>{device.status === 'online' ? 'Online' : 'Offline'}</span>
            <span className="text-label-sm text-outline">
              Last seen: {new Date(device.last_seen).toLocaleTimeString()}
            </span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">{device.name || id}</h2>
          <p className="text-on-surface-variant text-sm">ID: {device.device_id} • Location: {device.location}</p>
        </div>
        <div className="flex gap-2">
          <Link 
            to={`/admin/device/${id}/control`} 
            className="px-4 py-2 bg-primary text-on-primary text-label-sm font-bold primary-action-btn flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">valve</span> Control Solenoid
          </Link>
        </div>
      </div>

      {/* Metric Gauges Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="bg-surface-container-lowest border border-border-subtle p-4 rounded-lg shadow-sm hover:border-primary/30 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <span className={`material-symbols-outlined text-${m.color}`}>{m.icon}</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase">{m.label}</span>
            </div>
            <div className="text-center">
              <span className="text-headline-md font-black text-on-surface">{m.value}</span>
              {m.unit && <span className="text-label-sm text-on-surface-variant ml-1">{m.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Time Series Chart */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
        <h3 className="font-title-md text-title-md mb-6">WQI Trend History (Last {readings.length} readings)</h3>
        {graphReadings.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-outline">
            No telemetry logs available.
          </div>
        ) : (
          <div className="h-64 bg-surface-container rounded-lg flex items-end justify-between p-4 gap-1">
            {graphReadings.map((r, i) => {
              const score = r.quality_score;
              return (
                <div 
                  key={i} 
                  className={`flex-1 rounded-t-sm transition-all ${
                    score >= 80 ? 'bg-status-nominal/40 hover:bg-status-nominal/75' : 'bg-status-warning/40 hover:bg-status-warning/75'
                  }`} 
                  style={{ height: `${score}%` }}
                  title={`WQI: ${score} - ${new Date(r.timestamp).toLocaleTimeString()}`}
                ></div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between mt-4 text-label-sm text-on-surface-variant font-bold">
          <span>{graphReadings.length > 0 ? new Date(graphReadings[0].timestamp).toLocaleTimeString() : '—'}</span>
          <span>{graphReadings.length > 0 ? new Date(graphReadings[graphReadings.length - 1].timestamp).toLocaleTimeString() : '—'}</span>
        </div>
      </div>

      {/* Device Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
          <h3 className="font-title-md text-title-md mb-4">Device Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border-subtle/50">
              <span className="text-on-surface-variant">Firmware Version</span>
              <span className="font-bold font-mono">{device.firmware_version || 'v1.0.0'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border-subtle/50">
              <span className="text-on-surface-variant">Last Calibration</span>
              <span className="font-bold">
                {calibration?.last_calibration_at 
                  ? new Date(calibration.last_calibration_at).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border-subtle/50">
              <span className="text-on-surface-variant">Calibration Status</span>
              <span className={`font-bold ${calibration?.needs_calibration ? 'text-status-warning' : 'text-status-nominal'}`}>
                {calibration?.needs_calibration ? 'Needs Calibration' : 'Nominal'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border-subtle/50">
              <span className="text-on-surface-variant">Created At</span>
              <span className="font-bold">{new Date(device.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border-subtle/50">
              <span className="text-on-surface-variant">SD Memory Installed</span>
              <span className="font-bold">
                {device.last_sd_total_bytes 
                  ? `${(device.last_sd_total_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` 
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border-subtle/50">
              <span className="text-on-surface-variant">SD Memory Used</span>
              <span className="font-bold">
                {device.last_sd_used_bytes 
                  ? `${(device.last_sd_used_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB (${device.last_sd_usage_percent?.toFixed(1) || 0}%)` 
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
          <h3 className="font-title-md text-title-md mb-4">Recent Outlier Events</h3>
          <div className="space-y-3 max-h-[180px] overflow-y-auto custom-scrollbar">
            {readings.filter(r => r.anomaly_flags && Object.keys(r.anomaly_flags).length > 0).length === 0 ? (
              <p className="text-sm text-outline text-center py-6">No recent sensor anomaly events.</p>
            ) : (
              readings
                .filter(r => r.anomaly_flags && Object.keys(r.anomaly_flags).length > 0)
                .slice(0, 5)
                .map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-surface-container-low border border-border-subtle">
                    <span className="material-symbols-outlined text-status-warning mt-0.5">warning</span>
                    <div>
                      <p className="font-semibold text-sm">
                        Anomaly Flags: {Object.keys(r.anomaly_flags).join(', ')}
                      </p>
                      <p className="text-label-sm text-outline">
                        {new Date(r.timestamp).toLocaleTimeString()} • WQI: {r.quality_score}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
